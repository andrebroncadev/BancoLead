import { NextResponse } from "next/server";
import { Type } from "@google/genai";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { GEMINI_MODEL, getGeminiClient } from "@/lib/gemini";

export const runtime = "nodejs";
export const maxDuration = 60;

type Property = {
  id: string; codigo: string | null; titulo: string; bairro: string | null;
  cidade: string; uf: string; capacidade: number; dormitorios: number; suites: number;
  piscina: boolean; churrasqueira: boolean; area_gourmet: boolean; servico_praia: boolean;
  distancia_praia: number | null; descricao: string | null; url_origem: string | null;
  comodidades: unknown; disponibilidade_status: string;
};
type Price = { imovel_id: string; tipo: string; nome_periodo: string | null; data_inicio: string | null; data_fim: string | null; valor: number; noites_minimas: number };
type Photo = { imovel_id: string; url: string; capa: boolean; ordem: number };
type Suggestion = { property_id: string; compatibility_score: number; reasoning: string; matched_criteria: string[]; unmatched_criteria: string[] };

const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sessão expirada. Entre novamente." }, { status: 401 });

  const { data: profile, error: profileError } = await supabase
    .from("lead_search_profiles").select("*").eq("id", id).single();
  if (profileError || !profile) return NextResponse.json({ error: "Perfil não encontrado ou sem acesso." }, { status: 404 });

  const { data: rawProperties, error: propertyError } = await supabase
    .from("mare_imoveis")
    .select("id,codigo,titulo,bairro,cidade,uf,capacidade,dormitorios,suites,piscina,churrasqueira,area_gourmet,servico_praia,distancia_praia,descricao,url_origem,comodidades,disponibilidade_status")
    .eq("ativo", true)
    .limit(300);
  if (propertyError) return NextResponse.json({ error: "Não foi possível consultar o catálogo BancoImob." }, { status: 502 });

  const requestedLocations = (profile.localizacoes || []).map((item: string) => normalize(item)).filter(Boolean);
  const properties = ((rawProperties || []) as Property[]).filter((property) => {
    const place = normalize([property.bairro, property.cidade].filter(Boolean).join(" "));
    if (requestedLocations.length && !requestedLocations.some((location) => place.includes(location) || location.includes(normalize(property.bairro || "")))) return false;
    if (profile.dormitorios_min != null && property.dormitorios < profile.dormitorios_min) return false;
    if (profile.dormitorios_max != null && property.dormitorios > profile.dormitorios_max) return false;
    if (profile.suites_min != null && property.suites < profile.suites_min) return false;
    if (profile.suites_max != null && property.suites > profile.suites_max) return false;
    if (profile.hospedes != null && property.capacidade < profile.hospedes) return false;
    if (profile.distancia_praia_max_m != null && property.distancia_praia != null && property.distancia_praia > profile.distancia_praia_max_m) return false;
    return true;
  });

  if (!properties.length) {
    await supabase.from("property_recommendations").delete().eq("profile_id", id).eq("status", "sugerido");
    return NextResponse.json({ success: true, count: 0, message: "Nenhum imóvel passou pelos critérios técnicos. Amplie localização, capacidade ou características e tente novamente.", recommendations: [] });
  }

  const ids = properties.map((property) => property.id);
  const [{ data: prices }, { data: photos }] = await Promise.all([
    supabase.from("mare_precos_imovel").select("imovel_id,tipo,nome_periodo,data_inicio,data_fim,valor,noites_minimas").in("imovel_id", ids),
    supabase.from("mare_fotos_imovel").select("imovel_id,url,capa,ordem").in("imovel_id", ids).order("capa", { ascending: false }).order("ordem").limit(600),
  ]);
  const priceRows = (prices || []) as Price[];
  const photoRows = (photos || []) as Photo[];
  const candidates = properties.map((property) => ({
    id: property.id,
    codigo: property.codigo,
    titulo: property.titulo,
    bairro: property.bairro,
    cidade: property.cidade,
    capacidade: property.capacidade,
    dormitorios: property.dormitorios,
    suites: property.suites,
    piscina: property.piscina,
    churrasqueira: property.churrasqueira,
    area_gourmet: property.area_gourmet,
    servico_praia: property.servico_praia,
    distancia_praia_m: property.distancia_praia,
    descricao: property.descricao,
    comodidades: property.comodidades,
    disponibilidade: property.disponibilidade_status,
    precos_cadastrados: priceRows.filter((price) => price.imovel_id === property.id).map(({ tipo, nome_periodo, data_inicio, data_fim, valor, noites_minimas }) => ({ tipo, periodo: nome_periodo, data_inicio, data_fim, valor, noites_minimas })),
    foto_capa: photoRows.find((photo) => photo.imovel_id === property.id && photo.capa)?.url || photoRows.find((photo) => photo.imovel_id === property.id)?.url || null,
  }));

  const ranked = [...candidates].sort((a, b) => {
    const aDistance = a.distancia_praia_m ?? 99999;
    const bDistance = b.distancia_praia_m ?? 99999;
    return aDistance - bDistance;
  }).slice(0, 35);

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: "A análise técnica encontrou imóveis, mas GEMINI_API_KEY ainda não está configurada nas variáveis privadas da Vercel.", technical_count: properties.length }, { status: 503 });
  }

  const profileForAI = {
    modalidade: profile.modalidade,
    localizacoes: profile.localizacoes,
    dormitorios_min: profile.dormitorios_min,
    dormitorios_max: profile.dormitorios_max,
    suites_min: profile.suites_min,
    suites_max: profile.suites_max,
    orcamento_min: profile.orcamento_min,
    orcamento_max: profile.orcamento_max,
    distancia_praia_max_m: profile.distancia_praia_max_m,
    hospedes: profile.hospedes,
    checkin: profile.data_checkin,
    checkout: profile.data_checkout,
    comodidades: profile.comodidades,
    observacoes: profile.observacoes,
  };

  const prompt = [
    "Você é um analista imobiliário criterioso que auxilia corretores de alto padrão no Litoral Norte de São Paulo.",
    "Analise exclusivamente os imóveis enviados. Não invente características, disponibilidade, preços ou condições.",
    "Retorne no máximo 10 recomendações, ordenadas da maior para a menor compatibilidade.",
    "O score é de 0 a 100 e representa compatibilidade global, não probabilidade de fechamento.",
    "Use property_id exatamente como recebido. Não recomende IDs que não estejam na lista.",
    "Explique objetivamente por que o imóvel combina com a demanda e indique lacunas ou divergências em unmatched_criteria.",
    "Preço: considere somente preços cadastrados. Não compare diária, pacote e orçamento total como se fossem a mesma unidade. Se não houver preço comparável para o período, deixe isso explícito em unmatched_criteria e no texto. Nunca calcule um total sem base.",
    "Disponibilidade: o campo de disponibilidade é informativo; 'a_confirmar' não significa disponível. Recomende confirmar agenda com o proprietário.",
    "Não descarte por preço quando não houver preço cadastrado ou comparável; sinalize a pendência.",
    "Responda apenas JSON válido no formato especificado.",
    "PERFIL DO LEAD:", JSON.stringify(profileForAI),
    "IMÓVEIS CANDIDATOS:", JSON.stringify(ranked),
  ].join("\n\n");

  try {
    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            recommendations: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  property_id: { type: Type.STRING },
                  compatibility_score: { type: Type.INTEGER },
                  reasoning: { type: Type.STRING },
                  matched_criteria: { type: Type.ARRAY, items: { type: Type.STRING } },
                  unmatched_criteria: { type: Type.ARRAY, items: { type: Type.STRING } },
                },
                required: ["property_id", "compatibility_score", "reasoning", "matched_criteria", "unmatched_criteria"],
              },
            },
          },
          required: ["recommendations"],
        },
      },
    });

    const parsed = JSON.parse(response.text || "{}") as { recommendations?: Suggestion[] };
    const validIds = new Set(ranked.map((item) => item.id));
    const suggestions = (parsed.recommendations || []).filter((item) =>
      validIds.has(item.property_id) &&
      Number.isFinite(item.compatibility_score) &&
      typeof item.reasoning === "string"
    ).slice(0, 10).map((item) => ({
      profile_id: id,
      property_id: item.property_id,
      compatibility_score: Math.max(0, Math.min(100, Math.round(item.compatibility_score))),
      reasoning: item.reasoning.slice(0, 3000),
      matched_criteria: Array.isArray(item.matched_criteria) ? item.matched_criteria.slice(0, 20) : [],
      unmatched_criteria: Array.isArray(item.unmatched_criteria) ? item.unmatched_criteria.slice(0, 20) : [],
      model_name: GEMINI_MODEL,
      status: "sugerido",
      generated_at: new Date().toISOString(),
    }));

    if (!suggestions.length) throw new Error("O Gemini não retornou recomendações válidas.");
    const { error: deleteError } = await supabase.from("property_recommendations").delete().eq("profile_id", id).eq("status", "sugerido");
    if (deleteError) throw new Error("Não foi possível atualizar as recomendações anteriores.");
    const { data: saved, error: saveError } = await supabase.from("property_recommendations").insert(suggestions).select("id,profile_id,property_id,compatibility_score,reasoning,matched_criteria,unmatched_criteria,model_name,status,generated_at");
    if (saveError) throw new Error("A análise foi concluída, mas não foi possível salvar as recomendações.");
    return NextResponse.json({ success: true, count: saved?.length || 0, technical_count: properties.length, recommendations: saved || [] });
  } catch (error) {
    console.error("BancoLead Gemini analysis failed:", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: error instanceof Error ? error.message : "Falha ao analisar os imóveis." }, { status: 502 });
  }
}
