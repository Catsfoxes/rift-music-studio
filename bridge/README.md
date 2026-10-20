# Rift Music Studio → AI bridge prototype

This folder contains the first prototype of the **B architecture**: a remote MCP bridge that exposes Rift's saved creative references as read-only tools for ChatGPT-compatible MCP clients.

## Tools

- `list_rift_references` — search saved references by name/notes.
- `get_rift_reference` — return the selected image so the model can inspect it.

## Important architecture note

The browser's IndexedDB is local to the iPad and cannot be read directly by a remote MCP server. Therefore, the Rift web app needs an explicit **Publish to AI Library** action for references that should be available to ChatGPT. That action uploads a selected image to this bridge's protected storage. Ordinary local references remain device-only.

This keeps the privacy boundary clear:

**Device-only:** iPad Photos → Rift local library → stays local.

**AI-accessible:** Rift local library → explicit Publish to AI Library → protected bridge storage → MCP → ChatGPT.

## Deployment

The server expects a public HTTPS deployment with `/mcp` for ChatGPT. Set `RIFT_BRIDGE_TOKEN` in the host's secret environment and configure the Rift app with the same token. Do not commit the token to GitHub.

OpenAI's current ChatGPT custom MCP flow requires a public HTTPS MCP endpoint (or a supported Secure MCP Tunnel), and custom MCP connections are configured from ChatGPT on the web. Mobile ChatGPT cannot currently add custom MCP servers.
