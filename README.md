# Liferay Headless SDK

A JavaScript SDK that dynamically generates API client methods from Liferay's OpenAPI specifications at runtime.

Zero manual mapping required — point it at a Liferay instance and call APIs immediately.

---

## Table of Contents

- Installation
- Quick Start
- Configuration
- Authentication
- Dynamic Method Usage
- Pagination
- Interceptors
- Error Handling
- CLI Tool
- TypeScript
- Advanced Usage
- File Structure

---

## Installation

```bash
npm install liferay-headless-sdk
```

Node.js 18+ required (uses native `fetch` and ESM).

---

## Quick Start

```js
import { LiferayHeadlessClient } from 'liferay-headless-sdk';

const client = new LiferayHeadlessClient({
  baseUrl: 'https://your-liferay.com',
  swaggerUrls: ['/o/headless-delivery/v1.0/openapi.json', '/o/headless-admin-user/v1.0/openapi.json'],
  username: 'test@liferay.com',
  password: 'test',
});

await client.init();

const { data } = await client.headlessAdminUser.site.getMyUserAccountSitesPage();

console.log(data.items);
```

---

## Configuration

```js
const client = new LiferayHeadlessClient({
  baseUrl: 'https://your-liferay.com',

  swaggerUrls: ['/o/headless-delivery/v1.0/openapi.json', '/o/headless-admin-user/v1.0/openapi.json'],

  operationIds: [], // optional filter
  tags: [], // optional filter

  username: 'test@liferay.com',
  password: 'test',

  timeout: 30000,
  retries: 2,

  autoGenerate: true, // Proxy-based lazy init
});
```

---

## Authentication

### Basic Auth

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
  clientId: 'id-cbc930e2-3766-4ea2-24bd-6887b5fc112',
  clientSecret: 'secret-95f02f64-1033-5ad2-7066-2c393bdd',
});
```

### Switch Authentication at Runtime

```js
client.setBasicAuth('username', 'password');

client.setClientCredentials('clientId', 'clientSecret');

client.clearAuth();
```

---

## Dynamic Method Usage

After initialization:

```js
await client.init();
```

Access APIs:

```js
// GET /v1.0/sites/{siteId}
const { data } = await client.headlessAdminUser.site.getSite({ siteId: 12345 });

// GET /v1.0/structured-contents/{structuredContentId}
const { data: content } = await client.headlessDelivery.structuredContent.getStructuredContent({
  structuredContentId: 123,
});

// POST /v1.0/sites/{siteId}/structured-contents
await client.headlessDelivery.structuredContent.postSiteStructuredContent({
  siteId: 1,
  body: {
    title: 'My Article',
  },
});
```

---

## Parameter Mapping

| Type        | Example              |
| ----------- | -------------------- |
| Path param  | `{ siteId: 123 }`    |
| Query param | `{ page: 1 }`        |
| Body        | `{ body: {...} }`    |
| Headers     | `{ headers: {...} }` |

---

## Pagination

### Iterate lazily

```js
import { iteratePages } from 'liferay-headless-sdk';

for await (const item of iteratePages(client.headlessAdminUser.site.getMyUserAccountSitesPage, { pageSize: 50 })) {
  console.log(item);
}
```

### Collect all

```js
import { collectAllPages } from 'liferay-headless-sdk';

const all = await collectAllPages(client.headlessAdminUser.site.getMyUserAccountSitesPage, { pageSize: 100 });
```

---

## Interceptors

### Request Interceptor

```js
client.addRequestInterceptor((config) => {
  console.log('→', config.method, config.path);
  return config;
});
```

### Response Interceptor

```js
client.addResponseInterceptor((response) => {
  console.log('←', response.status);
  return response;
});
```

### Add headers dynamically

```js
client.addRequestInterceptor((config) => ({
  ...config,
  headers: {
    ...config.headers,
    'X-Request-ID': crypto.randomUUID(),
  },
}));
```

---

## Error Handling

```js
import { LiferayAPIError, LiferayNetworkError, LiferayTimeoutError } from 'liferay-headless-sdk';

try {
  await client.headlessAdminUser.site.getMyUserAccountSitesPage();
} catch (err) {
  if (err instanceof LiferayAPIError) {
    console.log(err.statusCode);
    console.log(err.responseBody);
  }

  if (err instanceof LiferayTimeoutError) {
    console.log(err.timeoutMs);
  }

  if (err instanceof LiferayNetworkError) {
    console.log(err.cause);
  }
}
```

### Behavior

- **4xx errors** → not retried
- **5xx + network errors** → retried with exponential backoff
- **timeouts** → wrapped in `LiferayTimeoutError`

---

## CLI Tool

```bash
npx liferay-sdk-cli generate \
  --baseUrl https://your-liferay.com \
  --output ./generated-sdk \
  --username test@liferay.com \
  --password test
```

### Options

| Flag         | Description              |
| ------------ | ------------------------ |
| `--baseUrl`  | Liferay instance URL     |
| `--output`   | Output directory         |
| `--swagger`  | Custom OpenAPI endpoints |
| `--username` | Basic auth username      |
| `--password` | Basic auth password      |
| `--token`    | OAuth token              |

---

## TypeScript

```ts
import { LiferayHeadlessClient } from 'liferay-headless-sdk';

const client = new LiferayHeadlessClient({
  baseUrl: 'https://your-liferay.com',
  username: 'test@liferay.com',
  password: 'test',
});
```

Dynamic access:

```ts
const ns = client['headlessDelivery'];

const result = await ns['structuredContent']['getStructuredContents']();
```

---

## Advanced Usage

### Load schema on demand

```js
await client.loadSchema('/o/headless-delivery/v1.0/openapi.json');
```

### Raw HTTP access

```js
const { data } = await client.request({
  method: 'GET',
  path: '/o/headless-delivery/v1.0/sites',
});
```

### Cache reset

```js
client.clearSchemaCache();
await client.init();
```

---

## File Structure

```
src/
├── client.js
├── http.js
├── auth.js
├── swagger-loader.js
├── api-generator.js
├── pagination.js
├── errors.js
├── utils.js
├── cli.js
```

---

## License

MIT
