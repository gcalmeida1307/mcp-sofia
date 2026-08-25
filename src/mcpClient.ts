type RpcResponse = {
  result?: {
    content?: Array<{ type: string; text?: string }>;
  };
  error?: { message?: string };
};

function parseRpcResponse(response: Response, body: string): RpcResponse {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("text/event-stream")) {
    const data = body
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim())
      .filter(Boolean)
      .at(-1);
    if (!data) throw new Error("O MCP não retornou uma mensagem válida.");
    return JSON.parse(data) as RpcResponse;
  }
  return JSON.parse(body) as RpcResponse;
}

class SofiaMcpClient {
  private sessionId: string | null = null;
  private requestId = 0;
  private initialized = false;

  private async request(method: string, params: Record<string, unknown> = {}) {
    const headers: Record<string, string> = {
      Accept: "application/json, text/event-stream",
      "Content-Type": "application/json",
    };
    if (this.sessionId) {
      headers["Mcp-Session-Id"] = this.sessionId;
      headers["Mcp-Protocol-Version"] = "2025-11-25";
    }

    const response = await fetch("/mcp", {
      method: "POST",
      headers,
      body: JSON.stringify({ jsonrpc: "2.0", id: ++this.requestId, method, params }),
    });
    const returnedSession = response.headers.get("Mcp-Session-Id");
    if (returnedSession) this.sessionId = returnedSession;
    const body = await response.text();
    if (!response.ok) throw new Error(`MCP HTTP ${response.status}: ${body}`);
    const rpc = parseRpcResponse(response, body);
    if (rpc.error) throw new Error(rpc.error.message ?? "Erro desconhecido do MCP.");
    return rpc.result;
  }

  private async ensureInitialized() {
    if (this.initialized) return;
    await this.request("initialize", {
      protocolVersion: "2025-11-25",
      capabilities: {},
      clientInfo: { name: "sofia-web", version: "0.1.0" },
    });
    await fetch("/mcp", {
      method: "POST",
      headers: {
        Accept: "application/json, text/event-stream",
        "Content-Type": "application/json",
        ...(this.sessionId
          ? { "Mcp-Session-Id": this.sessionId, "Mcp-Protocol-Version": "2025-11-25" }
          : {}),
      },
      body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized", params: {} }),
    });
    this.initialized = true;
  }

  async callTool(name: string, arguments_: Record<string, unknown>) {
    await this.ensureInitialized();
    const result = await this.request("tools/call", { name, arguments: arguments_ });
    const text = result?.content?.find((item) => item.type === "text")?.text;
    if (!text) throw new Error("O módulo não retornou texto.");
    return text;
  }
}

export const sofiaMcp = new SofiaMcpClient();

