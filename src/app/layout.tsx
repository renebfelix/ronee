import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import { APP } from "@/config/app";
import { Providers, themeInitScript } from "@/components/providers";
import { ServiceWorkerRegister } from "@/components/pwa";
import "@/styles/globals.scss";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

// Favicon (favicon.ico, icon.svg), apple-icon.png e manifest.webmanifest
// são detectados automaticamente pelo Next a partir de src/app.
export const metadata: Metadata = {
  title: { default: APP.shortName, template: `%s · ${APP.shortName}` },
  description: APP.description,
  applicationName: APP.shortName,
  appleWebApp: {
    capable: true,
    title: APP.shortName,
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: APP.backgroundColor },
    { media: "(prefers-color-scheme: dark)", color: APP.backgroundColorDark },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={inter.variable} suppressHydrationWarning>
      <body>
        <Script id="theme-init" strategy="beforeInteractive">
          {themeInitScript}
        </Script>
        <Providers>{children}</Providers>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
