import type { Metadata, Viewport } from "next";
import { Bruno_Ace, Inter, Noto_Sans_SC } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const notoSansSC = Noto_Sans_SC({
  variable: "--font-noto-sans-sc",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const brunoAce = Bruno_Ace({
  variable: "--font-bruno-ace",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "Explore — AI 结构化思维与知识探索",
  description: "AI-powered structured thinking & knowledge exploration tool",
};

export const viewport: Viewport = {
  themeColor: "#101010",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className={`${inter.variable} ${notoSansSC.variable} ${brunoAce.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
