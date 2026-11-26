"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CircleCheck, DatabaseZap, LogIn, Upload } from "lucide-react";
import { PageHeader } from "@/components/layout";
import { Alert, Button, Card } from "@/components/ui";
import { useAuth } from "@/components/providers";
import { isStoreLeestConfigured, readStoreLeest, snapshotCounts, writeToRonee, type StoreLeestSnapshot } from "./lib/importStoreLeest";
import styles from "./components/Shopping.module.scss";

type Step = { kind: "idle" } | { kind: "busy"; msg: string } | { kind: "read"; snap: StoreLeestSnapshot } | { kind: "done"; written: number };

/** Copia os dados do app Store Leest para a Lista de compras (pode rodar de novo sem duplicar). */
export function ImportView() {
  const { user } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState<Step>({ kind: "idle" });
  const [error, setError] = useState("");

  const read = async () => {
    setError("");
    setStep({ kind: "busy", msg: "Aguardando o login do Google…" });
    try {
      const snap = await readStoreLeest((msg) => setStep({ kind: "busy", msg }));
      setStep({ kind: "read", snap });
    } catch (e) {
      const code = (e as { code?: string }).code ?? "";
      setError(
        code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request"
          ? "Login cancelado."
          : code === "auth/unauthorized-domain"
            ? "Este domínio não está autorizado no projeto Store Leest. Rode a importação em localhost ou adicione o domínio em Firebase → Authentication → Settings → Authorized domains."
            : `Não foi possível ler os dados do Store Leest (${code || (e as Error).message}).`,
      );
      setStep({ kind: "idle" });
    }
  };

  const write = async (snap: StoreLeestSnapshot) => {
    setError("");
    setStep({ kind: "busy", msg: "Gravando no Ronee…" });
    try {
      const written = await writeToRonee(user!.uid, snap, (done, total) => setStep({ kind: "busy", msg: `Gravando no Ronee… ${done}/${total}` }));
      setStep({ kind: "done", written });
    } catch {
      setError("Não foi possível gravar no Ronee. Verifique sua conexão e tente de novo (não duplica).");
      setStep({ kind: "read", snap });
    }
  };

  const counts = step.kind === "read" ? snapshotCounts(step.snap) : null;

  return (
    <>
      <Link href="/compras/produtos" className={styles.back}>
        <ArrowLeft size={16} aria-hidden /> Voltar aos produtos
      </Link>
      <PageHeader
        icon={DatabaseZap}
        title="Importar do Store Leest"
        description="Copia categorias, produtos (com fotos e marcas), listas mensais, compras e histórico de preços."
      />

      {!isStoreLeestConfigured ? (
        <Alert tone="danger" title="Store Leest não configurado">
          Preencha as variáveis <code>RONEE_NEXT_PUBLIC_STORE_LEEST_FIREBASE_*</code> no <code>.env</code> (veja o <code>.env.example</code>) e
          reinicie o servidor.
        </Alert>
      ) : (
        <Card>
          <div className={styles.importBody}>
            {error && <Alert tone="danger">{error}</Alert>}

            {(step.kind === "idle" || step.kind === "busy") && (
              <>
                <p className={styles.muted}>
                  Entre com a conta Google que você usa no Store Leest. Os dados são só lidos de lá; nada é apagado.
                </p>
                <div>
                  <Button icon={LogIn} loading={step.kind === "busy"} onClick={read}>
                    Entrar no Store Leest e ler dados
                  </Button>
                </div>
                {step.kind === "busy" && <p className={styles.muted}>{step.msg}</p>}
              </>
            )}

            {step.kind === "read" && counts && (
              <>
                <p>
                  Encontrado em <strong>{step.snap.email ?? "Store Leest"}</strong>:
                </p>
                <ul className={styles.importList}>
                  <li>{counts.categories} categorias</li>
                  <li>{counts.products} produtos</li>
                  <li>
                    {counts.listItems} itens em {counts.months} {counts.months === 1 ? "lista mensal" : "listas mensais"}
                  </li>
                  <li>{counts.purchases} compras finalizadas</li>
                  <li>{counts.priceRecords} registros de preço</li>
                </ul>
                <p className={styles.muted}>
                  Itens com o mesmo id já existentes no Ronee são substituídos; o resto da sua Lista de compras continua como está.
                </p>
                <div className={styles.toolbar} style={{ marginBottom: 0 }}>
                  <Button icon={Upload} onClick={() => write(step.snap)}>
                    Importar para o Ronee
                  </Button>
                  <Button variant="ghost" onClick={() => setStep({ kind: "idle" })}>
                    Cancelar
                  </Button>
                </div>
              </>
            )}

            {step.kind === "done" && (
              <>
                <Alert tone="success" title="Importação concluída">
                  {step.written} registros copiados.
                </Alert>
                <div className={styles.toolbar} style={{ marginBottom: 0 }}>
                  <Button icon={CircleCheck} onClick={() => router.push("/compras/lista")}>
                    Abrir a lista do mês
                  </Button>
                </div>
              </>
            )}
          </div>
        </Card>
      )}
    </>
  );
}
