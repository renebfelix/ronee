import { Logo, Spinner } from "@/components/ui";
import styles from "./FullScreenLoader.module.scss";

export function FullScreenLoader({ label = "Carregando" }: { label?: string }) {
  return (
    <div className={styles.loader}>
      <Logo size="lg" />
      <Spinner size="md" label={label} className={styles.spinner} />
    </div>
  );
}
