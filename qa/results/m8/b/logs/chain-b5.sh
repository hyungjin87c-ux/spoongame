#!/bin/sh
# QA-003 M8 보충(b) 그룹 5: M7c 동작 공격(다중 탭·뒤로가기·저장 차단 포함)과 정상 플레이 3판을 새 번들(4898)에 다시 돌린다
cd "$(dirname "$0")/../../../../.." || exit 1
export QA_PROD=http://127.0.0.1:4898/spoongame/ QA_OUT=qa/results/m8/b/reg QA_SHOT_PREFIX=M8b-reg QA_CASES=qa/results/m8/b/reg/cases-attack.jsonl M8_K=1.25
mkdir -p qa/results/m8/b/reg
run() { echo "=== $* $(date +%H:%M:%S)"; node "$@" 2>&1; }
run qa/scripts/m7c-play.mjs past 17 N01-past 8 normal
run qa/scripts/m7c-play.mjs present 31 N02-present 8 normal
run qa/scripts/m7c-play.mjs future 23 N03-future 8 normal
QA_SKIP=B07 run qa/scripts/m7c-attack2.mjs
run qa/scripts/m7c-attack4.mjs
run qa/scripts/m7c-attack6.mjs
run qa/scripts/m7c-attack7.mjs
QA_SKIP=B04c run qa/scripts/m7c-attack8.mjs
echo "=== done 5 $(date +%H:%M:%S)"
