"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const numberOrNull = (value: FormDataEntryValue | null) => {
  if (typeof value !== "string" || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export async function createSearchProfile(data: FormData): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sua sessão expirou. Entre novamente." };

  const leadId = String(data.get("lead_id") || "");
  const modalidade = String(data.get("modalidade") || "");
  if (!leadId || !["temporada", "locacao", "compra"].includes(modalidade)) return { error: "Selecione um lead e uma modalidade válida." };

  const { data: lead, error: leadError } = await supabase.from("crm_contacts").select("id,workspace_id").eq("id", leadId).single();
  if (leadError || !lead) return { error: "Não foi possível validar o contato selecionado." };

  const checkin = String(data.get("data_checkin") || "") || null;
  const checkout = String(data.get("data_checkout") || "") || null;
  if (checkin && checkout && checkin >= checkout) return { error: "A data de check-out precisa ser posterior ao check-in." };

  const locations = String(data.get("localizacoes") || "").split(",").map((v) => v.trim()).filter(Boolean);
  const { error } = await supabase.from("lead_search_profiles").insert({
    workspace_id: lead.workspace_id,
    lead_id: lead.id,
    created_by: user.id,
    modalidade,
    localizacoes: locations,
    dormitorios_min: numberOrNull(data.get("dormitorios_min")),
    suites_min: numberOrNull(data.get("suites_min")),
    orcamento_max: numberOrNull(data.get("orcamento_max")),
    distancia_praia_max_m: numberOrNull(data.get("distancia_praia_max_m")),
    hospedes: numberOrNull(data.get("hospedes")),
    data_checkin: checkin,
    data_checkout: checkout,
    observacoes: String(data.get("observacoes") || "").trim() || null,
    comodidades: {},
    regras: {},
    status: "ativo",
  });
  if (error) return { error: "Não foi possível salvar o perfil. Verifique as permissões do workspace." };
  revalidatePath("/");
  return { success: true };
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
