import type { Metadata } from "next";
import type { PropsWithChildren } from "react";
import { Inter } from "next/font/google";
import localFont from "next/font/local";
import { TrpcReactProvider } from "@repo/api-client";
import { WorkspaceShell } from "./workspace-shell";
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

export default function RootLayout({ children }: PropsWithChildren) {
  return (
    <html
      lang="en"
      data-app="shop"
      className={`app-scroll ${inter.variable} ${geistMono.variable}`}
    >
      <body className="bg-background font-sans text-foreground antialiased">
        <TrpcReactProvider>
          <WorkspaceShell>{children}</WorkspaceShell>
        </TrpcReactProvider>
      </body>
    </html>
  );
}
