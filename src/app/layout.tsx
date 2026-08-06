import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "장터온 | 이동지원 물품배달",
  description: "시골 어르신을 위한 물품구매대행 주문 화면",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
