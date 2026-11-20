import type { Metadata, Viewport } from "next";
import "./globals.css";
import RegisterSW from "@/components/RegisterSW";
import TopBar from "@/components/TopBar";
import VoiceGuide from "@/components/VoiceGuide";
import { PREFS_BOOT_SCRIPT } from "@/lib/prefs-boot";

export const metadata: Metadata = {
  title: "Zinda Hon (prototype)",
  description: "Prototype pension proof-of-life platform. Not an official service. All data is simulated.",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0d6b5a" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ur" translate="no" className="notranslate" data-lang="both" suppressHydrationWarning>
      <head>
        {/* Stop the browser offering to translate: the page already shows Urdu and English, and auto-translate doubled the words. */}
        <meta name="google" content="notranslate" />
        <script dangerouslySetInnerHTML={{ __html: PREFS_BOOT_SCRIPT }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu:wght@400;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
        />
      </head>
      <body className="min-h-screen">
        <TopBar />
        <main className="mx-auto max-w-6xl px-4 py-5 md:px-8 md:py-8">{children}</main>
        <VoiceGuide />
        <RegisterSW />
      </body>
    </html>
  );
}
