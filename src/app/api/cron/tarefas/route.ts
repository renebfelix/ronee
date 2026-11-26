import { NextResponse } from "next/server";
import { adminDb, adminMessaging } from "@/lib/firebase/admin";

// Roda no runtime Node (padrão) e é sempre dinâmica, pois lê o cabeçalho Authorization.

type Device = { token: string; hour: number; timeZone?: string; lastSentDate?: string };
type PendingTask = { title: string; dueDate: string };

const FALLBACK_TIME_ZONE = "America/Sao_Paulo";
// Tokens que o FCM não aceita mais: o aparelho desinstalou o app ou revogou a permissão.
const STALE_TOKEN_ERRORS = [
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
  "messaging/invalid-argument",
];

/** Data (AAAA-MM-DD) e hora atuais no fuso do aparelho. */
function localNow(timeZone: string | undefined) {
  const options: Intl.DateTimeFormatOptions = { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" };
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-CA", { ...options, timeZone }).formatToParts();
  } catch {
    parts = new Intl.DateTimeFormat("en-CA", { ...options, timeZone: FALLBACK_TIME_ZONE }).formatToParts();
  }
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, hour: Number(get("hour")) };
}

function listTitles(tasks: PendingTask[]) {
  const titles = tasks.slice(0, 3).map((t) => t.title);
  const rest = tasks.length - titles.length;
  return rest > 0 ? `${titles.join(", ")} e mais ${rest}` : titles.join(", ");
}

function buildMessage(tasks: PendingTask[], date: string) {
  const today = tasks.filter((t) => t.dueDate === date);
  const overdue = tasks.filter((t) => t.dueDate < date);
  const lines = [];
  if (today.length) lines.push(`Hoje: ${listTitles(today)}`);
  if (overdue.length) lines.push(`${overdue.length} ${overdue.length === 1 ? "tarefa atrasada" : "tarefas atrasadas"}`);
  const title = today.length
    ? `Você tem ${today.length} ${today.length === 1 ? "tarefa" : "tarefas"} para hoje`
    : "Você tem tarefas atrasadas";
  return { title, body: lines.join("\n") };
}

/**
 * Chamada de hora em hora por um cron (ver README). Para cada aparelho, envia uma vez por dia,
 * na primeira execução a partir do horário escolhido, o resumo das tarefas de hoje e atrasadas.
 * Aparelhos ficam em `users/{uid}/modules/tasks/devices/{token}`.
 */
export async function GET(request: Request) {
  const secret = process.env.RONEE_CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = adminDb();
  const messaging = adminMessaging();
  const pendingByUser = new Map<string, Promise<PendingTask[]>>();
  const result = { checked: 0, sent: 0, removed: 0, failed: 0 };

  function pendingTasks(uid: string) {
    if (!pendingByUser.has(uid)) {
      pendingByUser.set(
        uid,
        db
          .collection(`users/${uid}/modules/tasks/tasks`)
          .where("done", "==", false)
          .get()
          .then((snap) =>
            snap.docs
              .map((d) => d.data() as Partial<PendingTask>)
              .filter((t): t is PendingTask => Boolean(t.title && t.dueDate)),
          ),
      );
    }
    return pendingByUser.get(uid)!;
  }

  const devices = await db.collectionGroup("devices").get();

  await Promise.all(
    devices.docs.map(async (snap) => {
      // users/{uid}/modules/tasks/devices/{token}
      const segments = snap.ref.path.split("/");
      if (segments.length !== 6 || segments[0] !== "users" || segments[2] !== "modules" || segments[3] !== "tasks") return;
      const uid = segments[1];
      const device = snap.data() as Device;
      if (!device.token) return;
      result.checked++;

      const now = localNow(device.timeZone);
      if (now.hour < device.hour || device.lastSentDate === now.date) return;

      const due = (await pendingTasks(uid)).filter((t) => t.dueDate <= now.date);
      if (due.length) {
        try {
          await messaging.send({
            token: device.token,
            data: { ...buildMessage(due, now.date), url: "/tarefas/lista", tag: `ronee-tasks-${now.date}` },
            webpush: { headers: { Urgency: "high", TTL: String(12 * 60 * 60) } },
          });
          result.sent++;
        } catch (error) {
          const code = (error as { code?: string }).code ?? "";
          if (STALE_TOKEN_ERRORS.includes(code)) {
            await snap.ref.delete();
            result.removed++;
          } else {
            result.failed++;
          }
          return;
        }
      }
      // Marca o dia como resolvido mesmo sem tarefas, para não consultar de novo até amanhã.
      await snap.ref.update({ lastSentDate: now.date });
    }),
  );

  return NextResponse.json(result);
}
