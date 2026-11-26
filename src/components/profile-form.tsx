"use client";

import { useState } from "react";
import { createSearchProfile } from "@/app/actions";

type Lead = { id: string; name: string; phone: string | null; title: string | null };

export function ProfileForm({ leads }: { leads: Lead[] }) {
  const [leadId,setLeadId]=useState(leads[0]?.id||"");
  const [mode,setMode]=useState<"temporada"|"locacao"|"compra">("temporada");
  const [locations,setLocations]=useState("");
  const [budget,setBudget]=useState("");
  const [bedrooms,setBedrooms]=useState("");
  const [suites,setSuites]=useState("");
  const [guests,setGuests]=useState("");
  const [checkin,setCheckin]=useState("");
  const [checkout,setCheckout]=useState("");
  const [distance,setDistance]=useState("");
  const [notes,setNotes]=useState("");
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");

  async function submit(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();setBusy(true);setMessage("");
    const data=new FormData();
    data.set("lead_id",leadId);data.set("modalidade",mode);data.set("localizacoes",locations);
    data.set("orcamento_max",budget);data.set("dormitorios_min",bedrooms);data.set("suites_min",suites);
    data.set("hospedes",guests);data.set("data_checkin",checkin);data.set("data_checkout",checkout);
    data.set("distancia_praia_max_m",distance);data.set("observacoes",notes);
    const result=await createSearchProfile(data);
    setBusy(false);
    setMessage(result.error||(result.success?"Perfil de busca salvo.":"Não foi possível salvar."));
    if(result.success){setLocations("");setBudget("");setBedrooms("");setSuites("");setGuests("");setCheckin("");setCheckout("");setDistance("");setNotes("");}
  }

  return <form onSubmit={submit} className="profile-form">
    <div className="form-heading"><div><span className="eyebrow">Novo perfil de busca</span><h3>O que esse lead procura?</h3><p>Somente leads cadastrados expressamente no BancoLead aparecem aqui.</p></div><span className="step">01 / 03</span></div>
    <label className="field"><span>Lead</span><select required value={leadId} onChange={e=>setLeadId(e.target.value)}><option value="">Selecione um lead</option>{leads.map(lead=><option key={lead.id} value={lead.id}>{lead.name}</option>)}</select></label>
    <div className="field"><span>Modalidade</span><div className="segmented">{(["temporada","locacao","compra"] as const).map(item=><button type="button" key={item} className={mode===item?"selected":""} onClick={()=>setMode(item)}>{item==="temporada"?"Temporada":item==="locacao"?"Locação":"Compra"}</button>)}</div></div>
    <label className="field"><span>Localizações de interesse</span><input value={locations} onChange={e=>setLocations(e.target.value)} placeholder="Juquehy, Barra do Sahy, Camburi"/></label>
    <div className="field-grid">
      <label className="field"><span>Orçamento máximo (R$)</span><input type="number" min="0" value={budget} onChange={e=>setBudget(e.target.value)} placeholder="Ex.: 15000"/></label>
      <label className="field"><span>Distância máxima da praia (m)</span><input type="number" min="0" value={distance} onChange={e=>setDistance(e.target.value)} placeholder="0 = pé na areia"/></label>
      <label className="field"><span>Dormitórios mínimos</span><input type="number" min="0" value={bedrooms} onChange={e=>setBedrooms(e.target.value)} placeholder="Qualquer"/></label>
      <label className="field"><span>Suítes mínimas</span><input type="number" min="0" value={suites} onChange={e=>setSuites(e.target.value)} placeholder="Qualquer"/></label>
      {mode!=="compra"&&<><label className="field"><span>Hóspedes</span><input type="number" min="1" value={guests} onChange={e=>setGuests(e.target.value)} placeholder="Nº de pessoas"/></label><label className="field"><span>Check-in</span><input type="date" value={checkin} onChange={e=>setCheckin(e.target.value)}/></label><label className="field"><span>Check-out</span><input type="date" value={checkout} onChange={e=>setCheckout(e.target.value)}/></label></>}
    </div>
    <label className="field"><span>Observações e prioridades</span><textarea rows={3} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Preferências, itens indispensáveis, flexibilidade…"/></label>
    <div className="form-footer"><p className="status-message" role="status">{message}</p><button className="primary-button" disabled={busy||!leadId}>{busy?"Salvando…":"Salvar perfil de busca"} <span>→</span></button></div>
  </form>;
}
