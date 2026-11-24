import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  updateProfile,
} from "firebase/auth";
import { FirebaseError } from "firebase/app";
import { getFirebaseAuth } from "./client";

export async function signInWithEmail(email: string, password: string) {
  return signInWithEmailAndPassword(getFirebaseAuth(), email, password);
}

export async function signUpWithEmail(name: string, email: string, password: string) {
  const credential = await createUserWithEmailAndPassword(getFirebaseAuth(), email, password);
  if (name) await updateProfile(credential.user, { displayName: name });
  return credential;
}

export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  return signInWithPopup(getFirebaseAuth(), provider);
}

export async function resetPassword(email: string) {
  return sendPasswordResetEmail(getFirebaseAuth(), email);
}

export async function signOut() {
  return firebaseSignOut(getFirebaseAuth());
}

const AUTH_ERRORS: Record<string, string> = {
  "auth/invalid-email": "E-mail inválido.",
  "auth/invalid-credential": "E-mail ou senha incorretos.",
  "auth/user-not-found": "E-mail ou senha incorretos.",
  "auth/wrong-password": "E-mail ou senha incorretos.",
  "auth/user-disabled": "Esta conta foi desativada.",
  "auth/email-already-in-use": "Já existe uma conta com este e-mail.",
  "auth/weak-password": "A senha precisa ter pelo menos 6 caracteres.",
  "auth/too-many-requests": "Muitas tentativas. Aguarde um pouco e tente novamente.",
  "auth/network-request-failed": "Falha de conexão. Verifique sua internet.",
  "auth/popup-closed-by-user": "A janela de login foi fechada antes de concluir.",
  "auth/popup-blocked": "O navegador bloqueou a janela de login. Permita pop-ups e tente novamente.",
  "auth/operation-not-allowed": "Este método de login não está habilitado no Firebase.",
  "auth/invalid-api-key": "Chave de API do Firebase inválida. Verifique o .env.local.",
};

/** Converte erros do Firebase Auth em mensagens amigáveis em português. */
export function getAuthErrorMessage(error: unknown): string {
  if (error instanceof FirebaseError) {
    return AUTH_ERRORS[error.code] ?? "Não foi possível concluir. Tente novamente.";
  }
  if (error instanceof Error) return error.message;
  return "Ocorreu um erro inesperado.";
}
