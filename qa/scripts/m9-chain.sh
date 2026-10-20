#!/bin/sh
# QA-003 M9 최종 릴리스 QA: M8 2회차 케이스 표(432건)를 최종 빌드에서 그대로 재실행하는 묶음(m8-r2-chain.sh의 M9판) + M9 새 케이스.
# 사용: sh qa/scripts/m9-chain.sh <그룹>     (그룹은 아래 case 문). 환경은 m9-env.sh. 실행 중인 이 파일을 고쳐 쓰지 않는다(M8 2회차 4중 실행 사고).
# 메모리가 작은 PC라 한 번에 한 그룹(타이밍 시험은 아무 것도 겹치지 않게)을 권한다.
cd "$(dirname "$0")/../.." || exit 1
. qa/scripts/m9-env.sh
L=qa/results/m9/logs
mkdir -p $L qa/results/m9/hold qa/results/m9/p1 qa/results/m9/reg "$QA_SHOT_DIR"
run() { echo "=== $* $(date +%H:%M:%S)"; node "$@" 2>&1; }
case "$1" in
  h1) run qa/scripts/m9-hold-multi.mjs h1 ;;
  p1) run qa/scripts/m9-hold-multi.mjs p1 ;;
  h2a) run qa/scripts/m9-hold-multi.mjs h2a ;;
  h2b) run qa/scripts/m9-hold-multi.mjs h2b ;;
  analyze) run qa/scripts/m8-hold-analyze.mjs ;;
  r422) # (마) R-422: 단발 → 10회 반복 병렬
     run qa/scripts/m8-r2-r422.mjs a 1 7 TB04a7
     run qa/scripts/m8-r2-r422.mjs a 1 20 TB04a20
     run qa/scripts/m8-r2-r422.mjs b 1 20 TB04b20
     run qa/scripts/m8-r2-r422.mjs d 1 20 TB04d20
     node qa/scripts/m8-r2-r422.mjs a 10 20 TB04c-a > $L/r422-c-a.log 2>&1 &
     node qa/scripts/m8-r2-r422.mjs b 10 20 TB04c-b > $L/r422-c-b.log 2>&1 &
     node qa/scripts/m8-r2-r422.mjs d 10 20 TB04d10 > $L/r422-d10.log 2>&1 &
     wait ;;
  r422dev) # 개발 서버 + __playTime 판(타이머 내부를 정확히 읽음 — 마스터 정정 ③)
     R422_DEV=1 run qa/scripts/m8-r2-r422.mjs a 1 20 TB04a20
     R422_DEV=1 run qa/scripts/m8-r2-r422.mjs b 1 20 TB04b20
     R422_DEV=1 run qa/scripts/m8-r2-r422.mjs d 1 20 TB04d20
     R422_DEV=1 run qa/scripts/m8-r2-r422.mjs a 10 20 TB04c-a ;;
  play) run qa/scripts/m8-r2-play.mjs grow pause hidden fold note exit title reload close freeze spam tabs back btn ;;
  playdev) PLAY_DEV=1 run qa/scripts/m8-r2-play.mjs grow pause hidden fold note exit title spam freeze ;;
  misc) run qa/scripts/m8-tamper.mjs play ending-end mode; run qa/scripts/m8-clean.mjs a b c d; run qa/scripts/m8-newgame.mjs; run qa/scripts/m8-extra.mjs ;;
  layout) run qa/scripts/m8-r2-det-check.mjs; run qa/scripts/m8-r2-ending.mjs display fit layout; run qa/scripts/m8-r2-title.mjs ;;
  det) # 첫 화면·엔딩의 관형사 관찰 케이스(TL-det-others) — 이월 RECORD 확인
     run qa/scripts/m8-r2-det-title.mjs; run qa/scripts/m8-r2-det-popline.mjs; run qa/scripts/m9-det-record.mjs ;;
  tabs) run qa/scripts/m8-r2-tabs.mjs ;;
  reg) # M7b·M7c 회귀·입력 가드·스크롤 잠금
     export QA_SHOT_PREFIX=M9-reg QA_OUT=qa/results/m9/reg QA_CASES=qa/results/m9/reg/cases.jsonl
     run qa/scripts/m7c-regress.mjs
     export QA_CASES=qa/results/m9/reg/cases-guard.jsonl
     run qa/scripts/m7c-r2-guard.mjs dec 1 360x740; run qa/scripts/m7c-r2-guard.mjs misc 1; run qa/scripts/m7c-r2-guard.mjs b07 1; run qa/scripts/m7c-r2-guard.mjs dbl 1 360x740; run qa/scripts/m7c-r2-scroll.mjs
     export QA_SHOT_PREFIX=M9-gt QA_OUT=qa/results/m9 QA_CASES=qa/results/m9/cases.jsonl
     run qa/scripts/m8-r2-guard-timed.mjs dec 1 360x740; run qa/scripts/m8-r2-guard-timed.mjs dbl 1 360x740; run qa/scripts/m8-r2-guard-timed.mjs inline 1 360x740 ;;
  attack) # N01~N03 정상 플레이 + 입력·동작 공격
     export QA_SHOT_PREFIX=M9-reg QA_OUT=qa/results/m9/reg QA_CASES=qa/results/m9/reg/cases-attack.jsonl
     run qa/scripts/m7c-play.mjs past 17 N01-past 8 normal
     run qa/scripts/m7c-play.mjs present 31 N02-present 8 normal
     run qa/scripts/m7c-play.mjs future 23 N03-future 8 normal
     run qa/scripts/m7c-attack.mjs
     QA_SKIP=B07 run qa/scripts/m7c-attack2.mjs
     run qa/scripts/m7c-attack4.mjs; run qa/scripts/m8-r2-attack6.mjs; run qa/scripts/m7c-attack7.mjs
     QA_SKIP=B04c run qa/scripts/m7c-attack8.mjs ;;
  inv) run qa/scripts/m8-invariance.mjs ;;
  fy) run qa/scripts/m8-first-year.mjs 5 1 ;;
  harvest1) run qa/scripts/m8-r2-harvest.mjs 1000 x1 0 ;;
  harvest5) run qa/scripts/m8-r2-harvest.mjs 5000 x5 1000000 ;;
esac
echo "=== done $1 $(date +%H:%M:%S)"
