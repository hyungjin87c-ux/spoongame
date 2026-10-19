#!/bin/sh
# QA-003 M8 1회차 보충(c): 검수 지적 반영·연출 계수 1.25·엔딩 줄바꿈 손질 뒤의 최신 작업 트리로 다시 빌드한 prod 번들(미리보기 4897)에 같은 시험을 다시 돌린다.
# 사용: sh qa/results/m8/c/logs/chain-c.sh <그룹 1~5>
cd "$(dirname "$0")/../../../../.." || exit 1
export QA_PROD=http://127.0.0.1:4897/spoongame/
export QA_OUT=qa/results/m8/c
export QA_SHOT_PREFIX=M8c
export QA_CASES=qa/results/m8/c/cases.jsonl
export M8_K=1.25
run() { echo "=== $* $(date +%H:%M:%S)"; node "$@" 2>&1; }
case "$1" in
  1) run qa/scripts/m8-play.mjs grow pause hidden fold note exit title reload close freeze spam tabs back btn ;;
  2) run qa/scripts/m8-tabs.mjs; run qa/scripts/m8-tamper.mjs play ending-end mode; run qa/scripts/m8-clean.mjs a b c d; run qa/scripts/m8-newgame.mjs; run qa/scripts/m8-extra.mjs ;;
  3) run qa/scripts/m8-ending.mjs display fit layout; run qa/scripts/m8-title.mjs ;;
  4) run qa/scripts/m8-first-year.mjs 5 1; run qa/scripts/m8-harvest.mjs 1000
     M8_HARVEST_TAG=x5 M8_SEED_OFFSET=1000000 run qa/scripts/m8-harvest.mjs 5000
     export QA_SHOT_PREFIX=M8c-reg QA_OUT=qa/results/m8/c/reg QA_CASES=qa/results/m8/c/reg/cases.jsonl
     run qa/scripts/m7c-regress.mjs
     export QA_CASES=qa/results/m8/c/reg/cases-guard.jsonl
     run qa/scripts/m7c-r2-guard.mjs dec 1 360x740; run qa/scripts/m7c-r2-guard.mjs misc 1; run qa/scripts/m7c-r2-guard.mjs b07 1; run qa/scripts/m7c-r2-guard.mjs dbl 1 360x740; run qa/scripts/m7c-r2-scroll.mjs ;;
  5) export QA_SHOT_PREFIX=M8c-reg QA_OUT=qa/results/m8/c/reg QA_CASES=qa/results/m8/c/reg/cases-attack.jsonl
     run qa/scripts/m7c-play.mjs past 17 N01-past 8 normal
     run qa/scripts/m7c-play.mjs present 31 N02-present 8 normal
     run qa/scripts/m7c-play.mjs future 23 N03-future 8 normal
     run qa/scripts/m7c-attack.mjs
     QA_SKIP=B07 run qa/scripts/m7c-attack2.mjs
     run qa/scripts/m7c-attack4.mjs; run qa/scripts/m7c-attack6.mjs; run qa/scripts/m7c-attack7.mjs
     QA_SKIP=B04c run qa/scripts/m7c-attack8.mjs ;;
esac
echo "=== done $1 $(date +%H:%M:%S)"
