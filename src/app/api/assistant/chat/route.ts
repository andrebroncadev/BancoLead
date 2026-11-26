import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getGeminiClient, GEMINI_MODEL } from "@/lib/gemini";

export const runtime = "nodejs";
export const maxDuration = 60;

type ChatMessage = { role: "user" | "model"; text: string };
type Args = Record<string, unknown>;

const declarations = [
  {
    name: "list_bancolead_leads",
    description: "Lista os leads que já foram cadastrados explicitamente no BancoLead. Use para localizar um lead antes de criar um perfil ou atualizar seus dados.",
    parametersJsonSchema: { type: "object", properties: {} },
  },
  {
    name: "create_bancolead_lead",
    description: "Cadastra um novo lead na base própria do BancoLead. Use somente quando o usuário pedir explicitamente para adicionar, cadastrar ou salvar uma pessoa.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Nome completo do lead." },
        phone: { type: "string", description: "Telefone, se informado." },
        email: { type: "string", description: "E-mail, se informado." },
        title: { type: "string", description: "Profissão ou cargo, se informado." },
        notes: { type: "string", description: "Contexto e observações fornecidos pelo usuário." },
      },
      required: ["name"],
    },
  },
  {
    name: "update_bancolead_lead",
    description: "Atualiza os dados de um lead existente no BancoLead. Só execute quando o usuário pedir expressamente a alteração. Nunca invente dados.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        lead_id: { type: "string", description: "ID obtido pela listagem de leads." },
        name: { type: "string" }, phone: { type: "string" }, email: { type: "string" },
        title: { type: "string" }, notes: { type: "string" },
      },
      required: ["lead_id"],
    },
  },
  {
    name: "create_search_profile",
    description: "Cria um perfil de busca para um lead já cadastrado no BancoLead. Só use quando o usuário pedir para salvar/cadastrar a demanda. Se não souber o lead_id, liste os leads primeiro.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        lead_id: { type: "string" },
        modalidade: { type: "string", enum: ["temporada", "locacao", "compra"] },
        localizacoes: { type: "array", items: { type: "string" } },
        orcamento_max: { type: "number" },
        dormitorios_min: { type: "integer" },
        suites_min: { type: "integer" },
        hospedes: { type: "integer" },
        data_checkin: { type: "string", description: "Data YYYY-MM-DD." },
        data_checkout: { type: "string", description: "Data YYYY-MM-DD." },
        distancia_praia_max_m: { type: "integer", description: "0 significa pé na areia." },
        observacoes: { type: "string" },
        comodidades: { type: "object", properties: { piscina: { type: "boolean" }, churrasqueira: { type: "boolean" }, area_gourmet: { type: "boolean" }, servico_praia: { type: "boolean" } } },
      },
      required: ["lead_id", "modalidade"],
    },
  },
];

const asString = (value: unknown) => typeof value === "string" ? value.trim() : "";
const asNumber = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value : null;

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sessão expirada. Entre novamente." }, { status: 401 });
  if (!process.env.GEMINI_API_KEY) return NextResponse.json({ error: "GEMINI_API_KEY ainda não está configurada na Vercel." }, { status: 503 });

  const { data: membership, error: membershipError } = await supabase
    .from("crm_workspace_members").select("workspace_id").eq("user_id", user.id).limit(1).single();
  if (membershipError || !membership) return NextResponse.json({ error: "Sua conta não possui um workspace autorizado." }, { status: 403 });
  const workspaceId = membership.workspace_id as string;

  let body: { messages?: ChatMessage[] };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Mensagem inválida." }, { status: 400 }); }
  const messages = (Array.isArray(body.messages) ? body.messages : [])
    .filter((item): item is ChatMessage => item && (item.role === "user" || item.role === "model") && typeof item.text === "string")
    .slice(-12).map((item) => ({ role: item.role, parts: [{ text: item.text.slice(0, 4000) }] }));
  if (!messages.length || messages[messages.length - 1].role !== "user") return NextResponse.json({ error: "Envie uma mensagem." }, { status: 400 });

  const execute = async (name: string, args: Args): Promise<Record<string, unknown>> => {
    if (name === "list_bancolead_leads") {
      const { data, error } = await supabase.from("bancolead_leads")
        .select("id,name,phone,email,title,notes").eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false }).limit(50);
      if (error) throw new Error("Não consegui consultar os leads.");
      return { leads: data || [], count: data?.length || 0 };
    }
    if (name === "create_bancolead_lead") {
      const leadName = asString(args.name);
      if (!leadName) throw new Error("O nome do lead é obrigatório.");
      const { data, error } = await supabase.from("bancolead_leads").insert({
        workspace_id: workspaceId, name: leadName, phone: asString(args.phone) || null,
        email: asString(args.email) || null, title: asString(args.title) || null,
        notes: asString(args.notes) || null, source: "gemini", created_by: user.id,
      }).select("id,name,phone,email,title,notes").single();
      if (error || !data) throw new Error("Não foi possível cadastrar o lead.");
      return { success: true, action: "lead_created", lead: data };
    }
    if (name === "update_bancolead_lead") {
      const leadId = asString(args.lead_id);
      const patch: Record<string, string | null> = {};
      for (const key of ["name", "phone", "email", "title", "notes"] as const) {
        if (typeof args[key] === "string") patch[key] = asString(args[key]) || null;
      }
      if (!Object.keys(patch).length) throw new Error("Nenhum campo foi informado para atualizar.");
      if (patch.name === null) throw new Error("O nome não pode ficar vazio.");
      const { data, error } = await supabase.from("bancolead_leads").update(patch)
        .eq("id", leadId).eq("workspace_id", workspaceId)
        .select("id,name,phone,email,title,notes").single();
      if (error || !data) throw new Error("Lead não encontrado ou sem permissão.");
      return { success: true, action: "lead_updated", lead: data };
    }
    if (name === "create_search_profile") {
      const leadId = asString(args.lead_id);
      const modalidade = asString(args.modalidade);
      if (!["temporada", "locacao", "compra"].includes(modalidade)) throw new Error("Modalidade inválida.");
      const { data: lead } = await supabase.from("bancolead_leads").select("id")
        .eq("id", leadId).eq("workspace_id", workspaceId).single();
      if (!lead) throw new Error("Lead não encontrado. Liste os leads antes de criar o perfil.");
      const checkin = asString(args.data_checkin) || null;
      const checkout = asString(args.data_checkout) || null;
      if (checkin && checkout && checkin >= checkout) throw new Error("Check-out precisa ser posterior ao check-in.");
      const locations = Array.isArray(args.localizacoes) ? args.localizacoes.filter((v): v is string => typeof v === "string").map(v => v.trim()).filter(Boolean).slice(0,20) : [];
      const { data, error } = await supabase.from("lead_search_profiles").insert({
        workspace_id: workspaceId, lead_id: leadId, created_by: user.id, modalidade,
        localizacoes: locations, orcamento_max: asNumber(args.orcamento_max),
        dormitorios_min: asNumber(args.dormitorios_min), suites_min: asNumber(args.suites_min),
        hospedes: asNumber(args.hospedes), data_checkin: checkin, data_checkout: checkout,
        distancia_praia_max_m: asNumber(args.distancia_praia_max_m),
        observacoes: asString(args.observacoes) || null,
        comodidades: args.comodidades && typeof args.comodidades === "object" ? args.comodidades : {},
        regras: {}, status: "ativo",
      }).select("id,lead_id,modalidade,localizacoes").single();
      if (error || !data) throw new Error("Não foi possível salvar o perfil de busca.");
      return { success: true, action: "profile_created", profile: data };
    }
    throw new Error("Ação não autorizada.");
  };

  try {
    const ai = getGeminiClient();
    const systemInstruction = [
      "Você é o assistente operacional do BancoLead, uma ferramenta privada de relacionamento imobiliário.",
      "A base BancoLead é independente: nunca importe nem consulte crm_contacts ou crm_deals.",
      "O catálogo de imóveis do BancoImob é apenas leitura nesta conversa.",
      "Você pode listar, cadastrar e atualizar leads próprios e cadastrar perfis de busca.",
      "REGRA DE ESCRITA: nunca execute ferramenta que altere dados só porque o usuário descreveu uma pessoa ou situação. Só grave quando houver comando explícito como 'cadastre', 'adicione', 'salve', 'atualize' ou equivalente.",
      "Se faltarem dados essenciais, faça uma pergunta em vez de inventar. Não invente telefone, e-mail, profissão, orçamento ou datas.",
      "Para criar perfil, se o lead ainda não estiver cadastrado, peça os dados ou cadastre-o apenas se o usuário também tiver pedido isso explicitamente.",
      "Após cada operação, informe claramente o que foi realmente salvo. Não diga que gravou se a ferramenta falhar.",
      "Responda em português brasileiro, de forma direta e organizada.",
    ].join("\\n");
    const contents: Array<{ role: string; parts: Array<Record<string, unknown>> }> = [...messages];
    let response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: contents as never,
      config: { systemInstruction, tools: [{ functionDeclarations: declarations }] },
    });
    const actions: Record<string, unknown>[] = [];
    for (let turn = 0; turn < 3; turn++) {
      const calls = response.functionCalls || [];
      if (!calls.length) break;
      const modelContent = response.candidates?.[0]?.content;
      if (modelContent) contents.push(modelContent as unknown as { role: string; parts: Array<Record<string, unknown>> });
      const functionResponses: Array<Record<string, unknown>> = [];
      for (const call of calls) {
        const actionName = call.name || "";
        try {
          const result = await execute(actionName, (call.args || {}) as Args);
          actions.push(result);
          functionResponses.push({ functionResponse: { name: actionName, response: { output: result } } });
        } catch (error) {
          functionResponses.push({ functionResponse: { name: actionName, response: { error: error instanceof Error ? error.message : "Falha na operação." } } });
        }
      }
      contents.push({ role: "user", parts: functionResponses });
      response = await ai.models.generateContent({ model: GEMINI_MODEL, contents: contents as never, config: { systemInstruction, tools: [{ functionDeclarations: declarations }] } });
    }
    return NextResponse.json({ text: response.text || "Concluído.", actions });
  } catch (error) {
    console.error("BancoLead assistant error:", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "O Gemini não conseguiu processar a mensagem. Verifique a configuração da API e tente novamente." }, { status: 502 });
  }
}
