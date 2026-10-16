import type { Metadata, Viewport } from "next";
import { Barlow, Barlow_Condensed } from "next/font/google";
import { ServiceWorkerRegister } from "@/components/pwa/ServiceWorkerRegister";
import { I18nProvider } from "@/lib/i18n/client";
import { getDictionary } from "@/lib/i18n";
import { getLocale, getTheme } from "@/lib/i18n/server";
import "./globals.css";

const barlow = Barlow({
  variable: "--font-barlow",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

const barlowCondensed = Barlow_Condensed({
  variable: "--font-barlow-condensed",
  weight: ["500", "600", "700", "800"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Shussapp",
  description: "Log games, track streaks, and settle the crew leaderboard.",
  appleWebApp: {
    title: "Shussapp",
    statusBarStyle: "black-translucent",
  },
};

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
      className={`${barlow.variable} ${barlowCondensed.variable} h-full antialiased`}
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
