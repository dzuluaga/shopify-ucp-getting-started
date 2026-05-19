import { prompt } from './utils.js';
import { CATALOG_URL } from './search.js';

async function getProductDetails(token, productId, selected = []) {
  const res = await fetch(CATALOG_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'tools/call',
      id: 2,
      params: {
        name: 'get_product',
        arguments: {
          meta: {
            'ucp-agent': {
              profile: 'https://shopify.dev/ucp/agent-profiles/2026-04-08/valid-with-capabilities.json'
            }
          },
          catalog: {
            id: productId,
            ...(selected.length ? { selected } : {})
          }
        }
      }
    })
  });
  const data = await res.json();
  return data.result?.structuredContent ?? null;
}

function displayProduct(product) {
  const featuredVariant = product.variants?.[0];
  const price = featuredVariant ? `$${(featuredVariant.price.amount / 100).toFixed(2)}` : '';
  const sellerName = featuredVariant?.seller?.name ?? '';
  const variantTitle = featuredVariant?.title ?? '';
  console.log('\n── 3. Product Details ─────────────────────────────\n');
  console.log(`  ${product.title}${variantTitle ? ` - ${variantTitle}` : ''}`);
  console.log(`  ${[price, sellerName].filter(Boolean).join('  ·  ')}\n`);
  if (product.description?.html) console.log(`  ${product.description.html}\n`);
}

async function pickVariant(token, productId, product) {
  const selected = Object.fromEntries(
    (product.selected ?? []).map(s => [s.name, s.label])
  );

  if (product.options?.length) while (true) {
    const optionMap = [];
    console.log('\n  Options:');
    product.options.forEach(opt => {
      const lines = opt.values.map(v => {
        const n = optionMap.length + 1;
        const marker = selected[opt.name] === v.label ? '●' : '○';
        optionMap.push({ optName: opt.name, label: v.label });
        return `    [${n}] ${marker} ${v.label}${v.available === false ? ' (unavailable)' : ''}`;
      });
      console.log(`\n  ${opt.name}:`);
      lines.forEach(l => console.log(l));
    });

    const selectedDesc = product.options.map(o => selected[o.name]).join(' / ');
    console.log(`\n  \x1b[1mSelected: ${selectedDesc}\x1b[0m`);
    console.log('\n  [s] Select this variant  [number] Pick an option  [b] Back to results');
    const action = await prompt('\n  > ');
    const trimmed = action.trim();

    if (trimmed === 'b') return null;
    if (trimmed === 's') {
      const selectedArr = Object.entries(selected).map(([name, label]) => ({ name, label }));
      const details = await getProductDetails(token, productId, selectedArr);
      const variant = details?.product?.variants?.[0];
      return variant ? { variantId: variant.id, checkout_url: variant.checkout_url } : null;
    }

    const chosen = optionMap[parseInt(trimmed) - 1];
    if (chosen) selected[chosen.optName] = chosen.label;
  }

  const variant = product.variants?.[0];
  return variant ? { variantId: variant.id, checkout_url: variant.checkout_url } : null;
}

export async function selectProduct(token, products) {
  const pick = await prompt(`\x1b[1m  Lookup details on a result [1-${products.length}]:\x1b[0m  `);
  const index = parseInt(pick) - 1;
  const selectedProduct = products[index];
  const details = await getProductDetails(token, selectedProduct.id);
  const product = details?.product;
  if (!product) return null;
  displayProduct(product);
  const variant = await pickVariant(token, selectedProduct.id, product);
  return variant;
}