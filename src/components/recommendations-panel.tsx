"use client";

import { useMemo, useState } from "react";

type Profile = { id: string; lead_id: string; modalidade: string; localizacoes: string[]; status: string; hospedes: number | null; data_checkin: string | null; data_checkout: string | null };
type Recommendation = {
  id: string; profile_id: string; property_id: string; compatibility_score: number;
  reasoning: string; matched_criteria: string[]; unmatched_criteria: string[];
  model_name: string; status: string; generated_at: string;
  property?: { codigo: string | null; titulo: string; bairro: string | null; cidade: string; dormitorios: number; suites: number; capacidade: number; distancia_praia: number | null; piscina: boolean; servico_praia: boolean; url_origem: string | null; cover: string | null };
};
type Props = { profiles: (Profile & { leadName: string })[]; initialRecommendations: Recommendation[] };

const currency = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(value);

export function RecommendationsPanel({ profiles, initialRecommendations }: Props) {
  const [selectedId, setSelectedId] = useState(profiles[0]?.id || "");
  const [recommendations, setRecommendations] = useState(initialRecommendations);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const selected = profiles.find((profile) => profile.id === selectedId);
  const current = useMemo(() => recommendations.filter((item) => item.profile_id === selectedId).sort((a,b) => b.compatibility_score-a.compatibility_score), [recommendations, selectedId]);

  async function analyze() {
    if (!selectedId) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch(`/api/profiles/${selectedId}/analyze`, { method: "POST" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Não foi possível concluir a análise.");
      setRecommendations((previous) => [...previous.filter((item) => item.profile_id !== selectedId || item.status !== "sugerido"), ...(payload.recommendations || [])]);
      setNotice(payload.count ? `${payload.count} recomendações geradas a partir de ${payload.technical_count} imóveis compatíveis com os filtros técnicos.` : payload.message || "Nenhum imóvel compatível.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro inesperado ao analisar.");
    } finally { setBusy(false); }
  }

  if (!profiles.length) return <div className="empty">Salve um perfil de busca para iniciar a análise de compatibilidade.</div>;

  return <div className="recommendation-workspace">
    <div className="analysis-controls">
      <label className="field"><span>Perfil de busca</span><select value={selectedId} onChange={(event) => { setSelectedId(event.target.value); setError(""); setNotice(""); }}><option value="">Selecione</option>{profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.leadName} · {profile.modalidade} · {profile.localizacoes.join(", ") || "Local não definido"}</option>)}</select></label>
      {selected && <div className="selected-profile"><div><strong>{selected.leadName}</strong><small>{selected.modalidade} · {selected.localizacoes.join(", ") || "Qualquer localização"}{selected.hospedes ? ` · ${selected.hospedes} hóspedes` : ""}</small></div><button className="primary-button" onClick={analyze} disabled={busy}>{busy ? "Analisando…" : "✳ Analisar com Gemini"} <span>→</span></button></div>}
    </div>
    {error && <div className="analysis-error" role="alert">{error}</div>}
    {notice && <div className="analysis-notice" role="status">{notice}</div>}
    <div className="recommendation-list">
      {current.map((item) => <article className="recommendation-card" key={item.id}>
        <div className="recommendation-photo">{item.property?.cover ? <img src={item.property.cover} alt="" /> : <span>IMÓVEL {item.property?.codigo || ""}</span>}<strong>{item.compatibility_score}%</strong></div>
        <div className="recommendation-body">
          <div className="recommendation-title"><div><span className="eyebrow">CÓD. {item.property?.codigo || "—"} · {item.property?.bairro || item.property?.cidade || "Litoral Norte"}</span><h3>{item.property?.titulo || "Imóvel do catálogo"}</h3></div>{item.property?.url_origem && <a href={item.property.url_origem} target="_blank" rel="noreferrer">Abrir ↗</a>}</div>
          <p>{item.reasoning}</p>
          <div className="property-facts"><span>{item.property?.dormitorios ?? "—"} dorm.</span><span>{item.property?.suites ?? "—"} suítes</span><span>{item.property?.capacidade ?? "—"} pessoas</span><span>{item.property?.distancia_praia == null ? "Distância n/d" : item.property.distancia_praia === 0 ? "Pé na areia" : `${item.property.distancia_praia} m do mar`}</span></div>
          {item.matched_criteria.length > 0 && <div className="criteria"><small>ATENDE</small><div>{item.matched_criteria.map((value,index)=><span className="criteria-good" key={index}>✓ {value}</span>)}</div></div>}
          {item.unmatched_criteria.length > 0 && <div className="criteria"><small>PONTOS A CONFIRMAR</small><div>{item.unmatched_criteria.map((value,index)=><span className="criteria-warn" key={index}>! {value}</span>)}</div></div>}
          <div className="recommendation-meta">Análise por {item.model_name} · {new Date(item.generated_at).toLocaleString("pt-BR")}</div>
        </div>
      </article>)}
      {!current.length && <div className="empty recommendation-empty">Nenhuma recomendação salva para este perfil. Clique em “Analisar com Gemini” para cruzar os critérios com o catálogo.</div>}
    </div>
  </div>;
}
