import { deleteDoc, doc, setDoc } from "firebase/firestore";
import { deleteToken, getMessaging, getToken, isSupported } from "firebase/messaging";
import { getDb, getFirebaseApp } from "@/lib/firebase";

/**
 * Cada aparelho com push ativo vira um documento em `users/{uid}/modules/tasks/devices/{token}`;
 * a rota /api/cron/tarefas lê esses documentos e envia o resumo do dia no horário escolhido.
 */
export type PushSettings = { token: string; hour: number };

const STORAGE_KEY = "ronee:tasks:push";
const vapidKey = process.env.RONEE_NEXT_PUBLIC_FIREBASE_VAPID_KEY;

export const DEFAULT_HOUR = 8;

export async function isPushSupported() {
  if (typeof window === "undefined" || !("Notification" in window) || !("serviceWorker" in navigator)) {
    return false;
  }
  return Boolean(vapidKey) && (await isSupported().catch(() => false));
}

export function loadPushSettings(): PushSettings | null {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    return saved?.token && Number.isInteger(saved.hour) ? saved : null;
  } catch {
    return null;
  }
}

function savePushSettings(settings: PushSettings | null) {
  try {
    if (settings) localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

function deviceDoc(uid: string, token: string) {
  return doc(getDb(), "users", uid, "modules", "tasks", "devices", token);
}

/**
 * Em produção o ServiceWorkerRegister já registrou o worker; em dev ele é registrado aqui,
 * com "?dev" para só cuidar das notificações (sem cache).
 */
async function registration() {
  const url = process.env.NODE_ENV === "production" ? "/sw.js" : "/sw.js?dev";
  if (!(await navigator.serviceWorker.getRegistration("/"))) {
    await navigator.serviceWorker.register(url, { scope: "/" });
  }
  return navigator.serviceWorker.ready;
}

export async function enablePush(uid: string, hour: number): Promise<PushSettings> {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("permission-denied");

  const token = await getToken(getMessaging(getFirebaseApp()), {
    vapidKey,
    serviceWorkerRegistration: await registration(),
  });
  await setDoc(
    deviceDoc(uid, token),
    {
      token,
      hour,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      updatedAt: Date.now(),
    },
    { merge: true },
  );
  const settings = { token, hour };
  savePushSettings(settings);
  return settings;
}

export async function disablePush(uid: string, settings: PushSettings) {
  savePushSettings(null);
  await deleteDoc(deviceDoc(uid, settings.token));
  await deleteToken(getMessaging(getFirebaseApp())).catch(() => {});
}

/** Mostra uma notificação local para conferir se o aparelho está exibindo os avisos. */
export async function showTestNotification() {
  const reg = await registration();
  await reg.showNotification("Ronee — Tarefas", {
    body: "Tudo certo! Você vai receber o resumo das suas tarefas aqui.",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
  });
}
