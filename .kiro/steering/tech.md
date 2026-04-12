# Tech Stack

## Runtime
- **Node.js 18+** required (uses native `fetch`, `AbortController`, and ES modules)
- **ES Modules only** (`"type": "module"` in package.json) — no CommonJS

## Language
- Plain JavaScript with JSDoc type annotations
- TypeScript declarations provided via `src/index.d.ts` (no TS compilation step)

## Dependencies
- **No runtime dependencies** — zero external packages
- **No Dev dependencies**: zero external packages

## Common Commands

```bash
# No build step needed — pure ES modules
npm run build   # no-op, prints a message

# CLI tool
npx liferay-sdk-cli generate --baseUrl https://your-liferay.com --output ./generated-sdk
```
