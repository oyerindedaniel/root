import type { Metadata } from "next";
import { Inter } from "next/font/google";
import localFont from "next/font/local";
import { TrpcReactProvider } from "@repo/api-client";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: "Shop",
  description: "Storefront and synthetic-order application.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-app="shop"
      className={`scrollbar-gutter-stable ${inter.variable} ${geistMono.variable}`}
    >
      <body className="bg-background font-sans text-foreground antialiased">
        <TrpcReactProvider>{children}</TrpcReactProvider>
      </body>
    </html>
  );
}
