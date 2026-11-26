import { redirect } from "next/navigation";
import Link from "next/link";
import { signOut } from "@/app/actions";
import { LeadForm } from "@/components/lead-form";
import { TenantWorkspace } from "@/components/tenant-workspace";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Lead = { id: string; name: string; phone: string | null; email: string | null; title: string | null; notes: string | null };
type Profile = {
  id: string; lead_id: string; modalidade: string; localizacoes: string[]; status: string;
  hospedes: number | null; data_checkin: string | null; data_checkout: string | null;
  orcamento_max: number | null; dormitorios_min: number | null; suites_min: number | null;
  distancia_praia_max_m: number | null; comodidades: Record<string, boolean> | null; observacoes: string | null;
};
type Recommendation = {
  id: string; profile_id: string; property_id: string; compatibility_score: number;
  reasoning: string; matched_criteria: string[]; unmatched_criteria: string[];
  model_name: string; status: string; generated_at: string;
  property?: {
    codigo: string | null; titulo: string; bairro: string | null; cidade: string;
    dormitorios: number; suites: number; capacidade: number; distancia_praia: number | null;
    piscina: boolean; churrasqueira: boolean; area_gourmet: boolean; servico_praia: boolean;
    url_origem: string | null; cover: string | null;
  };
};
type Property = {
  id: string; codigo: string | null; titulo: string; bairro: string | null; cidade: string;
  dormitorios: number; suites: number; capacidade: number; distancia_praia: number | null;
  piscina: boolean; churrasqueira: boolean; area_gourmet: boolean; servico_praia: boolean; url_origem: string | null;
};

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: rawLeads }, { data: rawProfiles, error: profilesError }] = await Promise.all([
    supabase.from("bancolead_leads").select("id,name,phone,email,title,notes").order("created_at", { ascending: false }).limit(300),
    supabase.from("lead_search_profiles").select("id,lead_id,modalidade,localizacoes,status,hospedes,data_checkin,data_checkout,orcamento_max,dormitorios_min,suites_min,distancia_praia_max_m,comodidades,observacoes").eq("modalidade", "temporada").order("updated_at", { ascending: false }).limit(300),
  ]);

  const leads = (rawLeads || []) as Lead[];
  const profiles = (rawProfiles || []) as Profile[];
  const profileByLead = new Map<string, Profile>();
  profiles.forEach((profile) => { if (!profileByLead.has(profile.lead_id)) profileByLead.set(profile.lead_id, profile); });
  const tenants = leads.flatMap((lead) => {
    const profile = profileByLead.get(lead.id);
    if (!profile) return [];
    return [{
      id: lead.id, name: lead.name, phone: lead.phone, email: lead.email, title: lead.title, notes: lead.notes,
      profileId: profile.id, locations: profile.localizacoes || [], guests: profile.hospedes,
      checkin: profile.data_checkin, checkout: profile.data_checkout, budget: profile.orcamento_max,
      bedrooms: profile.dormitorios_min, suites: profile.suites_min, beachDistance: profile.distancia_praia_max_m,
      amenities: profile.comodidades || {}, preferences: profile.observacoes,
    }];
  });

  const profileIds = profiles.map((profile) => profile.id);
  const { data: rawRecommendations } = profileIds.length ? await supabase.from("property_recommendations")
    .select("id,profile_id,property_id,compatibility_score,reasoning,matched_criteria,unmatched_criteria,model_name,status,generated_at")
    .in("profile_id", profileIds).neq("status", "descartado").order("generated_at", { ascending: false }).limit(300) : { data: [] };
  const recommendations = (rawRecommendations || []) as Recommendation[];
  const propertyIds = [...new Set(recommendations.map((item) => item.property_id).filter(Boolean))];
  const [{ data: rawProperties }, { data: rawPhotos }] = propertyIds.length ? await Promise.all([
    supabase.from("mare_imoveis").select("id,codigo,titulo,bairro,cidade,dormitorios,suites,capacidade,distancia_praia,piscina,churrasqueira,area_gourmet,servico_praia,url_origem").in("id", propertyIds),
    supabase.from("mare_fotos_imovel").select("imovel_id,url,capa,ordem").in("imovel_id", propertyIds).order("capa", { ascending: false }).order("ordem"),
  ]) : [{ data: [] }, { data: [] }];
  const propertyById = new Map(((rawProperties || []) as Property[]).map((property) => [property.id, property]));
  const photos = (rawPhotos || []) as { imovel_id: string; url: string; capa: boolean; ordem: number }[];
  const recommendationViews = recommendations.map((item) => {
    const property = propertyById.get(item.property_id);
    const cover = photos.find((photo) => photo.imovel_id === item.property_id && photo.capa)?.url || photos.find((photo) => photo.imovel_id === item.property_id)?.url || null;
    return { ...item, property: property ? { ...property, cover } : undefined };
  });

  return (
    <main className="layout">
      <aside className="sidebar">
        <Link className="logo" href="/"><span className="logo-mark">B</span><span><b>BancoLead</b><small>LOCAÇÃO DE TEMPORADA</small></span></Link>
        <small className="kicker">ATENDIMENTO</small>
        <nav><a className="nav active" href="#locatarios"><span>♙</span>Locatários</a></nav>
        <div className="side-bottom"><span>● Workspace privado</span><form action={signOut}><button type="submit">Sair ↗</button></form></div>
      </aside>
      <section className="main">
        <header><div className="mobile-logo">BancoLead</div><div className="header-links"><a href="https://bancoimob-bronca.vercel.app/" target="_blank" rel="noreferrer">BancoImob ↗</a><span className="header-user">{(user.email||"U").slice(0,1).toUpperCase()}</span></div></header>
        <div className="content">
          <div className="heading"><div><small className="kicker">GESTÃO DE CLIENTES</small><h1>Locatários</h1><p>Cadastre a demanda e encontre imóveis de temporada compatíveis no BancoImob.</p></div><LeadForm/></div>
          {profilesError&&<div className="notice error">Não foi possível carregar os perfis de temporada. Verifique o acesso ao workspace.</div>}
          <div className="metrics"><article><small>Locatários cadastrados</small><strong>{tenants.length}</strong><span>Base própria BancoLead</span></article><article><small>Imóveis no match</small><strong>{recommendations.length}</strong><span>Recomendações salvas</span></article></div>
          <section id="locatarios"><TenantWorkspace tenants={tenants} initialRecommendations={recommendationViews}/></section>
          <footer className="app-footer">BancoLead <span>·</span> Base independente <span>·</span> Catálogo conectado ao BancoImob</footer>
        </div>
      </section>
    </main>
  );
}
