import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { ServiceWorkerRegister } from "@/components/pwa/ServiceWorkerRegister";
import { I18nProvider } from "@/lib/i18n/client";
import { getDictionary } from "@/lib/i18n";
import { getLocale, getTheme } from "@/lib/i18n/server";
import "./globals.css";

// Self-hosted (SIL OFL, see app/fonts/OFL-LICENSE.txt) so builds and the
// offline PWA never depend on reaching Google Fonts.
const barlow = localFont({
  variable: "--font-barlow",
  display: "swap",
  src: [
    { path: "./fonts/barlow-latin-400-normal.woff2", weight: "400" },
    { path: "./fonts/barlow-latin-500-normal.woff2", weight: "500" },
    { path: "./fonts/barlow-latin-600-normal.woff2", weight: "600" },
    { path: "./fonts/barlow-latin-700-normal.woff2", weight: "700" },
  ],
});

const barlowCondensed = localFont({
  variable: "--font-barlow-condensed",
  display: "swap",
  src: [
    { path: "./fonts/barlow-condensed-latin-500-normal.woff2", weight: "500" },
    { path: "./fonts/barlow-condensed-latin-600-normal.woff2", weight: "600" },
    { path: "./fonts/barlow-condensed-latin-700-normal.woff2", weight: "700" },
    { path: "./fonts/barlow-condensed-latin-800-normal.woff2", weight: "800" },
  ],
});

// Beta motion pieces (components/beta/Stage) use the design's display and
// body faces; not preloaded so regular pages don't pay for them.
const bigShoulders = localFont({
  variable: "--font-bigs",
  display: "swap",
  preload: false,
  src: [
    { path: "./fonts/big-shoulders-display-latin-700-normal.woff2", weight: "700" },
    { path: "./fonts/big-shoulders-display-latin-900-normal.woff2", weight: "900" },
  ],
});

const archivo = localFont({
  variable: "--font-archivo",
  display: "swap",
  preload: false,
  src: [
    { path: "./fonts/archivo-latin-400-normal.woff2", weight: "400" },
    { path: "./fonts/archivo-latin-600-normal.woff2", weight: "600" },
    { path: "./fonts/archivo-latin-800-normal.woff2", weight: "800" },
  ],
});

export async function generateMetadata(): Promise<Metadata> {
  const t = getDictionary(await getLocale());
  return {
    title: "Shussapp",
    description: t.more.metaDescription,
    appleWebApp: {
      title: "Shussapp",
      statusBarStyle: "black-translucent",
    },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0b0d0c" },
    { media: "(prefers-color-scheme: light)", color: "#f4f2ec" },
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const [locale, theme] = await Promise.all([getLocale(), getTheme()]);

  return (
    <html
      lang={locale}
      data-theme={theme}
      className={`${barlow.variable} ${barlowCondensed.variable} ${bigShoulders.variable} ${archivo.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <I18nProvider locale={locale} dictionary={getDictionary(locale)}>
          {children}
        </I18nProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
