from __future__ import annotations

import asyncio
import sys

from mcp import ClientSession
from mcp.client.streamable_http import streamable_http_client


if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")


async def main() -> None:
    url = "http://127.0.0.1:8000/mcp"
    async with streamable_http_client(url) as (read_stream, write_stream):
        async with ClientSession(read_stream, write_stream) as session:
            await session.initialize()
            tools = await session.list_tools()
            print("TOOLS:", [tool.name for tool in tools.tools])

            modules = await session.call_tool("listar_modulos_ativos", {})
            print("MODULES:", modules.content)

            blocked = await session.call_tool(
                "perguntar_sofia", {"pergunta": "Como controlo o estoque?"}
            )
            print("ALMOXARIFADO_BLOCK:", blocked.content)

            routed = await session.call_tool(
                "perguntar_sofia", {"pergunta": "Como diagnosticar uma falha de rede?"}
            )
            print("CLAUDE_ROUTED:", routed.content)


if __name__ == "__main__":
    asyncio.run(main())
