import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import { Nav } from "./nav";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ClearPath Compliance Review",
  description: "Marketing compliance review for consumer lending",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-gray-50 text-gray-900">
        <Suspense fallback={<div className="h-12 bg-white border-b border-gray-200" />}>
          <Nav />
        </Suspense>
        <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-6">
          {children}
        </main>
      </body>
    </html>
  );
}
