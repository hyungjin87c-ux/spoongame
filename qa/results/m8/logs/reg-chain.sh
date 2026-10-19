#!/bin/sh
# QA-003 M8 회귀 사슬: M7c 2회차 F-1 가드·스크롤 잠금 스크립트를 M8 출력 위치로 다시 돌린다 (1회차/2회차 결과를 덮지 않도록 환경 변수로 위치를 정한다)
cd "$(dirname "$0")/../../../.." || exit 1
export QA_SHOT_PREFIX=M8-reg
export QA_OUT=qa/results/m8/reg
export QA_CASES=qa/results/m8/reg/cases-guard.jsonl
for args in "m7c-r2-guard.mjs dbl 1 360x740" "m7c-r2-guard.mjs dbl 1 320x568" "m7c-r2-guard.mjs dec 1 360x740" "m7c-r2-guard.mjs inline 1 360x740" "m7c-r2-guard.mjs release 1 360x740" "m7c-r2-guard.mjs b07 1" "m7c-r2-guard.mjs misc 1" "m7c-r2-scroll.mjs"; do
  echo "=== $args $(date +%H:%M:%S)"
  node qa/scripts/$args
done
echo "=== done $(date +%H:%M:%S)"
