#!/bin/bash
cd "$(dirname "$0")/../../../../.."
for step in "dbl 1" "dec 1" "inline 1" "dbl 2" "dec 2" "inline 2" "release 1" "b07 1"; do
  echo "=== $step $(date +%T)"
  node qa/scripts/m7c-r2-guard.mjs $step 2>&1
done
echo "=== chain done $(date +%T)"
