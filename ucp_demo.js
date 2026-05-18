import { getAccessToken } from './auth.js';
import { searchProducts, displayProducts, showCatalog } from './search.js';

async function main() {
  // 1. Authentication
  const token = await getAccessToken();
  console.log(`  Token:   ${token}`);
  // 2. Search the Catalog
  showCatalog();
  const result = await searchProducts(token);
  if (!result?.products?.length) return;
  displayProducts(result.products);
}

main().catch(err => console.error('Request failed:', err));