import { getMcpEndpoint } from './mcp.js';
import { randomUUID } from 'node:crypto';


const AGENT_PROFILE = 'https://ucp-profiles.vercel.app/profiles/ucp-demo-agent.json';

function unwrapCart(data) {
  if (data?.result?.structuredContent?.cart) return data.result.structuredContent.cart;
  const text = data?.result?.content?.[0]?.text;
  if (typeof text === 'string') return JSON.parse(text);
  if (typeof text === 'object' && text !== null) return text;
  return null;
}

export async function createCart(token, variantId, checkoutUrl) {
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
        name: 'create_cart',
        arguments: {
          cart: {
            line_items: [{ quantity: 1, item: { id: variantId } }]
          },
          meta: { 'ucp-agent': { profile: AGENT_PROFILE } }
        }
      }
    })
  });
  const data = await res.json();
  if (!data.result) throw new Error(`create_cart failed: ${JSON.stringify(data)}`);
  const cart = unwrapCart(data);
  if (!cart) throw new Error(`create_cart returned no cart: ${JSON.stringify(data)}`);
  const total = cart.totals?.find(t => t.type === 'total')?.amount ?? 0;
  console.log('\n── Create Cart ────────────────────────────────────\n');
  console.log(`  Cart ID:  ${cart.id}`);
  console.log(`  Total:    $${(total / 100).toFixed(2)}`);
  return cart.id;
}

export async function getCart(token, cartId, checkoutUrl) {
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
        name: 'get_cart',
        arguments: {
          id: cartId,
          meta: { 'ucp-agent': { profile: AGENT_PROFILE } }
        }
      }
    })
  });
  const data = await res.json();
  if (!data.result) throw new Error(`get_cart failed: ${JSON.stringify(data)}`);
  const cart = unwrapCart(data);
  if (!cart) throw new Error(`get_cart returned no cart: ${JSON.stringify(data)}`);
  const notFound = cart.messages?.find(m => m.code === 'not_found');
  if (notFound) throw new Error('Cart not found or expired');
  const total = cart.totals?.find(t => t.type === 'total')?.amount ?? 0;
  console.log('\n── Get Cart ───────────────────────────────────────\n');
  console.log(`  Cart ID:  ${cart.id}`);
  console.log(`  Items:    ${cart.line_items.length}`);
  console.log(`  Total:    $${(total / 100).toFixed(2)}`);
  return cart;
}

export async function updateCart(token, cartId, cart, checkoutUrl) {
  const origin = new URL(checkoutUrl).origin;
  const mcpEndpoint = await getMcpEndpoint(origin);
  const res = await fetch(mcpEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'Shopify-Buyer-IP': '8.8.8.8' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'tools/call',
      id: 5,
      params: {
        name: 'update_cart',
        arguments: {
          id: cartId,
          cart,
          meta: { 'ucp-agent': { profile: AGENT_PROFILE } }
        }
      }
    })
  });
  const data = await res.json();
  if (!data.result) throw new Error(`update_cart failed: ${JSON.stringify(data)}`);
  const updated = unwrapCart(data);
  if (!updated) throw new Error(`update_cart returned no cart: ${JSON.stringify(data)}`);
  const total = updated.totals?.find(t => t.type === 'total')?.amount ?? 0;
  console.log('\n── Update Cart ────────────────────────────────────\n');
  console.log(`  Items:  ${updated.line_items.length}`);
  console.log(`  Total:  $${(total / 100).toFixed(2)}`);
  return updated;
}

export async function cancelCart(token, cartId, checkoutUrl) {
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
        name: 'cancel_cart',
        arguments: {
          id: cartId,
          meta: {
            'ucp-agent': { profile: AGENT_PROFILE },
            'idempotency-key': randomUUID()
          }
        }
      }
    })
  });
  const data = await res.json();
  if (!data.result) throw new Error(`cancel_cart failed: ${JSON.stringify(data)}`);
  console.log('\n── Cancel Cart ────────────────────────────────────\n');
  console.log(`  Cart ${cartId} canceled.`);
}
