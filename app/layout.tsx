import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Zinda Hoon (prototype)",
  description: "Prototype pension proof-of-life platform. Not an official service. All data is simulated.",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0f766e" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ur">
      <body className="min-h-screen">
        <div style={{ background: "var(--warn)", color: "#fff" }} className="text-center text-sm py-1 px-3 font-semibold">
          PROTOTYPE, NOT AN OFFICIAL SERVICE · All people, CNICs and payments are simulated ·
          <span className="ur"> آزمائشی نمونہ، سرکاری سروس نہیں</span>
        </div>
        <main className="mx-auto max-w-5xl px-4 py-4">{children}</main>
      </body>
    </html>
  );
}
