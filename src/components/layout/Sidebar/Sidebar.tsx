"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { NAVIGATION, type NavItem } from "@/config/navigation";
import { cn } from "@/lib/utils/cn";
import { Badge, IconButton, Logo } from "@/components/ui";
import styles from "./Sidebar.module.scss";

export interface SidebarProps {
  /** Estado do drawer em telas pequenas. */
  open: boolean;
  onClose: () => void;
}

function NavLink({ item, active, onNavigate }: { item: NavItem; active: boolean; onNavigate: () => void }) {
  const Icon = item.icon;
  const content = (
    <>
      <span className={cn(styles.icon, styles[`accent-${item.accent}`])}>
        <Icon size={18} aria-hidden />
      </span>
      <span className={styles.label}>{item.label}</span>
      {item.comingSoon && <Badge className={styles.soon}>Em breve</Badge>}
    </>
  );

  if (item.comingSoon) {
    return (
      <span className={cn(styles.link, styles.disabled)} aria-disabled="true" title={`${item.label} — em breve`}>
        {content}
      </span>
    );
  }

  return (
    <Link
      href={item.href}
      className={cn(styles.link, active && styles.active)}
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
    >
      {content}
    </Link>
  );
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();

  return (
    <>
      <div className={cn(styles.overlay, open && styles.overlayVisible)} onClick={onClose} aria-hidden />
      <aside className={cn(styles.sidebar, open && styles.open)} aria-label="Menu principal">
        <div className={styles.brand}>
          <Logo />
          <IconButton icon={X} label="Fechar menu" className={styles.close} onClick={onClose} />
        </div>

        <nav className={styles.nav}>
          {NAVIGATION.map((section, i) => (
            <div key={section.title ?? i} className={styles.section}>
              {section.title && <p className={styles.sectionTitle}>{section.title}</p>}
              <ul className={styles.list}>
                {section.items.map((item) => (
                  <li key={item.id}>
                    <NavLink
                      item={item}
                      active={pathname === item.href || pathname.startsWith(`${item.href}/`)}
                      onNavigate={onClose}
                    />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}
