import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

const PORT = Number(process.env.PORT ?? 8787);
const TOKEN = process.env.RIFT_BRIDGE_TOKEN ?? "";
const DATA_DIR = path.resolve(process.env.RIFT_DATA_DIR ?? "./data");
const META_FILE = path.join(DATA_DIR, "references.json");
const IMAGE_DIR = path.join(DATA_DIR, "images");

await mkdir(IMAGE_DIR, { recursive: true });
if (!existsSync(META_FILE)) await writeFile(META_FILE, "[]", "utf8");

async function loadMeta() {
  try { return JSON.parse(await readFile(META_FILE, "utf8")); } catch { return []; }
}
async function saveMeta(items) { await writeFile(META_FILE, JSON.stringify(items, null, 2), "utf8"); }
function authorized(req) {
  if (!TOKEN) return true;
  return req.headers.authorization === `Bearer ${TOKEN}`;
}
function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "content-type, authorization, mcp-session-id");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");
}
async function body(req) {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  return raw ? JSON.parse(raw) : {};
}
function safeName(name) { return String(name).replace(/[^a-zA-Z0-9._-]/g, "_"); }

function createRiftServer() {
  const server = new McpServer({
    name: "rift-music-studio",
    version: "0.1.0",
    instructions: "Rift Music Studio is the user's creative reference library. Use list_rift_references to find saved references, then get_rift_reference when the user asks to view or analyze one. Do not modify or delete references through MCP in this read-only prototype."
  });

  server.registerTool("list_rift_references", {
    title: "List Rift references",
    description: "Find pictures saved in the user's Rift Music Studio AI library. Use this before getting a specific reference when the name is uncertain.",
    inputSchema: { query: z.string().optional() },
    outputSchema: { references: z.array(z.object({ id: z.string(), name: z.string(), notes: z.string(), mimeType: z.string() })) },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false }
  }, async ({ query }) => {
    const items = await loadMeta();
    const q = (query ?? "").trim().toLowerCase();
    const references = items.filter(x => !q || `${x.name} ${x.notes}`.toLowerCase().includes(q))
      .map(({ id, name, notes, mimeType }) => ({ id, name, notes, mimeType }));
    return { structuredContent: { references }, content: [{ type: "text", text: `Found ${references.length} Rift reference${references.length === 1 ? "" : "s"}.` }] };
  });

  server.registerTool("get_rift_reference", {
    title: "Get a Rift reference",
    description: "Retrieve one saved Rift Music Studio picture so it can be viewed or visually analyzed. Accepts a reference id or exact name.",
    inputSchema: { id: z.string().optional(), name: z.string().optional() },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false }
  }, async ({ id, name }) => {
    const items = await loadMeta();
    const item = id ? items.find(x => x.id === id) : items.find(x => x.name.toLowerCase() === String(name ?? "").toLowerCase());
    if (!item) return { content: [{ type: "text", text: "Rift reference not found." }] };
    const file = await readFile(path.join(IMAGE_DIR, safeName(item.fileName)));
    return {
      content: [
        { type: "text", text: `Rift reference: ${item.name}${item.notes ? ` — ${item.notes}` : ""}` },
        { type: "image", data: file.toString("base64"), mimeType: item.mimeType }
      ]
    };
  });
  return server;
}

const httpServer = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  cors(res);
  if (req.method === "OPTIONS") return res.writeHead(204).end();
  if (!authorized(req)) return res.writeHead(401, { "content-type": "application/json" }).end(JSON.stringify({ error: "Unauthorized" }));

  if (req.method === "GET" && url.pathname === "/") {
    return res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ name: "Rift Music Studio Bridge", mcp: "/mcp", status: "ok" }));
  }

  if (req.method === "GET" && url.pathname === "/references") {
    const items = await loadMeta();
    return res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(items.map(({ id, name, notes, mimeType }) => ({ id, name, notes, mimeType }))));
  }

  if (req.method === "POST" && url.pathname === "/references") {
    const input = await body(req);
    if (!input.name || !input.data || !input.mimeType?.startsWith("image/")) return res.writeHead(400, { "content-type": "application/json" }).end(JSON.stringify({ error: "name, image data, and image mimeType are required" }));
    const id = randomUUID();
    const fileName = `${id}.${safeName(input.mimeType.split("/")[1] ?? "bin")}`;
    await writeFile(path.join(IMAGE_DIR, fileName), Buffer.from(input.data, "base64"));
    const items = await loadMeta();
    const item = { id, name: String(input.name), notes: String(input.notes ?? ""), mimeType: input.mimeType, fileName, createdAt: Date.now() };
    items.unshift(item);
    await saveMeta(items);
    return res.writeHead(201, { "content-type": "application/json" }).end(JSON.stringify({ id, name: item.name }));
  }

  if (url.pathname === "/mcp" && ["POST", "GET"].includes(req.method ?? "")) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    const server = createRiftServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on("close", () => { transport.close(); server.close(); });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res);
    } catch (error) {
      console.error("MCP error", error);
      if (!res.headersSent) res.writeHead(500).end("Internal server error");
    }
    return;
  }

  res.writeHead(404).end("Not Found");
});

httpServer.listen(PORT, () => console.log(`Rift Music Studio Bridge listening on port ${PORT}`));
