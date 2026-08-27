import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { uploadChatAttachment } from "./chatService";
import { useChatEngine } from "./useChatEngine";

export default function ChatView({ activeModule, userName, accent, label, onManageSources }: { activeModule: string; userName: string; accent: string; label: string; onManageSources: () => void }) {
  const { messages, setMessages, streaming, send } = useChatEngine(activeModule);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming]);
  async function submit() { const text = input.trim(); if (!text || streaming) return; setInput(""); await send(text); }
  function onKey(event: KeyboardEvent<HTMLTextAreaElement>) { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void submit(); } }
  async function upload(file: File) { setStatus(`Indexando ${file.name}...`); try { const data = await uploadChatAttachment(activeModule, file); setStatus(`${data.file ?? file.name} foi indexado no módulo ${label}.`); } catch (error) { setStatus(error instanceof Error ? error.message : "Falha no upload."); } finally { if (fileRef.current) fileRef.current.value = ""; } }
  const name = userName.trim().split(/\s+/)[0] || "Você";
  return <div className="flex h-full flex-col">
    <header className="flex items-center gap-3 border-b border-[var(--border)] px-6 py-4"><div className="flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold text-white" style={{ backgroundColor: accent }}>IA</div><div><p className="text-sm font-semibold text-[var(--foreground)]">Sofia · {label}</p><p className="text-xs text-[var(--muted-foreground)]">{streaming ? "Respondendo..." : "Online · resposta em streaming"}</p></div><div className="ml-auto flex items-center gap-2">{activeModule !== "core" && <button onClick={onManageSources} className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--foreground)]">Fontes do módulo</button>}<span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" /></div></header>
    <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">{messages.map((message) => <div key={message.id} className={`flex gap-3 ${message.role === "user" ? "flex-row-reverse" : ""}`}><div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white" style={{ backgroundColor: message.role === "sofia" ? accent : "#6b7280" }}>{message.role === "sofia" ? "S" : name.slice(0, 2).toUpperCase()}</div><div className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${message.role === "user" ? "rounded-tr-sm text-white" : "rounded-tl-sm border border-[var(--border)] bg-[var(--card)] text-[var(--card-foreground)]"}`} style={message.role === "user" ? { backgroundColor: accent } : {}}><div className="mb-1 text-[10px] font-semibold opacity-70">{message.role === "sofia" ? "Sofia" : name}</div><div className="whitespace-pre-wrap break-words">{message.content || (streaming ? "▋" : "")}</div></div></div>)}<div ref={endRef} /></div>
    <div className="border-t border-[var(--border)] px-6 py-4"><div className="flex items-end gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3"><label className="mb-1 flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-[var(--border)] text-xs"><input ref={fileRef} type="file" disabled={activeModule === "core"} className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); }} />📎</label><textarea rows={3} value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={onKey} placeholder="Envie uma mensagem para a Sofia..." className="min-h-20 max-h-40 flex-1 resize-none bg-transparent text-sm text-[var(--foreground)] outline-none" /><button onClick={() => void submit()} disabled={!input.trim() || streaming} className="h-8 w-8 rounded-lg text-white disabled:opacity-40" style={{ backgroundColor: accent }}>↑</button></div>{status && <p className="mt-2 whitespace-pre-wrap text-xs text-[var(--muted-foreground)]">{status}</p>}<p className="mt-2 text-center text-xs text-[var(--muted-foreground)]">Sofia pode cometer erros. Verifique informações críticas.</p></div>
  </div>;
}
