import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gogoga Pages",
  description: "A small static site deployment platform"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
