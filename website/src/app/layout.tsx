import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AuthProvider } from "@/context/AuthContext";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const title = "Browsy — The web, your way.";
const description =
  "Tell Browsy what you want. It understands the page, plans supported actions, and helps you navigate the web—with you in control.";

export const metadata: Metadata = {
  title,
  description,
  applicationName: "Browsy",
  keywords: [
    "Browsy",
    "browser assistant",
    "supervised web navigation",
    "shopping assistant",
  ],
  openGraph: {
    title,
    description,
    siteName: "Browsy",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body
        suppressHydrationWarning
        className="min-h-full bg-[#FFFFFC] font-sans text-[#170404] antialiased"
      >
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
