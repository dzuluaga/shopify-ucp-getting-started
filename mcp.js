export async function getMcpEndpoint(merchantOrigin) {
  try {
    const res = await fetch(`${merchantOrigin}/.well-known/ucp`);
    if (!res.ok) throw new Error(res.status);
    const ucp = await res.json();
    const shopping = ucp?.ucp?.services?.['dev.ucp.shopping'];
    const mcp = Array.isArray(shopping) && shopping.find(s => s.transport === 'mcp');
    if (mcp?.endpoint) return mcp.endpoint;
  } catch (_) {}
  return `${merchantOrigin}/api/ucp/mcp`;
}