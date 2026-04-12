# Product: Liferay Headless SDK

A JavaScript SDK that dynamically generates API client methods from Liferay's Swagger/OpenAPI specifications at runtime. No manual endpoint mapping — point it at a Liferay instance and call APIs immediately.

## Core Value Proposition
- **Zero manual mapping**: API methods are generated at runtime from OpenAPI specs
- **Dynamic service namespaces**: After `init()`, services are accessible as `client.<namespace>.<tag>.<method>()`
- **Dual auth support**: Basic Auth and OAuth2 Bearer tokens with dynamic switching
- **Pagination helpers**: `iteratePages`, `collectAllPages`, `getPage` for Liferay's paginated responses
- **CLI tool**: `liferay-sdk-cli generate` pre-fetches specs and emits static JS service modules

## Target Users
Developers building integrations against Liferay's Headless APIs who want a typed, ergonomic client without hand-writing HTTP calls.

## Key Liferay API Endpoints Supported
- `/o/headless-delivery/v1.0/openapi.json`
- `/o/headless-admin-user/v1.0/openapi.json`
- `/o/headless-admin-content/v1.0/openapi.json`
- `/o/object-admin/v1.0/openapi.json`
