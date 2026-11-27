import { NextResponse } from "next/server";
import type { DocumentReference } from "firebase-admin/firestore";
import { adminDb, adminMessaging } from "@/lib/firebase/admin";
import { addDays } from "@/features/calendar/lib/dates";
import { expandAll } from "@/features/calendar/lib/recurrence";
import { naiveMs, reminderBody, reminderTimes } from "@/features/calendar/lib/reminders";
import type { CalendarEvent } from "@/features/calendar/lib/types";

// Roda no runtime Node (padrão) e é sempre dinâmica, pois lê o cabeçalho Authorization.

type Device = { ref: DocumentReference; token: string; timeZone?: string };

const FALLBACK_TIME_ZONE = "America/Sao_Paulo";
/** Lembretes atrasados até este limite ainda são enviados (o agendador pode atrasar alguns minutos). */
const LATE_LIMIT_MIN = 30;
/** Maior antecedência possível de um lembrete (1 semana) + folga. */
const LOOKAHEAD_DAYS = 8;
/** Registros de envio mais antigos que isso são apagados. */
const SENT_RETENTION_MS = 14 * 24 * 60 * 60 * 1000;
const STALE_TOKEN_ERRORS = [
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
  "messaging/invalid-argument",
];

/** Data e hora atuais no fuso do aparelho, como data local "ingênua" em ms. */
function localNow(timeZone: string | undefined) {
  const options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  };
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-CA", { ...options, timeZone }).formatToParts();
  } catch {
    parts = new Intl.DateTimeFormat("en-CA", { ...options, timeZone: FALLBACK_TIME_ZONE }).formatToParts();
  }
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const date = `${get("year")}-${get("month")}-${get("day")}`;
  return { date, ms: naiveMs(date, `${get("hour")}:${get("minute")}`) };
}

/**
 * Chamada a cada 5 minutos por um cron (ver README). Para cada usuário com aparelhos em
 * `users/{uid}/modules/calendar/devices/{token}`, expande os eventos (inclusive recorrentes) e envia
 * os lembretes que venceram. Cada envio é registrado em `.../calendar/sent/{evento_data_minutos}`
 * com `create()`, que falha se já existir — assim nada é enviado duas vezes.
 */
export async function GET(request: Request) {
  const secret = process.env.RONEE_NEXT_PUBLIC_CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = adminDb();
  const messaging = adminMessaging();
  const result = { users: 0, devices: 0, reminders: 0, sent: 0, removed: 0, failed: 0 };

  const byUser = new Map<string, Device[]>();
  for (const snap of (await db.collectionGroup("devices").get()).docs) {
    // users/{uid}/modules/calendar/devices/{token}
    const s = snap.ref.path.split("/");
    if (s.length !== 6 || s[0] !== "users" || s[2] !== "modules" || s[3] !== "calendar") continue;
    const data = snap.data() as { token?: string; timeZone?: string };
    if (!data.token) continue;
    byUser.set(s[1], [...(byUser.get(s[1]) ?? []), { ref: snap.ref, token: data.token, timeZone: data.timeZone }]);
    result.devices++;
  }

  await Promise.all(
    [...byUser].map(async ([uid, devices]) => {
      result.users++;
      const base = db.doc(`users/${uid}/modules/calendar`);
      const now = localNow(devices[0].timeZone);

      const events = (await base.collection("events").get()).docs
        .map((d) => ({ exceptions: [], reminders: [], ...(d.data() as Partial<CalendarEvent>), id: d.id }) as CalendarEvent)
        .filter((e) => e.reminders?.length);
      if (!events.length) return;

      const occurrences = expandAll(events, addDays(now.date, -1), addDays(now.date, LOOKAHEAD_DAYS));
      const due = occurrences.flatMap((o) =>
        reminderTimes(o)
          .filter(({ at }) => at <= now.ms && at > now.ms - LATE_LIMIT_MIN * 60_000)
          .map(({ offset }) => ({ o, offset })),
      );

      for (const { o, offset } of due) {
        result.reminders++;
        const key = `${o.event.id}_${o.startDate}_${offset}`;
        try {
          await base.collection("sent").doc(key).create({ sentAt: Date.now() });
        } catch {
          continue; // Já enviado em uma execução anterior.
        }

        await Promise.all(
          devices.map(async (device) => {
            try {
              await messaging.send({
                token: device.token,
                data: {
                  title: o.event.title,
                  body: reminderBody(o, offset),
                  url: `/agenda/calendario?dia=${o.startDate}`,
                  tag: `ronee-agenda-${key}`,
                },
                webpush: { headers: { Urgency: "high", TTL: String(LATE_LIMIT_MIN * 60) } },
              });
              result.sent++;
            } catch (error) {
              const code = (error as { code?: string }).code ?? "";
              if (STALE_TOKEN_ERRORS.includes(code)) {
                await device.ref.delete();
                result.removed++;
              } else {
                result.failed++;
              }
            }
          }),
        );
      }

      // Limpeza dos registros antigos de envio.
      const old = await base.collection("sent").where("sentAt", "<", Date.now() - SENT_RETENTION_MS).limit(100).get();
      await Promise.all(old.docs.map((d) => d.ref.delete()));
    }),
  );

  return NextResponse.json(result);
}
