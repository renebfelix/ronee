/**
 * CHARGE (cobrança): valor que um responsável me deve, sem conta nem cartão.
 * Fica a receber até ser marcado como recebido, quando entra na conta escolhida.
 */
export type TransactionType = 'INCOME' | 'EXPENSE' | 'CHARGE';
export type CategoryType = 'INCOME' | 'EXPENSE';
export type FrequencyType = 'SINGLE' | 'FIXED' | 'INSTALLMENT';
export type InvoiceStatus = 'OPEN' | 'CLOSED' | 'PAID';
export type AccountKind = 'CHECKING' | 'SAVINGS' | 'INVESTMENT';
/**
 * BOLETO: despesa a pagar; a conta de onde sai o dinheiro é escolhida ao marcar como paga.
 * NONE: cobrança, sem método de pagamento.
 */
export type PaymentMethodType = 'BANK' | 'CARD' | 'BOLETO' | 'NONE';

/** Id reservado para o próprio usuário nas divisões de gastos. */
export const ME_ID = 'me';

export interface BankAccount {
  id: string;
  name: string;
  kind: AccountKind;
  initialBalance: number;
  color: string;
  icon: string;
  isActive: boolean;
}

export interface CreditCard {
  id: string;
  name: string;
  brand: string;
  defaultBestDay: number;
  dueDay: number;
  limit: number;
  color: string;
  icon: string;
  isActive: boolean;
}

export interface Category {
  id: string;
  name: string;
  type: CategoryType;
  monthlyLimit?: number;
  color: string;
  icon: string;
  isActive: boolean;
}

export interface Responsible {
  id: string;
  name: string;
  avatarUrl?: string;
  email?: string;
}

export interface ResponsibleSplit {
  responsibleId: string;
  amount: number;
  isPaid: boolean;
  paidAt?: string | null;
  destinationAccountId?: string | null;
}

export interface Transaction {
  id: string;
  userId: string;
  type: TransactionType;
  title: string;
  /** Valor do lançamento. Em parcelados, é o valor de UMA parcela. */
  totalAmount: number;
  /** Valor cheio da compra parcelada. */
  purchaseTotal?: number;
  date: string; // YYYY-MM-DD
  categoryId: string;
  paymentMethodType: PaymentMethodType;
  paymentMethodId: string;
  frequency: FrequencyType;
  installmentsCount?: number;
  currentInstallment?: number;
  parentTransactionId?: string;
  splits: ResponsibleSplit[];
  /** Fixas: baixas por mês ("YYYY-MM"), pois uma única fixa gera várias ocorrências. */
  occurrenceSplits?: Record<string, ResponsibleSplit[]>;
  /** Fixas: valor ajustado só daquele mês ("YYYY-MM"); sem entrada, vale `totalAmount`. */
  occurrenceAmounts?: Record<string, number>;
  /**
   * Boleto marcado como pago: só então sai do saldo da conta escolhida.
   * Em fixas, o pagamento é por mês em `occurrencePaid`.
   */
  isPaid?: boolean;
  occurrencePaid?: Record<string, boolean>;
  /** Boleto pago: conta de onde saiu o dinheiro (em fixas, por mês em `occurrencePaidFrom`). */
  paidFromAccountId?: string | null;
  occurrencePaidFrom?: Record<string, string | null>;
  /** Boleto: código de barras / linha digitável (em fixas, vale para o lançamento todo). */
  barcode?: string;
  /** Fixas: último mês (inclusive) em que ainda se repete. */
  endMonth?: string;
  notes?: string;
  /**
   * Estorno no cartão de crédito: crédito que abate a fatura em que cai.
   * Valor e divisões ficam positivos no documento; as ocorrências usam o valor negativo.
   */
  isRefund?: boolean;
  /**
   * Lançamento movido (únicos e parcelas): quantos meses — ou faturas, no cartão — ele entra
   * depois (+) ou antes (−) do mês natural. A data da compra não muda.
   */
  monthShift?: number;
  /**
   * Fixas: ocorrências movidas, por mês natural ("YYYY-MM") → deslocamento em meses/faturas.
   * Ex.: { "2026-03": 1 } joga a cobrança de março para abril (abril passa a ter duas).
   */
  occurrenceShifts?: Record<string, number>;
  createdAt: number;
}

export interface MonthlyInvoiceOverride {
  id: string; // `${cardId}_${YYYY-MM}`
  cardId: string;
  monthYear: string;
  customBestDay: number;
  /**
   * Data de fechamento desta fatura, quando ajustada. Pode cair no início do mês seguinte
   * (ex.: a fatura de novembro fecha em 02/12): compras até essa data entram nesta fatura.
   */
  customClosingDate?: string;
  status: InvoiceStatus;
  paidFromAccountId?: string;
  paidAt?: string;
}

/** Uma ocorrência concreta de um lançamento em um mês (fixas geram várias). */
export interface Occurrence {
  key: string;
  tx: Transaction;
  /** Mês em que a ocorrência aparece (fatura, no cartão), já considerando a movimentação. */
  monthYear: string;
  /**
   * Mês natural, sem movimentação. Em fixas, é a chave dos dados por mês
   * (`occurrenceAmounts`, `occurrenceSplits`, `occurrencePaid`…), estável mesmo após mover.
   */
  baseMonth: string;
  date: string;
  amount: number;
  splits: ResponsibleSplit[];
  installment?: { current: number; total: number };
  /** Movido de mês: deslocamento em relação ao mês natural (`monthYear` já considera isso). */
  monthShift?: number;
}

export type OverrideMap = Record<string, MonthlyInvoiceOverride>;

/** `checks/{YYYY-MM}` — lançamentos conferidos no modo de verificação daquele mês. */
export interface MonthCheck {
  id: string; // YYYY-MM
  /** Chaves das ocorrências (`Occurrence.key`) marcadas como conferidas. */
  keys: string[];
  updatedAt: number;
}

/** Id do documento único em `settings/`. */
export const SETTINGS_ID = 'general';

/** `settings/general` — preferências do usuário. */
export interface UserSettings {
  id: string;
  /** Gasto mensal esperado (limite) para a minha parte ("Eu") nas despesas do mês. */
  monthlyBudget?: number;
  updatedAt: number;
}
