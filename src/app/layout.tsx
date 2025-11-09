// /src/app/layout.tsx

import type { Metadata } from "next";
// import "./globals.css"; // Temporarily disabled

export const metadata: Metadata = {
  title: "Ibticar.AI API",
  description: "Backend services for Ibticar.AI",
};

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