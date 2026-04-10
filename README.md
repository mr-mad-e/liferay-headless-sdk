# Liferay Headless SDK

A production-ready JavaScript SDK that **dynamically generates** API client methods from Liferay's Swagger/OpenAPI specifications at runtime. Zero manual mapping required — point it at a Liferay instance and call APIs immediately.

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

// Call generated methods
const { data: sites } = await client.headlessDelivery.getSites();
console.log(sites.items);
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

  // Auth — use one of the options below
  username: 'test@liferay.com',
  password: 'test',
  // oauthToken: 'your-bearer-token',

  // HTTP behavior
  timeout: 30000,   // ms — default 30s
  retries: 2,       // automatic retries on 5xx / network errors

  // Lazy init via Proxy (default true)
  // Set false if you want to call init() manually and avoid Proxy overhead
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
| All APIs (discovery) | `/o/api` |

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

After `init()`, service namespaces are accessible as properties of the client. The namespace name is derived from the OpenAPI tag (converted to camelCase).

```js
await client.init();

// GET /sites
const { data } = await client.headlessDelivery.getSites();

// GET /sites/{siteId}/structured-contents
const { data: contents } = await client.headlessDelivery.getStructuredContents({
  siteId: 12345,
  pageSize: 10,
});

// POST — create structured content
await client.headlessDelivery.createStructuredContent({
  siteId: 12345,
  body: {
    title: 'My Article',
    contentStructureId: 67890,
    contentFields: [],
  },
});

// PUT — update
await client.headlessDelivery.putStructuredContent({
  structuredContentId: 999,
  body: { title: 'Updated Title' },
});

// DELETE
await client.headlessDelivery.deleteStructuredContent({
  structuredContentId: 999,
});
```

### Parameter Mapping

The SDK auto-maps parameters from the single `params` object:

| Param type | How to pass |
|------------|-------------|
| Path variable `{siteId}` | `{ siteId: 12345 }` |
| Query string `?page=1` | `{ page: 1 }` |
| Request body | `{ body: { ... } }` |
| Extra headers | `{ headers: { 'X-Custom': 'value' } }` |

Any extra keys not defined in the OpenAPI spec are passed as query parameters.

### Discovering Available Methods

```js
// List all service namespaces
console.log(client.getServiceNames());
// ['headlessDelivery', 'headlessAdminUser', ...]

// List methods in a namespace
console.log(client.getMethodNames('headlessDelivery'));
// ['getSites', 'getStructuredContents', 'createStructuredContent', ...]
```

---

## Pagination

Liferay returns paginated responses with `{ items, page, pageSize, totalCount, lastPage }`.

### Iterate all pages lazily

```js
import { iteratePages } from 'liferay-headless-sdk';

await client.init();

for await (const site of iteratePages(client.headlessDelivery.getSites, { pageSize: 50 })) {
  console.log(site.name);
}
```

### Collect all items into an array

```js
import { collectAllPages } from 'liferay-headless-sdk';

const allUsers = await collectAllPages(client.headlessAdminUser.getUsers, { pageSize: 100 });
```

### Fetch a specific page

```js
import { getPage } from 'liferay-headless-sdk';

const page2 = await getPage(client.headlessDelivery.getSites, 2, 20);
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
  const { data } = await client.headlessDelivery.getSites();
} catch (err) {
  if (err instanceof LiferayAPIError) {
    // HTTP error response from Liferay
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

4xx errors are **not retried**. 5xx and network errors are retried up to `retries` times with exponential backoff.

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
| `--baseUrl` | Liferay instance URL | *required* |
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

---

## TypeScript

Full TypeScript declarations are included. The dynamic service namespaces are typed with an index signature:

```ts
import { LiferayHeadlessClient, LiferayAPIError } from 'liferay-headless-sdk';

const client = new LiferayHeadlessClient({
  baseUrl: 'https://your-liferay.com',
  username: 'test@liferay.com',
  password: 'test',
  swaggerUrls: ['/o/headless-delivery/v1.0/openapi.json'],
});

await client.init();

// Dynamically accessed namespaces return Record<string, ApiMethod>
const service = client['headlessDelivery'] as Record<string, Function>;
const result = await service['getSites']();
```

For strongly-typed wrappers, use the CLI to generate static service modules with explicit types.

---

## Advanced Usage

### Load schemas on demand

```js
const client = new LiferayHeadlessClient({
  baseUrl: '...',
  swaggerUrls: [],         // Start with no schemas
  autoGenerate: false,
  username: 'test@liferay.com',
  password: 'test',
});

// Load only what you need
await client.loadSchema('/o/headless-delivery/v1.0/openapi.json');
const { data } = await client.headlessDelivery.getSites();
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
liferay-sdk/
├── index.js          — Public exports
├── index.d.ts        — TypeScript declarations
├── client.js         — LiferayHeadlessClient class
├── swagger-loader.js — OpenAPI schema fetching & caching
├── api-generator.js  — Dynamic method generation from schemas
├── http.js           — HTTP transport (fetch, retry, timeout)
├── auth.js           — Basic Auth & OAuth2 manager
├── errors.js         — LiferayAPIError, LiferayNetworkError, LiferayTimeoutError
├── pagination.js     — iteratePages, collectAllPages, getPage
├── utils.js          — URL building, camelCase conversion, etc.
├── cli.js            — liferay-sdk-cli tool
├── package.json
└── README.md
```

---

## License

MIT
