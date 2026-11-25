"use client";

import { useEffect, useState } from "react";
import { Button, Modal } from "@/components/ui";
import { useFinance } from "../data/FinanceDataProvider";
import { ME_ID, SETTINGS_ID, type Occurrence, type UserSettings } from "../lib/types";
import { addMonths, monthOf } from "../lib/finance";
import { brl, byName, dateBR, monthLabel, parseMoney } from "../lib/format";
import { ErrorText, Field, ui } from "./kit";

const SAVE_ERROR = "Não foi possível salvar. Verifique sua conexão e tente de novo.";

/* ───────────── Excluir lançamento ───────────── */

export function DeleteTransactionModal({ occ, onClose }: { occ: Occurrence | null; onClose: () => void }) {
  const d = useFinance();
  const [busy, setBusy] = useState(false);
  if (!occ) return null;
  const tx = occ.tx;
  const group = tx.parentTransactionId ? d.transactions.filter((t) => t.parentTransactionId === tx.parentTransactionId) : [tx];

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Excluir lançamento"
      footer={
        <Button variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
      }
    >
      <div className={ui.stackTight}>
        <p className={ui.hint} style={{ fontSize: "0.875rem", marginBottom: 8 }}>
          “{tx.title}” — escolha o que remover:
        </p>
        {tx.frequency === "INSTALLMENT" && (
          <>
            <Button variant="danger" disabled={busy} onClick={() => run(() => d.remove("transactions", tx.id))}>
              Só esta parcela ({tx.currentInstallment}/{tx.installmentsCount})
            </Button>
            <Button
              variant="danger"
              disabled={busy}
              onClick={() =>
                run(() =>
                  d.removeMany(
                    "transactions",
                    group.filter((t) => (t.currentInstallment ?? 0) >= (tx.currentInstallment ?? 0)).map((t) => t.id),
                  ),
                )
              }
            >
              Esta e as próximas parcelas
            </Button>
            <Button
              variant="danger"
              disabled={busy}
              onClick={() =>
                run(() =>
                  d.removeMany(
                    "transactions",
                    group.map((t) => t.id),
                  ),
                )
              }
            >
              Todas as {tx.installmentsCount} parcelas
            </Button>
          </>
        )}
        {tx.frequency === "FIXED" && (
          <>
            {addMonths(occ.baseMonth, -1) >= monthOf(tx.date) && (
              <Button
                variant="danger"
                disabled={busy}
                onClick={() => run(() => d.save("transactions", { ...tx, endMonth: addMonths(occ.baseMonth, -1) }))}
              >
                Encerrar a partir de {monthLabel(occ.baseMonth)}
              </Button>
            )}
            <Button variant="danger" disabled={busy} onClick={() => run(() => d.remove("transactions", tx.id))}>
              Excluir todas as repetições
            </Button>
          </>
        )}
        {tx.frequency === "SINGLE" && (
          <Button variant="danger" disabled={busy} onClick={() => run(() => d.remove("transactions", tx.id))}>
            Excluir lançamento
          </Button>
        )}
      </div>
    </Modal>
  );
}

/* ───────────── Escolher conta (pagar boleto / receber cobrança) ───────────── */

function AccountChoiceModal({
  open,
  onClose,
  title,
  summary,
  fieldLabel,
  emptyText,
  confirmLabel,
  disabled,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  summary: string;
  fieldLabel: string;
  emptyText: string;
  confirmLabel: string;
  disabled?: boolean;
  onConfirm: (accountId: string) => Promise<void>;
}) {
  const d = useFinance();
  const accounts = byName(d.accounts.filter((a) => a.isActive));
  const [accountId, setAccountId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    /* eslint-disable react-hooks/set-state-in-effect */
    setAccountId(accounts[0]?.id ?? "");
    setSaving(false);
    setError("");
    /* eslint-enable react-hooks/set-state-in-effect */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const submit = async () => {
    if (!accountId) return setError("Escolha a conta.");
    setSaving(true);
    try {
      await onConfirm(accountId);
      onClose();
    } catch {
      setError(SAVE_ERROR);
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={submit} loading={saving} disabled={accounts.length === 0 || disabled}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className={ui.stack}>
        <p className={ui.hint} style={{ fontSize: "0.875rem" }}>
          {summary}
        </p>
        {accounts.length === 0 ? (
          <ErrorText>{emptyText}</ErrorText>
        ) : (
          <Field label={fieldLabel}>
            <select className={ui.select} value={accountId} onChange={(e) => setAccountId(e.target.value)} autoFocus>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} — saldo {brl(d.balances[a.id] ?? 0)}
                </option>
              ))}
            </select>
          </Field>
        )}
        {error && <ErrorText>{error}</ErrorText>}
      </div>
    </Modal>
  );
}

/** Pagar boleto: escolhe a conta de onde sai o dinheiro e marca a ocorrência como paga. */
export function PayBoletoModal({ occ, onClose }: { occ: Occurrence | null; onClose: () => void }) {
  const d = useFinance();
  if (!occ) return null;
  return (
    <AccountChoiceModal
      open
      onClose={onClose}
      title="Pagar boleto"
      summary={`“${occ.tx.title}” · vencimento ${dateBR(occ.date)}`}
      fieldLabel="Pagar com a conta"
      emptyText="Cadastre uma conta em Finanças → Bancos para pagar o boleto."
      confirmLabel={`Pagar ${brl(occ.amount)}`}
      onConfirm={(accountId) => d.setOccPaid(occ, true, accountId)}
    />
  );
}

/** Receber cobrança: escolhe a conta onde o valor caiu e dá baixa na parte do responsável. */
export function ReceiveChargeModal({ occ, onClose }: { occ: Occurrence | null; onClose: () => void }) {
  const d = useFinance();
  if (!occ) return null;
  const pending = occ.splits.filter((s) => s.responsibleId !== ME_ID && !s.isPaid);
  const who = pending.map((s) => d.respName(s.responsibleId)).join(", ");
  return (
    <AccountChoiceModal
      open
      onClose={onClose}
      title="Receber cobrança"
      summary={`“${occ.tx.title}”${who ? ` · ${who}` : ""} · ${dateBR(occ.date)}`}
      fieldLabel="Conta onde o valor caiu"
      emptyText="Cadastre uma conta em Finanças → Bancos para receber a cobrança."
      confirmLabel={`Receber ${brl(pending.reduce((s, p) => s + p.amount, 0))}`}
      disabled={pending.length === 0}
      onConfirm={(accountId) =>
        d.settleSplits(
          pending.map((s) => ({ occ, responsibleId: s.responsibleId })),
          accountId,
          true,
        )
      }
    />
  );
}

/* ───────────── Configurações: gasto mensal esperado ───────────── */

export function BudgetSettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const d = useFinance();
  const current = d.settings[SETTINGS_ID];
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    /* eslint-disable react-hooks/set-state-in-effect */
    setValue(current?.monthlyBudget ? String(current.monthlyBudget).replace(".", ",") : "");
    setSaving(false);
    setError("");
    /* eslint-enable react-hooks/set-state-in-effect */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const submit = async () => {
    let monthlyBudget: number | undefined;
    if (value.trim()) {
      const v = parseMoney(value);
      if (!Number.isFinite(v) || v < 0) return setError("Informe um valor válido.");
      monthlyBudget = v > 0 ? v : undefined;
    }
    setSaving(true);
    try {
      const next: UserSettings = { ...(current ?? {}), id: SETTINGS_ID, monthlyBudget, updatedAt: Date.now() };
      await d.save("settings", next);
      onClose();
    } catch {
      setError(SAVE_ERROR);
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Configurações"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={submit} loading={saving}>
            Salvar
          </Button>
        </>
      }
    >
      <form
        className={ui.stack}
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Field
          label="Gasto mensal esperado"
          hint="Limite para a sua parte (Eu) nas despesas de cada mês. Deixe em branco para não usar limite."
        >
          <input
            className={ui.input}
            inputMode="decimal"
            placeholder="Ex.: 3.000,00"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoFocus
          />
        </Field>
        {error && <ErrorText>{error}</ErrorText>}
      </form>
    </Modal>
  );
}
