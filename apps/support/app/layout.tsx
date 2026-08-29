import type { Metadata } from "next";
import type { PropsWithChildren } from "react";
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
  title: "Support",
  description: "Service application with customer and order projections.",
};

export default function RootLayout({ children }: PropsWithChildren) {
  return (
    <html
      lang="en"
      data-app="support"
      className={`scrollbar-gutter-stable ${inter.variable} ${geistMono.variable}`}
    >
      <body className="bg-background font-sans text-foreground antialiased">
        <TrpcReactProvider>{children}</TrpcReactProvider>
      </body>
    </html>
  );
}
