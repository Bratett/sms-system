import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SMS - School Management System",
  description: "Comprehensive High School Management System for Ghana",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
