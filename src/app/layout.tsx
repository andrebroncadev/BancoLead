import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BancoLead | Locatários de temporada",
  description: "Cadastro de locatários e match de imóveis para temporada.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
