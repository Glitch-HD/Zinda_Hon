import type { Metadata, Viewport } from "next";
import "./globals.css";
// Government-portal look. To go back to the previous design, delete this import (and the two gov components below).
import "./gov-theme.css";
import RegisterSW from "@/components/RegisterSW";
import ErrorReporter from "@/components/ErrorReporter";
import VoicePendingPill from "@/components/VoicePendingPill";
import TopBar from "@/components/TopBar";
import VoiceGuide from "@/components/VoiceGuide";
import { PREFS_BOOT_SCRIPT } from "@/lib/prefs-boot";
import GovMasthead from "@/components/gov/GovMasthead";
import GovFooter from "@/components/gov/GovFooter";

export const metadata: Metadata = {
  title: "Zinda Hon (prototype)",
  description: "Prototype pension proof-of-life platform. Not an official service. All data is simulated.",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0a5c36" };

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
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,700;9..144,800&family=Noto+Nastaliq+Urdu:wght@400;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Open+Sans:wght@400;500;600;700;800&family=Poppins:wght@500;600;700&display=swap"
        />
      </head>
      <body className="min-h-screen">
        <TopBar />
        <GovMasthead />
        <main className="mx-auto max-w-6xl px-4 py-5 md:px-8 md:py-8">{children}</main>
        <GovFooter />
        <VoiceGuide />
        <RegisterSW />
        <ErrorReporter />
        <VoicePendingPill />
      </body>
    </html>
  );
}
