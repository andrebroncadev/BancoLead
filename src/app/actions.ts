"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const numberOrNull = (value: FormDataEntryValue | null) => {
  if (typeof value !== "string" || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export async function createLead(data: FormData): Promise<{ success?: boolean; error?: string; lead?: { id: string; name: string; phone: string | null; email: string | null; title: string | null; notes: string | null }; profileId?: string }> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sua sessão expirou. Entre novamente." };

  const name = String(data.get("name") || "").trim();
  if (!name) return { error: "Informe o nome do locatário." };

  const checkin = String(data.get("data_checkin") || "") || null;
  const checkout = String(data.get("data_checkout") || "") || null;
  if (checkin && checkout && checkin >= checkout) return { error: "O check-out precisa ser posterior ao check-in." };

  const guests = numberOrNull(data.get("hospedes"));
  if (guests !== null && guests < 1) return { error: "A quantidade de hóspedes precisa ser maior que zero." };

  const { data: membership, error: membershipError } = await supabase
    .from("crm_workspace_members").select("workspace_id").eq("user_id", user.id).limit(1).single();
  if (membershipError || !membership) return { error: "Não encontrei um workspace autorizado para sua conta." };

  const workspaceId = membership.workspace_id;
  const { data: lead, error: leadError } = await supabase.from("bancolead_leads").insert({
    workspace_id: workspaceId,
    name,
    phone: String(data.get("phone") || "").trim() || null,
    email: String(data.get("email") || "").trim() || null,
    title: String(data.get("title") || "").trim() || null,
    notes: String(data.get("notes") || "").trim() || null,
    source: "manual",
    created_by: user.id,
  }).select("id,name,phone,email,title,notes").single();

  if (leadError || !lead) return { error: "Não foi possível cadastrar o locatário. Verifique as permissões." };

  const locations = String(data.get("localizacoes") || "").split(",").map((value) => value.trim()).filter(Boolean);
  const amenities = {
    piscina: data.get("piscina") === "on",
    churrasqueira: data.get("churrasqueira") === "on",
    area_gourmet: data.get("area_gourmet") === "on",
    servico_praia: data.get("servico_praia") === "on",
  };
  const { data: profile, error: profileError } = await supabase.from("lead_search_profiles").insert({
    workspace_id: workspaceId,
    lead_id: lead.id,
    created_by: user.id,
    modalidade: "temporada",
    localizacoes: locations,
    dormitorios_min: numberOrNull(data.get("dormitorios_min")),
    suites_min: numberOrNull(data.get("suites_min")),
    orcamento_max: numberOrNull(data.get("orcamento_max")),
    distancia_praia_max_m: numberOrNull(data.get("distancia_praia_max_m")),
    hospedes: guests,
    data_checkin: checkin,
    data_checkout: checkout,
    observacoes: String(data.get("preferencias") || "").trim() || null,
    comodidades: amenities,
    regras: {},
    status: "ativo",
  }).select("id").single();

  if (profileError || !profile) {
    await supabase.from("bancolead_leads").delete().eq("id", lead.id).eq("workspace_id", workspaceId);
    return { error: "O locatário não foi salvo porque não foi possível gravar os critérios da temporada. Tente novamente." };
  }

  revalidatePath("/");
  return { success: true, lead, profileId: profile.id };
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
