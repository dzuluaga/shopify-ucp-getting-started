import { getMcpEndpoint } from './mcp.js';
import { randomUUID } from 'node:crypto';

const AGENT_PROFILE = 'https://ucp-profiles.vercel.app/profiles/ucp-demo-agent.json';

function unwrapCheckout(data) {
  if (data?.result?.structuredContent) return data.result.structuredContent;
  const text = data?.result?.content?.[0]?.text;
  if (typeof text === 'string') return JSON.parse(text);
  if (typeof text === 'object' && text !== null) return text;
  return null;
}

export async function createCheckout(token, cartId, checkoutUrl, variantId) {
  const origin = new URL(checkoutUrl).origin;
  const mcpEndpoint = await getMcpEndpoint(origin);
  const res = await fetch(mcpEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'Shopify-Buyer-IP': '8.8.8.8' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'tools/call',
      id: 3,
      params: {
        name: 'create_checkout',
        arguments: {
          cart_id: cartId,
          checkout: {
            line_items: [{ quantity: 1, item: { id: variantId } }]
          },
          meta: { 'ucp-agent': { profile: AGENT_PROFILE } }
        }
      }
    })
  });
  const data = await res.json();
  if (!data.result) throw new Error(`create_checkout failed: ${JSON.stringify(data)}`);
  const checkout = unwrapCheckout(data);
  if (!checkout) throw new Error(`create_checkout returned no checkout: ${JSON.stringify(data)}`);
  const total = checkout.totals?.find(t => t.type === 'total')?.amount ?? 0;
  console.log('\n── Create Checkout ────────────────────────────────\n');
  console.log(`  ID:     ${checkout.id}`);
  console.log(`  Total:  $${(total / 100).toFixed(2)}`);
  return checkout.id;
}

export async function getCheckout(token, checkoutId, checkoutUrl) {
  const origin = new URL(checkoutUrl).origin;
  const mcpEndpoint = await getMcpEndpoint(origin);
  const res = await fetch(mcpEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'Shopify-Buyer-IP': '8.8.8.8' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'tools/call',
      id: 4,
      params: {
        name: 'get_checkout',
        arguments: {
          id: checkoutId,
          meta: { 'ucp-agent': { profile: AGENT_PROFILE } }
        }
      }
    })
  });
  const data = await res.json();
  if (!data.result) throw new Error(`get_checkout failed: ${JSON.stringify(data)}`);
  const checkout = unwrapCheckout(data);
  if (!checkout) throw new Error(`get_checkout returned no checkout: ${JSON.stringify(data)}`);
  return checkout;
}

export async function updateCheckout(token, checkoutId, email, checkoutUrl) {
  const origin = new URL(checkoutUrl).origin;
  const mcpEndpoint = await getMcpEndpoint(origin);
  const current = await getCheckout(token, checkoutId, checkoutUrl);
  const res = await fetch(mcpEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'Shopify-Buyer-IP': '8.8.8.8' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'tools/call',
      id: 5,
      params: {
        name: 'update_checkout',
        arguments: {
          id: checkoutId,
          checkout: {
            currency: current.currency,
            context: current.context,
            line_items: current.line_items.map(li => ({
              quantity: li.quantity,
              item: { id: li.item.id }
            })),
            buyer: { ...(current.buyer ?? {}), email }
          },
          meta: { 'ucp-agent': { profile: AGENT_PROFILE } }
        }
      }
    })
  });
  const data = await res.json();
  if (!data.result) throw new Error(`update_checkout failed: ${JSON.stringify(data)}`);
  const checkout = unwrapCheckout(data);
  if (!checkout) throw new Error(`update_checkout returned no checkout: ${JSON.stringify(data)}`);
  console.log('\n── Update Checkout ────────────────────────────────\n');
  return checkout.continue_url;
}

export async function cancelCheckout(token, checkoutId, checkoutUrl) {
  const origin = new URL(checkoutUrl).origin;
  const mcpEndpoint = await getMcpEndpoint(origin);
  const res = await fetch(mcpEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'Shopify-Buyer-IP': '8.8.8.8' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'tools/call',
      id: 6,
      params: {
        name: 'cancel_checkout',
        arguments: {
          id: checkoutId,
          meta: {
            'ucp-agent': { profile: AGENT_PROFILE },
            'idempotency-key': randomUUID()
          }
        }
      }
    })
  });
  const data = await res.json();
  if (!data.result) throw new Error(`cancel_checkout failed: ${JSON.stringify(data)}`);
  console.log('\n── Cancel Checkout ────────────────────────────────\n');
  console.log(`  Checkout ${checkoutId} canceled.`);
}
