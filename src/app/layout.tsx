import type { Metadata } from "next";
import "@fontsource-variable/inter";
import "bootstrap-icons/font/bootstrap-icons.css";
import "./globals.css";
import { getTheme } from "@/lib/theme";

export const metadata: Metadata = {
  title: "Quantum Edge | Cold Calling Tracker",
  description: "Track cold calls, meetings, leads and earnings for Quantum Edge.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const theme = await getTheme();
  return (
    <html lang="en" data-theme={theme}>
      <body className="min-h-screen font-sans">{children}</body>
    </html>
  );
}
