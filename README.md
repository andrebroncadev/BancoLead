# BancoLead

Dashboard de inteligência comercial imobiliária.

## Stack
- Next.js App Router + TypeScript
- Tailwind CSS
- Supabase Auth + PostgreSQL
- Google GenAI SDK (backend)

## Desenvolvimento
1. Copie `.env.example` para `.env.local`.
2. Preencha a URL e a publishable key do Supabase.
3. Configure `GEMINI_API_KEY` somente no ambiente do servidor.
4. Execute `npm install` e `npm run dev`.

O dashboard usa autenticação do Supabase e consulta `crm_contacts` e `lead_search_profiles` respeitando RLS.

## Banco de dados
As tabelas `lead_search_profiles` e `property_recommendations` já foram criadas no projeto Supabase conectado. O histórico de execuções automatizado ficou fora do MVP.
