# Liferay Headless SDK

A JavaScript SDK that **dynamically generates** API client methods from Liferay's Swagger/OpenAPI specifications at runtime. Zero manual mapping required — point it at a Liferay instance and call APIs immediately.

---

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Authentication](#authentication)
- [Dynamic Method Usage](#dynamic-method-usage)
- [Pagination](#pagination)
- [Interceptors](#interceptors)
- [Error Handling](#error-handling)
- [CLI Tool](#cli-tool)
- [TypeScript](#typescript)
- [Advanced Usage](#advanced-usage)
- [File Structure](#file-structure)

---

## Installation

```bash
npm install liferay-headless-sdk
# or
yarn add liferay-headless-sdk
```

Node.js 18+ is required (uses native `fetch` and ES modules).

---

## Quick Start

```js
import { LiferayHeadlessClient } from 'liferay-headless-sdk';

const client = new LiferayHeadlessClient({
  baseUrl: 'https://your-liferay.com',
  swaggerUrls: [
    '/o/headless-delivery/v1.0/openapi.json',
    '/o/headless-admin-user/v1.0/openapi.json',
  ],
  username: 'test@liferay.com',
  password: 'test',
});

// Initialize (loads and parses OpenAPI schemas)
await client.init();

// Call generated methods — namespace > tag > method
const { data } = await client.headlessAdminUser.site.getMyUserAccountSitesPage();
console.log(data.items);
```

---

## Configuration

```js
const client = new LiferayHeadlessClient({
  // Required
  baseUrl: 'https://your-liferay.com',

  // OpenAPI endpoints to load (relative or absolute URLs)
  swaggerUrls: [
    '/o/headless-delivery/v1.0/openapi.json',
    '/o/headless-admin-user/v1.0/openapi.json',
    '/o/headless-admin-content/v1.0/openapi.json',
    '/o/object-admin/v1.0/openapi.json',
  ],

  // Filter to specific operation IDs (optional)
  operationIds: [],

  // Filter to specific tags (optional)
  tags: [],

  // Auth — use one of the options below
  username: 'test@liferay.com',
  password: 'test',
  // oauthToken: 'your-bearer-token',
  // authToken: 'your-csrf-token',   // sets x-csrf-token header

  // HTTP behavior
  timeout: 30000,   // ms — default 30s
  retries: 2,       // automatic retries on 5xx / network errors

  // Lazy init via Proxy (default true)
  // When true, init() is called automatically on first service access
  autoGenerate: true,
});
```

### Available Swagger Endpoints

| API | Path |
|-----|------|
| Headless Delivery | `/o/headless-delivery/v1.0/openapi.json` |
| Headless Admin User | `/o/headless-admin-user/v1.0/openapi.json` |
| Headless Admin Content | `/o/headless-admin-content/v1.0/openapi.json` |
| Object Admin | `/o/object-admin/v1.0/openapi.json` |

---

## Authentication

### Basic Auth (username + password)

```js
const client = new LiferayHeadlessClient({
  baseUrl: '...',
  username: 'test@liferay.com',
  password: 'test',
});
```

### OAuth2 Bearer Token

```js
const client = new LiferayHeadlessClient({
  baseUrl: '...',
  oauthToken: 'eyJhbGciOiJSUzI1NiJ9...',
});
```

### CSRF Token

```js
const client = new LiferayHeadlessClient({
  baseUrl: '...',
  authToken: 'your-csrf-token', // sets x-csrf-token header
});
```

### Switching Auth Dynamically

```js
// Switch to OAuth after initial Basic auth setup
client.setOAuthToken('new-access-token');

// Or switch back to Basic
client.setBasicAuth('admin@liferay.com', 'admin');

// Clear auth
client.clearAuth();
```

---

## Dynamic Method Usage

After `init()`, service namespaces are accessible as `client.<namespace>.<tag>.<method>()`.

The namespace is derived from the OpenAPI `info.title` (camelCased). Tags become sub-namespaces.

```js
await client.init();

// GET /v1.0/sites/{siteId}
const { data } = await client.headlessAdminUser.site.getSite({ siteId: 12345 });

// GET /v1.0/structured-contents/{structuredContentId}
const { data: content } = await client.headlessDelivery.structuredContent.getStructuredContent({
  structuredContentId: 999,
});

// POST /v1.0/sites/{siteId}/structured-contents
await client.headlessDelivery.structuredContent.postSiteStructuredContent({
  siteId: 12345,
  body: {
    title: 'My Article',
    contentStructureId: 67890,
    contentFields: [],
  },
});

// PUT /v1.0/structured-contents/{structuredContentId}
await client.headlessDelivery.structuredContent.putStructuredContent({
  structuredContentId: 999,
  body: { title: 'Updated Title' },
});

// DELETE /v1.0/structured-contents/{structuredContentId}
await client.headlessDelivery.structuredContent.deleteStructuredContent({
  structuredContentId: 999,
});
```

### Parameter Mapping

All parameters are passed as a single flat object:

| Param type | How to pass |
|------------|-------------|
| Path variable `{siteId}` | `{ siteId: 12345 }` |
| Query string `?page=1` | `{ page: 1 }` |
| Request body | `{ body: { ... } }` |
| Extra headers | `{ headers: { 'X-Custom': 'value' } }` |

Any extra keys not defined in the OpenAPI spec fall through as query parameters.

### Filtering Operations

Load only what you need by filtering at construction time:

```js
const client = new LiferayHeadlessClient({
  baseUrl: '...',
  swaggerUrls: ['/o/headless-delivery/v1.0/openapi.json'],
  // Only generate methods for these operation IDs
  operationIds: ['getSite', 'getSites'],
  // Or filter by tag name
  tags: ['Site'],
});
```

### Discovering Available Methods

```js
// List all service namespaces
console.log(client.getServiceNames());
// ['headlessDelivery', 'headlessAdminUser', ...]

// List tag groups within a namespace
const ns = client._services['headlessDelivery'];
console.log(Object.keys(ns));
// ['structuredContent', 'site', ...]

// List methods in a tag group
console.log(client.getMethodNames('headlessDelivery'));
```

---

## Pagination

Liferay returns paginated responses with `{ items, page, pageSize, totalCount, lastPage }`.

### Iterate all pages lazily

```js
import { iteratePages } from 'liferay-headless-sdk';

for await (const site of iteratePages(client.headlessAdminUser.site.getMyUserAccountSitesPage, { pageSize: 50 })) {
  console.log(site.name);
}
```

### Collect all items into an array

```js
import { collectAllPages } from 'liferay-headless-sdk';

const allUsers = await collectAllPages(client.headlessAdminUser.site.getMyUserAccountSitesPage, { pageSize: 100 });
```

### Fetch a specific page

```js
import { getPage } from 'liferay-headless-sdk';

const page2 = await getPage(client.headlessAdminUser.site.getMyUserAccountSitesPage, 2, 20);
console.log(page2.items, page2.totalCount, page2.lastPage);
```

---

## Interceptors

Interceptors run on every request/response before it is returned to your code.

### Logging

```js
client.addRequestInterceptor((config) => {
  console.log(`→ ${config.method} ${config.path}`);
  return config;
});

client.addResponseInterceptor((response) => {
  console.log(`← ${response.status}`);
  return response;
});
```

### Adding headers

```js
client.addRequestInterceptor((config) => ({
  ...config,
  headers: { ...config.headers, 'X-Correlation-ID': crypto.randomUUID() },
}));
```

### Token refresh

```js
client.addResponseInterceptor(async (response) => {
  if (response.status === 401) {
    const newToken = await refreshAccessToken();
    client.setOAuthToken(newToken);
  }
  return response;
});
```

---

## Error Handling

```js
import { LiferayAPIError, LiferayNetworkError, LiferayTimeoutError } from 'liferay-headless-sdk';

try {
  const { data } = await client.headlessAdminUser.site.getMyUserAccountSitesPage();
} catch (err) {
  if (err instanceof LiferayAPIError) {
    console.error(`API Error ${err.statusCode}: ${err.message}`);
    console.error('Endpoint:', err.endpoint);
    console.error('Response body:', err.responseBody);
  } else if (err instanceof LiferayTimeoutError) {
    console.error(`Timed out after ${err.timeoutMs}ms on ${err.endpoint}`);
  } else if (err instanceof LiferayNetworkError) {
    console.error(`Network failure on ${err.endpoint}:`, err.message);
  } else {
    throw err;
  }
}
```

### Error properties

| Class | Properties |
|-------|-----------|
| `LiferayAPIError` | `statusCode`, `message`, `endpoint`, `requestPayload`, `responseBody` |
| `LiferayNetworkError` | `message`, `endpoint`, `cause` |
| `LiferayTimeoutError` | `message`, `endpoint`, `timeoutMs` |

4xx errors are not retried. 5xx and network errors are retried up to `retries` times with exponential backoff.

---

## CLI Tool

Generate a static SDK by pre-fetching Swagger definitions:

```bash
npx liferay-sdk-cli generate \
  --baseUrl https://your-liferay.com \
  --output ./generated-sdk \
  --username test@liferay.com \
  --password test
```

### Options

| Flag | Description | Default |
|------|-------------|---------|
| `--baseUrl` | Liferay instance URL | required |
| `--output` | Output directory | `./generated-sdk` |
| `--username` | Basic Auth username | |
| `--password` | Basic Auth password | |
| `--token` | OAuth2 bearer token | |
| `--swagger` | Comma-separated list of OpenAPI paths | all 4 default endpoints |

### Custom Swagger URLs

```bash
npx liferay-sdk-cli generate \
  --baseUrl https://your-liferay.com \
  --swagger /o/headless-delivery/v1.0/openapi.json,/o/my-custom-api/v1.0/openapi.json
```

The CLI generates a `services/` directory with one JS file per API, plus an `index.js` that re-exports everything alongside the core SDK helpers.

---

## TypeScript

TypeScript declarations are included via `src/index.d.ts`. Dynamic service namespaces are typed with an index signature:

```ts
import { LiferayHeadlessClient, LiferayAPIError } from 'liferay-headless-sdk';

const client = new LiferayHeadlessClient({
  baseUrl: 'https://your-liferay.com',
  username: 'test@liferay.com',
  password: 'test',
  swaggerUrls: ['/o/headless-delivery/v1.0/openapi.json'],
});

await client.init();

// Dynamically accessed namespaces
const ns = client['headlessDelivery'] as Record<string, Record<string, Function>>;
const result = await ns['structuredContent']['getStructuredContents']();
```

For strongly-typed wrappers, use the CLI to generate static service modules.

---

## Advanced Usage

### Load schemas on demand

```js
const client = new LiferayHeadlessClient({
  baseUrl: '...',
  swaggerUrls: [],
  autoGenerate: false,
  username: 'test@liferay.com',
  password: 'test',
});

// Load only what you need
await client.loadSchema('/o/headless-delivery/v1.0/openapi.json');
const { data } = await client.headlessDelivery.structuredContent.getStructuredContents();
```

### Raw HTTP access

```js
const { data } = await client.request({
  method: 'GET',
  path: '/o/headless-delivery/v1.0/sites',
  query: { page: 1, pageSize: 5 },
});
```

### Cache management

```js
// Clear all cached schemas (forces re-fetch on next init)
client.clearSchemaCache();
await client.init();
```

---

## File Structure

```
liferay-headless-sdk/
├── src/
│   ├── index.js          — Public exports
│   ├── index.d.ts        — TypeScript declarations
│   ├── client.js         — LiferayHeadlessClient (main entry point)
│   ├── api-generator.js  — Parses OpenAPI schemas, generates service modules
│   ├── swagger-loader.js — Fetches and caches OpenAPI JSON schemas
│   ├── http.js           — Fetch wrapper with retry, timeout, interceptors
│   ├── auth.js           — Basic Auth, OAuth2, and CSRF token management
│   ├── errors.js         — LiferayAPIError, LiferayNetworkError, LiferayTimeoutError
│   ├── pagination.js     — iteratePages, collectAllPages, getPage
│   ├── utils.js          — URL building, camelCase, query string helpers
│   └── cli.js            — liferay-sdk-cli binary
├── package.json
└── README.md
```

---

## License

MIT
