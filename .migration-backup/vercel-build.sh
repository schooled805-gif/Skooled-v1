#!/bin/sh
set -e

echo "Building api-server..."
pnpm --filter @workspace/api-server exec node ./build.mjs

echo "Copying dist to root..."
cp -r artifacts/api-server/dist ./dist

echo "Verifying dist..."
ls -la dist/
ls -la dist/api/

echo "Build complete!"
