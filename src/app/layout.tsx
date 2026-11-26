import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BancoLead | Inteligência comercial",
  description: "Central de perfis de busca e recomendações imobiliárias.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
