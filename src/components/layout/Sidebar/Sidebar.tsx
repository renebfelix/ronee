"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { NAVIGATION, getNavItemTarget, isRouteActive, type NavItem } from "@/config/navigation";
import { cn } from "@/lib/utils/cn";
import { Badge, IconButton, Logo } from "@/components/ui";
import styles from "./Sidebar.module.scss";

export interface SidebarProps {
  /** Estado do drawer em telas pequenas. */
  open: boolean;
  onClose: () => void;
}

function NavLink({ item, pathname, onNavigate }: { item: NavItem; pathname: string; onNavigate: () => void }) {
  const inSection = isRouteActive(pathname, item.href);
  const hasChildren = !!item.children?.length;
  // Com submenu, o destaque forte vai para a subpágina; o módulo só indica a seção atual.
  const active = inSection && !hasChildren;
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
    <>
      <Link
        href={getNavItemTarget(item)}
        className={cn(styles.link, active && styles.active, hasChildren && inSection && styles.sectionActive)}
        aria-current={active ? "page" : undefined}
        aria-expanded={hasChildren ? inSection : undefined}
        onClick={onNavigate}
      >
        {content}
      </Link>

      {hasChildren && inSection && (
        <ul className={styles.subList}>
          {item.children!.map((child) => {
            const childActive = isRouteActive(pathname, child.href);
            return (
              <li key={child.id}>
                <Link
                  href={child.href}
                  className={cn(styles.subLink, childActive && styles.subActive)}
                  aria-current={childActive ? "page" : undefined}
                  onClick={onNavigate}
                >
                  {child.label}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
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
                    <NavLink item={item} pathname={pathname} onNavigate={onClose} />
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
