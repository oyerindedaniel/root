import type { Metadata } from "next";
import { Inter } from "next/font/google";
import localFont from "next/font/local";
import Script from "next/script";

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
  title: "Root",
  description: "Governed workflows across trusted web apps.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-app="root"
      className={`${inter.variable} ${geistMono.variable}`}
    >
      <body className="bg-background font-sans text-foreground antialiased">
        {process.env.NODE_ENV === "development" ? (
          <Script
            src="https://unpkg.com/@oyerinde/caliper/dist/index.global.js"
            strategy="afterInteractive"
            data-config={JSON.stringify({ bridge: { enabled: true } })}
          />
        ) : null}
        <TrpcReactProvider>{children}</TrpcReactProvider>
      </body>
    </html>
  );
}
