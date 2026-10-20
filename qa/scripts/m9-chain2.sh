#!/bin/sh
# QA-003 M9 새 케이스 묶음(P1~P6·공격 B/C/D·E·F·3-4 이월). M8 2회차 재실행은 m9-chain.sh.
# 사용: sh qa/scripts/m9-chain2.sh <그룹>   환경은 m9-env.sh. 실행 중인 이 파일을 고쳐 쓰지 않는다.
cd "$(dirname "$0")/../.." || exit 1
. qa/scripts/m9-env.sh
mkdir -p qa/results/m9/logs qa/results/m9/p2 qa/results/m9/e "$QA_SHOT_DIR"
run() { echo "=== $* $(date +%H:%M:%S)"; node "$@" 2>&1; }
case "$1" in
  p2) # 세 시대 × (1280×800 마우스 · 360×740 터치) — 8배속 + 다음 결정으로 수동 흉내 완주, 단계마다 감사
     run qa/scripts/m9-p2.mjs past 31 d1280 P2-past-d1280
     run qa/scripts/m9-p2.mjs present 32 d1280 P2-present-d1280
     run qa/scripts/m9-p2.mjs future 33 d1280 P2-future-d1280
     run qa/scripts/m9-p2.mjs past 41 m360 P2-past-m360
     run qa/scripts/m9-p2.mjs present 42 m360 P2-present-m360
     run qa/scripts/m9-p2.mjs future 43 m360 P2-future-m360 ;;
  p3) run qa/scripts/m9-p3.mjs ;;
  p4) # 키보드만·강제 색상·움직임 줄이기·360 터치 + 다크 1판(8배속 완주, 글자 대비 포함)
     run qa/scripts/m9-p4.mjs kbd forced motion m360
     M9_SCHEME=dark M9_CONTRAST=1 M9_CAT='P4 다크 1판' run qa/scripts/m9-p2.mjs present 35 d1280 P4-dark-play ;;
  p5) # 3열 배치·폭 경계 + 데스크톱 1280·1920 한 판씩(8배속)
     run qa/scripts/m9-p5.mjs
     M9_CAT='P5 데스크톱 3열' run qa/scripts/m9-p2.mjs present 36 d1280 P5-play-1280
     M9_CAT='P5 데스크톱 3열' run qa/scripts/m9-p2.mjs past 37 d1920 P5-play-1920 ;;
  p6) # WebKit 핵심 흐름(1280×800 1판 · 360×740 터치 1판) + 레이아웃 감사(글자 100·200%)
     M9_BROWSER=webkit M9_CAT='P6 WebKit' run qa/scripts/m9-p2.mjs present 51 d1280 P6-wk-flow-1280
     M9_BROWSER=webkit M9_CAT='P6 WebKit' run qa/scripts/m9-p2.mjs future 52 m360 P6-wk-flow-360
     M9_BROWSER=webkit M9_E_PREFIX=P6-wk-audit- M9_E_CAT='P6 WebKit' M9_E_FONTS=100,200 run qa/scripts/m9-e.mjs title,roulette,birth,dash-adult,dash-infant,decision,note-auto,note-manual,ending 1280x800,360x740-touch ;;
  f) run qa/scripts/m9-f.mjs ;;
  ctl) run qa/scripts/m9-audit-control.mjs ;;
  atkb) run qa/scripts/m9-attack-b.mjs ;;
  atkc) run qa/scripts/m9-attack-c.mjs ;;
  atkd) run qa/scripts/m9-attack-d.mjs ;;
  carry) run qa/scripts/m9-carry.mjs ;;
  e) run qa/scripts/m9-e.mjs ;;
  e1) run qa/scripts/m9-e.mjs title,roulette,birth,dash-adult ;;
  e2) run qa/scripts/m9-e.mjs dash-infant,decision,note-auto,note-manual,exit-ask,ending ;;
esac
echo "=== done $1 $(date +%H:%M:%S)"
