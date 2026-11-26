import {
  EmailAuthProvider,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  linkWithCredential,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  updatePassword,
  updateProfile,
  type User,
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

/** O usuário já pode entrar com e-mail e senha? */
export function hasPasswordProvider(user: User) {
  return user.providerData.some((p) => p.providerId === EmailAuthProvider.PROVIDER_ID);
}

/** O usuário entra com o Google? */
export function hasGoogleProvider(user: User) {
  return user.providerData.some((p) => p.providerId === GoogleAuthProvider.PROVIDER_ID);
}

/** Pede ao Google uma nova confirmação (o Firebase exige login recente para operações sensíveis). */
async function reauthenticate(user: User) {
  if (!hasGoogleProvider(user)) {
    throw new FirebaseError("auth/requires-recent-login", "Login recente necessário.");
  }
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account", login_hint: user.email ?? "" });
  const result = await reauthenticateWithPopup(user, provider);
  if (result.user.email?.toLowerCase() !== user.email?.toLowerCase()) {
    throw new FirebaseError("auth/user-mismatch", "Conta diferente.");
  }
}

async function withRecentLogin<T>(user: User, action: () => Promise<T>): Promise<T> {
  try {
    return await action();
  } catch (err) {
    if (err instanceof FirebaseError && err.code === "auth/requires-recent-login") {
      await reauthenticate(user);
      return action();
    }
    throw err;
  }
}

/**
 * Cria uma senha para a conta atual, usando o MESMO e-mail da conta (ex.: o do Google).
 * Depois disso a conta pode ser acessada tanto pelo Google quanto por e-mail e senha.
 */
export async function createAccountPassword(user: User, password: string) {
  if (!user.email) throw new FirebaseError("auth/missing-email", "Conta sem e-mail.");
  const credential = EmailAuthProvider.credential(user.email, password);
  await withRecentLogin(user, () => linkWithCredential(user, credential));
  await user.reload();
}

/** Troca a senha de uma conta que já tem login por e-mail e senha. */
export async function changeAccountPassword(user: User, currentPassword: string, newPassword: string) {
  if (!user.email) throw new FirebaseError("auth/missing-email", "Conta sem e-mail.");
  await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, currentPassword));
  await updatePassword(user, newPassword);
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
  "auth/provider-already-linked": "Esta conta já tem uma senha cadastrada.",
  "auth/credential-already-in-use": "Este e-mail já está vinculado a outra conta.",
  "auth/requires-recent-login": "Por segurança, saia e entre novamente antes de continuar.",
  "auth/user-mismatch": "Confirme usando a mesma conta Google com que você está logado.",
  "auth/missing-email": "Sua conta não tem um e-mail associado.",
  "auth/missing-password": "Informe a senha.",
};

/** Converte erros do Firebase Auth em mensagens amigáveis em português. */
export function getAuthErrorMessage(error: unknown): string {
  if (error instanceof FirebaseError) {
    return AUTH_ERRORS[error.code] ?? "Não foi possível concluir. Tente novamente.";
  }
  if (error instanceof Error) return error.message;
  return "Ocorreu um erro inesperado.";
}
