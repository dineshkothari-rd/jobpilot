import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "JobPilot — AI Career Copilot",
    template: "%s | JobPilot",
  },
  description:
    "JobPilot is your AI-powered career operating system for discovering jobs, preparing applications, practicing interviews, and growing your career.",
  applicationName: "JobPilot",
  keywords: [
    "JobPilot",
    "AI career copilot",
    "AI job search",
    "job tracker",
    "resume",
    "interview preparation",
    "career management",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geist.variable} ${geistMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
