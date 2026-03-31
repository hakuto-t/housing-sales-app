import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "住宅営業育成アプリ",
  description: "住宅営業の知識を効率的に習得するための学習プラットフォーム",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
