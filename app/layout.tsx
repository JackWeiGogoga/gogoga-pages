import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gogoga 页面",
  description: "静态站点发布平台"
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
