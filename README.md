# ucp-cli — Minimal UCP Agent Profile on Vercel

A small reference repo that walks through hosting an agent profile for Shopify's
Universal Commerce Protocol (UCP), following the
[Shopify Agents getting-started docs](https://shopify.dev/docs/agents).

**Live profile:** https://ucp-profiles.vercel.app/profiles/ucp-demo-agent.json

## What this is (and isn't)

UCP requires an agent to publish a JSON **profile** declaring which capabilities
it speaks (cart, checkout, etc.). The profile URL is passed on every request
via `meta.ucp-agent.profile`, and Shopify uses it for capability negotiation,
rate-limit tiering, and signed-request verification.

This repo:

- Hosts the smallest valid profile (cart + checkout capabilities) as a static
  JSON file on Vercel.
- Includes `ucp_demo.js`, which authenticates against Shopify's token endpoint
  and then calls the `search_global_products` MCP tool against a saved catalog
  to render product results.
- Does **not** implement cart or checkout tool calls yet — that's the next step
  beyond search.

## Repo layout

```
.
├── profiles/
│   └── ucp-demo-agent.json   # source of truth — the published profile
├── .deploy/                  # isolated staging dir (what actually ships to Vercel)
│   ├── profiles/ucp-demo-agent.json   # copy of the source
│   ├── vercel.json           # content-type + CORS headers
│   └── .vercel/              # gitignored — contains project/org link
├── auth.js                   # OAuth client-credentials helper
├── search.js                 # MCP catalog search (search_global_products)
├── utils.js                  # tiny stdin prompt helper
├── ucp_demo.js               # entrypoint: auth → search → render
├── package.json              # ESM, no deps
├── .env.example              # required env vars
└── .gitignore
```

The `.deploy/` directory is a deliberate sandbox: it contains **only** the
files we want to publish. `auth.js`, `package.json`, etc. never leave the
repo, so there's no risk of leaking the auth code or env-var assumptions
via the Vercel deployment.

## Prerequisites

- Node.js 22+ (anything with native `fetch` works).
- A Vercel account and `npm i -g vercel` (this repo used CLI 50.44.0+).
- Shopify OAuth client credentials if you want to run `ucp_demo.js`.

## Reproduce from scratch

### 1. Author the profile

**What:** declare which UCP capabilities your agent speaks.
**Why:** Shopify reads this on every request to decide what tools to expose.

`profiles/ucp-demo-agent.json`:

```json
{
  "ucp": {
    "version": "2026-04-08",
    "capabilities": {
      "dev.ucp.shopping.cart":     [{ "version": "2026-04-08" }],
      "dev.ucp.shopping.checkout": [{ "version": "2026-04-08" }]
    }
  }
}
```

Optional fields per the spec: `services`, `payment_handlers`, and per-capability
`extends` / `spec` / `schema`. Omit them until you actually need them.

### 2. Stage an isolated deploy directory

**What:** copy only the JSON into `.deploy/profiles/`.
**Why:** keeps `auth.js` and anything secret-adjacent out of the static deploy.

```bash
mkdir -p .deploy/profiles
cp profiles/ucp-demo-agent.json .deploy/profiles/
```

### 3. Add `vercel.json` for headers

**What:** set `Content-Type: application/json` and open CORS.
**Why:** agent clients fetching cross-origin need `Access-Control-Allow-Origin: *`,
and serving the file with the right content-type avoids client-side guessing.

`.deploy/vercel.json`:

```json
{
  "headers": [
    {
      "source": "/profiles/(.*).json",
      "headers": [
        { "key": "Content-Type",                 "value": "application/json; charset=utf-8" },
        { "key": "Access-Control-Allow-Origin",  "value": "*" },
        { "key": "Cache-Control",                "value": "public, max-age=300, must-revalidate" }
      ]
    }
  ]
}
```

### 4. Link to a Vercel project

**What:** create / connect the project under your Vercel scope.
**Why:** `vercel deploy` needs to know which project + team to push to. The
`.vercel/` directory it writes is account-scoped — keep it gitignored.

```bash
cd .deploy
vercel link --yes --project ucp-profiles --scope <your-team-slug>
```

If you don't know your scope: `vercel teams ls`.

### 5. Deploy

**What:** push the staged files to production.
**Why:** preview deploys also work (drop `--prod`); use prod once you've
verified the JSON is correct.

```bash
vercel deploy --prod --yes --scope <your-team-slug>
```

You'll get a URL like `https://ucp-profiles-<hash>-<team>.vercel.app`, which
Vercel aliases to `https://ucp-profiles.vercel.app` on prod deploys.

### 6. Verify

**What:** confirm the file is reachable with the right headers.
**Why:** an unreachable or mis-typed profile silently breaks every UCP call.

```bash
curl -sS -D - https://ucp-profiles.vercel.app/profiles/ucp-demo-agent.json
```

Expect `HTTP/2 200`, `content-type: application/json; charset=utf-8`,
`access-control-allow-origin: *`, and the JSON body verbatim.

### 7. Reference the profile in agent calls

When your agent makes an MCP tool call, include:

```json
"meta": {
  "ucp-agent.profile": "https://ucp-profiles.vercel.app/profiles/ucp-demo-agent.json"
}
```

That's the contract: Shopify fetches, caches, and uses it for the session.

## Auth helper

`auth.js` exchanges `CLIENT_ID` / `CLIENT_SECRET` for an access token and
prints the granted scopes + expiry. Set the env vars (see `.env.example`)
before running `node ucp_demo.js`.

After authentication the demo POSTs a JSON-RPC `tools/call` for
`search_global_products` against the saved catalog and prints the offers it
gets back. Wiring cart/checkout calls is the natural next step.

Run it:

```bash
export CLIENT_ID=...
export CLIENT_SECRET=...
node ucp_demo.js jackets        # CLI arg becomes the search query
node ucp_demo.js                # prompts you interactively
```

## Updating the published profile

Edit `profiles/ucp-demo-agent.json`, then:

```bash
cp profiles/ucp-demo-agent.json .deploy/profiles/
cd .deploy && vercel deploy --prod --yes --scope <your-team-slug>
```

Re-run the `curl` from step 6 to confirm the new bytes are live (note: the
header sets a 5-minute cache, so allow a moment or hard-refresh).

## Divergences from the official tutorial

The Shopify Agents [Search the catalog](https://shopify.dev/docs/agents) page
shows code that didn't run against a live saved-catalog endpoint in our test.
Every divergence below was verified against the Dev Dashboard's "MCP" Request
panel for our own catalog (the dashboard exposes a `REST / MCP` toggle in the
top-right of the Request box — toggle it to MCP to see the canonical sample).

| Concern | Tutorial code | Live MCP endpoint |
|---|---|---|
| **URL** | `https://discover.shopifyapps.com/global/v2/search/<catalog_id>` (per-catalog path) | `https://discover.shopifyapps.com/global/mcp` (single global endpoint) |
| **Catalog ID location** | embedded in the URL path | passed in the body as `arguments.saved_catalog` |
| **Tool name** | `search_catalog` | `search_global_products` |
| **Arguments shape** | `{ meta: { 'ucp-agent': { profile } }, catalog: { query, filters } }` | `{ query, context, limit, saved_catalog }` |
| **Profile reference** | `arguments.meta['ucp-agent'].profile` | not required for search; the dashboard's sample omits it entirely |
| **Response wrapper** | `result.structuredContent.products[]` | `result.content[0].text` is a **JSON-encoded string** containing `{ "offers": [...] }` (requires a second `JSON.parse`) |
| **Per-product price field** | `product.price_range.min.amount` | `product.priceRange.min.amount` (camelCase) |
| **Per-product options** | `options[].values[].label` | `options[].values[].value` |

Other things worth knowing if you're reproducing this:

- **Saved catalogs go stale.** Ours started returning 0 results for every
  query mid-session despite previously working. Re-saving the catalog in Dev
  Dashboard (no config change) brought it back. Searching *without*
  `saved_catalog` falls back to the global Shopify catalog and is a useful
  isolation tool when debugging.
- **The `tools/list` JSON-RPC method** is the fastest way to confirm what's
  actually exposed at the MCP endpoint. It currently lists
  `search_global_products` and `get_global_product_details`.
- **The catalog ID and the MCP URL are now separate concepts.** Two configs to
  manage instead of one URL.

## References

- [Shopify Agents overview](https://shopify.dev/docs/agents)
- [Agent profiles](https://shopify.dev/docs/agents/profiles)
- [Catalog reference](https://shopify.dev/docs/agents/catalog)
