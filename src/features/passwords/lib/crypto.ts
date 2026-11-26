/**
 * Criptografia do cofre de senhas (Web Crypto, só no navegador).
 *
 * - As senhas salvas são cifradas com AES-256-GCM. A chave vem da variável de ambiente
 *   RONEE_NEXT_PUBLIC_VAULT_KEY (32 bytes em base64) e nunca é gravada no Firestore.
 * - A senha de segurança do cofre é guardada só como hash PBKDF2-SHA256 com salt.
 *
 * Formato do texto cifrado: `v1:<iv base64>:<dados base64>`.
 */

const VAULT_KEY_B64 = process.env.RONEE_NEXT_PUBLIC_VAULT_KEY ?? "";
const PBKDF2_ITERATIONS = 310_000;

const enc = new TextEncoder();
const dec = new TextDecoder();

function toB64(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (let i = 0; i < arr.length; i++) s += String.fromCharCode(arr[i]);
  return btoa(s);
}

function fromB64(b64: string): Uint8Array<ArrayBuffer> {
  const s = atob(b64);
  const arr = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) arr[i] = s.charCodeAt(i);
  return arr;
}

function keyBytes(): Uint8Array<ArrayBuffer> | null {
  try {
    const bytes = fromB64(VAULT_KEY_B64.trim());
    return bytes.length === 32 ? bytes : null;
  } catch {
    return null;
  }
}

/** A chave do cofre está presente e válida (32 bytes em base64). */
export const isVaultKeyConfigured = keyBytes() !== null;

let cachedKey: Promise<CryptoKey> | null = null;
function aesKey(): Promise<CryptoKey> {
  const raw = keyBytes();
  if (!raw) return Promise.reject(new Error("Chave do cofre não configurada (RONEE_NEXT_PUBLIC_VAULT_KEY)."));
  cachedKey ??= crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
  return cachedKey;
}

export async function encryptSecret(plain: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await aesKey(), enc.encode(plain));
  return `v1:${toB64(iv)}:${toB64(data)}`;
}

export async function decryptSecret(cipher: string): Promise<string> {
  const [version, iv, data] = cipher.split(":");
  if (version !== "v1" || !iv || !data) throw new Error("Formato de senha cifrada desconhecido.");
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromB64(iv) }, await aesKey(), fromB64(data));
  return dec.decode(plain);
}

/** Hash da senha de segurança do cofre (gravado no Firestore). */
export interface VaultHash {
  salt: string;
  hash: string;
  iterations: number;
}

async function pbkdf2(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<Uint8Array> {
  const base = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, base, 256);
  return new Uint8Array(bits);
}

export async function hashVaultPassword(password: string): Promise<VaultHash> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(password, salt, PBKDF2_ITERATIONS);
  return { salt: toB64(salt), hash: toB64(hash), iterations: PBKDF2_ITERATIONS };
}

export async function verifyVaultPassword(password: string, stored: VaultHash): Promise<boolean> {
  const hash = await pbkdf2(password, fromB64(stored.salt), stored.iterations);
  const expected = fromB64(stored.hash);
  if (hash.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < hash.length; i++) diff |= hash[i] ^ expected[i];
  return diff === 0;
}
