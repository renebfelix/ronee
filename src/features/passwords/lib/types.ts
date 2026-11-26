export interface PasswordTag {
  id: string;
  name: string;
  color: string;
}

export interface PasswordEntry {
  id: string;
  name: string;
  url: string;
  /** Usuário ou e-mail de acesso (opcional). */
  username?: string;
  /** Senha cifrada com AES-GCM (ver lib/crypto.ts). Nunca é gravada em texto puro. */
  passwordCipher: string;
  description: string;
  tagIds: string[];
  createdAt: number;
  updatedAt: number;
}

/** Duração da sessão do cofre depois de digitar a senha de segurança. */
export const VAULT_SESSION_MS = 5 * 60 * 1000;
