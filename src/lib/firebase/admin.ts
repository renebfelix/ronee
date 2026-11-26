// Usado só no servidor (rotas de API). Não exporte este arquivo pelo index de src/lib/firebase.
import { cert, getApp, getApps, initializeApp, type App } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

// Conta de serviço (Configurações do projeto → Contas de serviço → Gerar nova chave privada),
// em JSON puro ou em base64, na variável RONEE_FIREBASE_SERVICE_ACCOUNT.
function credentials() {
  const raw = process.env.RONEE_FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error("RONEE_FIREBASE_SERVICE_ACCOUNT não configurada");
  const json = raw.trim().startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
  return cert(JSON.parse(json));
}

function adminApp(): App {
  return getApps().length ? getApp() : initializeApp({ credential: credentials() });
}

export function adminDb() {
  return getFirestore(adminApp());
}

export function adminMessaging() {
  return getMessaging(adminApp());
}
