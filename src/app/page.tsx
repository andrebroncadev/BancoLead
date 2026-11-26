import { redirect } from "next/navigation";
import { signOut } from "@/app/actions";
import { ProfileForm } from "@/components/profile-form";
import { RecommendationsPanel } from "@/components/recommendations-panel";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Contact = { id: string; name: string; phone: string | null; email: string | null; location: string | null; roles: string[] | null };
type Deal = { id: string; contact_id: string | null; kind: string; budget: number | null; check_in: string | null; check_out: string | null; people: number | null; neighborhood: string | null; bedrooms: number | null; suites: number | null };
type Profile = { id: string; lead_id: string; modalidade: string; localizacoes: string[]; status: string; updated_at: string; hospedes: number | null; data_checkin: string | null; data_checkout: string | null };
type Recommendation = { id: string; profile_id: string; property_id: string; compatibility_score: number; reasoning: string; matched_criteria: string[]; unmatched_criteria: string[]; model_name: string; status: string; generated_at: string };
type Property = { id: string; codigo: string | null; titulo: string; bairro: string | null; cidade: string; dormitorios: number; suites: number; capacidade: number; distancia_praia: number | null; piscina: boolean; servico_praia: boolean; url_origem: string | null };

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: contacts, error: contactsError }, { data: profiles, error: profilesError }, { data: deals }] = await Promise.all([
    supabase.from("crm_contacts").select("id,name,phone,email,location,roles").order("name").limit(250),
    supabase.from("lead_search_profiles").select("id,lead_id,modalidade,localizacoes,status,updated_at,hospedes,data_checkin,data_checkout").order("updated_at", { ascending: false }).limit(100),
    supabase.from("crm_deals").select("id,contact_id,kind,budget,check_in,check_out,people,neighborhood,bedrooms,suites").eq("status", "open").order("updated_at", { ascending: false }).limit(250),
  ]);

  const safeContacts = (contacts || []) as Contact[];
  const safeProfiles = (profiles || []) as Profile[];
  const safeDeals = (deals || []) as Deal[];
  const dealByContact = new Map<string, Deal>();
  safeDeals.forEach((deal) => { if (deal.contact_id && !dealByContact.has(deal.contact_id)) dealByContact.set(deal.contact_id, deal); });
  const leads = safeContacts.map((contact) => ({ ...contact, deal: dealByContact.get(contact.id) }));
  const contactById = new Map(safeContacts.map((contact) => [contact.id, contact]));
  const activeProfiles = safeProfiles.filter((profile) => profile.status === "ativo").length;
  const { data: rawRecommendations } = safeProfiles.length ? await supabase.from("property_recommendations")
    .select("id,profile_id,property_id,compatibility_score,reasoning,matched_criteria,unmatched_criteria,model_name,status,generated_at")
    .in("profile_id", safeProfiles.map((profile) => profile.id)).neq("status", "descartado")
    .order("generated_at", { ascending: false }).limit(100) : { data: [] };
  const safeRecommendations = (rawRecommendations || []) as Recommendation[];
  const propertyIds = [...new Set(safeRecommendations.map((item) => item.property_id).filter(Boolean))];
  const [{ data: rawRecommendedProperties }, { data: rawRecommendationPhotos }] = propertyIds.length ? await Promise.all([
    supabase.from("mare_imoveis").select("id,codigo,titulo,bairro,cidade,dormitorios,suites,capacidade,distancia_praia,piscina,servico_praia,url_origem").in("id", propertyIds),
    supabase.from("mare_fotos_imovel").select("imovel_id,url,capa,ordem").in("imovel_id", propertyIds).order("capa", { ascending: false }).order("ordem"),
  ]) : [{ data: [] }, { data: [] }];
  const recommendedProperties = new Map(((rawRecommendedProperties || []) as Property[]).map((property) => [property.id, property]));
  const recommendationPhotos = (rawRecommendationPhotos || []) as { imovel_id: string; url: string; capa: boolean; ordem: number }[];
  const profileViews = safeProfiles.map((profile) => ({ ...profile, leadName: contactById.get(profile.lead_id)?.name || "Lead sem nome" }));
  const recommendationViews = safeRecommendations.map((item) => {
    const property = recommendedProperties.get(item.property_id);
    const cover = recommendationPhotos.find((photo) => photo.imovel_id === item.property_id && photo.capa)?.url || recommendationPhotos.find((photo) => photo.imovel_id === item.property_id)?.url || null;
    return { ...item, property: property ? { ...property, cover } : undefined };
  });

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="/"><span className="brand-mark">B</span><span>BancoLead<small>INTELIGÊNCIA COMERCIAL</small></span></a>
        <div className="side-label">WORKSPACE</div>
        <a className="side-link active" href="/"><span>▦</span> Visão geral</a>
        <a className="side-link" href="#novo-perfil"><span>＋</span> Novo perfil de busca</a>
        <a className="side-link" href="#perfis"><span>◎</span> Perfis de busca</a>
        <div className="side-bottom"><div className="avatar user-avatar">{(user.email || "U").slice(0,1).toUpperCase()}</div><div className="user-meta"><strong>{user.email}</strong><small>Conta autenticada</small></div><form action={signOut}><button className="logout" aria-label="Sair">↗</button></form></div>
      </aside>
      <section className="main-area">
        <header className="topbar"><div><span className="crumb">Workspace /</span> <strong>Visão geral</strong></div><div className="top-actions"><span className="connection"><i/> CRM conectado</span><a className="imob-link" href="https://bancoimob-bronca.vercel.app/" target="_blank" rel="noreferrer">Abrir BancoImob ↗</a></div></header>
        <div className="content">
          <div className="welcome-row"><div><span className="eyebrow">CENTRAL DE INTELIGÊNCIA IMOBILIÁRIA</span><h1>Encontre o imóvel certo<br/><em>para cada lead.</em></h1><p>Transforme a intenção de busca em recomendações mais assertivas.</p></div><div className="welcome-art"><div className="art-circle"/><div className="art-card"><span>LEAD MATCH</span><strong>↗</strong><small>CRM × BancoImob</small></div></div></div>
          <div className="stats-grid"><Stat label="Contatos no CRM" value={String(safeContacts.length)} detail="Base conectada" icon="♙"/><Stat label="Perfis de busca" value={String(safeProfiles.length)} detail="Demandas estruturadas" icon="◎"/><Stat label="Perfis ativos" value={String(activeProfiles)} detail="Em acompanhamento" icon="◷"/><Stat label="Oportunidades" value={String(safeDeals.length)} detail="Negociações abertas" icon="↗"/></div>
          {(contactsError || profilesError) && <div className="notice">Algumas consultas não puderam ser carregadas. Verifique as políticas de acesso do CRM.</div>}
          <div className="workspace-grid">
            <section className="panel profile-panel" id="novo-perfil"><div className="panel-top"><div><span className="eyebrow">COMECE POR AQUI</span><h2>Estruture uma busca</h2></div><span className="panel-icon">✳</span></div><ProfileForm leads={leads}/></section>
            <section className="panel lead-panel"><div className="panel-top"><div><span className="eyebrow">BASE DE CONTATOS</span><h2>Leads recentes</h2></div><span className="count">{safeContacts.length} contatos</span></div><div className="lead-list">{safeContacts.slice(0,8).map((contact)=>{const deal=dealByContact.get(contact.id);return <div className="lead-row" key={contact.id}><span className="avatar">{contact.name.slice(0,1).toUpperCase()}</span><div className="lead-info"><strong>{contact.name}</strong><small>{contact.location || contact.phone || "Contato cadastrado"}</small></div>{deal&&<span className="intent-tag">{deal.kind==="compra"?"Compra":deal.kind==="locacao"?"Locação":"Temporada"}</span>}</div>})}{safeContacts.length===0&&<p className="empty">Nenhum contato visível neste workspace.</p>}</div><a className="text-link" href="#novo-perfil">Criar perfil para um lead <span>→</span></a></section>
          </div>
          <section className="panel recent-panel analysis-panel" id="analise"><div className="panel-top"><div><span className="eyebrow">INTELIGÊNCIA ARTIFICIAL</span><h2>Compatibilidade de imóveis</h2></div><span className="panel-icon">✳</span></div><p className="analysis-intro">O sistema aplica os filtros objetivos primeiro e usa o Gemini para explicar a aderência dos imóveis que passaram pelos critérios.</p><RecommendationsPanel profiles={profileViews} initialRecommendations={recommendationViews}/></section>
          <section className="panel recent-panel" id="perfis"><div className="panel-top"><div><span className="eyebrow">ACOMPANHAMENTO</span><h2>Perfis de busca recentes</h2></div><span className="count">{safeProfiles.length} registros</span></div><div className="profile-table"><div className="table-head"><span>LEAD</span><span>MODALIDADE</span><span>LOCALIZAÇÃO</span><span>STATUS</span></div>{safeProfiles.slice(0,10).map((profile)=>{const contact=contactById.get(profile.lead_id);return <div className="table-row" key={profile.id}><strong>{contact?.name || "Lead sem nome"}</strong><span>{profile.modalidade}</span><span>{profile.localizacoes.join(", ") || "Não definida"}</span><span className="status-pill">{profile.status}</span></div>})}{safeProfiles.length===0&&<p className="empty">Os perfis criados aparecerão aqui. Cadastre a primeira busca acima.</p>}</div></section>
          <footer className="footer">BancoLead <span>·</span> Dados sincronizados com o CRM e BancoImob</footer>
        </div>
      </section>
    </main>
  );
}

function Stat({label,value,detail,icon}:{label:string;value:string;detail:string;icon:string}) { return <div className="stat-card"><div className="stat-head"><span>{label}</span><i>{icon}</i></div><strong>{value}</strong><small>{detail}</small></div>; }
