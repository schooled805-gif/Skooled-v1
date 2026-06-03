---
name: api-client-react Vite + TypeScript resolution
description: How @workspace/api-client-react must be configured to resolve correctly in both Vite (dev server/build) and TypeScript (tsc).
---

Two separate fixes are required:

1. **TypeScript**: Add a `paths` entry directly in the web app's `tsconfig.json` — DO NOT use project `references` for this package as there is no build step. Remove the `references` block entirely.
   ```json
   "paths": {
     "@workspace/api-client-react": ["../../lib/api-client-react/src/index.ts"]
   }
   ```

2. **Vite**: Add an explicit alias in `vite.config.ts` (Vite ignores tsconfig `paths` and `customConditions`):
   ```ts
   resolve: {
     alias: {
       "@workspace/api-client-react": path.resolve(import.meta.dirname, "../../lib/api-client-react/src/index.ts"),
     },
     conditions: ["workspace", "import", "module", "browser", "default"],
   }
   ```

The `workspace` export condition in `lib/api-client-react/package.json` is also needed for any consumer that does resolve via exports.

**Why:** Vite does NOT read tsconfig `paths` or `customConditions` — it uses its own resolution pipeline. TypeScript project `references` require compiled `.d.ts` output files; without a build step they silently fall back to broken resolution.

**How to apply:** Any web app artifact importing from `@workspace/api-client-react` needs both fixes.
