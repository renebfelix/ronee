"use client";

import { Bell, LogOut, Menu, Moon, Search, Sun } from "lucide-react";
import { useAuth, useTheme } from "@/components/providers";
import { Avatar, IconButton } from "@/components/ui";
import styles from "./Topbar.module.scss";

export interface TopbarProps {
  onOpenMenu: () => void;
}

export function Topbar({ onOpenMenu }: TopbarProps) {
  const { user, signOut } = useAuth();
  const { toggleTheme } = useTheme();
  const name = user?.displayName || user?.email?.split("@")[0] || "Usuário";

  return (
    <header className={styles.topbar}>
      <IconButton icon={Menu} label="Abrir menu" className={styles.menu} onClick={onOpenMenu} />

      <div className={styles.search} aria-hidden>
        <Search size={18} />
        <span>Buscar…</span>
      </div>

      <div className={styles.actions}>
        <IconButton icon={Search} label="Buscar" className={styles.searchMobile} />
        <IconButton icon={Bell} label="Notificações" />
        <IconButton
          icon={Moon}
          label="Alternar tema"
          className={styles.themeLight}
          onClick={toggleTheme}
        />
        <IconButton icon={Sun} label="Alternar tema" className={styles.themeDark} onClick={toggleTheme} />

        <div className={styles.user}>
          <Avatar name={name} src={user?.photoURL} size="sm" />
          <div className={styles.userText}>
            <span className={styles.userName}>{name}</span>
            {user?.email && <span className={styles.userEmail}>{user.email}</span>}
          </div>
        </div>

        <IconButton icon={LogOut} label="Sair" onClick={() => signOut()} />
      </div>
    </header>
  );
}
