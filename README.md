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


## Análise de compatibilidade

O dashboard cruza perfis de busca com o catálogo do BancoImob usando filtros técnicos antes de chamar o Gemini.

- Endpoint autenticado: `POST /api/profiles/:id/analyze`.
- Filtros técnicos: localização, dormitórios, suítes, capacidade, distância da praia e comodidades marcadas como obrigatórias.
- A IA recebe somente os imóveis que passaram pelos filtros e deve justificar aderências e pontos pendentes.
- As recomendações são persistidas em `property_recommendations`; novas análises substituem apenas recomendações ainda com status `sugerido`, preservando decisões já aprovadas ou descartadas.
- Preços e disponibilidade são dados informativos; o sistema não os apresenta como confirmação. Valores de unidades diferentes (diária/pacote) não são comparados diretamente.

### Variáveis privadas da Vercel

Configure em Project Settings → Environment Variables:

- `GEMINI_API_KEY`: chave privada da API Gemini (sem prefixo `NEXT_PUBLIC_`).
- `GEMINI_MODEL`: modelo Gemini (padrão: `gemini-2.5-flash`).

A chave é lida exclusivamente no servidor. Nunca a coloque em arquivos versionados ou no código do navegador.
