import { getAccessToken } from './auth.js';
import { searchProducts, displayProducts, showCatalog } from './search.js';
import { selectProduct } from './product.js';

async function main() {
  // 1. Authentication
  const token = await getAccessToken();
  console.log(`  Token:   ${token}`);

  // 2 & 3. Search and select a variant
  let variant = null;
  while (!variant) {
    // 2. Search the Catalog
    showCatalog();
    // const result = await searchProducts(token);


    const result = await searchProducts(token, {
      include_secondhand: true,
      min_price: 0,
      max_price: 500,
      ships_to: 'US',
    });

    if (!result?.products?.length) return;
    displayProducts(result.products);
    variant = await selectProduct(token, result.products);
  }
}

main().catch(err => console.error('Request failed:', err));