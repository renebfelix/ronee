# Ronee para Android (Trusted Web Activity)

A TWA empacota o PWA em um app Android (Play Store) que abre o site em tela cheia,
sem barra de endereço. O projeto Android é gerado com o
[Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap) a partir do manifest do site.

## Requisitos do site (já configurados)

| Requisito | Onde |
| --- | --- |
| Web App Manifest (`/manifest.webmanifest`) | `src/app/manifest.ts` |
| Ícones 192/512 `any` e `maskable` | `public/icons/` (gerados por `npm run icons`) |
| Service worker com suporte offline | `public/sw.js` + `public/offline.html` |
| Digital Asset Links (`/.well-known/assetlinks.json`) | `public/.well-known/assetlinks.json` |
| HTTPS | responsabilidade da hospedagem (ex.: Vercel, Firebase Hosting) |

## Passo a passo

1. **Publique o site** em um domínio com HTTPS e confira que
   `https://SEU-DOMINIO/manifest.webmanifest` abre.

2. **Instale o Bubblewrap** (precisa de Node e, na primeira execução, ele baixa JDK e Android SDK):

   ```bash
   npm i -g @bubblewrap/cli
   ```

3. **Gere o projeto Android** dentro desta pasta:

   ```bash
   cd twa
   bubblewrap init --manifest https://SEU-DOMINIO/manifest.webmanifest
   ```

   Use o pacote `com.ronee.app` (ou outro, mas mantenha igual ao `assetlinks.json`).
   O Bubblewrap cria a chave de assinatura (`android.keystore`) — **guarde-a e não a commite**.

4. **Compile**:

   ```bash
   bubblewrap build
   ```

   Gera `app-release-signed.apk` (testes) e `app-release-bundle.aab` (Play Store).

5. **Configure o Digital Asset Links** — é o que remove a barra de endereço:

   ```bash
   bubblewrap fingerprint list
   ```

   Copie a impressão digital SHA-256 para `public/.well-known/assetlinks.json`.
   Se usar a **Assinatura de apps do Google Play**, adicione também a impressão digital mostrada em
   Play Console → Configuração → Integridade do app → Assinatura de apps.
   Faça o deploy e valide em:
   <https://developers.google.com/digital-asset-links/tools/generator>

6. **Teste no celular**: `bubblewrap install` (com o aparelho conectado via USB e depuração ativada).

## Atualizações

- Mudanças no site chegam ao app automaticamente (é o mesmo site).
- Mudou ícone, nome ou cores? Rode `bubblewrap update` e `bubblewrap build`, aumentando a versão.
- Ao publicar uma versão nova do site, se quiser forçar a limpeza de cache dos usuários,
  altere `VERSION` em `public/sw.js`.
