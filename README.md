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

## BancoLead: base independente e assistente Gemini

Os leads do BancoLead são armazenados em `public.bancolead_leads`. A aplicação não importa nem lista automaticamente `crm_contacts` ou `crm_deals`. Os dados antigos do CRM permanecem intactos e fora desta aplicação.

A entrada de dados ocorre por:
- Formulário manual da plataforma.
- Assistente conversacional Gemini, com ferramentas server-side para listar, cadastrar e atualizar leads e criar perfis de busca.

O Gemini só deve executar gravações após instrução explícita do usuário. A API usa a sessão autenticada e as políticas RLS do workspace. Não há ferramenta de exclusão de dados disponível ao modelo.

Configure `GEMINI_API_KEY` como variável privada na Vercel para habilitar o chat. A chave não deve usar o prefixo `NEXT_PUBLIC_`.


## Operação simplificada

O BancoLead é dedicado exclusivamente a locações por temporada. A tela principal apresenta locatários, um cadastro único com dados de contato e critérios da viagem, e a ação **Match com Gemini** para cruzar a demanda com o catálogo de imóveis ativos do BancoImob.

Cada locatário e seu perfil de temporada são gravados juntos. A base própria é `public.bancolead_leads`; o BancoLead não consulta nem importa `crm_contacts` ou `crm_deals`. O catálogo `mare_*` do BancoImob é utilizado apenas para leitura durante o match.

A área de conversa Gemini não faz parte da tela operacional neste momento. A futura importação de perfis a partir de conversas será tratada como uma etapa separada, com revisão dos dados antes de salvar.
