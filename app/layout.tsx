import type { Metadata, Viewport } from "next";
import "./globals.css";
import RegisterSW from "@/components/RegisterSW";

export const metadata: Metadata = {
  title: "Zinda Hon (prototype)",
  description: "Prototype pension proof-of-life platform. Not an official service. All data is simulated.",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0d6b5a" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ur">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu:wght@400;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
        />
      </head>
      <body className="min-h-screen">
        <div className="text-center text-xs py-1.5 px-3 font-semibold" style={{ background: "var(--accent-soft)", color: "var(--warn)", borderBottom: "1px solid var(--line)" }}>
          ⚠️ PROTOTYPE, NOT AN OFFICIAL SERVICE · All people, CNICs and payments are simulated ·
          <span className="ur"> آزمائشی نمونہ، سرکاری سروس نہیں</span>
        </div>
        <main className="mx-auto max-w-5xl px-4 py-5">{children}</main>
        <RegisterSW />
      </body>
    </html>
  );
}
