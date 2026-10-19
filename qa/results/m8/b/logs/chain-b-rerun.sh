#!/bin/sh
# QA-003 M8 보충(b) 재실행: idle만 바뀐 상태를 저장에 쓰지 않는 빌드(R-417)에서도 읽히게 고친 시험 스크립트(PL03·04·04b·07·07b·08)를 다시 돌린다
cd "$(dirname "$0")/../../../../.." || exit 1
export QA_PROD=http://127.0.0.1:4898/spoongame/ QA_OUT=qa/results/m8/b QA_SHOT_PREFIX=M8b QA_CASES=qa/results/m8/b/cases.jsonl M8_K=1.25
echo "=== rerun $(date +%H:%M:%S)"
node qa/scripts/m8-play.mjs pause hidden exit title 2>&1
echo "=== done rerun $(date +%H:%M:%S)"
