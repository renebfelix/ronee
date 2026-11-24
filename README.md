# Ronee

Plataforma de gerenciamento de vida completo: finanças, tarefas de casa, agenda, lembretes, estoque,
listas de compras, alertas, treinos, alimentação, sono e saúde.

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · SCSS Modules · Firebase · Lucide Icons

## Começando

```bash
npm install
cp .env.example .env.local   # preencha com as chaves do seu projeto Firebase
npm run dev                  # http://localhost:3006
```

### Configurando o Firebase

1. Crie um projeto em <https://console.firebase.google.com>.
2. Adicione um **App da Web** e copie a configuração do SDK para o `.env.local`.
3. Em **Authentication → Método de login**, habilite **E-mail/senha** e **Google**.
4. Em **Firestore Database**, crie o banco (já inicializado em `src/lib/firebase/client.ts`).

## Estrutura

```
src/
├── app/                    # Rotas (App Router)
│   ├── (auth)/login/       # Rotas públicas (só para visitantes)
│   └── (app)/dashboard/    # Rotas autenticadas (AppShell + AuthGuard)
├── components/
│   ├── ui/                 # Componentes base reutilizáveis (Button, Input, Card, Badge, ...)
│   ├── layout/             # AppShell, Sidebar, Topbar, PageHeader, FullScreenLoader
│   ├── auth/               # AuthGuard
│   └── providers/          # AuthProvider (useAuth) e ThemeProvider (useTheme)
├── features/               # Telas/lógica de cada módulo (auth, dashboard, ...)
├── config/navigation.ts    # Fonte única do menu e dos módulos
├── hooks/                  # Hooks reutilizáveis
├── lib/
│   ├── firebase/           # Inicialização, Auth e helpers
│   └── utils/
└── styles/
    ├── abstracts/          # Tokens, breakpoints e mixins (@use "abstracts" as *;)
    ├── base/               # Reset e temas claro/escuro (CSS custom properties)
    └── globals.scss
```

## Convenções

- **Componentes**: uma pasta por componente (`Button/Button.tsx`, `Button.module.scss`, `index.ts`),
  exportados em `components/ui/index.ts`. Importe sempre de `@/components/ui`.
- **Ícones**: [Lucide](https://lucide.dev/icons). Componentes aceitam `icon={NomeDoIcone}`.
- **Estilos**: SCSS Modules. Em todo módulo use `@use "abstracts" as *;` para tokens (`$space-4`,
  `$radius-md`...) e breakpoints mobile-first (`@include up(md) { ... }`).
- **Cores**: sempre via variáveis CSS (`var(--color-primary)`), para funcionar nos temas claro e escuro.
- **Novo módulo**: crie `src/app/(app)/<rota>/page.tsx`, a view em `src/features/<modulo>/` e remova
  `comingSoon` do item em `src/config/navigation.ts`. Toda página em `(app)` deve exportar
  `export const instant = false;` — o conteúdo protegido só renderiza no cliente após o Firebase
  confirmar a sessão, e sem isso o Next acusa "could not validate instant navigation" em dev.

## Scripts

| Comando         | Descrição                 |
| --------------- | ------------------------- |
| `npm run dev`   | Servidor de desenvolvimento |
| `npm run build` | Build de produção          |
| `npm run start` | Servidor de produção       |
| `npm run lint`  | ESLint                     |
| `npm run icons` | Regenera favicon e ícones do PWA a partir de `assets/brand/*.svg` |

## PWA e app Android (TWA)

- **Manifest**: `src/app/manifest.ts` → `/manifest.webmanifest` (nome, cores, ícones, atalhos).
- **Identidade** (nome, cores): `src/config/app.ts`.
- **Ícones e favicon**: edite `assets/brand/icon.svg` (padrão) e `assets/brand/icon-maskable.svg`
  (Android, com margem de segurança) e rode `npm run icons`. São gerados `src/app/favicon.ico`,
  `src/app/icon.svg`, `src/app/apple-icon.png` e `public/icons/*.png`.
- **Service worker**: `public/sw.js`, registrado só em produção (`npm run build && npm run start`).
  Guarda os arquivos estáticos e as páginas visitadas; sem internet mostra `public/offline.html`.
  Mude `VERSION` no arquivo para descartar caches antigos.
- **TWA (Play Store)**: veja [twa/README.md](twa/README.md). O arquivo
  `public/.well-known/assetlinks.json` precisa receber o nome do pacote e a impressão digital SHA-256
  da chave de assinatura.
