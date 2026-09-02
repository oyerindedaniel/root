import type { Metadata } from "next";
import type { PropsWithChildren } from "react";
import { Inter } from "next/font/google";
import localFont from "next/font/local";
import { WorkspaceShell } from "@/app/workspace-shell";
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
  title: "Lab",
  description: "Custom WebMCP provider for Root granted-invoke demos.",
  applicationName: "Lab",
};

export default function RootLayout({ children }: PropsWithChildren) {
  return (
    <html
      lang="en"
      data-app="lab"
      className={`${inter.variable} ${geistMono.variable}`}
    >
      <body className="bg-background font-sans text-foreground antialiased">
        <WorkspaceShell>{children}</WorkspaceShell>
      </body>
    </html>
  );
}
