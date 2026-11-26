"use client";

import { useState } from "react";

type Message = { role: "user" | "model"; text: string };

export function AssistantChat() {
  const [messages,setMessages]=useState<Message[]>([
    {role:"model",text:"Olá! Posso organizar sua base do BancoLead. Você pode pedir para listar leads, cadastrar alguém, atualizar informações ou criar um perfil de busca. Não salvo nada sem uma instrução explícita."}
  ]);
  const [input,setInput]=useState("");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");

  async function send(event?:React.FormEvent<HTMLFormElement>,suggestion?:string) {
    event?.preventDefault();
    const text=(suggestion ?? input).trim();
    if(!text||busy)return;
    const next=[...messages,{role:"user" as const,text}];
    setMessages(next);setInput("");setBusy(true);setError("");
    try{
      const response=await fetch("/api/assistant/chat",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({messages:next.slice(-12)}),
      });
      const payload=await response.json();
      if(!response.ok)throw new Error(payload.error||"Não foi possível falar com o Gemini.");
      setMessages([...next,{role:"model",text:payload.text||"Concluído."}]);
    }catch(e){
      setError(e instanceof Error?e.message:"Falha inesperada.");
      setMessages(next);
    }finally{setBusy(false);}
  }

  return <div className="assistant-chat">
    <div className="assistant-messages" aria-live="polite">
      {messages.map((message,index)=><div key={index} className={`assistant-message ${message.role}`}><span className="assistant-avatar">{message.role==="model"?"✳":"EU"}</span><div className="assistant-bubble"><small>{message.role==="model"?"GEMINI":"VOCÊ"}</small><p>{message.text}</p></div></div>)}
      {busy&&<div className="assistant-message model"><span className="assistant-avatar">✳</span><div className="assistant-bubble"><small>GEMINI</small><p className="typing">Analisando e executando quando solicitado…</p></div></div>}
    </div>
    {error&&<div className="analysis-error" role="alert">{error}</div>}
    <div className="assistant-suggestions">
      <button type="button" onClick={()=>send(undefined,"Liste os leads cadastrados no BancoLead.")} disabled={busy}>Listar meus leads</button>
      <button type="button" onClick={()=>send(undefined,"Quais dados você precisa para cadastrar um novo lead?")} disabled={busy}>Cadastrar um lead</button>
      <button type="button" onClick={()=>send(undefined,"Como posso criar um perfil de busca para um lead?")} disabled={busy}>Criar perfil de busca</button>
    </div>
    <form className="assistant-input" onSubmit={send}>
      <textarea value={input} onChange={e=>setInput(e.target.value)} rows={2} placeholder="Ex.: Cadastre Maria Silva, telefone..., empresária, procura casa em Juquehy…"/>
      <button className="primary-button" disabled={busy||!input.trim()}>{busy?"Enviando…":"Enviar"} <span>↑</span></button>
    </form>
    <p className="assistant-disclaimer">O Gemini pode cadastrar ou alterar apenas os dados do BancoLead. Não apaga registros e não altera o CRM original.</p>
  </div>;
}
