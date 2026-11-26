"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createLead } from "@/app/actions";

export function LeadForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [open, setOpen] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(true);
    setMessage("");
    const result = await createLead(new FormData(form));
    setBusy(false);
    if (result.success) {
      form.reset();
      setMessage("Locatário cadastrado. Já pode fazer o match.");
      setOpen(false);
      router.refresh();
    } else {
      setMessage(result.error || "Não foi possível cadastrar.");
    }
  }

  return <section className="new-tenant-wrap"><button className="btn primary new-tenant-trigger" type="button" onClick={()=>setOpen(v=>!v)}>{open?"Fechar cadastro":"＋ Novo locatário"}</button>{open&&<form className="tenant-form" onSubmit={submit}>
    <div className="tenant-form-section">
      <div className="form-section-title"><span>01</span><div><strong>Dados do locatário</strong><small>Quem está procurando o imóvel?</small></div></div>
      <label className="field"><span>Nome completo *</span><input name="name" required placeholder="Nome do cliente"/></label>
      <div className="field-grid">
        <label className="field"><span>Telefone</span><input name="phone" type="tel" placeholder="(12) 99999-9999"/></label>
        <label className="field"><span>E-mail</span><input name="email" type="email" placeholder="cliente@email.com"/></label>
      </div>
      <label className="field"><span>Profissão / perfil</span><input name="title" placeholder="Empresário, executivo, família…"/></label>
    </div>

    <div className="tenant-form-section">
      <div className="form-section-title"><span>02</span><div><strong>O que procura?</strong><small>Critérios para cruzar com os imóveis do BancoImob</small></div></div>
      <label className="field"><span>Praias / bairros de interesse</span><input name="localizacoes" placeholder="Juquehy, Barra do Sahy, Camburi"/></label>
      <div className="field-grid">
        <label className="field"><span>Orçamento máximo (R$)</span><input name="orcamento_max" type="number" min="0" placeholder="Ex.: 25000"/></label>
        <label className="field"><span>Quantidade de hóspedes</span><input name="hospedes" type="number" min="1" placeholder="Ex.: 8"/></label>
        <label className="field"><span>Dormitórios mínimos</span><input name="dormitorios_min" type="number" min="0" placeholder="Qualquer"/></label>
        <label className="field"><span>Suítes mínimas</span><input name="suites_min" type="number" min="0" placeholder="Qualquer"/></label>
        <label className="field"><span>Check-in</span><input name="data_checkin" type="date"/></label>
        <label className="field"><span>Check-out</span><input name="data_checkout" type="date"/></label>
        <label className="field"><span>Distância máxima da praia (m)</span><input name="distancia_praia_max_m" type="number" min="0" placeholder="0 = pé na areia"/></label>
      </div>
      <div className="amenities-field"><span>Preferências importantes</span><div className="amenities-grid">
        <label><input type="checkbox" name="piscina"/> Piscina</label>
        <label><input type="checkbox" name="churrasqueira"/> Churrasqueira</label>
        <label><input type="checkbox" name="area_gourmet"/> Área gourmet</label>
        <label><input type="checkbox" name="servico_praia"/> Serviço de praia</label>
      </div></div>
      <label className="field"><span>Observações / detalhes da conversa</span><textarea name="preferencias" rows={3} placeholder="Flexibilidade de datas, crianças, pets, preferência por pé na areia, contexto do cliente…"/></label>
    </div>
    <div className="tenant-form-footer"><p role="status">{message}</p><button className="primary-button" disabled={busy}>{busy ? "Salvando…" : "Cadastrar locatário"} <span>＋</span></button></div>
  </form>}</section>;
}
