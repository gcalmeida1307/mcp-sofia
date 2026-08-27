export type StreamEvent = { token?: string; done?: boolean; source_mode?: string; error?: string };

export async function* streamChat(module: string, question: string, context: string): AsyncGenerator<StreamEvent> {
  const response = await fetch("/api/chat/stream", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify({ module: module === "infra" ? "infraestrutura" : module, question, context }),
  });
  if (!response.ok) throw new Error((await response.text()) || `API HTTP ${response.status}`);
  if (!response.body) throw new Error("O servidor não iniciou o streaming.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";
    for (const frame of frames) {
      const line = frame.split("\n").find((item) => item.startsWith("data:"));
      if (!line) continue;
      yield JSON.parse(line.slice(5).trim()) as StreamEvent;
    }
    if (done) break;
  }
}

export async function uploadChatAttachment(module: string, file: File): Promise<Record<string, any>> {
  const form = new FormData();
  form.append("module", module === "infra" ? "infraestrutura" : module);
  form.append("file", file);
  const response = await fetch("/knowledge/upload", { method: "POST", credentials: "include", body: form });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "Não foi possível indexar o anexo.");
  return data;
}
