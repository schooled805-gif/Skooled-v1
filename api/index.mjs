// Vercel serverless entry point.
//
// Vercel turns every file under /api at the project root into a serverless
// function. This thin handler re-exports the fully-bundled Express app
// produced by esbuild (artifacts/api-server/dist/app.mjs). An Express app is
// itself a (req, res) request handler, which @vercel/node serves directly.
//
// We import the pre-bundled .mjs (not the TypeScript source) on purpose: the
// bundle already inlines the @workspace/db and @workspace/api-zod packages, so
// Vercel never has to type-check the monorepo's TypeScript project references
// (the source of the previous "Emit skipped" build failure).
import app from "../artifacts/api-server/dist/app.mjs";

export default app;
