#!/bin/sh
# QA-003 M8 2회차: 최신 트리(src 해시 df425ded…)로 빌드한 prod 번들(미리보기 4896)과 오라클 개발 서버(5898)에 시험을 돌린다. 1회차 결과(qa/results/m8, b, c)는 덮지 않는다.
# 사용: sh qa/scripts/m8-r2-chain.sh <그룹>
cd "$(dirname "$0")/../.." || exit 1
export QA_PROD=http://127.0.0.1:4896/spoongame/
export QA_DEV=http://127.0.0.1:5898/
export QA_OUT=qa/results/m8/r2
export QA_SHOT_PREFIX=M8-r2
export QA_CASES=qa/results/m8/r2/cases.jsonl
export M8_K=1.25
L=qa/results/m8/r2/logs
mkdir -p $L qa/results/m8/r2/hold qa/results/m8/r2/reg
run() { echo "=== $* $(date +%H:%M:%S)"; node "$@" 2>&1; }
hold() { # era seed speed mode tag [readMs]
  node qa/scripts/m8-hold-run.mjs "$@" > "$L/hold-$5.log" 2> "$L/hold-$5.err"; }
case "$1" in
  h1) # 1배속 완주 8판(자동 6 · 수동 1 · 건너뛰기 1): 약 20분
     hold past 11 1 auto a1x-past-11 &
     hold past 21 1 auto a1x-past-21 &
     hold present 12 1 auto a1x-present-12 &
     hold present 22 1 auto a1x-present-22 &
     hold future 13 1 auto a1x-future-13 &
     hold future 23 1 auto a1x-future-23 &
     hold present 61 1 manual m1x-present-61 &
     hold future 71 1 skip s1x-future-71 &
     wait ;;
  h2) # 2·4·8배속 완주 + 건너뛰기 8배속
     hold present 31 2 auto a2x-present-31 &
     hold past 41 4 auto a4x-past-41 &
     hold present 81 8 skip s8x-present-81 &
     hold past 101 8 auto a8x-past-101 &
     hold present 111 8 auto a8x-present-111 &
     hold future 121 8 auto a8x-future-121 &
     wait
     hold past 102 8 auto a8x-past-102 &
     hold present 112 8 auto a8x-present-112 &
     hold future 122 8 auto a8x-future-122 &
     hold past 103 8 auto a8x-past-103 &
     hold present 113 8 auto a8x-present-113 &
     hold future 123 8 auto a8x-future-123 &
     wait ;;
  r422) # (마) R-422: 단발 → 10회 반복 병렬
     run qa/scripts/m8-r2-r422.mjs a 1 7 TB04a7
     run qa/scripts/m8-r2-r422.mjs a 1 20 TB04a20
     run qa/scripts/m8-r2-r422.mjs b 1 20 TB04b20
     run qa/scripts/m8-r2-r422.mjs d 1 20 TB04d20
     node qa/scripts/m8-r2-r422.mjs a 10 20 TB04c-a > $L/r422-c-a.log 2>&1 &
     node qa/scripts/m8-r2-r422.mjs b 10 20 TB04c-b > $L/r422-c-b.log 2>&1 &
     node qa/scripts/m8-r2-r422.mjs d 10 20 TB04d10 > $L/r422-d10.log 2>&1 &
     wait ;;
  play) run qa/scripts/m8-r2-play.mjs grow pause hidden fold note exit title reload close freeze spam tabs back btn ;;
  misc) run qa/scripts/m8-tamper.mjs play ending-end mode; run qa/scripts/m8-clean.mjs a b c d; run qa/scripts/m8-newgame.mjs; run qa/scripts/m8-extra.mjs ;;
  layout) run qa/scripts/m8-r2-det-check.mjs; run qa/scripts/m8-r2-ending.mjs display fit layout; run qa/scripts/m8-r2-title.mjs ;;
  reg) # M7b·M7c 회귀·입력 가드·스크롤 잠금(1회차 c 체인 4번 뒤쪽)
     export QA_SHOT_PREFIX=M8-r2-reg QA_OUT=qa/results/m8/r2/reg QA_CASES=qa/results/m8/r2/reg/cases.jsonl
     run qa/scripts/m7c-regress.mjs
     export QA_CASES=qa/results/m8/r2/reg/cases-guard.jsonl
     run qa/scripts/m7c-r2-guard.mjs dec 1 360x740; run qa/scripts/m7c-r2-guard.mjs misc 1; run qa/scripts/m7c-r2-guard.mjs b07 1; run qa/scripts/m7c-r2-guard.mjs dbl 1 360x740; run qa/scripts/m7c-r2-scroll.mjs
     export QA_SHOT_PREFIX=M8-r2-gt QA_OUT=qa/results/m8/r2 QA_CASES=qa/results/m8/r2/cases.jsonl
     run qa/scripts/m8-r2-guard-timed.mjs dec 1 360x740; run qa/scripts/m8-r2-guard-timed.mjs dbl 1 360x740; run qa/scripts/m8-r2-guard-timed.mjs inline 1 360x740 ;;
  attack) # N01~N03 정상 플레이 + 입력·동작 공격(1회차 c 체인 5번)
     export QA_SHOT_PREFIX=M8-r2-reg QA_OUT=qa/results/m8/r2/reg QA_CASES=qa/results/m8/r2/reg/cases-attack.jsonl
     run qa/scripts/m7c-play.mjs past 17 N01-past 8 normal
     run qa/scripts/m7c-play.mjs present 31 N02-present 8 normal
     run qa/scripts/m7c-play.mjs future 23 N03-future 8 normal
     run qa/scripts/m7c-attack.mjs
     QA_SKIP=B07 run qa/scripts/m7c-attack2.mjs
     run qa/scripts/m7c-attack4.mjs; run qa/scripts/m7c-attack6.mjs; run qa/scripts/m7c-attack7.mjs
     QA_SKIP=B04c run qa/scripts/m7c-attack8.mjs ;;
  inv) run qa/scripts/m8-invariance.mjs ;;
  fy) run qa/scripts/m8-first-year.mjs 5 1 ;;
  analyze) run qa/scripts/m8-hold-analyze.mjs ;;
esac
echo "=== done $1 $(date +%H:%M:%S)"
