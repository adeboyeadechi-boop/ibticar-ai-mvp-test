// /src/app/layout.tsx

import type { Metadata } from "next";
import "./globals.css"; // Vous pouvez même vider ce CSS plus tard

export const metadata: Metadata = {
  title: "Ibticar.AI API", // Modifié
  description: "Backend services for Ibticar.AI", // Modifié
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en"> {/* Simplifié en "en" */}
      <body>{children}</body>
    </html>
  );
}