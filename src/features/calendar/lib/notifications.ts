import { deleteDoc, doc, setDoc } from "firebase/firestore";
import { requestPushToken } from "@/features/tasks/lib/notifications";
import { getDb } from "@/lib/firebase";

/**
 * Aparelhos que recebem os lembretes da Agenda: `users/{uid}/modules/calendar/devices/{token}`.
 * Independente do resumo diário de Tarefas (que usa o mesmo token FCM em outro documento).
 * A rota /api/cron/agenda lê esses documentos e envia os lembretes de cada evento.
 */
export type CalendarPush = { token: string };

const STORAGE_KEY = "ronee:calendar:push";

export function loadCalendarPush(): CalendarPush | null {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    return saved?.token ? saved : null;
  } catch {
    return null;
  }
}

function save(settings: CalendarPush | null) {
  try {
    if (settings) localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

function deviceDoc(uid: string, token: string) {
  return doc(getDb(), "users", uid, "modules", "calendar", "devices", token);
}

export async function enableCalendarPush(uid: string): Promise<CalendarPush> {
  const token = await requestPushToken();
  const previous = loadCalendarPush();
  // O token pode mudar (renovação do FCM): tira o aparelho antigo para não duplicar avisos.
  if (previous && previous.token !== token) await deleteDoc(deviceDoc(uid, previous.token)).catch(() => {});
  await setDoc(
    deviceDoc(uid, token),
    { token, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, updatedAt: Date.now() },
    { merge: true },
  );
  const settings = { token };
  save(settings);
  return settings;
}

export async function disableCalendarPush(uid: string, settings: CalendarPush) {
  save(null);
  await deleteDoc(deviceDoc(uid, settings.token));
}
