#!/bin/sh
# QA-003 M8 회귀 사슬 2: M7c의 정상 플레이 3판(세 세상)과 입력·동작 공격 스크립트를 M8 출력 위치로 다시 돌린다
cd "$(dirname "$0")/../../../.." || exit 1
export QA_SHOT_PREFIX=M8-reg
export QA_OUT=qa/results/m8/reg
export QA_CASES=qa/results/m8/reg/cases-attack.jsonl
run() { echo "=== $* $(date +%H:%M:%S)"; node "$@" 2>&1; }
run qa/scripts/m7c-play.mjs past 17 N01-past 8 normal
run qa/scripts/m7c-play.mjs present 31 N02-present 8 normal
run qa/scripts/m7c-play.mjs future 23 N03-future 8 normal
run qa/scripts/m7c-attack.mjs
QA_SKIP=B07 run qa/scripts/m7c-attack2.mjs
run qa/scripts/m7c-attack4.mjs
run qa/scripts/m7c-attack6.mjs
run qa/scripts/m7c-attack7.mjs
QA_SKIP=B04c run qa/scripts/m7c-attack8.mjs
echo "=== done $(date +%H:%M:%S)"
