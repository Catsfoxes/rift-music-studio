/* Rift Music Studio → AI bridge client prototype.
   Local references stay local unless the user explicitly publishes one to the AI library.
*/
const RIFT_BRIDGE_URL_KEY = 'rift-ai-bridge-url-v1';
const RIFT_BRIDGE_TOKEN_KEY = 'rift-ai-bridge-token-v1';

function bridgeConfig() {
  return {
    url: (localStorage.getItem(RIFT_BRIDGE_URL_KEY) || '').replace(/\/$/, ''),
    token: localStorage.getItem(RIFT_BRIDGE_TOKEN_KEY) || ''
  };
}

function bridgeHeaders() {
  const { token } = bridgeConfig();
  return { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) };
}

async function publishActiveReference() {
  const active = window.RiftReferenceLibrary?.getActive?.();
  const { url } = bridgeConfig();
  if (!active) throw new Error('Recall a local reference first.');
  if (!url) throw new Error('Set the AI bridge URL first.');
  const data = await active.blob.arrayBuffer();
  let binary = '';
  const bytes = new Uint8Array(data);
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  const response = await fetch(`${url}/references`, {
    method: 'POST', headers: bridgeHeaders(),
    body: JSON.stringify({ name: active.name, notes: active.notes || '', mimeType: active.type || active.blob.type, data: btoa(binary) })
  });
  if (!response.ok) throw new Error(`Bridge returned ${response.status}`);
  return response.json();
}

async function listRemoteReferences(query = '') {
  const { url } = bridgeConfig();
  if (!url) throw new Error('Set the AI bridge URL first.');
  const response = await fetch(`${url}/references${query ? `?q=${encodeURIComponent(query)}` : ''}`, { headers: bridgeHeaders() });
  if (!response.ok) throw new Error(`Bridge returned ${response.status}`);
  return response.json();
}

window.RiftAIBridge = { bridgeConfig, publishActiveReference, listRemoteReferences };
