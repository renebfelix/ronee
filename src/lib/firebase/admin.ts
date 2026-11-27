// Usado só no servidor (rotas de API). Não exporte este arquivo pelo index de src/lib/firebase.
import { cert, getApp, getApps, initializeApp, type App, type ServiceAccount } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

// Conta de serviço (Configurações do projeto → Contas de serviço → Gerar nova chave privada),
// em JSON puro, base64 ou URL-encoded (aceita também base64 de um JSON URL-encoded),
// na variável RONEE_NEXT_PUBLIC_FIREBASE_SERVICE_ACCOUNT. Precisa ser do mesmo projeto do app.
const VAR = "RONEE_NEXT_PUBLIC_FIREBASE_SERVICE_ACCOUNT";

function decode(raw: string) {
  let text = raw.trim().replace(/^["']|["']$/g, "");
  if (!text.startsWith("{") && !text.startsWith("%7B")) text = Buffer.from(text, "base64").toString("utf8");
  if (text.startsWith("%7B")) text = decodeURIComponent(text);
  return JSON.parse(text) as { project_id?: string };
}

function credentials() {
  const raw = process.env[VAR];
  if (!raw) throw new Error(`${VAR} não configurada`);
  let account: { project_id?: string };
  try {
    account = decode(raw);
  } catch {
    throw new Error(`${VAR} inválida: use o JSON da conta de serviço (em uma linha, base64 ou URL-encoded).`);
  }
  // Uma conta de outro projeto leria outro Firestore e o FCM recusaria os tokens do app.
  const appProject = process.env.RONEE_NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (appProject && account.project_id !== appProject) {
    throw new Error(`${VAR} é do projeto "${account.project_id}", mas o app usa "${appProject}". Gere a chave no projeto do app.`);
  }
  return cert(account as ServiceAccount);
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
