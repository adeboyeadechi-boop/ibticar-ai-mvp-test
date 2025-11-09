// /src/app/layout.tsx

import type { Metadata } from "next";
// import "./globals.css"; // Temporarily disabled

export const metadata: Metadata = {
  title: "Ibticar.AI API",
  description: "Backend services for Ibticar.AI",
};

// Disable static generation for the entire app
export const dynamic = 'force-dynamic'
export const dynamicParams = true

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}