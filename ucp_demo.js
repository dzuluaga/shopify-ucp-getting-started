import { getAccessToken } from './auth.js';
import { searchProducts, displayProducts, showCatalog } from './search.js';
import { selectProduct } from './product.js';
import { createCart, getCart, updateCart } from './cart.js';
import { createCheckout, updateCheckout, cancelCheckout } from './checkout.js';
import { prompt } from './utils.js';

async function main() {
  // 1. Authentication
  const token = await getAccessToken();

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

  const { variantId, checkoutUrl } = variant;

  // 4. Build a cart
  const cartId = await createCart(token, variantId, checkoutUrl);

  // 5. Create checkout from the cart
  const checkoutId = await createCheckout(token, cartId, checkoutUrl, variantId);

  // 6. Update checkout: add buyer email
  const email = await prompt('\n\x1b[1m  Enter your email address:\x1b[0m  ');
  const continueUrl = await updateCheckout(token, checkoutId, email, checkoutUrl);
  const attributedUrl = new URL(continueUrl);
  attributedUrl.searchParams.set('utm_source', 'ucp_demo_app');
  console.log(`  Refer your buyer to finish checkout at:\n\n  ${attributedUrl}\n`);

  // 7. Cancel checkout
  await prompt('\x1b[1m  Are you finished with the demo? Press Enter to cancel the checkout and exit.\x1b[0m  ');
  await cancelCheckout(token, checkoutId, checkoutUrl);
}

main().catch(err => console.error('Request failed:', err));