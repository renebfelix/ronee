"use client";

import { useEffect, useRef, useState } from "react";
import { collection, doc, onSnapshot, query, where, writeBatch, type WriteBatch } from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import type { Category, Occurrence, Responsible, ShareDoc, ShareMonthDoc } from "../lib/types";
import { buildShareMonths, hashOf, summarize } from "../lib/share";

interface Args {
  /** false: não lê nem grava nada (outro provider já cuida da sincronização). */
  enabled?: boolean;
  uid: string;
  ownerName: string | null;
  loading: boolean;
  responsibles: Responsible[];
  occurrences: Occurrence[];
  catById: (id: string) => Category | undefined;
  methodName: (o: Occurrence) => string;
}

/** JSON com chaves ordenadas: o Firestore não preserva a ordem dos campos. */
const stable = (v: unknown): string => {
  if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o)
      .filter((k) => o[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stable(o[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(v);
};

/** Compara o documento salvo com o desejado, ignorando a data de atualização. */
const comparable = (s: Omit<ShareDoc, "updatedAt"> & { updatedAt?: number }) => stable({ ...s, updatedAt: undefined });

/**
 * Mantém `shares/{shareId}` (e os meses) em dia com os dados do dono.
 * A página pública não acessa `users/…`: ela só lê esse espelho, filtrado por responsável.
 */
export function useShareSync({ enabled = true, uid, ownerName, loading, responsibles, occurrences, catById, methodName }: Args) {
  const [shares, setShares] = useState<Record<string, ShareDoc> | null>(null);
  const running = useRef(false);
  const again = useRef(false);
  const latest = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    if (!enabled) return;
    return onSnapshot(
      query(collection(getDb(), "shares"), where("ownerUid", "==", uid)),
      (snap) => setShares(Object.fromEntries(snap.docs.map((d) => [d.id, d.data() as ShareDoc]))),
      (e) => console.error("Falha ao ler os links de responsáveis", e),
    );
  }, [uid, enabled]);

  useEffect(() => {
    if (!enabled || loading || !shares) return;
    const db = getDb();

    const sync = async () => {
      if (running.current) {
        again.current = true;
        return;
      }
      running.current = true;
      try {
        const ops: ((b: WriteBatch) => void)[] = [];
        const kept = new Set<string>();

        for (const r of responsibles) {
          if (!r.shareId) {
            // Gera o link uma única vez; a próxima rodada publica o conteúdo.
            const shareId = doc(collection(db, "shares")).id;
            ops.push((b) =>
              b.set(
                doc(db, "users", uid, "modules", "finance", "responsibles", r.id),
                { shareId, shareMode: r.shareMode ?? "PRIVATE" },
                { merge: true },
              ),
            );
            continue;
          }
          kept.add(r.shareId);
          const months = buildShareMonths(r, occurrences, catById, methodName);
          const prev = shares[r.shareId];
          const hashes = Object.fromEntries(Object.entries(months).map(([ym, items]) => [ym, hashOf(JSON.stringify(items))]));
          const next: Omit<ShareDoc, "updatedAt"> = {
            id: r.shareId,
            ownerUid: uid,
            ownerName,
            responsibleId: r.id,
            name: r.name,
            avatarUrl: r.avatarUrl ?? null,
            mode: r.shareMode ?? "PRIVATE",
            // O e-mail só vai para o espelho quando é usado na regra de acesso.
            email: r.shareMode === "EMAIL" ? r.email?.trim().toLowerCase() || null : null,
            months: Object.fromEntries(Object.entries(months).map(([ym, items]) => [ym, summarize(items)])),
            hashes,
          };
          const shareRef = doc(db, "shares", r.shareId);
          if (!prev || comparable(prev) !== comparable(next)) {
            ops.push((b) => b.set(shareRef, { ...next, updatedAt: Date.now() }));
          }
          for (const [ym, items] of Object.entries(months)) {
            if (prev?.hashes?.[ym] === hashes[ym]) continue;
            const data: ShareMonthDoc = { ownerUid: uid, monthYear: ym, items: JSON.parse(JSON.stringify(items)) };
            ops.push((b) => b.set(doc(shareRef, "months", ym), data));
          }
          for (const ym of Object.keys(prev?.hashes ?? {})) {
            if (!months[ym]) ops.push((b) => b.delete(doc(shareRef, "months", ym)));
          }
        }

        // Links de responsáveis excluídos ou regenerados deixam de existir.
        for (const [id, s] of Object.entries(shares)) {
          if (kept.has(id)) continue;
          const shareRef = doc(db, "shares", id);
          for (const ym of Object.keys(s.hashes ?? {})) ops.push((b) => b.delete(doc(shareRef, "months", ym)));
          ops.push((b) => b.delete(shareRef));
        }

        for (let i = 0; i < ops.length; i += 400) {
          const batch = writeBatch(db);
          ops.slice(i, i + 400).forEach((op) => op(batch));
          await batch.commit();
        }
      } catch (e) {
        console.error("Falha ao atualizar links de responsáveis", e);
      } finally {
        running.current = false;
        if (again.current) {
          again.current = false;
          void latest.current?.();
        }
      }
    };

    latest.current = sync;
    const t = setTimeout(sync, 1000);
    return () => clearTimeout(t);
  }, [enabled, uid, ownerName, loading, shares, responsibles, occurrences, catById, methodName]);
}
