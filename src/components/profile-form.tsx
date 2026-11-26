"use client";

import { useState } from "react";
import { createSearchProfile } from "@/app/actions";

type Lead = { id: string; name: string; phone: string | null; location: string | null; deal?: { budget: number | null; neighborhood: string | null; bedrooms: number | null; suites: number | null; people: number | null; check_in: string | null; check_out: string | null; kind: string } };

const money = (value: number | null | undefined) => value ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(value) : "";

export function ProfileForm({ leads }: { leads: Lead[] }) {
  const [leadId, setLeadId] = useState(leads[0]?.id || "");
  const selected = leads.find((lead) => lead.id === leadId);
  const [mode, setMode] = useState<"temporada" | "locacao" | "compra">(selected?.deal?.kind === "compra" ? "compra" : selected?.deal?.kind === "locacao" ? "locacao" : "temporada");
  const [locations, setLocations] = useState(selected?.deal?.neighborhood || selected?.location || "Juquehy");
  const [budget, setBudget] = useState(selected?.deal?.budget ? String(selected.deal.budget) : "");
  const [bedrooms, setBedrooms] = useState(selected?.deal?.bedrooms ? String(selected.deal.bedrooms) : "");
  const [suites, setSuites] = useState(selected?.deal?.suites ? String(selected.deal.suites) : "");
  const [guests, setGuests] = useState(selected?.deal?.people ? String(selected.deal.people) : "");
  const [checkin, setCheckin] = useState(selected?.deal?.check_in || "");
  const [checkout, setCheckout] = useState(selected?.deal?.check_out || "");
  const [distance, setDistance] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  function selectLead(id: string) {
    setLeadId(id);
    const lead = leads.find((item) => item.id === id);
    if (!lead) return;
    setLocations(lead.deal?.neighborhood || lead.location || "");
    setBudget(lead.deal?.budget ? String(lead.deal.budget) : "");
    setBedrooms(lead.deal?.bedrooms ? String(lead.deal.bedrooms) : "");
    setSuites(lead.deal?.suites ? String(lead.deal.suites) : "");
    setGuests(lead.deal?.people ? String(lead.deal.people) : "");
    setCheckin(lead.deal?.check_in || "");
    setCheckout(lead.deal?.check_out || "");
    setMode(lead.deal?.kind === "compra" ? "compra" : lead.deal?.kind === "locacao" ? "locacao" : "temporada");
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setMessage("");
    const data = new FormData();
    data.set("lead_id", leadId); data.set("modalidade", mode); data.set("localizacoes", locations);
    data.set("orcamento_max", budget); data.set("dormitorios_min", bedrooms); data.set("suites_min", suites);
    data.set("hospedes", guests); data.set("data_checkin", checkin); data.set("data_checkout", checkout);
    data.set("distancia_praia_max_m", distance); data.set("observacoes", notes);
    const result = await createSearchProfile(data);
    setMessage(result.error || (result.success ? "Perfil salvo com sucesso. Ele já está vinculado ao lead no CRM." : "Não foi possível salvar."));
    setBusy(false);
    if (result.success) event.currentTarget.reset();
  }

  return <form onSubmit={submit} className="profile-form">
    <div className="form-heading"><div><span className="eyebrow">Novo perfil de busca</span><h3>O que esse lead procura?</h3><p>Os dados existentes no CRM são sugeridos automaticamente. Revise antes de salvar.</p></div><span className="step">01 / 03</span></div>
    <label className="field"><span>Lead do CRM</span><select required value={leadId} onChange={(e) => selectLead(e.target.value)}><option value="">Selecione um contato</option>{leads.map((lead) => <option key={lead.id} value={lead.id}>{lead.name}{lead.location ? " · " + lead.location : ""}</option>)}</select></label>
    {selected && <div className="lead-hint"><span className="avatar">{selected.name.slice(0,1).toUpperCase()}</span><div><strong>{selected.name}</strong><small>{[selected.phone, selected.location].filter(Boolean).join(" · ") || "Contato vinculado ao CRM"}</small></div><span className="linked">CRM conectado</span></div>}
    <div className="field"><span>Modalidade</span><div className="segmented">{(["temporada","locacao","compra"] as const).map((item) => <button type="button" key={item} className={mode===item?"selected":""} onClick={() => setMode(item)}>{item==="temporada"?"Temporada":item==="locacao"?"Locação":"Compra"}</button>)}</div></div>
    <label className="field"><span>Localizações de interesse</span><input value={locations} onChange={(e)=>setLocations(e.target.value)} placeholder="Ex.: Juquehy, Barra do Sahy, Camburi" /></label>
    <div className="field-grid">
      <label className="field"><span>Orçamento máximo (R$)</span><input type="number" min="0" value={budget} onChange={(e)=>setBudget(e.target.value)} placeholder="Ex.: 15000" /></label>
      <label className="field"><span>Distância máxima da praia (m)</span><input type="number" min="0" value={distance} onChange={(e)=>setDistance(e.target.value)} placeholder="0 = pé na areia" /></label>
      <label className="field"><span>Dormitórios mínimos</span><input type="number" min="0" value={bedrooms} onChange={(e)=>setBedrooms(e.target.value)} placeholder="Qualquer" /></label>
      <label className="field"><span>Suítes mínimas</span><input type="number" min="0" value={suites} onChange={(e)=>setSuites(e.target.value)} placeholder="Qualquer" /></label>
      {mode!=="compra" && <><label className="field"><span>Hóspedes</span><input type="number" min="1" value={guests} onChange={(e)=>setGuests(e.target.value)} placeholder="Nº de pessoas" /></label><label className="field"><span>Check-in</span><input type="date" value={checkin} onChange={(e)=>setCheckin(e.target.value)} /></label><label className="field"><span>Check-out</span><input type="date" value={checkout} onChange={(e)=>setCheckout(e.target.value)} /></label></>}
    </div>
    <label className="field"><span>Observações e prioridades</span><textarea rows={3} value={notes} onChange={(e)=>setNotes(e.target.value)} placeholder="Preferências, itens indispensáveis, flexibilidade..." /></label>
    <div className="form-footer"><p className="status-message" role="status">{message}</p><button className="primary-button" disabled={busy || !leadId}>{busy?"Salvando…":"Salvar perfil de busca"} <span>→</span></button></div>
  </form>;
}
