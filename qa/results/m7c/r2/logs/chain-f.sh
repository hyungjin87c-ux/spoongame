#!/bin/bash
cd "$(dirname "$0")/../../../../.."
run() { echo "=== $* $(date +%T)"; node --import ./qa/scripts/m7c-r2-env.mjs "$@" 2>&1; }
run qa/scripts/m7c-r2-keys.mjs
run qa/scripts/m7c-r2-guard3.mjs
run qa/scripts/m7c-r2-guard.mjs shots 1
run qa/scripts/m7c-monkey.mjs 16 140 2000 MK02
echo "=== chain-f done $(date +%T)"
