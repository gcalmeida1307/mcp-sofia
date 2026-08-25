import { useState, useRef, useEffect, FormEvent, KeyboardEvent } from "react";
import { sofiaMcp } from "./mcpClient";

async function requestJson(url: string, init: RequestInit, timeoutMs = 15000): Promise<{ response: Response; data: Record<string, any> }> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const raw = await response.text();
    let data: Record<string, any> = {};
    try { data = raw ? JSON.parse(raw) : {}; } catch { data = { error: raw || `Servidor respondeu HTTP ${response.status}.` }; }
    return { response, data };
  } finally {
    window.clearTimeout(timer);
  }
}

function requestError(error: unknown): string {
  if (error instanceof DOMException && error.name === "AbortError") return "Tempo limite excedido. Verifique se o backend está ativo.";
  return error instanceof Error ? error.message : "Não foi possível comunicar com o backend.";
}

function connectionModuleName(moduleId: ModuleId): string {
  // CORE is not a data-source owner. The Global user must switch to the
  // destination profile before testing or saving a connection.
  return moduleId === "infra" ? "infraestrutura" : moduleId;
}

// ── Types ──────────────────────────────────────────────────────────────────

type ModuleId = string;
type View = "chat" | "modules" | "new-module" | "users" | "knowledge" | "connections" | "dashboards" | "automations";
type Theme = "light" | "dark";

function storedTheme(): Theme {
  return typeof window !== "undefined" && window.localStorage.getItem("sofia-theme") === "dark" ? "dark" : "light";
}

function SofiaMark({ size = "md" }: { size?: "sm" | "md" }) {
  return <span className={`sofia-mark sofia-mark--${size}`} aria-label="Sofia">S</span>;
}

interface Message {
  id: string;
  role: "user" | "sofia";
  content: string;
  ts: Date;
}

interface Module {
  id: string;
  name: string;
  description: string;
  category: ModuleId;
  status: "active" | "beta" | "maintenance";
  createdAt: Date;
  accentHex?: string;
  icon?: string;
}

// ── Module palette config ──────────────────────────────────────────────────

type ModuleConfig = {
    label: string;
    icon: string;
    accent: string;
    accentDark: string;
    accentLight: string;
    accentText: string;
    tag: string;
  };

const MODULE_CONFIGS: Record<string, ModuleConfig> = {
  core: {
    label: "CORE",
    icon: "⬡",
    accent: "#8b5cf6",
    accentDark: "#7c3aed",
    accentLight: "#ede9fe",
    accentText: "#5b21b6",
    tag: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  },
  infra: {
    label: "INFORMÁTICA",
    icon: "◈",
    accent: "#1565C0",
    accentDark: "#0D47A1",
    accentLight: "#E3F2FD",
    accentText: "#0D47A1",
    tag: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  },
  medicina: {
    label: "MEDICINA",
    icon: "✦",
    accent: "#2E7D32",
    accentDark: "#1B5E20",
    accentLight: "#E8F5E9",
    accentText: "#1B5E20",
    tag: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  },
  almoxarifado: {
    label: "ALMOXARIFADO",
    icon: "◉",
    accent: "#f97316",
    accentDark: "#ea580c",
    accentLight: "#ffedd5",
    accentText: "#9a3412",
    tag: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  },
  "recursos-humanos": { label: "RECURSOS HUMANOS", icon: "●", accent: "#E05D44", accentDark: "#B74431", accentLight: "#FCE8E4", accentText: "#8F2D21", tag: "bg-rose-100 text-rose-700" },
  contabilidade: { label: "CONTABILIDADE", icon: "▣", accent: "#546E7A", accentDark: "#37474F", accentLight: "#ECEFF1", accentText: "#37474F", tag: "bg-slate-100 text-slate-700" },
  financeiro: { label: "FINANCEIRO", icon: "¤", accent: "#B8860B", accentDark: "#8B6508", accentLight: "#FFF8E1", accentText: "#6D4C00", tag: "bg-amber-100 text-amber-800" },
  "juridico-trabalhista": { label: "JURÍDICO TRABALHISTA", icon: "§", accent: "#7B1E3A", accentDark: "#541329", accentLight: "#F7E7ED", accentText: "#541329", tag: "bg-rose-100 text-rose-800" },
  secretaria: { label: "SECRETARIA", icon: "◇", accent: "#00838F", accentDark: "#005662", accentLight: "#E0F7FA", accentText: "#005662", tag: "bg-cyan-100 text-cyan-800" },
  cursos: { label: "CURSOS", icon: "✦", accent: "#6F42C1", accentDark: "#512DA8", accentLight: "#EDE7F6", accentText: "#4527A0", tag: "bg-violet-100 text-violet-800" },
  biblioteca: { label: "BIBLIOTECA", icon: "▤", accent: "#795548", accentDark: "#4E342E", accentLight: "#EFEBE9", accentText: "#4E342E", tag: "bg-stone-100 text-stone-800" },
  "pesquisa-extensao": { label: "PESQUISA E EXTENSÃO", icon: "✺", accent: "#C2185B", accentDark: "#880E4F", accentLight: "#FCE4EC", accentText: "#880E4F", tag: "bg-pink-100 text-pink-800" },
  compras: { label: "COMPRAS E CONTRATOS", icon: "◆", accent: "#EF6C00", accentDark: "#E65100", accentLight: "#FFF3E0", accentText: "#E65100", tag: "bg-orange-100 text-orange-800" },
  "gestao-empresarial": { label: "GESTÃO EMPRESARIAL", icon: "◉", accent: "#3949AB", accentDark: "#283593", accentLight: "#E8EAF6", accentText: "#283593", tag: "bg-indigo-100 text-indigo-800" },
};

function moduleConfig(id: ModuleId, label?: string, accentHex?: string, icon?: string): ModuleConfig {
  if (MODULE_CONFIGS[id] && !accentHex && !icon) return MODULE_CONFIGS[id];
  const palette = [
    ["#06b6d4", "#0891b2", "#cffafe", "#155e75"],
    ["#ec4899", "#db2777", "#fce7f3", "#9d174d"],
    ["#84cc16", "#65a30d", "#ecfccb", "#3f6212"],
    ["#eab308", "#ca8a04", "#fef9c3", "#854d0e"],
  ][Math.abs([...id].reduce((sum, char) => sum + char.charCodeAt(0), 0)) % 4];
  const base = MODULE_CONFIGS[id] ?? { label: label ?? id.split("-").join(" ").toUpperCase(), icon: "◆", accent: palette[0], accentDark: palette[1], accentLight: palette[2], accentText: palette[3], tag: "bg-slate-100 text-slate-700" };
  return { ...base, label: label ?? base.label, icon: icon ?? base.icon, accent: accentHex ?? base.accent };
}

// ── Seed data ──────────────────────────────────────────────────────────────

// Não há módulos fictícios no frontend. Os módulos e seus conhecimentos são
// definidos pelo backend/configuração da instalação e cadastrados pelo usuário.
const INITIAL_MODULES: Module[] = [];
const MODULE_BANNER = "/assets/sofia-modules-banner.png";

// ── Icons ──────────────────────────────────────────────────────────────────

function IconChat() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}
function IconModules() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}
function IconPlus() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}
function IconSun() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
}
function IconMoon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}
function IconSend() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}
function IconMenu() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}
function IconX() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

// ── Status badge ──────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: Module["status"] }) {
  const cfg = {
    active: { label: "Ativo", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
    beta: { label: "Beta", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
    maintenance: { label: "Manutenção", cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  }[status];
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full font-mono ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

// ── Chat view ─────────────────────────────────────────────────────────────

function ChatView({ activeModule, onManageSources }: { activeModule: ModuleId; onManageSources: () => void }) {
  const cfg = moduleConfig(activeModule);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "0",
      role: "sofia",
      content: `S.O.F.I.A. — Sabedoria que conecta, inteligência que transforma.\n\nOlá! Sou a Sofia, a IA central do sistema. Estou conectada ao módulo **${cfg.label}** e pronta para ajudar. Como posso auxiliar você hoje?`,
      ts: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [feedback, setFeedback] = useState<Record<string, number>>({});
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  async function send() {
    const text = input.trim();
    if (!text) return;
    const userMsg: Message = { id: Date.now().toString(), role: "user", content: text, ts: new Date() };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setTyping(true);
    try {
      const routedModule = activeModule === "infra" ? "infraestrutura" : activeModule;
      const conversationContext = [...messages, userMsg]
        .filter((message) => message.id !== "0")
        .slice(-8)
        .map((message) => `${message.role === "user" ? "Usuário" : "Sofia"}: ${message.content}`)
        .join("\n\n");
      const content = await sofiaMcp.callTool("perguntar_sofia", { pergunta: text, modulo: routedModule, contexto: conversationContext });
      setMessages((m) => [
        ...m,
        { id: (Date.now() + 1).toString(), role: "sofia", content, ts: new Date() },
      ]);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Erro desconhecido";
      setMessages((m) => [
        ...m,
        {
          id: (Date.now() + 1).toString(),
          role: "sofia",
          content: `Não consegui acessar o MCP Sofia. Verifique se o servidor está ativo em http://127.0.0.1:8000.\n\nDetalhe: ${detail}`,
          ts: new Date(),
        },
      ]);
    } finally {
      setTyping(false);
    }
  }

  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  async function rate(message: Message, rating: number) {
    const userQuestion = [...messages].reverse().find((item) => item.role === "user" && item.ts < message.ts)?.content ?? "";
    const routedModule = activeModule === "infra" ? "infraestrutura" : activeModule;
    const response = await fetch("/ai/feedback", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ module: routedModule, question: userQuestion, answer: message.content, rating }) });
    if (response.ok) setFeedback((current) => ({ ...current, [message.id]: rating }));
  }

  const accent = cfg.accent;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-[var(--border)]">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm"
          style={{ backgroundColor: accent }}
        >
          IA
        </div>
        <div>
          <p className="font-semibold text-sm text-[var(--foreground)]" style={{ fontFamily: "var(--font-heading)" }}>
            Sofia · {cfg.label}
          </p>
          <p className="text-xs text-[var(--muted-foreground)]">
            {typing ? "Digitando..." : "Online · MCP conectado"}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {activeModule !== "core" && (
            <button
              onClick={onManageSources}
              className="px-3 py-1.5 rounded-lg border border-[var(--border)] text-xs font-medium text-[var(--foreground)] hover:bg-[var(--muted)]"
            >
              Fontes do módulo
            </button>
          )}
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs text-[var(--muted-foreground)]">Conectado</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
            <div
              className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center text-xs font-bold text-white"
              style={{ backgroundColor: msg.role === "sofia" ? accent : "#6b7280" }}
            >
              {msg.role === "sofia" ? "S" : "U"}
            </div>
            <div
              className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "text-white rounded-tr-sm"
                  : "bg-[var(--card)] text-[var(--card-foreground)] border border-[var(--border)] rounded-tl-sm"
              }`}
              style={msg.role === "user" ? { backgroundColor: accent } : {}}
            >
              <div className="whitespace-pre-wrap break-words">{msg.content}</div>
              {msg.role === "sofia" && msg.id !== "0" && <div className="mt-2 flex gap-2 text-[10px] text-[var(--muted-foreground)]"><button onClick={() => void rate(msg, 1)} className={feedback[msg.id] === 1 ? "text-emerald-600" : ""}>Útil</button><button onClick={() => void rate(msg, -1)} className={feedback[msg.id] === -1 ? "text-rose-600" : ""}>Precisa melhorar</button></div>}
            </div>
          </div>
        ))}
        {typing && (
          <div className="flex gap-3">
            <div
              className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center text-xs font-bold text-white"
              style={{ backgroundColor: accent }}
            >
              S
            </div>
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl rounded-tl-sm px-4 py-3 flex gap-1 items-center">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-[var(--muted-foreground)] animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div className="px-6 py-4 border-t border-[var(--border)]">
        <div className="flex gap-3 items-end bg-[var(--card)] border border-[var(--border)] rounded-xl px-4 py-3 focus-within:ring-2 transition-shadow" style={{ "--tw-ring-color": accent } as React.CSSProperties}>
          <textarea
            rows={3}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKey}
            placeholder="Envie uma mensagem para a Sofia..."
            className="flex-1 resize-none bg-transparent text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] outline-none leading-relaxed min-h-20 max-h-40 overflow-y-auto whitespace-pre-wrap"
            style={{ fontFamily: "var(--font-body)" }}
          />
          <button
            onClick={send}
            disabled={!input.trim()}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
            style={{ backgroundColor: accent }}
          >
            <IconSend />
          </button>
        </div>
        <p className="text-xs text-[var(--muted-foreground)] mt-2 text-center">
          Sofia pode cometer erros. Verifique informações críticas.
        </p>
      </div>
    </div>
  );
}

// ── Modules view ──────────────────────────────────────────────────────────

function KnowledgeSources({ moduleId }: { moduleId: ModuleId }) {
  const [url, setUrl] = useState("");
  const [captureMode, setCaptureMode] = useState<"page" | "linked_documents" | "crawl">("page");
  const [maxDepth, setMaxDepth] = useState("2");
  const [maxPages, setMaxPages] = useState("10");
  const [status, setStatus] = useState("");

  async function upload(file: File) {
    const form = new FormData();
    form.append("module", moduleId === "infra" ? "infraestrutura" : moduleId);
    form.append("file", file);
    const response = await fetch("/knowledge/upload", { method: "POST", body: form });
    const data = await response.json();
    setStatus(response.ok ? `Arquivo processado: ${data.file}` : data.error);
  }

  async function addUrl() {
    setStatus("Consultando o link e convertendo o conteúdo para TXT...");
    try {
      const response = await fetch("/knowledge/url", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ module: moduleId === "infra" ? "infraestrutura" : moduleId, url, mode: captureMode, crawl: captureMode === "crawl", max_pages: Number(maxPages), max_depth: Number(maxDepth) }),
      });
      const raw = await response.text();
      let data: any = {};
      try { data = raw ? JSON.parse(raw) : {}; } catch { data = { error: raw || `Servidor respondeu HTTP ${response.status}.` }; }
      if (!response.ok) { setStatus(`Erro ${response.status}: ${data.error ?? "Não foi possível indexar o link."}`); return; }
      setStatus(`Link adicionado com sucesso: ${data.indexed_pages} página(s), ${data.total_chunks} trecho(s) e ${data.total_extracted_chars} caracteres convertidos para TXT e gravados no módulo.`);
      setUrl("");
    } catch (error) {
      setStatus(`Falha de comunicação: ${error instanceof Error ? error.message : "backend indisponível"}`);
    }
  }

  if (moduleId === "core") return null;
  return (
    <div className="mt-5 bg-[var(--card)] border border-[var(--border)] rounded-xl p-4">
      <p className="font-semibold text-sm text-[var(--foreground)]">Fontes de conhecimento</p>
      <p className="text-xs text-[var(--muted-foreground)] mt-1">As fontes ficam isoladas no módulo {moduleId === "infra" ? "Infraestrutura" : moduleId} e são organizadas automaticamente.</p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-2 text-xs text-[var(--muted-foreground)]">
          Arquivos de texto, dados e imagens
          <input type="file" multiple accept=".pdf,.doc,.docx,.txt,.md,.rtf,.odt,.csv,.tsv,.xlsx,.xls,.parquet,.json,.xml,.html,.htm,.gif,.jpeg,.jpg,.png,.webp,.bmp,.tif,.tiff" onChange={(e) => e.target.files && Array.from(e.target.files).forEach(upload)} className="text-xs" />
          <span className="text-[10px]">Texto → textos · CSV/XLSX → bases_de_dados · imagens → imagens</span>
        </label>
          <label className="flex flex-col gap-2 text-xs text-[var(--muted-foreground)]">
          Link
          <div className="flex gap-2"><input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." className="min-w-0 flex-1 bg-[var(--muted)] border border-[var(--border)] rounded px-2 py-1.5 text-xs" /><button onClick={addUrl} disabled={!url} className="px-3 rounded bg-[var(--primary)] text-white disabled:opacity-40">Adicionar</button></div>
          <select value={captureMode} onChange={(e) => setCaptureMode(e.target.value as typeof captureMode)} className="bg-[var(--muted)] border border-[var(--border)] rounded px-2 py-1.5 text-xs"><option value="page">Somente esta página</option><option value="linked_documents">Página e documentos vinculados</option><option value="crawl">Rastreamento controlado do mesmo domínio</option></select>
          {captureMode !== "page" && <div className="flex items-center gap-2"><span>Máx. páginas</span><input type="number" min={1} max={20} value={maxPages} onChange={(e) => setMaxPages(e.target.value)} className="w-16 bg-[var(--muted)] border border-[var(--border)] rounded px-2 py-1" />{captureMode === "crawl" && <><span>profundidade</span><input type="number" min={0} max={5} value={maxDepth} onChange={(e) => setMaxDepth(e.target.value)} className="w-14 bg-[var(--muted)] border border-[var(--border)] rounded px-2 py-1" /></>}</div>}
        </label>
      </div>
      {status && <p className="mt-3 text-xs text-[var(--muted-foreground)]">{status}</p>}
    </div>
  );
}

function ModulesView({
  modules,
  activeModule,
  onNew,
}: {
  modules: Module[];
  activeModule: ModuleId;
  onNew: () => void;
}) {
  const activeModuleRecord = modules.find((item) => item.category === activeModule);
  const cfg = moduleConfig(activeModule, activeModuleRecord?.name, activeModuleRecord?.accentHex, activeModuleRecord?.icon);
  const filtered = modules.filter((m) => m.category === activeModule);
  const accent = cfg.accent;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--border)]">
        <div>
          <h2
            className="text-xl font-semibold text-[var(--foreground)]"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Módulos · {cfg.label}
          </h2>
          <p className="text-sm text-[var(--muted-foreground)] mt-0.5">
            {filtered.length} módulo{filtered.length !== 1 ? "s" : ""} registrado{filtered.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={onNew}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-all hover:opacity-90 active:scale-95"
          style={{ backgroundColor: accent }}
        >
          <IconPlus />
          Novo Módulo
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        <img src={MODULE_BANNER} alt="Profissionais dos módulos Medicina, Infraestrutura, Jurídico Trabalhista e Gestão" className="mb-6 h-40 w-full max-w-5xl rounded-2xl object-cover shadow-sm" />
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl"
              style={{ backgroundColor: cfg.accentLight, color: accent }}
            >
              {cfg.icon}
            </div>
            <div>
              <p className="font-medium text-[var(--foreground)]">Nenhum módulo cadastrado</p>
              <p className="text-sm text-[var(--muted-foreground)] mt-1">
                Crie o primeiro módulo para este perfil.
              </p>
            </div>
            <button
              onClick={onNew}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white"
              style={{ backgroundColor: accent }}
            >
              <IconPlus />
              Criar módulo
            </button>
          </div>
        ) : (
          <div className="grid gap-3">
            {filtered.map((mod) => (
              <div
                key={mod.id}
                className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 hover:border-[var(--ring)] transition-all group cursor-pointer"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div
                      className="w-9 h-9 rounded-lg flex-shrink-0 flex items-center justify-center text-base mt-0.5"
                      style={{ backgroundColor: cfg.accentLight, color: accent }}
                    >
                      {cfg.icon}
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-[var(--foreground)]" style={{ fontFamily: "var(--font-heading)" }}>
                        {mod.name}
                      </p>
                      <p className="text-xs text-[var(--muted-foreground)] mt-0.5 leading-relaxed">
                        {mod.description}
                      </p>
                    </div>
                  </div>
                  <StatusBadge status={mod.status} />
                </div>
                <div className="mt-3 flex items-center gap-4 text-xs text-[var(--muted-foreground)] font-mono">
                  <span>Criado em {mod.createdAt.toLocaleDateString("pt-BR")}</span>
                  <span
                    className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-xs font-sans font-medium"
                    style={{ color: accent }}
                  >
                    Acessar →
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── New module form ───────────────────────────────────────────────────────

function NewModuleView({
  activeModule,
  onSave,
  onCancel,
}: {
  activeModule: ModuleId;
  onSave: (m: Omit<Module, "id" | "createdAt">) => void | Promise<void>;
  onCancel: () => void;
}) {
  const cfg = moduleConfig(activeModule);
  const accent = cfg.accent;

  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [category, setCategory] = useState<ModuleId>(activeModule);
  const [status, setStatus] = useState<Module["status"]>("active");
  const [accentHex, setAccentHex] = useState(cfg.accent);
  const [icon, setIcon] = useState(cfg.icon);
  const [error, setError] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("O nome do módulo é obrigatório."); return; }
    if (!desc.trim()) { setError("A descrição é obrigatória."); return; }
    void onSave({ name: name.trim(), description: desc.trim(), category, status, accentHex, icon });
  }

  const inputCls =
    "w-full bg-[var(--muted)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] outline-none focus:ring-2 transition-shadow";

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--border)]">
        <div>
          <h2
            className="text-xl font-semibold text-[var(--foreground)]"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Novo Módulo
          </h2>
          <p className="text-sm text-[var(--muted-foreground)] mt-0.5">
            Configure e registre um novo módulo no sistema Sofia
          </p>
        </div>
        <button
          onClick={onCancel}
          className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
        >
          Cancelar
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <form onSubmit={handleSubmit} className="max-w-lg space-y-5">
          {/* Name */}
          <div>
            <label className="block text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-1.5">
              Nome do Módulo
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setError(""); }}
              placeholder="Nome do módulo"
              className={inputCls}
              style={{ "--tw-ring-color": accent } as React.CSSProperties}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-1.5">
              Descrição
            </label>
            <textarea
              rows={3}
              value={desc}
              onChange={(e) => { setDesc(e.target.value); setError(""); }}
              placeholder="Descreva a funcionalidade e propósito deste módulo..."
              className={`${inputCls} resize-none`}
              style={{ "--tw-ring-color": accent } as React.CSSProperties}
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-1.5">
              Categoria / Perfil
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.entries(MODULE_CONFIGS) as [ModuleId, (typeof MODULE_CONFIGS)[ModuleId]][]).map(
                ([id, c]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setCategory(id)}
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border text-sm font-medium transition-all text-left ${
                      category === id
                        ? "border-transparent text-white"
                        : "border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] bg-[var(--card)]"
                    }`}
                    style={category === id ? { backgroundColor: c.accent } : {}}
                  >
                    <span>{c.icon}</span>
                    <span>{c.label}</span>
                  </button>
                )
              )}
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="block text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-1.5">Identidade visual</label>
            <div className="flex items-center gap-3">
              <input aria-label="Cor do módulo" type="color" value={accentHex} onChange={(e) => setAccentHex(e.target.value)} className="h-11 w-14 rounded-lg border border-[var(--border)] bg-transparent cursor-pointer" />
              <input aria-label="Ícone do módulo" value={icon} maxLength={4} onChange={(e) => setIcon(e.target.value)} placeholder="◆" className={`${inputCls} max-w-24 text-center text-lg`} />
              <span className="text-xs text-[var(--muted-foreground)]">Essa cor e ícone serão usados no perfil e ficam salvos no banco.</span>
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="block text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-1.5">
              Status Inicial
            </label>
            <div className="flex gap-2">
              {(["active", "beta", "maintenance"] as Module["status"][]).map((s) => {
                const labels = { active: "Ativo", beta: "Beta", maintenance: "Manutenção" };
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatus(s)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-all ${
                      status === s
                        ? "text-white border-transparent"
                        : "border-[var(--border)] text-[var(--muted-foreground)] bg-[var(--card)]"
                    }`}
                    style={status === s ? { backgroundColor: accent } : {}}
                  >
                    {labels[s]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          {/* Submit */}
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-95"
              style={{ backgroundColor: accent }}
            >
              Criar Módulo
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="px-5 py-2.5 rounded-lg text-sm font-medium border border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors bg-[var(--card)]"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Sidebar nav item ──────────────────────────────────────────────────────

function NavItem({
  active,
  onClick,
  children,
  accent,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  accent?: string;
}) {
  return (
    <button
      onClick={onClick}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-left ${
        active ? "text-white" : "text-[var(--sidebar-fg)] hover:bg-[var(--sidebar-hover)]"
      }`}
      style={active && accent ? { backgroundColor: accent } : {}}
    >
      {children}
    </button>
  );
}

function AuthView({ setup, theme, onThemeChange, onAuthenticated }: { setup: boolean; theme: Theme; onThemeChange: (theme: Theme) => void; onAuthenticated: (mustChange: boolean) => void }) {
  const [requestMode, setRequestMode] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [requestModule, setRequestModule] = useState("infraestrutura");
  const [requestModules, setRequestModules] = useState<Array<{ slug: string; display_name: string }>>([]);
  const [justification, setJustification] = useState("");
  const [requestStatus, setRequestStatus] = useState("");
  const [email, setEmail] = useState("");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [setupToken, setSetupToken] = useState("");
  const [totpSecret, setTotpSecret] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [setupComplete, setSetupComplete] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/auth/available-modules").then((response) => response.ok ? response.json() : { modules: [] }).then((data) => { const available = data.modules ?? []; setRequestModules(available); if (available[0] && !available.some((item: { slug: string }) => item.slug === requestModule)) setRequestModule(available[0].slug); }).catch(() => undefined);
  }, []);

  async function requestAccess(e: FormEvent) {
    e.preventDefault(); setBusy(true); setRequestStatus("");
    const response = await fetch("/auth/access-request", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ first_name: firstName, last_name: lastName, email, module: requestModule, justification, accepted_terms: true, website: "" }) });
    const data = await response.json(); setRequestStatus(data.message ?? data.error ?? "Solicitação enviada."); setBusy(false);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const isSetup = setup && !setupComplete;
      const response = await fetch(isSetup ? "/auth/setup" : "/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, login: login || email, matricula: login || email, identifier: login || email, password, otp, setup_token: setupToken, website: "" }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Não foi possível concluir a autenticação.");
      if (isSetup) {
        setTotpSecret(data.totp_secret ?? "");
        setLogin(data.identifier ?? "");
        setQrDataUrl(data.qr_data_url ?? "");
        setSetupComplete(true);
        setError("Usuário Global criado. Cadastre o segredo no seu aplicativo autenticador e entre com o código de seis dígitos.");
      } else onAuthenticated(Boolean(data.must_change_password));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível concluir a autenticação.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-full grid lg:grid-cols-2 bg-[var(--background)]">
      <section className="hidden lg:grid min-h-full grid-rows-[140px_1fr] items-start bg-[var(--background)] px-12 py-12 text-[var(--foreground)]">
          <div className="max-w-lg">
          <p className="text-sm uppercase tracking-[0.25em] text-violet-600 dark:text-violet-300">Plataforma Sofia</p>
          <h2 className="mt-3 text-3xl font-semibold leading-tight text-[var(--foreground)]">S.O.F.I.A. — Sabedoria que conecta, inteligência que transforma.</h2>
          <p className="mt-3 text-sm text-[var(--muted-foreground)]">Conhecimento especializado para cada módulo, com contexto, segurança e propósito.</p>
          </div>
          <div className="mt-7 flex w-full items-start justify-start">
            <div className="relative h-[min(50vh,460px)] w-[min(300px,90%)] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--muted)] shadow-lg">
              <div className="sofia-module-roll flex h-full w-[400%]">
                {["Medicina", "Infraestrutura", "Jurídico Trabalhista", "Gestão"].map((label, index) => <div key={label} role="img" aria-label={`Imagem do módulo ${label}`} className="h-full w-1/4 shrink-0 bg-cover bg-center" style={{ backgroundImage: `url(${MODULE_BANNER})`, backgroundSize: "400% 100%", backgroundPosition: `${index * 33.333}% center` }} />)}
              </div>
              <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5" aria-hidden="true">{[0, 1, 2, 3].map((index) => <span key={index} className="h-1.5 w-1.5 rounded-full bg-white shadow" />)}</div>
            </div>
          </div>
      </section>
      <div className="auth-surface relative flex min-h-full flex-col items-center justify-start px-4 py-8 pt-[210px]">
      <button type="button" onClick={() => onThemeChange(theme === "light" ? "dark" : "light")} className="absolute right-4 top-4 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs text-[var(--muted-foreground)] shadow-sm hover:text-[var(--foreground)]" aria-label="Alternar modo de cor">{theme === "light" ? "☾ Modo escuro" : "☀ Modo claro"}</button>
      <form onSubmit={requestMode ? requestAccess : submit} className="w-full max-w-md bg-[var(--card)] border-2 border-violet-200 dark:border-violet-900/70 rounded-2xl p-8 shadow-xl">
        <SofiaMark size="md" />
        <h1 className="text-xl font-semibold text-[var(--foreground)]">{requestMode ? "Solicitar acesso" : setup && !setupComplete ? "Criar usuário Global" : "Entrar na Sofia"}</h1>
        <p className="text-sm text-[var(--muted-foreground)] mt-2">{requestMode ? "Seu cadastro ficará pendente até aprovação do administrador. O autenticador será configurado depois da aprovação." : setup && !setupComplete ? "O primeiro usuário terá acesso global e duplo fator obrigatório." : "Acesse somente os módulos autorizados."}</p>
        <div className="mt-6 grid gap-3">
          {requestMode && <><input required value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Nome" className="bg-[var(--muted)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-sm" /><input required value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Sobrenome" className="bg-[var(--muted)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-sm" /></>}
          {requestMode || (setup && !setupComplete) ? <input required type="email" value={email} onChange={(e) => { setEmail(e.target.value); setLogin(e.target.value); }} placeholder="E-mail" className="bg-[var(--muted)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-sm" /> : <input required value={login} onChange={(e) => setLogin(e.target.value)} placeholder="Matrícula (AG000001) ou e-mail" className="bg-[var(--muted)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-sm" />}
          {requestMode && <><select value={requestModule} onChange={(e) => setRequestModule(e.target.value)} className="bg-[var(--muted)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-sm">{requestModules.map((item) => <option key={item.slug} value={item.slug}>{item.display_name}</option>)}</select><textarea value={justification} onChange={(e) => setJustification(e.target.value)} placeholder="Justificativa do acesso (opcional)" className="bg-[var(--muted)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-sm" /></>}
          {!requestMode && <input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Senha" className="bg-[var(--muted)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-sm" />}
          {setup && !setupComplete && <input required type="password" value={setupToken} onChange={(e) => setSetupToken(e.target.value)} placeholder="Token de configuração" className="bg-[var(--muted)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-sm" />}
          {setup && !setupComplete && <p className="text-xs text-[var(--muted-foreground)]">A senha deve conter 8-128 caracteres, maiúscula, minúscula, número e símbolo.</p>}
          {setupComplete && <><p className="text-xs text-[var(--muted-foreground)]">Abra o Google Authenticator, toque em “+” e escaneie este QR Code:</p>{qrDataUrl && <img src={qrDataUrl} alt="QR Code para configurar o duplo fator" className="w-48 h-48 bg-white p-2 rounded-lg" />}<p className="text-xs text-[var(--muted-foreground)]">Se não conseguir escanear, use esta chave manual:</p><code className="select-all rounded bg-[var(--muted)] border border-[var(--border)] p-2 text-xs break-all">{totpSecret}</code></>}
          {!requestMode && !setup && <input required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} placeholder="Código do Google Authenticator" className="bg-[var(--muted)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-sm" />}
          {setupComplete && <input required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} placeholder="Código de 6 dígitos" className="bg-[var(--muted)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-sm" />}
          {(error || requestStatus) && <p className="text-xs text-rose-600">{error || requestStatus}</p>}
          <button disabled={busy} className="rounded-lg bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-medium py-2.5 text-sm">{busy ? "Aguarde..." : requestMode ? "Enviar solicitação" : setup ? "Criar acesso" : "Entrar"}</button>
          {!setup && !setupComplete && <div className="flex justify-between text-xs"><button type="button" onClick={() => setRequestMode((value) => !value)} className="text-violet-700">{requestMode ? "Voltar ao login" : "Não possui acesso? Solicite seu cadastro"}</button><button type="button" onClick={() => setError("Recuperação por e-mail será habilitada quando o SMTP for configurado.")} className="text-[var(--muted-foreground)]">Esqueci minha senha</button></div>}
        </div>
      </form>
      <p className="absolute bottom-5 left-0 right-0 text-center text-xs text-[var(--muted-foreground)]">© {new Date().getFullYear()} S.O.F.I.A. · Todos os direitos reservados.</p>
      </div>
    </div>
  );
}

function ChangePasswordView({ onComplete }: { onComplete: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    const response = await fetch("/auth/change-password", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ new_password: password }) });
    const data = await response.json();
    if (!response.ok) setError(data.error ?? "Não foi possível trocar a senha."); else onComplete();
  }
  return <div className="min-h-full flex items-center justify-center bg-[var(--background)] px-4"><form onSubmit={submit} className="w-full max-w-md bg-[var(--card)] border border-[var(--border)] rounded-2xl p-7 shadow-xl"><h1 className="text-xl font-semibold text-[var(--foreground)]">Troca obrigatória de senha</h1><p className="text-sm text-[var(--muted-foreground)] mt-2">Defina uma nova senha antes de acessar o sistema.</p><input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Nova senha" className="mt-5 w-full bg-[var(--muted)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-sm" /><p className="text-xs text-[var(--muted-foreground)] mt-2">Use 8-128 caracteres, maiúscula, minúscula, número e símbolo.</p>{error && <p className="text-xs text-rose-600 mt-2">{error}</p>}<button className="mt-4 w-full rounded-lg bg-violet-600 text-white py-2.5 text-sm font-medium">Salvar nova senha</button></form></div>;
}

function UsersView() {
  const [users, setUsers] = useState<Array<{ id: string; email: string; display_name: string; role: string; status: string }>>([]);
  const [requests, setRequests] = useState<Array<{ id: string; first_name: string; last_name: string; email: string; requested_module: string; justification: string; status: string }>>([]);
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [module, setModule] = useState("infraestrutura");
  const [status, setStatus] = useState("");
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [totpSetup, setTotpSetup] = useState("");
  const [totpQr, setTotpQr] = useState("");
  const [totpSecret, setTotpSecret] = useState("");
  const [approvalRole, setApprovalRole] = useState("operator");
  const [availableModules, setAvailableModules] = useState<Array<{ slug: string; display_name: string }>>([]);

  async function loadUsers() {
    const response = await fetch("/auth/users", { credentials: "include" });
    if (response.ok) setUsers((await response.json()).users ?? []);
  }
  async function loadRequests() { const response = await fetch("/auth/access-requests", { credentials: "include" }); if (response.ok) setRequests((await response.json()).requests ?? []); }
  useEffect(() => { void loadUsers(); void loadRequests(); fetch("/auth/available-modules").then((response) => response.json()).then((data) => setAvailableModules(data.modules ?? [])).catch(() => undefined); }, []);

  async function createUser(e: FormEvent) {
    e.preventDefault();
    const response = await fetch("/auth/users", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, display_name: displayName, password, module }) });
    const data = await response.json();
    setStatus(response.ok ? "Usuário criado e aguardando aprovação." : data.error ?? "Falha ao criar usuário.");
    if (response.ok) { setEmail(""); setDisplayName(""); setPassword(""); await loadUsers(); }
  }
  async function decide(id: string, decision: "approved" | "rejected", module: string) {
    const response = await fetch(`/auth/access-requests/${id}/decision`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision, module, module_role: approvalRole, temporary_password: temporaryPassword, reason: decision === "rejected" ? "Rejeitado pelo administrador Global." : "Aprovado pelo administrador Global." }) });
    const data = await response.json(); setStatus(response.ok ? `Solicitação ${decision === "approved" ? "aprovada" : "rejeitada"}.` : data.error ?? "Não foi possível decidir."); if (response.ok && data.totp_secret) { setTotpSetup(`Acesso aprovado para ${data.identifier}. Mostre o QR Code ao usuário por um canal seguro. Depois de configurar o Google Authenticator, ele usará a senha temporária e o código de 6 dígitos no primeiro login.`); setTotpQr(data.qr_data_url ?? ""); setTotpSecret(data.totp_secret); } await loadRequests(); await loadUsers();
  }
  async function approve(id: string) { const response = await fetch(`/auth/users/${id}/approve`, { method: "POST", credentials: "include" }); setStatus(response.ok ? "Usuário aprovado." : "Não foi possível aprovar."); await loadUsers(); }

  return <div className="h-full overflow-y-auto p-6">
    <h2 className="text-xl font-semibold text-[var(--foreground)]">Usuários e aprovações</h2>
    <p className="text-sm text-[var(--muted-foreground)] mt-1">Somente o usuário Global pode criar, aprovar ou rejeitar acessos.</p>
    {totpSetup && <div className="mt-3 max-w-3xl rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900"><p>{totpSetup}</p>{totpQr && <><img src={totpQr} alt="QR Code para configurar o Google Authenticator" className="mt-3 w-48 h-48 bg-white p-2 rounded-lg" /><a href={totpQr} download="sofia-google-authenticator.png" className="inline-block mt-2 text-violet-700 underline">Baixar QR Code</a></>} {totpSecret && <><p className="mt-3">Configuração manual:</p><code className="block select-all rounded bg-white border border-amber-200 p-2 mt-1 break-all">{totpSecret}</code></>}</div>}
    <div className="mt-5 max-w-3xl"><h3 className="font-semibold text-[var(--foreground)]">Solicitações pendentes</h3><input type="password" value={temporaryPassword} onChange={(e) => setTemporaryPassword(e.target.value)} placeholder="Senha temporária para aprovações (8+, maiúscula, número e símbolo)" className="mt-2 w-full bg-[var(--muted)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm" /><select value={approvalRole} onChange={(e) => setApprovalRole(e.target.value)} className="mt-2 w-full bg-[var(--muted)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm"><option value="operator">Operador · somente leitura</option><option value="manager">Gestor · pode inserir no módulo</option><option value="global">Global · todos os módulos</option></select><div className="mt-3 grid gap-2">{requests.filter((item) => item.status === "pending").map((item) => <div key={item.id} className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3 text-sm"><b>{item.first_name} {item.last_name}</b><span className="block text-xs text-[var(--muted-foreground)]">{item.email} · módulo solicitado: {item.requested_module}</span>{item.justification && <span className="block text-xs mt-1">{item.justification}</span>}<div className="flex gap-2 mt-3"><button onClick={() => decide(item.id, "approved", item.requested_module)} className="px-3 py-1.5 rounded bg-emerald-600 text-white text-xs">Aprovar</button><button onClick={() => decide(item.id, "rejected", item.requested_module)} className="px-3 py-1.5 rounded bg-rose-600 text-white text-xs">Rejeitar</button></div></div>)}</div></div>
    <form onSubmit={createUser} className="mt-5 grid gap-3 max-w-xl bg-[var(--card)] border border-[var(--border)] rounded-xl p-4">
      <input required value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Nome de exibição" className="bg-[var(--muted)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm" />
      <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-mail" className="bg-[var(--muted)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm" />
      <input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Senha inicial" className="bg-[var(--muted)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm" />
      <select value={module} onChange={(e) => setModule(e.target.value)} className="bg-[var(--muted)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm">{availableModules.map((item) => <option key={item.slug} value={item.slug}>{item.display_name}</option>)}</select>
      <button className="rounded-lg bg-violet-600 text-white py-2 text-sm font-medium">Criar usuário pendente</button>
      {status && <p className="text-xs text-[var(--muted-foreground)]">{status}</p>}
    </form>
    <div className="mt-6 grid gap-2 max-w-3xl">{users.map((user) => <div key={user.id} className="flex items-center gap-3 bg-[var(--card)] border border-[var(--border)] rounded-lg p-3 text-sm"><span className="flex-1"><b>{user.display_name}</b><span className="block text-xs text-[var(--muted-foreground)]">{user.email} · {user.role} · {user.status}</span></span>{user.status === "pending" && <button onClick={() => approve(user.id)} className="px-3 py-1.5 rounded bg-emerald-600 text-white text-xs">Aprovar</button>}</div>)}</div>
  </div>;
}

function InsightsView({ moduleId }: { moduleId: ModuleId }) {
  const moduleName = connectionModuleName(moduleId);
  const [connectionUrl, setConnectionUrl] = useState(""); const [connectionName, setConnectionName] = useState(""); const [dashboardName, setDashboardName] = useState(""); const [status, setStatus] = useState("");
  async function saveConnection(e: FormEvent) { e.preventDefault(); setStatus("Salvando conexão..."); try { const scheme = connectionUrl.split(":")[0].toLowerCase(); const dialect = scheme.startsWith("postgres") ? "postgresql" : scheme.startsWith("mysql") ? "mysql" : scheme.startsWith("mssql") ? "mssql" : scheme; const { response, data } = await requestJson("/connections", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ module: moduleName, name: connectionName, dialect, connection_url: connectionUrl }) }); setStatus(response.ok ? data.message ?? "Conexão armazenada." : `Erro ${response.status}: ${data.error ?? "Conexão recusada."}`); } catch (error) { setStatus(`Falha de comunicação: ${requestError(error)}`); } }
  async function saveDashboard(e: FormEvent) {
    e.preventDefault();
    setStatus("Salvando painel...");
    try {
      const { response, data } = await requestJson("/dashboards", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ module: moduleName, name: dashboardName, definition: { widgets: [{ type: "table", title: "Tabela inicial" }] } }),
      });
      setStatus(response.ok ? "Painel salvo." : `Erro ${response.status}: ${data.error ?? "Não foi possível salvar o painel."}`);
    } catch (error) {
      setStatus(`Falha de comunicação: ${requestError(error)}`);
    }
  }
  return <div className="h-full overflow-y-auto p-6"><h2 className="text-xl font-semibold text-[var(--foreground)]">Painéis e dados</h2><p className="text-sm text-[var(--muted-foreground)] mt-1">Área inicial para conexões seguras, tabelas e gráficos do módulo atual.</p><div className="grid gap-4 lg:grid-cols-2 mt-5"><form onSubmit={saveConnection} className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 grid gap-3"><h3 className="font-semibold">Conectar fonte de dados</h3><input required value={connectionName} onChange={(e) => setConnectionName(e.target.value)} placeholder="Nome da conexão" className="bg-[var(--muted)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm" /><input required value={connectionUrl} onChange={(e) => setConnectionUrl(e.target.value)} placeholder="postgresql+psycopg://..." className="bg-[var(--muted)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm" /><p className="text-xs text-[var(--muted-foreground)]">A credencial é cifrada no banco e não retorna para a interface.</p><button className="rounded-lg bg-violet-600 text-white py-2 text-sm">Salvar conexão</button></form><form onSubmit={saveDashboard} className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 grid gap-3"><h3 className="font-semibold">Novo painel</h3><input required value={dashboardName} onChange={(e) => setDashboardName(e.target.value)} placeholder="Nome do painel" className="bg-[var(--muted)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm" /><p className="text-xs text-[var(--muted-foreground)]">A primeira versão cria uma tabela-base. O editor visual de gráficos será expandido sobre esta definição versionada.</p><button className="rounded-lg bg-blue-600 text-white py-2 text-sm">Criar painel</button></form></div>{status && <p className="mt-4 text-sm text-[var(--muted-foreground)]">{status}</p>}</div>;
}

function SemanticNetwork({ graph, moduleName }: { graph: any; moduleName: string }) {
  if (!graph?.available) return <section className="mt-5 rounded-xl border border-[var(--border)] bg-[var(--card)] p-6"><h3 className="font-semibold">Rede semântica de conhecimento</h3><p className="mt-2 text-sm text-[var(--muted-foreground)]">Rede semântica ainda não calculada.</p><p className="mt-1 text-xs text-[var(--muted-foreground)]">{graph?.reason ?? "Reprocesse as fontes quando o modelo local estiver habilitado."}</p></section>;
  const nodes = (graph.nodes ?? []).slice(0, 30).map((node: any, index: number, all: any[]) => ({ ...node, x: 8 + ((index * 37) % 84), y: 12 + ((index * 53) % 76), radius: Math.max(2.2, Math.min(5, 2 + Number(node.relevance ?? 0) * 3)) }));
  const byId = new Map<string, any>(nodes.map((node: any) => [String(node.id), node] as [string, any]));
  return <section className="mt-5 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] p-4"><div className="flex items-center justify-between gap-3"><div><h3 className="font-semibold">Rede semântica · {moduleName}</h3><p className="mt-1 text-xs text-[var(--muted-foreground)]">Nós e conexões calculados por embeddings persistidos e similaridade de cosseno. Nenhuma ligação é decorativa.</p></div><span className="text-xs text-[var(--muted-foreground)]">{nodes.length} assuntos · {(graph.edges ?? []).length} relações</span></div><div className="mt-4 overflow-auto rounded-lg bg-[#111326] p-2"><svg viewBox="0 0 100 100" role="img" aria-label={`Rede semântica real do módulo ${moduleName}`} className="min-h-[420px] w-full min-w-[620px]">{(graph.edges ?? []).map((edge: any) => { const source = byId.get(edge.source); const target = byId.get(edge.target); return source && target ? <line key={`${edge.source}-${edge.target}`} x1={source.x} y1={source.y} x2={target.x} y2={target.y} stroke="var(--module-accent, #8b5cf6)" strokeWidth={Math.max(.18, Number(edge.weight) * .7)} opacity=".55" /> : null; })}{nodes.map((node: any) => <g key={node.id} tabIndex={0} role="button" aria-label={`${node.label}, ${node.source_count} fontes, confiança ${Math.round(node.confidence * 100)}%`}><circle cx={node.x} cy={node.y} r={node.radius} fill="var(--module-accent, #8b5cf6)" opacity=".92" /><text x={node.x} y={node.y + node.radius + 3} textAnchor="middle" fill="#f8fafc" fontSize="2.5" className="select-none">{node.label.length > 22 ? `${node.label.slice(0, 21)}…` : node.label}</text></g>)}</svg></div><p className="mt-2 text-[11px] text-[var(--muted-foreground)]">Modelo: {graph.model?.model ?? "local"} · dimensão: {graph.model?.dimension ?? "não informada"} · normalização: {graph.model?.normalized ? "sim" : "não"}</p></section>;
}

function CoreKnowledgeView() {
  const [overview, setOverview] = useState<any>(null);
  const [status, setStatus] = useState("Carregando resumo global...");
  async function load() {
    const { response, data } = await requestJson("/knowledge/overview", { credentials: "include" });
    if (response.ok) { setOverview(data); setStatus(""); } else setStatus(data.error ?? "Não foi possível carregar o resumo global.");
  }
  useEffect(() => { void load(); }, []);
  return <div className="h-full overflow-y-auto p-6"><div className="flex items-start justify-between"><div><h2 className="text-xl font-semibold">Biblioteca global · CORE</h2><p className="mt-1 text-sm text-[var(--muted-foreground)]">Resumo consolidado das fontes dos módulos autorizados. O CORE não mistura os grafos dos módulos.</p></div><button onClick={() => void load()} className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs">Atualizar</button></div>{status && <p className="mt-5 text-sm text-[var(--muted-foreground)]">{status}</p>}{overview && <><div className="mt-5 grid gap-3 sm:grid-cols-3"><div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4"><b className="block text-2xl">{overview.total_sources}</b><span className="text-xs text-[var(--muted-foreground)]">fontes totais</span></div><div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4"><b className="block text-2xl">{Object.keys(overview.by_module ?? {}).length}</b><span className="text-xs text-[var(--muted-foreground)]">módulos com fontes</span></div><div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4"><b className="block text-2xl">{Object.keys(overview.by_extension ?? {}).length}</b><span className="text-xs text-[var(--muted-foreground)]">tipos de extensão</span></div></div><div className="mt-5 grid gap-4 lg:grid-cols-2"><section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4"><h3 className="font-semibold">Arquivos por extensão</h3><div className="mt-3 grid grid-cols-2 gap-2 text-sm">{Object.entries(overview.by_extension ?? {}).map(([extension, count]) => <div key={extension} className="rounded-lg bg-[var(--muted)] p-3"><b>{count as number}</b> <span className="text-[var(--muted-foreground)]">{extension}</span></div>)}</div></section><section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4"><h3 className="font-semibold">Fontes por módulo</h3><div className="mt-3 grid gap-2 text-sm">{Object.entries(overview.by_module ?? {}).map(([module, count]) => <div key={module} className="flex justify-between rounded-lg bg-[var(--muted)] p-3"><span>{module}</span><b>{count as number}</b></div>)}</div></section></div></>}</div>;
}

function KnowledgeView({ moduleId }: { moduleId: ModuleId }) {
  const moduleName = moduleId === "infra" ? "infraestrutura" : moduleId;
  type Source = { id: string; original_name: string; bucket: string; version_no: number; processing_status: string; processing_error?: string | null; size_bytes: number; has_source_url?: boolean; content_chars?: number; chunk_count?: number; keywords?: string[]; created_at?: string };
  type KnowledgeMap = { source_count: number; indexed_source_count: number; total_chunks: number; total_content_chars: number; status_counts: Record<string, number>; type_counts: Record<string, number>; ready_explanation: Record<string, number>; training_mode: string; training_note: string };
  const [sources, setSources] = useState<Source[]>([]);
  const [knowledgeMap, setKnowledgeMap] = useState<KnowledgeMap | null>(null);
  const [graph, setGraph] = useState<any>(null);
  const [manageSources, setManageSources] = useState(false);
  const [status, setStatus] = useState("");
  async function load(includeSources = false) {
    const response = await fetch(`/knowledge/sources?module=${encodeURIComponent(moduleName)}${includeSources ? "&manage=1" : ""}`, { credentials: "include" });
    if (response.ok) { const data = await response.json(); setSources(data.sources ?? []); setKnowledgeMap(data.knowledge_map ?? null); }
    const graphResponse = await fetch(`/knowledge/semantic-graph?module=${encodeURIComponent(moduleName)}`, { credentials: "include" });
    setGraph(graphResponse.ok ? await graphResponse.json() : { available: false, reason: "Não foi possível carregar a rede semântica." });
  }
  useEffect(() => { if (moduleId !== "core") void load(false); }, [moduleId]);
  async function reindex() { const response = await fetch("/knowledge/reindex", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ module: moduleName }) }); const data = await response.json(); setStatus(response.ok ? `${data.indexed} fonte(s) reindexada(s), ${data.tabular_rows} linha(s) estruturada(s).` : data.error ?? "Não foi possível reindexar."); await load(manageSources); }
  async function reprocess(id: string) { const response = await fetch(`/knowledge/sources/${id}/reprocess`, { method: "POST", credentials: "include" }); const data = await response.json(); setStatus(response.ok ? `Fonte reprocessada: ${data.processing_status}.` : data.error ?? "Não foi possível reprocessar."); await load(true); }
  async function refresh(id: string) { setStatus("Atualizando conteúdo original do link..."); const response = await fetch(`/knowledge/sources/${id}/refresh`, { method: "POST", credentials: "include" }); const data = await response.json(); setStatus(response.ok ? `Fonte atualizada: ${data.processing_status}.` : data.error ?? "Não foi possível atualizar."); await load(true); }
  async function logicalDelete(id: string) { const response = await fetch(`/knowledge/sources/${id}`, { method: "DELETE", credentials: "include" }); setStatus(response.ok ? "Fonte removida logicamente." : (await response.json()).error ?? "Não foi possível remover."); await load(true); }
  const formatNumber = (value: number) => new Intl.NumberFormat("pt-BR").format(value);
  if (moduleId === "core") return <CoreKnowledgeView />;
  return <div className="h-full overflow-y-auto p-6"><div className="flex items-start justify-between gap-3"><div><h2 className="text-xl font-semibold">Biblioteca de conhecimento · {moduleName}</h2><p className="text-sm text-[var(--muted-foreground)] mt-1">Rede e indicadores calculados exclusivamente com as fontes autorizadas deste módulo.</p></div><div className="flex gap-2"><button onClick={() => { setManageSources(true); void load(true); }} className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs">Gerenciar fontes</button><button onClick={() => void reindex()} className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs">Ler pastas locais</button></div></div>{knowledgeMap && <section className="mt-5 grid gap-4 lg:grid-cols-[1.1fr_1fr]"><div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4"><h3 className="font-semibold">Estado da biblioteca</h3><div className="mt-3 grid grid-cols-2 gap-3 text-xs"><div className="rounded-lg bg-[var(--muted)] p-3"><b className="block text-lg">{formatNumber(knowledgeMap.source_count)}</b>fontes totais</div><div className="rounded-lg bg-[var(--muted)] p-3"><b className="block text-lg">{formatNumber(knowledgeMap.indexed_source_count)}</b>fontes prontas</div><div className="rounded-lg bg-[var(--muted)] p-3"><b className="block text-lg">{formatNumber(knowledgeMap.total_chunks)}</b>trechos indexados</div><div className="rounded-lg bg-[var(--muted)] p-3"><b className="block text-lg">{formatNumber(knowledgeMap.total_content_chars)}</b>caracteres lidos</div></div><p className="mt-3 text-xs text-[var(--muted-foreground)]">Processamento: {knowledgeMap.ready_explanation.em_processamento ?? 0} · erros: {knowledgeMap.ready_explanation.com_erro ?? 0} · fora do assunto: {knowledgeMap.ready_explanation.fora_do_assunto ?? 0}.</p><p className="mt-2 text-[11px] text-[var(--muted-foreground)]">{knowledgeMap.training_note}</p></div><div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4"><h3 className="font-semibold">Fontes por tipo original</h3><div className="mt-3 grid grid-cols-2 gap-2 text-xs">{Object.entries(knowledgeMap.type_counts ?? {}).map(([type, count]) => <div key={type} className="rounded-lg bg-[var(--muted)] p-2"><b>{formatNumber(Number(count))}</b> {type.toUpperCase()}</div>)}</div></div></section>}{<SemanticNetwork graph={graph} moduleName={moduleName} />}{manageSources && <div className="fixed inset-0 z-50 bg-black/60 p-4" role="dialog" aria-modal="true"><div className="mx-auto mt-8 max-h-[85vh] max-w-4xl overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--card)] p-5"><div className="flex items-center justify-between"><h3 className="text-lg font-semibold">Gerenciar fontes · {moduleName}</h3><button onClick={() => setManageSources(false)} className="text-sm">Fechar</button></div><div className="mt-4 grid gap-2">{sources.length === 0 ? <p className="text-xs text-[var(--muted-foreground)]">Nenhuma fonte carregada.</p> : sources.map(source => <div key={source.id} className="rounded-lg border-b border-[var(--border)] py-3 text-xs"><div className="flex items-start gap-3"><span className="min-w-0 flex-1"><b className="break-words">{source.original_name}</b><span className="mt-1 block text-[var(--muted-foreground)]">{source.bucket} · versão {source.version_no} · {source.processing_status} · {source.chunk_count ?? 0} trecho(s)</span>{source.processing_error && <span className="mt-1 block text-rose-600">{source.processing_error}</span>}</span>{source.has_source_url && <button onClick={() => void refresh(source.id)} className="text-blue-600">Atualizar</button>}<button onClick={() => void reprocess(source.id)} className="text-violet-600">Reprocessar</button><button onClick={() => void logicalDelete(source.id)} className="text-rose-600">Remover</button></div></div>)}</div>{status && <p role="status" className="mt-3 text-xs text-[var(--muted-foreground)]">{status}</p>}</div></div>}</div>;
}

function ZabbixView({ moduleId }: { moduleId: ModuleId }) {
  const moduleName = connectionModuleName(moduleId);
  const [baseUrl, setBaseUrl] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [apiToken, setApiToken] = useState("");
  const [status, setStatus] = useState("");
  async function test() {
    setStatus("Testando conexão com o Zabbix...");
    try { const { response, data } = await requestJson("/connections/zabbix/test", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ module: moduleName, base_url: baseUrl, username, password, api_token: apiToken }) }, 30000); setStatus(response.ok ? `Zabbix ${data.version} conectado: ${data.hosts} host(s), ${data.recent_problems} problema(s) recente(s).` : `Erro ${response.status}: ${data.error ?? "Não foi possível conectar ao Zabbix."}`); } catch (error) { setStatus(`Falha de comunicação: ${requestError(error)}`); }
  }
  async function save() { setStatus("Salvando configuração do Zabbix..."); try { const { response, data } = await requestJson("/connections", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ module: moduleName, name: "Zabbix", dialect: "zabbix", connection_url: baseUrl, config: { base_url: baseUrl, api_token: apiToken, username, password } }) }); setStatus(response.ok ? "Zabbix validado e configuração cifrada armazenada." : `Erro ${response.status}: ${data.error ?? "Não foi possível armazenar o Zabbix."}`); } catch (error) { setStatus(`Falha de comunicação: ${requestError(error)}`); } }
  return <div className="p-6 pb-0"><div className="max-w-2xl bg-[var(--card)] border border-[var(--border)] rounded-xl p-5 grid gap-3"><h2 className="text-lg font-semibold">Conectar ao Zabbix</h2><p className="text-xs text-[var(--muted-foreground)]">Informe o endereço do servidor. O sistema tenta automaticamente HTTP/HTTPS e os caminhos padrão da API. Escolha token ou usuário/senha.</p><input value={baseUrl} onChange={e => setBaseUrl(e.target.value)} placeholder="http://ipdoservidor/zabbix/api_jsonrpc.php" className="bg-[var(--muted)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm"/><input type="password" value={apiToken} onChange={e => setApiToken(e.target.value)} placeholder="API token do Zabbix (preferencial)" className="bg-[var(--muted)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm"/><div className="grid grid-cols-2 gap-3"><input value={username} onChange={e => setUsername(e.target.value)} placeholder="Usuário (alternativo)" className="bg-[var(--muted)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm"/><input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Senha (alternativa)" className="bg-[var(--muted)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm"/></div><div className="flex gap-2"><button onClick={() => void test()} disabled={!baseUrl || (!apiToken && (!username || !password))} className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm disabled:opacity-40">Testar conexão</button><button onClick={() => void save()} disabled={!baseUrl || (!apiToken && (!username || !password))} className="rounded-lg bg-orange-600 text-white px-4 py-2 text-sm disabled:opacity-40">Validar e salvar</button></div>{status && <p className="text-xs text-[var(--muted-foreground)]">{status}</p>}</div></div>;
}

function ApiConnectionsView({ moduleId }: { moduleId: ModuleId }) {
  const moduleName = connectionModuleName(moduleId); const [url, setUrl] = useState(""); const [token, setToken] = useState(""); const [header, setHeader] = useState("Authorization"); const [prefix, setPrefix] = useState("Bearer"); const [username, setUsername] = useState(""); const [password, setPassword] = useState(""); const [status, setStatus] = useState("");
  async function test() { setStatus("Testando API..."); try { const { response, data } = await requestJson("/connections/api/test", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ module: moduleName, url, api_token: token, token_header: header, token_prefix: prefix, username, password }) }); setStatus(response.ok ? `API acessível (${data.status_code}).` : `Erro ${response.status}: ${data.error ?? "Falha ao validar API."}`); } catch (error) { setStatus(`Falha de comunicação: ${requestError(error)}`); } }
  async function save() { setStatus("Salvando API..."); try { const { response, data } = await requestJson("/connections", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ module: moduleName, name: new URL(url).hostname, dialect: "api", connection_url: url, config: { url, api_token: token, token_header: header, token_prefix: prefix, username, password } }) }); setStatus(response.ok ? "API conectada e configuração protegida." : `Erro ${response.status}: ${data.error ?? "Não foi possível salvar."}`); } catch (error) { setStatus(`Falha de comunicação: ${requestError(error)}`); } }
  const ready = Boolean(url && (token || (username && password)));
  return <div className="h-full overflow-y-auto p-6"><h2 className="text-xl font-semibold text-[var(--foreground)]">Conectar uma API</h2><p className="text-sm text-[var(--muted-foreground)] mt-1">Informe o endereço e a chave. Os demais campos são opcionais e só devem ser usados quando a API exigir.</p><div className="mt-5 max-w-2xl rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 grid gap-3"><input required value={url} onChange={e => setUrl(e.target.value)} placeholder="Endereço da API (https://servidor/api)" className="bg-[var(--muted)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--foreground)]"/><input type="password" value={token} onChange={e => setToken(e.target.value)} placeholder="Chave ou token da API" className="bg-[var(--muted)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--foreground)]"/><details className="rounded-lg border border-[var(--border)] p-3"><summary className="cursor-pointer text-sm text-[var(--foreground)]">Autenticação adicional (opcional)</summary><div className="mt-3 grid gap-3"><div className="grid grid-cols-2 gap-3"><input value={header} onChange={e => setHeader(e.target.value)} placeholder="Cabeçalho: Authorization" className="bg-[var(--muted)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm"/><input value={prefix} onChange={e => setPrefix(e.target.value)} placeholder="Prefixo: Bearer" className="bg-[var(--muted)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm"/></div><div className="grid grid-cols-2 gap-3"><input value={username} onChange={e => setUsername(e.target.value)} placeholder="Usuário opcional" className="bg-[var(--muted)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm"/><input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Senha opcional" className="bg-[var(--muted)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm"/></div></div></details><div className="flex gap-2"><button onClick={() => void test()} disabled={!ready} className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm disabled:opacity-40">Testar API</button><button onClick={() => void save()} disabled={!ready} className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-40">Validar e conectar</button></div>{status && <p className="text-xs text-[var(--muted-foreground)]">{status}</p>}</div></div>;
}

function LegacyApiConnectionsView({ moduleId }: { moduleId: ModuleId }) {
  const moduleName = connectionModuleName(moduleId);
  const [url, setUrl] = useState(""); const [name, setName] = useState(""); const [token, setToken] = useState(""); const [header, setHeader] = useState("Authorization"); const [prefix, setPrefix] = useState("Bearer"); const [username, setUsername] = useState(""); const [password, setPassword] = useState(""); const [status, setStatus] = useState("");
  async function test() { setStatus("Testando API..."); try { const { response, data } = await requestJson("/connections/api/test", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ module: moduleName, url, api_token: token, token_header: header, token_prefix: prefix, username, password }) }); setStatus(response.ok ? `API acessível (${data.status_code}).` : `Erro ${response.status}: ${data.error ?? "Falha ao validar API."}`); } catch (error) { setStatus(`Falha de comunicação: ${requestError(error)}`); } }
  async function save() { setStatus("Salvando configuração da API..."); try { const { response, data } = await requestJson("/connections", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ module: moduleName, name, dialect: "api", connection_url: url, config: { url, api_token: token, token_header: header, token_prefix: prefix, username, password } }) }); setStatus(response.ok ? "API validada e configuração cifrada armazenada." : `Erro ${response.status}: ${data.error ?? "Não foi possível armazenar a API."}`); } catch (error) { setStatus(`Falha de comunicação: ${requestError(error)}`); } }
  return <div className="p-6 pb-0"><div className="max-w-2xl bg-[var(--card)] border border-[var(--border)] rounded-xl p-5 grid gap-3"><h2 className="text-lg font-semibold">Conexão de APIs</h2><p className="text-xs text-[var(--muted-foreground)]">Informe endereço e token. Usuário e senha são opcionais para APIs que usam autenticação Basic.</p><input value={name} onChange={e=>setName(e.target.value)} placeholder="Nome da API" className="bg-[var(--muted)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm"/><input value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://api.exemplo.com/health" className="bg-[var(--muted)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm"/><div className="grid grid-cols-2 gap-3"><input value={header} onChange={e=>setHeader(e.target.value)} placeholder="Cabeçalho do token" className="bg-[var(--muted)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm"/><input value={prefix} onChange={e=>setPrefix(e.target.value)} placeholder="Prefixo: Bearer" className="bg-[var(--muted)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm"/></div><input type="password" value={token} onChange={e=>setToken(e.target.value)} placeholder="Chave / token" className="bg-[var(--muted)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm"/><div className="grid grid-cols-2 gap-3"><input value={username} onChange={e=>setUsername(e.target.value)} placeholder="Usuário opcional" className="bg-[var(--muted)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm"/><input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Senha opcional" className="bg-[var(--muted)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm"/></div><div className="flex gap-2"><button onClick={() => void test()} disabled={!url || (!token && (!username || !password))} className="w-fit rounded-lg border border-[var(--border)] px-4 py-2 text-sm disabled:opacity-40">Testar API</button><button onClick={() => void save()} disabled={!name || !url || (!token && (!username || !password))} className="w-fit rounded-lg bg-blue-600 text-white px-4 py-2 text-sm disabled:opacity-40">Validar e salvar</button></div>{status&&<p className="text-xs text-[var(--muted-foreground)]">{status}</p>}</div></div>;
}

function DataSourcesView({ moduleId }: { moduleId: ModuleId }) {
  const moduleName = connectionModuleName(moduleId);
  const [kind, setKind] = useState<"database" | "api">("database");
  const [dialect, setDialect] = useState("postgresql");
  const [name, setName] = useState(""); const [host, setHost] = useState(""); const [port, setPort] = useState("5432");
  const [database, setDatabase] = useState(""); const [username, setUsername] = useState(""); const [password, setPassword] = useState("");
  const [apiType, setApiType] = useState("api"); const [apiUrl, setApiUrl] = useState(""); const [token, setToken] = useState(""); const [purpose, setPurpose] = useState("all");
  const [status, setStatus] = useState(""); const [tested, setTested] = useState(false); const [tables, setTables] = useState<string[]>([]);
  const [sources, setSources] = useState<any[]>([]);
  useEffect(() => { setPort(dialect === "postgresql" ? "5432" : dialect === "mysql" ? "3306" : dialect === "mssql" ? "1433" : dialect === "oracle" ? "1521" : ""); setTested(false); }, [dialect]);
  useEffect(() => { if (moduleId !== "core") void requestJson(`/data-sources?module=${encodeURIComponent(moduleName)}`, { credentials: "include" }).then(({ response, data }) => { if (response.ok) setSources(data.connections ?? []); }); }, [moduleId, moduleName]);
  function databaseUrl() { const scheme = dialect === "postgresql" ? "postgresql+psycopg" : dialect === "mysql" ? "mysql+pymysql" : dialect === "mssql" ? "mssql+pyodbc" : dialect === "oracle" ? "oracle+oracledb" : "sqlite"; const target = database || (dialect === "postgresql" ? "postgres" : dialect === "mysql" ? "mysql" : dialect === "mssql" ? "master" : ""); return dialect === "sqlite" ? `sqlite:///${database}` : `${scheme}://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${host}:${port}/${target}`; }
  async function test() { setStatus("Testando conexão real..."); setTested(false); try { const url = kind === "database" ? databaseUrl() : apiUrl; const endpoint = kind === "database" ? "/data-sources/test" : apiType === "zabbix" ? "/connections/zabbix/test" : "/connections/api/test"; const body = kind === "database" ? { module: moduleName, connection_url: url } : apiType === "zabbix" ? { module: moduleName, base_url: url, api_token: token } : { module: moduleName, url, api_token: token }; const { response, data } = await requestJson(endpoint, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }, 30000); if (response.ok) { setTested(true); setTables(data.tables ?? []); setStatus(kind === "database" ? `Conexão validada. ${data.tables?.length ?? 0} objeto(s) descoberto(s).` : apiType === "zabbix" ? `Zabbix ${data.version ?? ""} conectado: ${data.hosts ?? 0} host(s).` : `API acessível (${data.status_code}).`); } else setStatus(data.error ?? data.message ?? "Não foi possível validar a fonte."); } catch (error) { setStatus(`Falha de comunicação: ${requestError(error)}`); } }
  async function connect() { if (!tested) return; setStatus("Salvando fonte..."); const url = kind === "database" ? databaseUrl() : apiUrl; const { response, data } = await requestJson("/data-sources", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ module: moduleName, name: name || (kind === "database" ? `${dialect} · ${host}` : new URL(apiUrl).hostname), dialect: kind === "database" ? dialect : apiType, source_type: kind === "database" ? "database" : apiType, purpose, connection_url: url, config: kind === "database" ? { connection_url: url } : { url: apiUrl, api_token: token } }) }); setStatus(response.ok ? "Fonte conectada e disponível para IA e dashboards." : data.error ?? "Não foi possível salvar a fonte."); if (response.ok) { setTested(false); const refreshed = await requestJson(`/data-sources?module=${encodeURIComponent(moduleName)}`, { credentials: "include" }); if (refreshed.response.ok) setSources(refreshed.data.connections ?? []); } }
  if (moduleId === "core") return <div className="p-6 text-sm text-[var(--muted-foreground)]">Selecione um módulo antes de conectar uma fonte.</div>;
  return <div className="h-full overflow-y-auto p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-semibold">Fontes de dados</h2><p className="text-sm text-[var(--muted-foreground)] mt-1">Escolha a fonte, teste o acesso, descubra os dados e conecte somente após a validação.</p></div><span className="rounded-full bg-emerald-100 px-3 py-1 text-xs text-emerald-800">Somente leitura</span></div><div className="mt-5 max-w-3xl rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 grid gap-3"><div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => { setKind("database"); setTested(false); }} className={`rounded-lg border px-3 py-2 text-sm ${kind === "database" ? "border-blue-600 bg-blue-50" : "border-[var(--border)]"}`}>Bancos de dados</button><button type="button" onClick={() => { setKind("api"); setTested(false); }} className={`rounded-lg border px-3 py-2 text-sm ${kind === "api" ? "border-blue-600 bg-blue-50" : "border-[var(--border)]"}`}>APIs e sistemas</button></div><input required value={name} onChange={e => setName(e.target.value)} placeholder="Nome da fonte" className="bg-[var(--muted)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm" />{kind === "database" ? <><select value={dialect} onChange={e => setDialect(e.target.value)} className="bg-[var(--muted)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm"><option value="postgresql">PostgreSQL</option><option value="mysql">MySQL / MariaDB</option><option value="mssql">SQL Server</option><option value="oracle">Oracle</option><option value="sqlite">SQLite</option></select>{dialect === "sqlite" ? <input required value={database} onChange={e => setDatabase(e.target.value)} placeholder="Arquivo .db, .sqlite ou .sqlite3" className="bg-[var(--muted)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm" /> : <><div className="grid grid-cols-2 gap-3"><input required value={host} onChange={e => setHost(e.target.value)} placeholder="Host ou IP" className="bg-[var(--muted)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm" /><input required value={port} onChange={e => setPort(e.target.value)} placeholder="Porta" className="bg-[var(--muted)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm" /></div><input value={database} onChange={e => setDatabase(e.target.value)} placeholder="Nome do banco" className="bg-[var(--muted)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm" /><div className="grid grid-cols-2 gap-3"><input required value={username} onChange={e => setUsername(e.target.value)} placeholder="Usuário" className="bg-[var(--muted)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm" /><input required type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Senha" className="bg-[var(--muted)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm" /></div></>}</> : <><select value={apiType} onChange={e => { setApiType(e.target.value); setTested(false); }} className="bg-[var(--muted)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm"><option value="zabbix">Zabbix</option><option value="totvs">TOTVS</option><option value="fluig">Fluig</option><option value="api">API REST genérica</option></select><input required value={apiUrl} onChange={e => setApiUrl(e.target.value)} placeholder="URL base ou endpoint HTTPS" className="bg-[var(--muted)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm" /><input type="password" value={token} onChange={e => setToken(e.target.value)} placeholder="Token (opcional)" className="bg-[var(--muted)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm" /></>}<select value={purpose} onChange={e => setPurpose(e.target.value)} className="bg-[var(--muted)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm"><option value="all">Todas as finalidades</option><option value="ai">Consultas da IA</option><option value="dashboard">Dashboard</option><option value="knowledge">Base de conhecimento estruturada</option><option value="workflow">Fluxos e automações</option></select><p className="text-xs text-[var(--muted-foreground)]">Disponibilizar uma fonte para a IA não treina automaticamente os pesos do modelo. Os dados serão usados de forma controlada para fundamentar consultas e respostas.</p><div className="flex flex-wrap gap-2"><button type="button" onClick={() => void test()} disabled={kind === "database" ? (dialect === "sqlite" ? !database : !host || !username || !password) : !apiUrl} className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm disabled:opacity-40">Testar conexão</button><button type="button" onClick={() => void connect()} disabled={!tested} className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-40">Conectar</button></div>{status && <p role="status" className="text-xs text-[var(--muted-foreground)]">{status}</p>}{tables.length > 0 && <div className="rounded-lg border border-[var(--border)] p-3"><h3 className="text-sm font-semibold">Dados descobertos</h3><div className="mt-2 grid gap-1 text-xs">{tables.map(table => <label key={table} className="flex gap-2"><input type="checkbox" defaultChecked />{table}</label>)}</div></div>}</div><section className="mt-6 max-w-4xl"><h3 className="font-semibold">Catálogo de fontes</h3><div className="mt-3 grid gap-2">{sources.length === 0 ? <p className="text-xs text-[var(--muted-foreground)]">Nenhuma fonte conectada neste módulo.</p> : sources.map(source => <article key={source.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--card)] p-3 text-sm"><span className="flex-1"><b>{source.name}</b><span className="block text-xs text-[var(--muted-foreground)]">{source.dialect} · {source.purpose} · {source.status}</span></span><span className="text-xs text-[var(--muted-foreground)]">{source.is_read_only ? "Somente leitura" : "Leitura e escrita"}</span></article>)}</div></section></div>;
}

function ConnectionsView({ moduleId }: { moduleId: ModuleId }) {
  const moduleName = connectionModuleName(moduleId); const [dialect, setDialect] = useState("postgresql"); const [host, setHost] = useState(""); const [port, setPort] = useState("5432"); const [database, setDatabase] = useState(""); const [username, setUsername] = useState(""); const [password, setPassword] = useState(""); const [status, setStatus] = useState(""); const [tables, setTables] = useState<string[]>([]);
  useEffect(() => { setPort(dialect === "postgresql" ? "5432" : dialect === "mysql" ? "3306" : dialect === "mssql" ? "1433" : dialect === "oracle" ? "1521" : ""); }, [dialect]);
  function url() { const scheme = dialect === "postgresql" ? "postgresql+psycopg" : dialect === "mysql" ? "mysql+pymysql" : dialect === "mssql" ? "mssql+pyodbc" : dialect === "oracle" ? "oracle+oracledb" : "sqlite"; const target = database || (dialect === "postgresql" ? "postgres" : dialect === "mysql" ? "mysql" : dialect === "mssql" ? "master" : ""); return dialect === "sqlite" ? `sqlite:///${database}` : `${scheme}://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${host}:${port}/${target}`; }
  async function test() { setStatus("Testando e descobrindo tabelas..."); try { const { response, data } = await requestJson("/knowledge/database/test", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ module: moduleName, connection_url: url() }) }); if (response.ok) { setTables(data.tables ?? []); setStatus(`Conectado. ${data.tables?.length ?? 0} tabela(s) encontrada(s).`); } else setStatus(`Erro ${response.status}: ${data.error ?? "Falha na conexão."}`); } catch (error) { setStatus(`Falha de comunicação: ${requestError(error)}`); } }
  async function connect() { setStatus("Conectando e salvando..."); try { const { response, data } = await requestJson("/connections", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ module: moduleName, name: `${dialect} · ${host}`, dialect, connection_url: url() }) }); setStatus(response.ok ? "Conectado. A fonte está pronta para IA e dashboards." : `Erro ${response.status}: ${data.error ?? "Não foi possível conectar."}`); } catch (error) { setStatus(`Falha de comunicação: ${requestError(error)}`); } }
  const ready = Boolean(host && username && password);
  return <div className="h-full overflow-y-auto p-6"><h2 className="text-xl font-semibold text-[var(--foreground)]">Conectar banco de dados</h2><p className="text-sm text-[var(--muted-foreground)] mt-1">Escolha o banco e informe somente servidor, usuário e senha. Porta e banco padrão são preenchidos automaticamente.</p><div className="mt-5 max-w-2xl rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 grid gap-3"><select value={dialect} onChange={e => setDialect(e.target.value)} className="bg-[var(--muted)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--foreground)]"><option value="postgresql">PostgreSQL</option><option value="mysql">MySQL / MariaDB</option><option value="mssql">SQL Server</option><option value="oracle">Oracle</option><option value="sqlite">SQLite</option></select><div className="grid grid-cols-2 gap-3"><input required value={host} onChange={e => setHost(e.target.value)} placeholder="IP ou DNS do servidor" className="bg-[var(--muted)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--foreground)]"/><input value={port} onChange={e => setPort(e.target.value)} placeholder="Porta padrão" className="bg-[var(--muted)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--foreground)]"/></div><input value={database} onChange={e => setDatabase(e.target.value)} placeholder="Banco (opcional; usar padrão)" className="bg-[var(--muted)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--foreground)]"/><div className="grid grid-cols-2 gap-3"><input required value={username} onChange={e => setUsername(e.target.value)} placeholder="Usuário" className="bg-[var(--muted)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--foreground)]"/><input required type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Senha" className="bg-[var(--muted)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--foreground)]"/></div><div className="flex gap-2"><button type="button" onClick={() => void test()} disabled={!ready} className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm disabled:opacity-40">Testar e descobrir</button><button type="button" onClick={() => void connect()} disabled={!ready} className="rounded-lg bg-violet-600 px-4 py-2 text-sm text-white disabled:opacity-40">Conectar</button></div>{status && <p className="text-xs text-[var(--muted-foreground)]">{status}</p>}{tables.length > 0 && <div className="rounded-lg bg-[var(--muted)] p-3"><p className="text-xs font-semibold text-[var(--foreground)]">Tabelas encontradas</p><div className="mt-2 flex flex-wrap gap-1">{tables.map(table => <span key={table} className="rounded bg-[var(--card)] px-2 py-1 text-xs text-[var(--muted-foreground)]">{table}</span>)}</div></div>}</div></div>;
}

function LegacyConnectionsView({ moduleId }: { moduleId: ModuleId }) {
  const moduleName = connectionModuleName(moduleId); const [dialect,setDialect]=useState("postgresql"); const [name,setName]=useState(""); const [host,setHost]=useState("127.0.0.1"); const [port,setPort]=useState("5432"); const [database,setDatabase]=useState(""); const [username,setUsername]=useState(""); const [password,setPassword]=useState(""); const [status,setStatus]=useState("");
  useEffect(()=>{setPort(dialect==="postgresql"?"5432":dialect==="mysql"?"3306":dialect==="mssql"?"1433":dialect==="oracle"?"1521":"5432");},[dialect]);
  function url(){const scheme=dialect==="postgresql"?"postgresql+psycopg":dialect==="mysql"?"mysql+pymysql":dialect==="mssql"?"mssql+pyodbc":dialect==="oracle"?"oracle+oracledb":"sqlite"; const targetDatabase=database || (dialect==="postgresql"?"postgres":dialect==="mysql"?"mysql":dialect==="mssql"?"master":""); return dialect==="sqlite"?`sqlite:///${database}`:`${scheme}://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${host}:${port}/${targetDatabase}`;}
  async function test(){setStatus("Testando conexão com o banco...");try{const {response,data}=await requestJson("/knowledge/database/test",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({module:moduleName,connection_url:url()})});setStatus(response.ok?`Conexão válida: ${data.tables?.length??0} tabela(s) encontrada(s).`:`Erro ${response.status}: ${data.error??data.message??"Falha na conexão."}`);}catch(error){setStatus(`Falha de comunicação: ${requestError(error)}`);}}
  async function connect(){setStatus("Validando e salvando conexão...");try{const {response,data}=await requestJson("/connections",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({module:moduleName,name:name||`${dialect} em ${host}`,dialect,connection_url:url()})});setStatus(response.ok?"Conectado. As tabelas estarão disponíveis para análises e dashboards.":`Erro ${response.status}: ${data.error??"Não foi possível conectar."}`);}catch(error){setStatus(`Falha de comunicação: ${requestError(error)}`);}}
  return <div className="h-full overflow-y-auto p-6"><h2 className="text-xl font-semibold">Conexões de bancos</h2><p className="text-sm text-[var(--muted-foreground)] mt-1">Use este formulário para o banco do Zabbix ou qualquer outra base. As portas padrão são sugeridas automaticamente.</p><div className="mt-5 max-w-2xl bg-[var(--card)] border border-[var(--border)] rounded-xl p-5 grid gap-3"><input required value={name} onChange={e=>setName(e.target.value)} placeholder="Nome da conexão (ex.: Banco Zabbix)" className="bg-[var(--muted)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm"/><select value={dialect} onChange={e=>setDialect(e.target.value)} className="bg-[var(--muted)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm"><option value="postgresql">PostgreSQL</option><option value="mysql">MySQL / MariaDB</option><option value="mssql">SQL Server</option><option value="oracle">Oracle</option><option value="sqlite">SQLite</option></select><div className="grid grid-cols-2 gap-3"><input value={host} onChange={e=>setHost(e.target.value)} placeholder="ipdoservidor ou dnsdoservidor" className="bg-[var(--muted)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm"/><input value={port} onChange={e=>setPort(e.target.value)} placeholder="Porta" className="bg-[var(--muted)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm"/></div><input value={database} onChange={e=>setDatabase(e.target.value)} placeholder="Banco / serviço / SID (ex.: zabbix)" className="bg-[var(--muted)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm"/><div className="grid grid-cols-2 gap-3"><input value={username} onChange={e=>setUsername(e.target.value)} placeholder="Usuário" className="bg-[var(--muted)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm"/><input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Senha" className="bg-[var(--muted)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm"/></div><div className="flex gap-2"><button type="button" onClick={test} className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm">Testar conexão</button><button type="button" onClick={connect} className="rounded-lg bg-violet-600 text-white px-4 py-2 text-sm">Validar e conectar</button></div>{status&&<p className="text-xs text-[var(--muted-foreground)]">{status}</p>}<p className="text-xs text-[var(--muted-foreground)]">A senha é usada apenas para o teste e, ao conectar, é cifrada no banco. O driver necessário precisa estar instalado no ambiente do servidor.</p></div></div>;
}

function TrendChart({ series, positive }: { series: number[]; positive: boolean }) {
  if (!series?.length) return <div className="h-28 flex items-center justify-center text-xs text-[var(--muted-foreground)]">Sem série suficiente</div>;
  const min = Math.min(...series); const max = Math.max(...series); const range = max - min || 1;
  const points = series.map((value, index) => `${(index / Math.max(series.length - 1, 1)) * 100},${100 - ((value - min) / range) * 88 - 6}`).join(" ");
  return <svg viewBox="0 0 100 100" preserveAspectRatio="none" className={`h-28 w-full ${positive ? "text-emerald-500" : "text-rose-500"}`} role="img" aria-label="Gráfico de tendência"><polyline points={points} fill="none" stroke="currentColor" strokeWidth="2.5" vectorEffect="non-scaling-stroke" /></svg>;
}

function DashboardsView({ moduleId }: { moduleId: ModuleId }) {
  const moduleName = moduleId === "infra" ? "infraestrutura" : moduleId;
  const [status, setStatus] = useState("");
  const [trends, setTrends] = useState<any>(null);
  async function loadTrends() {
    setStatus("Calculando estatísticas, categorias e tendências...");
    const { response, data } = await requestJson(`/ai/trends?module=${encodeURIComponent(moduleName)}`, { credentials: "include" });
    if (response.ok) { setTrends(data); setStatus("Dashboard automático atualizado."); } else setStatus(data.error ?? `Erro ${response.status}`);
  }
  return <div className="h-full overflow-y-auto p-6"><h2 className="text-xl font-semibold text-[var(--foreground)]">Dashboards inteligentes</h2><p className="text-sm text-[var(--muted-foreground)] mt-1">A Sofia identifica estatísticas, categorias e palavras-chave do módulo.</p><button onClick={() => void loadTrends()} className="mt-5 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white">Gerar dashboard automático</button>{status && <p className="mt-3 text-xs text-[var(--muted-foreground)]">{status}</p>}{trends && <div className="mt-5 grid gap-4 md:grid-cols-2">{trends.metrics?.map((metric: any) => <article key={metric.field} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4"><div className="flex justify-between"><h3 className="font-semibold text-[var(--foreground)]">{metric.field}</h3><span className="text-xs text-[var(--muted-foreground)]">{metric.direction} · {Number(metric.change_percent).toFixed(1)}%</span></div><TrendChart series={metric.series} positive={metric.direction !== "queda"} /><div className="grid grid-cols-2 gap-2 text-xs text-[var(--muted-foreground)]"><span>Média: <b className="text-[var(--foreground)]">{Number(metric.average).toFixed(2)}</b></span><span>Mediana: <b className="text-[var(--foreground)]">{Number(metric.median).toFixed(2)}</b></span><span>Mínimo: <b className="text-[var(--foreground)]">{Number(metric.min).toFixed(2)}</b></span><span>Máximo: <b className="text-[var(--foreground)]">{Number(metric.max).toFixed(2)}</b></span></div></article>)}{trends.dimensions?.map((dimension: any) => <article key={dimension.field} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4"><h3 className="font-semibold text-[var(--foreground)]">{dimension.field}</h3><p className="text-xs text-[var(--muted-foreground)]">{dimension.kind}</p><div className="mt-3 space-y-2">{dimension.items.map((item: any) => <div key={item.label} className="flex items-center gap-2 text-xs"><span className="w-28 truncate text-[var(--muted-foreground)]">{item.label}</span><div className="h-2 flex-1 rounded bg-[var(--muted)]"><div className="h-2 rounded bg-violet-500" style={{ width: `${Math.min(100, item.count / Math.max(...dimension.items.map((entry: any) => entry.count)) * 100)}%` }} /></div><b className="text-[var(--foreground)]">{item.count}</b></div>)}</div></article>)}{trends.topic_matches?.map((topic: any) => <article key={topic.topic} className="rounded-xl border border-blue-300 bg-blue-50 p-4 dark:bg-blue-950/20"><h3 className="font-semibold text-blue-900 dark:text-blue-200">Tema identificado</h3><p className="mt-2 text-sm text-blue-800 dark:text-blue-100"><b>{topic.topic}</b>: {topic.count} registro(s) relacionado(s).</p></article>)}</div>}</div>;
}

function LegacyDashboardsView({ moduleId }: { moduleId: ModuleId }) {
  const moduleName = moduleId === "infra" ? "infraestrutura" : moduleId;
  const [name, setName] = useState(""); const [status, setStatus] = useState(""); const [trends, setTrends] = useState<any>(null);
  async function save() { const response = await fetch("/dashboards", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ module: moduleName, name, definition: { widgets: [{ type: "trend", title: "Análise automática" }] } }) }); const data = await response.json(); setStatus(response.ok ? "Dashboard salvo." : data.error ?? "Falha ao salvar."); }
  async function loadTrends() { setStatus("Calculando estatísticas e tendências..."); const { response, data } = await requestJson(`/ai/trends?module=${encodeURIComponent(moduleName)}`, { credentials: "include" }); if (response.ok) { setTrends(data); setStatus("Dashboard automático atualizado com os dados tabulares importados."); } else setStatus(data.error ?? `Erro ${response.status}`); }
  return <div className="h-full overflow-y-auto p-6"><h2 className="text-xl font-semibold text-[var(--foreground)]">Dashboards inteligentes</h2><p className="text-sm text-[var(--muted-foreground)] mt-1">A Sofia identifica campos numéricos, calcula estatísticas e cria gráficos de tendência automaticamente.</p><div className="mt-5 max-w-5xl bg-[var(--card)] border border-[var(--border)] rounded-xl p-5 grid gap-3"><div className="flex flex-col gap-3 sm:flex-row"><input value={name} onChange={e => setName(e.target.value)} placeholder="Nome do dashboard" className="flex-1 bg-[var(--muted)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--foreground)]" /><button onClick={save} disabled={!name.trim()} className="rounded-lg bg-blue-600 text-white py-2 px-3 text-sm disabled:opacity-40">Salvar dashboard</button><button onClick={() => void loadTrends()} className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--foreground)]">Gerar análise automática</button></div>{status && <p className="text-xs text-[var(--muted-foreground)]">{status}</p>}{trends && <><div className="grid gap-3 sm:grid-cols-3"><div className="rounded-lg bg-[var(--muted)] p-3"><p className="text-xs text-[var(--muted-foreground)]">Registros analisados</p><strong className="text-xl text-[var(--foreground)]">{trends.rows ?? 0}</strong></div><div className="rounded-lg bg-[var(--muted)] p-3"><p className="text-xs text-[var(--muted-foreground)]">Indicadores</p><strong className="text-xl text-[var(--foreground)]">{trends.metrics?.length ?? 0}</strong></div><div className="rounded-lg bg-[var(--muted)] p-3"><p className="text-xs text-[var(--muted-foreground)]">Alertas e insights</p><strong className="text-xl text-[var(--foreground)]">{trends.insights?.length ?? 0}</strong></div></div><div className="grid gap-4 md:grid-cols-2">{trends.metrics?.map((metric: any) => <article key={metric.field} className="rounded-xl border border-[var(--border)] p-4"><div className="flex items-center justify-between"><h3 className="font-semibold text-[var(--foreground)]">{metric.field}</h3><span className={`text-xs font-medium ${metric.direction === "alta" ? "text-emerald-600" : metric.direction === "queda" ? "text-rose-600" : "text-[var(--muted-foreground)]"}`}>{metric.direction} · {Number(metric.change_percent).toFixed(1)}%</span></div><TrendChart series={metric.series} positive={metric.direction !== "queda"} /><div className="grid grid-cols-2 gap-2 text-xs text-[var(--muted-foreground)]"><span>Média: <b className="text-[var(--foreground)]">{Number(metric.average).toFixed(2)}</b></span><span>Mediana: <b className="text-[var(--foreground)]">{Number(metric.median).toFixed(2)}</b></span><span>Mínimo: <b className="text-[var(--foreground)]">{Number(metric.min).toFixed(2)}</b></span><span>Máximo: <b className="text-[var(--foreground)]">{Number(metric.max).toFixed(2)}</b></span></div></article>)}</div>{trends.insights?.length > 0 && <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/20 p-4"><h3 className="font-semibold text-amber-900 dark:text-amber-200">Insights automáticos</h3>{trends.insights.map((insight: any, index: number) => <p key={`${insight.field}-${index}`} className="mt-2 text-xs text-amber-800 dark:text-amber-100">{insight.message}</p>)}</div>}<p className="text-xs text-[var(--muted-foreground)]">{trends.note}</p></>}</div></div>;
}

function AutomationsView({ moduleId }: { moduleId: ModuleId }) { const [workflow,setWorkflow]=useState(""); const [status,setStatus]=useState(""); async function run(){const r=await fetch("/automation/n8n/run",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({module:moduleId==="infra"?"infraestrutura":moduleId,workflow,data:{source:"sofia"}})});const d=await r.json();setStatus(r.ok?"Workflow enviado.":d.error??"Falha na automação.");} return <div className="h-full overflow-y-auto p-6"><h2 className="text-xl font-semibold">Automações n8n</h2><p className="text-sm text-[var(--muted-foreground)] mt-1">Workflows são executados somente quando habilitados na configuração do ambiente.</p><div className="mt-5 max-w-xl bg-[var(--card)] border border-[var(--border)] rounded-xl p-5 grid gap-3"><input value={workflow} onChange={e=>setWorkflow(e.target.value)} placeholder="ID do workflow autorizado" className="bg-[var(--muted)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm"/><button onClick={run} disabled={!workflow.trim()} className="rounded-lg bg-amber-600 text-white py-2 text-sm disabled:opacity-40">Executar workflow</button>{status&&<p className="text-xs">{status}</p>}</div></div>; }

// ── Main App ──────────────────────────────────────────────────────────────

export default function App() {
  const [authState, setAuthState] = useState<"loading" | "login" | "setup" | "change-password" | "authenticated">("loading");
  const [userRole, setUserRole] = useState<string>("");
  const [userName, setUserName] = useState("");
  const [allowedModules, setAllowedModules] = useState<ModuleId[]>(["core"]);
  const [theme, setTheme] = useState<Theme>(() => storedTheme());
  const [activeModule, setActiveModule] = useState<ModuleId>("core");
  const [view, setView] = useState<View>("chat");
  const [modules, setModules] = useState<Module[]>(INITIAL_MODULES);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const activeModuleRecord = modules.find((item) => item.category === activeModule);
  const cfg = moduleConfig(activeModule, activeModuleRecord?.name, activeModuleRecord?.accentHex, activeModuleRecord?.icon);
  const accent = cfg.accent;

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    window.localStorage.setItem("sofia-theme", theme);
  }, [theme]);

  useEffect(() => {
    fetch("/auth/status", { credentials: "include" })
      .then((response) => response.json())
      .then((data) => setAuthState(data.configured ? "login" : "setup"))
      .catch(() => setAuthState("login"));
  }, []);

  useEffect(() => {
    if (authState !== "authenticated") return;
    fetch("/auth/me", { credentials: "include" }).then((response) => response.ok ? response.json() : null).then(async (data) => { setUserRole(data?.user?.role ?? ""); setUserName(data?.user?.display_name ?? ""); const names = (data?.modules ?? []).map((item: { module_name: string }) => item.module_name === "infraestrutura" ? "infra" : item.module_name).filter((item: string) => item !== "core") as ModuleId[]; setAllowedModules(["core", ...names]); if (data?.user?.role !== "global" && names[0]) setActiveModule(names[0]); const moduleResponse = await fetch("/modules", { credentials: "include" }); if (moduleResponse.ok) { const moduleData = await moduleResponse.json(); setModules((moduleData.modules ?? []).map((item: any) => ({ id: item.slug === "infraestrutura" ? "infra" : item.slug, name: item.display_name, description: item.description, category: item.slug === "infraestrutura" ? "infra" : item.slug, status: item.is_active ? "active" : "maintenance", accentHex: item.accent_hex, icon: item.icon, createdAt: new Date(item.created_at) }))); } });
  }, [authState]);

  if (authState === "loading") return <div className="min-h-full flex items-center justify-center text-sm text-[var(--muted-foreground)]">Carregando autenticação...</div>;
  if (authState === "change-password") return <ChangePasswordView onComplete={() => setAuthState("authenticated")} />;
  if (authState !== "authenticated") return <AuthView setup={authState === "setup"} theme={theme} onThemeChange={setTheme} onAuthenticated={(mustChange) => setAuthState(mustChange ? "change-password" : "authenticated")} />;

  function handleModuleSelect(id: ModuleId) {
    setActiveModule(id);
    setView("chat");
    setSidebarOpen(false);
  }

  async function handleLogout() {
    await fetch("/auth/logout", { method: "POST", credentials: "include" }).catch(() => undefined);
    setUserName("");
    setUserRole("");
    setAllowedModules(["core"]);
    setAuthState("login");
  }

  async function handleNewModule(data: Omit<Module, "id" | "createdAt">) {
    const response = await fetch("/modules", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: data.name, description: data.description, accent_hex: data.accentHex, icon: data.icon }) });
    if (!response.ok) { const failure = await response.json().catch(() => ({})); window.alert(failure.error ?? "Não foi possível criar o módulo."); return; }
    const created = await response.json();
    const newMod: Module = { ...data, id: created.slug ?? Date.now().toString(), category: created.slug ?? data.category, createdAt: new Date(), accentHex: created.accent_hex ?? data.accentHex, icon: created.icon ?? data.icon };
    setModules((prev) => [...prev, newMod]);
    setAllowedModules((prev) => [...new Set([...prev, newMod.id])]);
    setActiveModule(newMod.id);
    setView("modules");
  }

  const moduleOrder: ModuleId[] = ["core", ...allowedModules.filter((id) => id !== "core")];

  const sidebar = (
    <aside
      className="app-sidebar flex flex-col h-full w-[222px] flex-shrink-0"
      style={{ backgroundColor: "var(--sidebar-bg)" }}
    >
      {/* Logo */}
      <div className="px-5 py-5 border-b sidebar-border">
        <div className="flex items-center gap-3">
          <SofiaMark size="sm" />
          <div>
            <p className="sidebar-logo-name font-bold text-base tracking-wide" style={{ fontFamily: "var(--font-heading)" }}>
              SOFIA
            </p>
            <p className="sidebar-logo-sub text-[10px] uppercase tracking-widest font-mono">
              MCP · AI Platform
            </p>
          </div>
        </div>
      </div>

      {/* Views */}
      <div className="px-3 pt-4 pb-2">
        <p className="sidebar-section-label text-[10px] uppercase tracking-widest font-mono px-3 mb-2">
          Ferramentas
        </p>
        <NavItem active={view === "chat"} onClick={() => { setView("chat"); setSidebarOpen(false); }} accent={accent}>
          <IconChat />
          Chat com IA
        </NavItem>
        <NavItem active={view === "modules"} onClick={() => { setView("modules"); setSidebarOpen(false); }} accent={accent}>
          <IconModules />
          Módulos
        </NavItem>
        <NavItem active={view === "knowledge"} onClick={() => { setView("knowledge"); setSidebarOpen(false); }} accent={accent}>Biblioteca de conhecimento</NavItem>
        <NavItem active={view === "connections"} onClick={() => { setView("connections"); setSidebarOpen(false); }} accent={accent}>Fontes de dados</NavItem>
        <NavItem active={view === "dashboards"} onClick={() => { setView("dashboards"); setSidebarOpen(false); }} accent={accent}>Dashboards</NavItem>
        <NavItem active={view === "automations"} onClick={() => { setView("automations"); setSidebarOpen(false); }} accent={accent}>Fluxos e automações</NavItem>
        {userRole === "global" && <NavItem active={view === "users"} onClick={() => { setView("users"); setSidebarOpen(false); }} accent={accent}>Usuários e aprovações</NavItem>}
      </div>

      {/* Module profiles */}
      <div className="px-3 pt-4 flex-1">
        <p className="sidebar-section-label text-[10px] uppercase tracking-widest font-mono px-3 mb-2">
          Perfis
        </p>
        <div className="profile-picker">
          <span className="profile-picker__icon" style={{ backgroundColor: cfg.accent }}>{cfg.icon}</span>
          <select aria-label="Selecionar perfil do módulo" value={activeModule} onChange={(event) => handleModuleSelect(event.target.value)} className="profile-picker__select">
            {moduleOrder.filter((id) => allowedModules.includes(id)).map((id) => { const item = modules.find((module) => module.category === id); const config = moduleConfig(id, item?.name, item?.accentHex, item?.icon); return <option key={id} value={id}>{config.label}</option>; })}
          </select>
        </div>
        <p className="profile-picker__hint">{userRole === "global" ? "Global · pode alternar entre todos os perfis" : "Perfil autorizado para este usuário"}</p>
      </div>

      {/* Bottom */}
      <div className="px-3 py-3 border-t sidebar-border flex flex-col gap-2">
        <div className="px-3 text-xs text-[var(--sidebar-fg)] truncate" title={userName}>
          <span className="font-semibold">{userName || "Usuário"}</span>
          <span className="block text-[10px] opacity-70">{userRole === "global" ? "Administrador Global" : userRole === "module_user" ? "Administrador do módulo" : "Operador"}</span>
        </div>
        <button onClick={() => void handleLogout()} className="flex items-center gap-2 px-3 py-2 rounded-lg text-[var(--sidebar-fg)] hover:bg-[var(--sidebar-hover)] text-xs font-medium transition-all">
          Sair do sistema
        </button>
        <button
          onClick={() => setTheme(theme === "light" ? "dark" : "light")}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-[var(--sidebar-fg)] hover:bg-[var(--sidebar-hover)] text-xs font-medium transition-all"
        >
          {theme === "light" ? <IconMoon /> : <IconSun />}
          {theme === "light" ? "Modo escuro" : "Modo claro"}
        </button>
      </div>
    </aside>
  );

  return (
    <div className="flex h-full overflow-hidden bg-[var(--background)]">
      {/* Desktop sidebar */}
      <div className="hidden md:flex">
        {sidebar}
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div className="fixed inset-0 bg-black/60" onClick={() => setSidebarOpen(false)} />
          <div className="relative z-50 flex">
            {sidebar}
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="app-main flex-1 flex flex-col min-w-0">
        {/* Mobile topbar */}
        <div className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-[var(--border)] bg-[var(--background)]">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
          >
            {sidebarOpen ? <IconX /> : <IconMenu />}
          </button>
          <span
            className="font-bold text-base text-[var(--foreground)]"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            SOFIA
          </span>
          <div className="ml-auto flex items-center gap-2">
            <span
              className="text-xs font-medium px-2 py-1 rounded-lg text-white"
              style={{ backgroundColor: accent }}
            >
              {cfg.label}
            </span>
          </div>
        </div>

        {/* Active module banner */}
        <div
          className="app-topbar hidden md:flex items-center gap-3 px-6 py-2.5 text-xs font-medium text-white"
          style={{ backgroundColor: accent }}
        >
          <span className="font-mono opacity-75">perfil ativo:</span>
          <span className="font-semibold">{cfg.label}</span>
          <span className="ml-auto opacity-60">
            {modules.filter((m) => m.category === activeModule).length} módulo(s) neste perfil
          </span>
        </div>

        {/* View content */}
        <div className="app-content flex-1 overflow-hidden">
          {view === "chat" && <ChatView activeModule={activeModule} onManageSources={() => setView("modules")} key={activeModule} />}
          {view === "modules" && (
            <ModulesView
              modules={modules}
              activeModule={activeModule}
              onNew={() => setView("new-module")}
            />
          )}
          {view === "new-module" && (
            <NewModuleView
              activeModule={activeModule}
              onSave={handleNewModule}
              onCancel={() => setView("modules")}
            />
          )}
          {view === "users" && <UsersView />}
          {view === "knowledge" && <KnowledgeView moduleId={activeModule} />}
          {view === "connections" && <DataSourcesView moduleId={activeModule} />}
          {view === "dashboards" && <DashboardsView moduleId={activeModule} />}
          {view === "automations" && <AutomationsView moduleId={activeModule} />}
        </div>
      </div>
    </div>
  );
}
