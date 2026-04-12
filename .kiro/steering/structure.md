# Project Structure

All source files live flat under `src/`. No subdirectories.

```
liferay-headless-sdk/
├── src/
│   ├── index.js          — Public exports (re-exports everything)
│   ├── index.d.ts        — TypeScript declarations for all public APIs
│   ├── client.js         — LiferayHeadlessClient class (main entry point)
│   ├── api-generator.js  — Parses OpenAPI schemas, generates service modules at runtime
│   ├── swagger-loader.js — Fetches and caches OpenAPI JSON schemas
│   ├── http.js           — HttpClient: fetch wrapper with retry, timeout, interceptors
│   ├── auth.js           — AuthManager: Basic Auth and OAuth2 token management
│   ├── errors.js         — LiferayAPIError, LiferayNetworkError, LiferayTimeoutError
│   ├── pagination.js     — iteratePages, collectAllPages, getPage helpers
│   ├── utils.js          — Shared utilities: URL building, camelCase, query strings
│   └── cli.js            — liferay-sdk-cli binary (static SDK code generation)
├── package.json
└── README.md
```

## Module Responsibilities

- `client.js` orchestrates all other modules — it's the only file consumers interact with directly
- `api-generator.js` contains `parseOperationsByTag`, `buildOperationMethod`, `buildServiceModule`, `generateServicesFromSchema`
- `utils.js` is a pure utility module — no imports from other SDK files
- `errors.js` is a pure module — no imports from other SDK files
- `cli.js` is a standalone script; it duplicates some logic (auth header building, camelCase) rather than importing from the SDK

## Conventions

- Every file has a `@fileoverview` JSDoc at the top
- Classes use JSDoc `@typedef` and `@param` annotations throughout
- Private methods are prefixed with `_` (e.g. `_fetchWithTimeout`, `_parseResponse`)
- Metadata is attached directly to generated functions via `Object.defineProperty` and custom properties (`_operationId`, `_method`, `_path`, `_summary`)
- Service namespaces are derived from OpenAPI `info.title` (camelCased); tag groups become sub-namespaces
- Unknown/extra params passed to generated methods fall through as query parameters
