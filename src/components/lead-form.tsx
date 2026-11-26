"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createLead } from "@/app/actions";

type Lead = { id: string; name: string; phone: string | null; email: string | null; title: string | null; notes: string | null };

export function LeadForm({ onCreated }: { onCreated?: (lead: Lead) => void }) {
  const router=useRouter();
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form=event.currentTarget;
    setBusy(true);setMessage("");
    const result=await createLead(new FormData(form));
    setBusy(false);
    if(result.success && result.lead){form.reset();setMessage("Lead cadastrado.");onCreated?.(result.lead);router.refresh();}
    else setMessage(result.error || "Não foi possível cadastrar.");
  }
  return <form className="lead-create-form" onSubmit={submit}>
    <label className="field"><span>Nome *</span><input name="name" required placeholder="Nome do cliente"/></label>
    <div className="field-grid">
      <label className="field"><span>Telefone</span><input name="phone" type="tel" placeholder="(11) 99999-9999"/></label>
      <label className="field"><span>E-mail</span><input name="email" type="email" placeholder="cliente@email.com"/></label>
      <label className="field"><span>Profissão / título</span><input name="title" placeholder="Empresário, executivo…"/></label>
    </div>
    <label className="field"><span>Observações iniciais</span><textarea name="notes" rows={2} placeholder="Contexto do relacionamento, origem do contato…"/></label>
    <div className="form-footer"><p className="status-message" role="status">{message}</p><button className="primary-button" disabled={busy}>{busy?"Cadastrando…":"Adicionar lead"} <span>＋</span></button></div>
  </form>;
}
