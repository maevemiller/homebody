import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { HomebodyProvider } from "@/lib/state";
import HideOnFlow from "@/components/HideOnFlow";
import { LIVE, pairingClass } from "@/app/fonts";

export const metadata: Metadata = {
  title: "Homebody",
  description:
    "An AI interior designer that turns a real room, the pieces you already own, and your own story into one harmonious, shoppable plan.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={pairingClass(LIVE)}>
      <body className="min-h-screen flex flex-col">
        <HomebodyProvider>
          <HideOnFlow>
            <header className="glass sticky top-0 z-30 border-b border-line/70">
              <div className="max-w-6xl mx-auto px-6 h-12 flex items-center justify-between gap-4">
                <Link href="/" className="wordmark text-[1.5rem] text-ink">
                  homebody
                </Link>
                <Link href="/rooms" className="text-[13px] text-ink-soft transition-colors hover:text-ink">Your rooms</Link>
              </div>
            </header>
          </HideOnFlow>
          <main className="flex-1">{children}</main>
          <HideOnFlow>
            <footer className="mt-16">
              <div className="max-w-6xl mx-auto px-6 py-8 text-xs text-ink-faint">Homebody · working prototype</div>
            </footer>
          </HideOnFlow>
        </HomebodyProvider>
      </body>
    </html>
  );
}
