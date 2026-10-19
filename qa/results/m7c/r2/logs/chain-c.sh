#!/bin/bash
cd "$(dirname "$0")/../../../../.."
run() { echo "=== $* $(date +%T)"; node --import ./qa/scripts/m7c-r2-env.mjs "$@" 2>&1; }
run qa/scripts/m7c-play.mjs past 17 N01-past 8 normal
run qa/scripts/m7c-play.mjs present 31 N02-present 8 normal
run qa/scripts/m7c-play.mjs future 23 N03-future 8 normal
run qa/scripts/m7c-attack.mjs
QA_SKIP=B07 run qa/scripts/m7c-attack2.mjs
run qa/scripts/m7c-attack4.mjs
run qa/scripts/m7c-attack6.mjs
run qa/scripts/m7c-attack7.mjs
QA_SKIP=B04c run qa/scripts/m7c-attack8.mjs
echo "=== chain-c done $(date +%T)"
