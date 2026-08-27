import { useCallback, useState } from "react";
import { streamChat } from "./chatService";

export type ChatMessage = { id: string; role: "user" | "sofia"; content: string; ts: Date };

export function useChatEngine(module: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const send = useCallback(async (question: string) => {
    const user: ChatMessage = { id: crypto.randomUUID(), role: "user", content: question, ts: new Date() };
    const assistant: ChatMessage = { id: crypto.randomUUID(), role: "sofia", content: "", ts: new Date() };
    const context = [...messages, user].slice(-8).map((item) => `${item.role === "user" ? "Usuário" : "Sofia"}: ${item.content}`).join("\n\n");
    setMessages((current) => [...current, user, assistant]);
    setStreaming(true);
    try {
      for await (const event of streamChat(module, question, context)) {
        if (event.token) setMessages((current) => current.map((item) => item.id === assistant.id ? { ...item, content: item.content + event.token } : item));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha no streaming.";
      setMessages((current) => current.map((item) => item.id === assistant.id ? { ...item, content: `Não consegui acessar a Sofia.\n\n${message}` } : item));
    } finally { setStreaming(false); }
  }, [messages, module]);
  return { messages, setMessages, streaming, send };
}
