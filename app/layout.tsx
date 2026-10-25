import type { Metadata, Viewport } from "next";
import { Fredoka, Noto_Sans_TC } from "next/font/google";
import "./globals.css";
import { quizMeta } from "@/data/questions";

// 內文：思源黑體；中文字型很大，只預載拉丁子集，中文字依需要載入
const notoSansTC = Noto_Sans_TC({
  variable: "--font-noto-tc",
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
  display: "swap",
});

// 標題的英數字用圓體，跟中文粗體搭起來比較活潑
const fredoka = Fredoka({
  variable: "--font-fredoka",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: quizMeta.title,
  description: quizMeta.description,
};

export const viewport: Viewport = {
  themeColor: "#140a24",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="zh-Hant"
      className={`${notoSansTC.variable} ${fredoka.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
