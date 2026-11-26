"use client";

import { useMemo, useState } from "react";

type Tenant = {
  id: string; name: string; phone: string | null; email: string | null;
  title: string | null; notes: string | null; profileId: string;
  locations: string[]; guests: number | null; checkin: string | null;
  checkout: string | null; budget: number | null; bedrooms: number | null;
  suites: number | null; beachDistance: number | null; amenities: Record<string, boolean>;
  preferences: string | null;
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

export function TenantWorkspace({ tenants, initialRecommendations }: { tenants: Tenant[]; initialRecommendations: Recommendation[] }) {
  const [selectedId,setSelectedId]=useState(tenants[0]?.id||"");
  const [recommendations,setRecommendations]=useState(initialRecommendations);
  const [query,setQuery]=useState("");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const selected=tenants.find(t=>t.profileId===selectedId);
  const current=useMemo(()=>recommendations.filter(r=>r.profile_id===selectedId).sort((a,b)=>b.compatibility_score-a.compatibility_score),[recommendations,selectedId]);
  const visible=tenants.filter(t=>[t.name,t.phone,t.email,t.title,...t.locations].join(" ").toLocaleLowerCase("pt-BR").includes(query.toLocaleLowerCase("pt-BR")));

  async function match(profileId:string) {
    setSelectedId(profileId);setBusy(true);setError("");setNotice("");
    try {
      const response=await fetch(`/api/profiles/${profileId}/analyze`,{method:"POST"});
      const payload=await response.json();
      if(!response.ok)throw new Error(payload.error||"Não foi possível fazer o match.");
      setRecommendations(previous=>[...previous.filter(item=>item.profile_id!==profileId||item.status!=="sugerido"),...(payload.recommendations||[])]);
      setNotice(payload.count? `${payload.count} imóveis recomendados entre ${payload.technical_count} opções que passaram pelos critérios.` : payload.message||"Nenhum imóvel compatível encontrado.");
    } catch(e) {
      setError(e instanceof Error?e.message:"Erro inesperado ao analisar.");
    } finally {setBusy(false);}
  }

  if(!tenants.length) return <div className="empty"><strong>Nenhum locatário cadastrado ainda.</strong><span>Adicione o primeiro cadastro acima. Os critérios de temporada serão salvos junto com ele.</span></div>;

  return <div className="tenant-workspace">
    <section className="tenant-list-panel">
      <div className="section-title"><div><h2>Locatários</h2><small>{tenants.length} cadastrados</small></div><span className="list-icon">♙</span></div>
      <div className="toolbar tenant-search"><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar locatário, telefone ou praia…"/></div>
      <div className="tenant-list">
        {visible.map(tenant=><article className={selectedId===tenant.profileId?"tenant-item active":"tenant-item"} key={tenant.id}>
          <button className="tenant-select" type="button" onClick={()=>{setSelectedId(tenant.profileId);setError("");setNotice("");}}>
            <span className="tenant-avatar">{tenant.name.trim().slice(0,1).toUpperCase()}</span>
            <span className="tenant-summary"><strong>{tenant.name}</strong><small>{tenant.title||tenant.phone||tenant.email||"Locatário"}</small><small className="tenant-locations">{tenant.locations.join(", ")||"Localização não definida"}</small></span>
          </button>
          <button className="match-small" type="button" disabled={busy} onClick={()=>match(tenant.profileId)}>{busy&&selectedId===tenant.profileId?"…":"Match ↗"}</button>
        </article>)}
        {!visible.length&&<p className="empty compact">Nenhum locatário encontrado.</p>}
      </div>
    </section>

    <section className="tenant-detail-panel">
      {selected?<>
        <div className="tenant-detail-head">
          <div><span className="kicker">PERFIL DE TEMPORADA</span><h2>{selected.name}</h2><p>{[selected.title,selected.phone,selected.email].filter(Boolean).join(" · ")||"Dados de contato não informados"}</p></div>
          <button className="btn primary match-main" type="button" disabled={busy} onClick={()=>match(selected.profileId)}>{busy?"Analisando…":"✳ Match com Gemini"}</button>
        </div>
        <div className="criteria-summary">
          {selected.locations.length>0&&<div><small>LOCALIZAÇÃO</small><strong>{selected.locations.join(", ")}</strong></div>}
          {selected.guests!=null&&<div><small>HÓSPEDES</small><strong>{selected.guests} pessoas</strong></div>}
          {(selected.checkin||selected.checkout)&&<div><small>PERÍODO</small><strong>{selected.checkin||"—"} até {selected.checkout||"—"}</strong></div>}
          {selected.budget!=null&&<div><small>ORÇAMENTO MÁX.</small><strong>{selected.budget.toLocaleString("pt-BR",{style:"currency",currency:"BRL",maximumFractionDigits:0})}</strong></div>}
          {selected.bedrooms!=null&&<div><small>DORMITÓRIOS</small><strong>A partir de {selected.bedrooms}</strong></div>}
          {selected.suites!=null&&<div><small>SUÍTES</small><strong>A partir de {selected.suites}</strong></div>}
          {selected.beachDistance!=null&&<div><small>PRAIA</small><strong>{selected.beachDistance===0?"Pé na areia":`Até ${selected.beachDistance} m`}</strong></div>}
        </div>
        {Object.entries(selected.amenities||{}).filter(([,v])=>v).length>0&&<div className="tenant-amenities">{Object.entries(selected.amenities).filter(([,v])=>v).map(([k])=><span key={k}>{({piscina:"Piscina",churrasqueira:"Churrasqueira",area_gourmet:"Área gourmet",servico_praia:"Serviço de praia"} as Record<string,string>)[k]||k}</span>)}</div>}
        {selected.preferences&&<div className="tenant-notes"><small>OBSERVAÇÕES DA DEMANDA</small><p>{selected.preferences}</p></div>}
        {selected.notes&&<div className="tenant-notes"><small>OBSERVAÇÕES DO CONTATO</small><p>{selected.notes}</p></div>}
        <div className="match-results">
          <div className="section-title"><div><h2>Imóveis compatíveis</h2><small>Resultado do cruzamento com o BancoImob</small></div><span className="result-count">{current.length}</span></div>
          {error&&<div className="notice error" role="alert">{error}</div>}
          {notice&&<div className="notice" role="status">{notice}</div>}
          {current.map(item=><article className="match-card" key={item.id}>
            <div className="match-cover">{item.property?.cover?<img src={item.property.cover} alt=""/>:<span>≈ BancoImob</span>}<b>{item.compatibility_score}%</b></div>
            <div className="match-card-body">
              <div className="match-card-title"><div><small>{item.property?.codigo||"IMÓVEL"} · {item.property?.bairro||item.property?.cidade||"Litoral Norte"}</small><h3>{item.property?.titulo||"Imóvel do catálogo"}</h3></div>{item.property?.url_origem&&<a href={item.property.url_origem} target="_blank" rel="noreferrer">Abrir imóvel ↗</a>}</div>
              <p>{item.reasoning}</p>
              <div className="match-facts"><span>{item.property?.dormitorios??"—"} dorm.</span><span>{item.property?.suites??"—"} suítes</span><span>{item.property?.capacidade??"—"} pessoas</span><span>{item.property?.distancia_praia==null?"Distância n/d":item.property.distancia_praia===0?"Pé na areia":`${item.property.distancia_praia} m do mar`}</span></div>
              {item.matched_criteria?.length>0&&<div className="match-tags"><small>ATENDE</small>{item.matched_criteria.map((v,i)=><span className="good" key={i}>✓ {v}</span>)}</div>}
              {item.unmatched_criteria?.length>0&&<div className="match-tags"><small>A CONFIRMAR</small>{item.unmatched_criteria.map((v,i)=><span className="warn" key={i}>! {v}</span>)}</div>}
              <footer>Analisado por {item.model_name} · {new Date(item.generated_at).toLocaleString("pt-BR")}</footer>
            </div>
          </article>)}
          {!current.length&&!error&&<div className="empty compact">Clique em <strong>Match com Gemini</strong> para encontrar imóveis compatíveis com esta demanda.</div>}
        </div>
      </>:<div className="empty">Selecione um locatário para visualizar a demanda.</div>}
    </section>
  </div>;
}
