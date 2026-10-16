import type { Metadata } from "next";
import "./globals.css";
import "./product-experience.css";
export const metadata: Metadata = { title: "COBS Marketing Agent" };
export default function Layout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
