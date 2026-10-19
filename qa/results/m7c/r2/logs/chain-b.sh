#!/bin/bash
cd "$(dirname "$0")/../../../../.."
for step in "m7c-r2-cards.mjs" "m7c-r2-pinch.mjs" "m7c-r2-limit.mjs" "m7c-r2-record.mjs" "m7c-broke.mjs" "m7c-lint.mjs"; do
  echo "=== $step $(date +%T)"
  node --import ./qa/scripts/m7c-r2-env.mjs qa/scripts/$step 2>&1
done
echo "=== chain-b done $(date +%T)"
