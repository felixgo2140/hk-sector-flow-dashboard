import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "港股资金流 · HK Sector Flow",
  description: "南向资金、港股板块、热门个股资金流向监测",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full bg-zinc-950 text-zinc-100 flex flex-col">
        <header className="border-b border-zinc-800 px-6 py-3 flex items-center gap-6">
          <span className="font-semibold tracking-tight">
            港股资金流 · <span className="text-zinc-500">HK Sector Flow</span>
          </span>
          <nav className="flex gap-4 text-sm">
            <Link href="/" className="text-zinc-300 hover:text-white">
              总览
            </Link>
            <Link href="/southbound" className="text-zinc-300 hover:text-white">
              南向资金
            </Link>
            <Link href="/stocks" className="text-zinc-300 hover:text-white">
              个股
            </Link>
          </nav>
        </header>
        <main className="flex-1 px-6 py-5">{children}</main>
      </body>
    </html>
  );
}
