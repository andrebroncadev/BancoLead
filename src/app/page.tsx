import Link from "next/link";
import { redirect } from "next/navigation";
import { signOut } from "@/app/actions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Contact = { id: string; name: string | null; phone: string | null; email: string | null; location: string | null; roles: string[] | null };
type Profile = { id: string; lead_id: string; modalidade: string; localizacoes: string[]; status: string; updated_at: string };

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: contacts, error: contactsError }, { data: profiles, error: profilesError }] = await Promise.all([
    supabase.from("crm_contacts").select("id,name,phone,email,location,roles").order("name").limit(100),
    supabase.from("lead_search_profiles").select("id,lead_id,modalidade,localizacoes,status,updated_at").order("updated_at", { ascending: false }).limit(100),
  ]);

  const safeContacts = (contacts || []) as Contact[];
  const safeProfiles = (profiles || []) as Profile[];
  const contactById = new Map(safeContacts.map((contact) => [contact.id, contact]));

  return (
    <main className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <div><p className="text-xs font-bold uppercase tracking-[.2em] text-blue-700">BancoLead</p><h1 className="text-xl font-bold">Inteligência comercial</h1></div>
          <form action={signOut}><button className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium">Sair</button></form>
        </div>
      </header>
      <section className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-8"><h2 className="text-2xl font-bold">Visão geral</h2><p className="mt-1 text-sm text-slate-500">Perfis de busca conectados ao CRM e ao catálogo BancoImob.</p></div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat label="Contatos visíveis" value={String(safeContacts.length)} />
          <Stat label="Perfis de busca" value={String(safeProfiles.length)} />
          <Stat label="Perfis ativos" value={String(safeProfiles.filter((p) => p.status === "ativo").length)} />
        </div>
        {(contactsError || profilesError) && <p className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">Algumas consultas não puderam ser carregadas. Verifique as políticas de acesso do CRM e das novas tabelas.</p>}
        <div className="mt-10 grid gap-8 lg:grid-cols-[1.1fr_.9fr]">
          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="mb-4 flex items-center justify-between"><h3 className="font-bold">Contatos do CRM</h3><span className="text-xs text-slate-500">Até 100 registros</span></div>
            <div className="divide-y divide-slate-100">
              {safeContacts.slice(0, 12).map((contact) => <div key={contact.id} className="py-3"><p className="font-medium">{contact.name || "Contato sem nome"}</p><p className="mt-1 text-xs text-slate-500">{[contact.location, contact.phone, contact.email].filter(Boolean).join(" · ") || "Sem dados complementares"}</p></div>)}
              {safeContacts.length === 0 && <p className="py-8 text-sm text-slate-500">Nenhum contato visível para este usuário.</p>}
            </div>
          </section>
          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="mb-4 flex items-center justify-between"><h3 className="font-bold">Perfis de busca recentes</h3><span className="text-xs text-slate-500">Mais recentes</span></div>
            <div className="divide-y divide-slate-100">
              {safeProfiles.map((profile) => { const contact = contactById.get(profile.lead_id); return <div key={profile.id} className="py-3"><p className="font-medium">{contact?.name || "Lead"}</p><p className="mt-1 text-xs text-slate-500">{profile.modalidade} · {profile.localizacoes.join(", ") || "Localização não definida"}</p></div>; })}
              {safeProfiles.length === 0 && <p className="py-8 text-sm text-slate-500">Ainda não existem perfis de busca cadastrados.</p>}
            </div>
          </section>
        </div>
        <p className="mt-8 text-xs text-slate-400">Sessão: {user.email}</p>
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-3xl font-bold tracking-tight">{value}</p></div>;
}
