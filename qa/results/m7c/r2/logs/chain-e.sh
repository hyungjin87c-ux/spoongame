#!/bin/bash
cd "$(dirname "$0")/../../../../.."
run() { echo "=== $* $(date +%T)"; node --import ./qa/scripts/m7c-r2-env.mjs "$@" 2>&1; }
run qa/scripts/m7c-r2-keys.mjs
run qa/scripts/m7c-r2-content-sample.mjs 300
run qa/scripts/m7c-play.mjs past 41 I-past-41-w 8 normal
run qa/scripts/m7c-play.mjs past 41 I-past-41-s 8 skipall
run qa/scripts/m7c-play.mjs present 51 I-present-51-w 8 normal
run qa/scripts/m7c-play.mjs present 51 I-present-51-s 8 skipall
run qa/scripts/m7c-play.mjs future 61 I-future-61-w 8 normal
run qa/scripts/m7c-play.mjs future 61 I-future-61-s 8 skipall
run qa/scripts/m7c-monkey.mjs 8 120
run qa/scripts/m7c-shots-extra.mjs
run qa/scripts/m7c-shots-extra2.mjs
echo "=== chain-e done $(date +%T)"
