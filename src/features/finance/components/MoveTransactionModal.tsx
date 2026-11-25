"use client";

import { useState } from "react";
import { Button, Modal } from "@/components/ui";
import { useFinance } from "../data/FinanceDataProvider";
import type { Occurrence, Transaction } from "../lib/types";
import { addMonths } from "../lib/finance";
import { dateBR, monthLabel } from "../lib/format";
import { ErrorText, FieldGroup, Hint, MonthPicker, Segmented, ui } from "./kit";

type Scope = "ONE" | "NEXT";

/** Diferença em meses entre dois "YYYY-MM" (b − a). */
const monthDiff = (a: string, b: string) => {
  const [ay, am] = a.split("-").map(Number);
  const [by, bm] = b.split("-").map(Number);
  return by * 12 + bm - (ay * 12 + am);
};

/**
 * Move um lançamento para outro mês — no cartão, para outra fatura — sem mudar a data da compra.
 * Guarda só o deslocamento: `monthShift` (únicos e parcelas) ou `occurrenceShifts[mês natural]` (fixas,
 * só aquela ocorrência; o mês de destino fica com duas cobranças).
 */
export function MoveTransactionModal({ occ, onClose }: { occ: Occurrence | null; onClose: () => void }) {
  return occ ? <MoveForm key={occ.key} occ={occ} onClose={onClose} /> : null;
}

function MoveForm({ occ, onClose }: { occ: Occurrence; onClose: () => void }) {
  const d = useFinance();
  // Sugere o próximo mês (o caso mais comum: jogar para a próxima fatura).
  const [target, setTarget] = useState(() => addMonths(occ.monthYear, 1));
  const [scope, setScope] = useState<Scope>("ONE");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const tx = occ.tx;
  const isCard = tx.type === "EXPENSE" && tx.paymentMethodType === "CARD";
  const unit = isCard ? "fatura" : "mês";
  const shift = occ.monthShift ?? 0;
  const original = occ.baseMonth;
  const isFixed = tx.frequency === "FIXED";
  const delta = monthDiff(occ.monthYear, target);
  const newShift = shift + delta;
  const isInstallment = tx.frequency === "INSTALLMENT" && !!tx.parentTransactionId;
  const label = (ym: string) => `${isCard ? "fatura de " : ""}${monthLabel(ym).toLowerCase()}`;

  // Parcelas seguintes do mesmo parcelamento (inclui esta).
  const group: Transaction[] =
    isInstallment && scope === "NEXT"
      ? d.transactions.filter(
          (t) => t.parentTransactionId === tx.parentTransactionId && (t.currentInstallment ?? 0) >= (tx.currentInstallment ?? 0),
        )
      : [tx];

  // Fixas guardam o deslocamento só desta ocorrência (pelo mês natural); as demais, no próprio lançamento.
  const withShift = (t: Transaction, s: number): Transaction => {
    if (t.frequency !== "FIXED") return { ...t, monthShift: s || undefined };
    const { [occ.baseMonth]: _prev, ...others } = t.occurrenceShifts ?? {};
    void _prev;
    const next = s ? { ...others, [occ.baseMonth]: s } : others;
    return { ...t, occurrenceShifts: Object.keys(next).length ? next : undefined };
  };
  const currentShift = (t: Transaction) =>
    t.frequency === "FIXED" ? (t.occurrenceShifts?.[occ.baseMonth] ?? 0) : (t.monthShift ?? 0);

  const submit = async () => {
    if (delta === 0) return setError(isCard ? "Escolha uma fatura diferente da atual." : "Escolha um mês diferente do atual.");
    setSaving(true);
    try {
      await d.saveMany(
        "transactions",
        group.map((t) => withShift(t, currentShift(t) + delta)),
      );
      onClose();
    } catch {
      setError("Não foi possível salvar. Verifique sua conexão e tente de novo.");
      setSaving(false);
    }
  };

  const restore = async () => {
    setSaving(true);
    try {
      await d.save("transactions", withShift(tx, 0));
      onClose();
    } catch {
      setError("Não foi possível salvar. Verifique sua conexão e tente de novo.");
      setSaving(false);
    }
  };

  const relation =
    newShift === 0
      ? `Volta para ${isCard ? "a fatura original" : "o mês original"}.`
      : `${Math.abs(newShift)} ${isCard ? (Math.abs(newShift) === 1 ? "fatura" : "faturas") : Math.abs(newShift) === 1 ? "mês" : "meses"} ${newShift > 0 ? "depois" : "antes"} do original (${label(original)}).`;

  return (
    <Modal
      open
      onClose={onClose}
      title={isCard ? "Mover para outra fatura" : "Mover para outro mês"}
      footer={
        <>
          {shift !== 0 && (
            <Button variant="ghost" onClick={restore} disabled={saving}>
              Voltar ao original
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={submit} loading={saving} disabled={delta === 0}>
            Mover
          </Button>
        </>
      }
    >
      <div className={ui.stack}>
        <Hint>
          “{tx.title}”{occ.installment ? ` · parcela ${occ.installment.current}/${occ.installment.total}` : ""} · compra em{" "}
          {dateBR(occ.date)}. Hoje aparece {isCard ? "na" : "em"} {label(occ.monthYear)}
          {shift !== 0 ? ` (movido; o original é ${label(original)})` : ""}. A data da compra não muda.
        </Hint>
        {isFixed && (
          <Hint>
            Lançamento fixo: só a cobrança de {label(original)} é movida. As outras repetições continuam onde estão, então{" "}
            {isCard ? "a fatura" : "o mês"} de destino fica com duas cobranças.
          </Hint>
        )}

        <FieldGroup label={isCard ? "Fatura de destino" : "Mês de destino"} hint={delta === 0 ? (isCard ? "É a fatura atual." : "É o mês atual.") : relation} warn={delta === 0}>
          <div className={ui.chips}>
            <MonthPicker value={target} onChange={setTarget} />
          </div>
          <div className={ui.chips}>
            <Button size="sm" variant={target === addMonths(occ.monthYear, -1) ? "secondary" : "outline"} onClick={() => setTarget(addMonths(occ.monthYear, -1))}>
              {isCard ? "Fatura anterior" : "Mês anterior"}
            </Button>
            <Button size="sm" variant={target === addMonths(occ.monthYear, 1) ? "secondary" : "outline"} onClick={() => setTarget(addMonths(occ.monthYear, 1))}>
              {isCard ? "Próxima fatura" : "Próximo mês"}
            </Button>
          </div>
        </FieldGroup>

        {isInstallment && (
          <FieldGroup
            label="Aplicar em"
            hint={
              scope === "NEXT"
                ? `Move ${group.length} parcela(s) o mesmo tanto, mantendo uma por ${unit}.`
                : "Só esta parcela muda; as outras continuam onde estão."
            }
          >
            <Segmented
              label="Aplicar em"
              value={scope}
              onChange={setScope}
              options={[
                { value: "ONE", label: "Só esta parcela" },
                { value: "NEXT", label: "Esta e as próximas" },
              ]}
            />
          </FieldGroup>
        )}

        {error && <ErrorText>{error}</ErrorText>}
      </div>
    </Modal>
  );
}
