"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { collection, deleteDoc, doc, getDoc, onSnapshot, setDoc, writeBatch } from "firebase/firestore";
import { useAuth } from "@/components/providers";
import { Alert, Spinner } from "@/components/ui";
import { getDb } from "@/lib/firebase";
import { hashVaultPassword, isVaultKeyConfigured, verifyVaultPassword, type VaultHash } from "../lib/crypto";
import { VAULT_SESSION_MS, type PasswordEntry, type PasswordTag } from "../lib/types";
import { LockScreen } from "../components/LockScreen";

/**
 * Coleções do cofre em `users/{uid}/modules/passwords/{coleção}`.
 * O documento `users/{uid}/modules/passwords` guarda o hash da senha de segurança (`vault`).
 */
export type VaultCol = "entries" | "tags";

export interface VaultData {
  entries: PasswordEntry[];
  tags: PasswordTag[];
  /** Momento (ms) em que o cofre volta a bloquear. */
  expiresAt: number;
  lock: () => void;
  newId: (col: VaultCol) => string;
  save: <T extends { id: string }>(col: VaultCol, item: T) => Promise<void>;
  remove: (col: VaultCol, id: string) => Promise<void>;
  /** Exclui a tag e a retira de todas as senhas que a usam. */
  removeTag: (id: string) => Promise<void>;
  /** Troca a senha de segurança (exige a atual). Devolve false se a atual estiver errada. */
  changeVaultPassword: (current: string, next: string) => Promise<boolean>;
}

const VaultContext = createContext<VaultData | null>(null);

/**
 * Fim da sessão desbloqueada, por usuário. Fica só na memória da aba: sobrevive à navegação
 * entre páginas, mas recarregar a página ou fechar a aba bloqueia o cofre.
 */
const sessions = new Map<string, number>();

function clean<T>(value: T): T {
  if (Array.isArray(value)) return value.map(clean) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, clean(v)]),
    ) as T;
  }
  return value;
}

function Centered({ label }: { label: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "4rem 0", color: "var(--color-primary)" }}>
      <Spinner label={label} />
    </div>
  );
}

/** Protege todas as rotas em /senhas com a senha de segurança e a sessão de 5 minutos. */
export function VaultProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const uid = user!.uid;
  const [vault, setVault] = useState<VaultHash | null | undefined>(undefined);
  const [loadError, setLoadError] = useState(false);
  const [expiresAt, setExpiresAt] = useState(() => {
    const until = sessions.get(uid) ?? 0;
    return until > Date.now() ? until : 0;
  });

  const moduleDoc = useCallback(() => doc(getDb(), "users", uid, "modules", "passwords"), [uid]);

  useEffect(() => {
    getDoc(moduleDoc())
      .then((snap) => setVault((snap.data()?.vault as VaultHash | undefined) ?? null))
      .catch(() => setLoadError(true));
  }, [moduleDoc]);

  const lock = useCallback(() => {
    sessions.delete(uid);
    setExpiresAt(0);
  }, [uid]);

  const startSession = useCallback(() => {
    const until = Date.now() + VAULT_SESSION_MS;
    sessions.set(uid, until);
    setExpiresAt(until);
  }, [uid]);

  /* Bloqueia ao fim dos 5 minutos (também ao voltar para a aba depois de suspensa). */
  useEffect(() => {
    if (!expiresAt) return;
    const check = () => Date.now() >= expiresAt && lock();
    const timer = window.setTimeout(lock, Math.max(0, expiresAt - Date.now()));
    document.addEventListener("visibilitychange", check);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", check);
    };
  }, [expiresAt, lock]);

  const unlock = useCallback(
    async (password: string) => {
      if (!vault) return false;
      const ok = await verifyVaultPassword(password, vault);
      if (ok) startSession();
      return ok;
    },
    [vault, startSession],
  );

  const create = useCallback(
    async (password: string) => {
      const hash = await hashVaultPassword(password);
      await setDoc(moduleDoc(), { vault: hash }, { merge: true });
      setVault(hash);
      startSession();
    },
    [moduleDoc, startSession],
  );

  const changeVaultPassword = useCallback(
    async (current: string, next: string) => {
      if (!vault || !(await verifyVaultPassword(current, vault))) return false;
      const hash = await hashVaultPassword(next);
      await setDoc(moduleDoc(), { vault: hash }, { merge: true });
      setVault(hash);
      startSession();
      return true;
    },
    [vault, moduleDoc, startSession],
  );

  if (!isVaultKeyConfigured) {
    return (
      <Alert tone="danger" title="Chave do cofre não configurada">
        Defina <code>RONEE_NEXT_PUBLIC_VAULT_KEY</code> no <code>.env</code> com 32 bytes em base64 (veja o{" "}
        <code>.env.example</code>) e reinicie o servidor.
      </Alert>
    );
  }
  if (loadError) {
    return (
      <Alert tone="danger" title="Não foi possível abrir o cofre">
        Verifique sua conexão e se as regras do Firestore permitem acesso a <code>{"users/{uid}/**"}</code>.
      </Alert>
    );
  }
  if (vault === undefined) return <Centered label="Abrindo o cofre" />;
  if (!expiresAt) {
    return vault ? <LockScreen mode="unlock" onUnlock={unlock} /> : <LockScreen mode="create" onCreate={create} />;
  }

  return (
    <UnlockedVault uid={uid} expiresAt={expiresAt} lock={lock} changeVaultPassword={changeVaultPassword}>
      {children}
    </UnlockedVault>
  );
}

/** Dados do cofre em tempo real; só existe (e só assina o Firestore) enquanto está desbloqueado. */
function UnlockedVault({
  uid,
  expiresAt,
  lock,
  changeVaultPassword,
  children,
}: Pick<VaultData, "expiresAt" | "lock" | "changeVaultPassword"> & { uid: string; children: ReactNode }) {
  const [entries, setEntries] = useState<PasswordEntry[] | null>(null);
  const [tags, setTags] = useState<PasswordTag[] | null>(null);
  const [error, setError] = useState(false);

  const colRef = useCallback((name: VaultCol) => collection(getDb(), "users", uid, "modules", "passwords", name), [uid]);
  const docRef = useCallback((name: VaultCol, id: string) => doc(colRef(name), id), [colRef]);

  useEffect(() => {
    const onErr = () => setError(true);
    const u1 = onSnapshot(colRef("entries"), (s) => setEntries(s.docs.map((d) => d.data() as PasswordEntry)), onErr);
    const u2 = onSnapshot(colRef("tags"), (s) => setTags(s.docs.map((d) => d.data() as PasswordTag)), onErr);
    return () => {
      u1();
      u2();
    };
  }, [colRef]);

  const newId = useCallback((name: VaultCol) => doc(colRef(name)).id, [colRef]);
  const save = useCallback(
    async <T extends { id: string }>(name: VaultCol, item: T) => {
      await setDoc(docRef(name, item.id), clean(item));
    },
    [docRef],
  );
  const remove = useCallback(async (name: VaultCol, id: string) => deleteDoc(docRef(name, id)), [docRef]);
  const removeTag = useCallback(
    async (id: string) => {
      const batch = writeBatch(getDb());
      (entries ?? [])
        .filter((e) => e.tagIds.includes(id))
        .forEach((e) => batch.update(docRef("entries", e.id), { tagIds: e.tagIds.filter((t) => t !== id) }));
      batch.delete(docRef("tags", id));
      await batch.commit();
    },
    [entries, docRef],
  );

  if (error) {
    return (
      <Alert tone="danger" title="Não foi possível carregar suas senhas">
        Verifique sua conexão e se as regras do Firestore permitem acesso a <code>{"users/{uid}/**"}</code>.
      </Alert>
    );
  }
  if (!entries || !tags) return <Centered label="Carregando suas senhas" />;

  const value: VaultData = { entries, tags, expiresAt, lock, newId, save, remove, removeTag, changeVaultPassword };
  return <VaultContext.Provider value={value}>{children}</VaultContext.Provider>;
}

export function useVault(): VaultData {
  const ctx = useContext(VaultContext);
  if (!ctx) throw new Error("useVault precisa ser usado dentro de <VaultProvider>.");
  return ctx;
}
