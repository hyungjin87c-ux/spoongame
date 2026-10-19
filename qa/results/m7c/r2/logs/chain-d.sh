#!/bin/bash
cd "$(dirname "$0")/../../../../.."
run() { echo "=== $* $(date +%T)"; node --import ./qa/scripts/m7c-r2-env.mjs "$@" 2>&1; }
run qa/scripts/m7c-r2-guard2.mjs
run qa/scripts/m7c-r2-vv.mjs
run qa/scripts/m7c-r2-cite.mjs
run qa/scripts/m7c-r2-labels.mjs
run qa/scripts/m7c-r2-pinch.mjs
run qa/scripts/m7c-scroll.mjs
run qa/scripts/m7c-privacy.mjs
run qa/scripts/m7c-regress.mjs
run qa/scripts/m7c-layout.mjs
run qa/scripts/m7c-a11y.mjs
echo "=== chain-d done $(date +%T)"
