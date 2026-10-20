#!/bin/sh
# QA-003 M9 보충 묶음: 카드 90개 전수 훑기·줄 모양·L03 재실행(sweep), 알려진 2차 후보(known), WebKit 눈 판정(wkvis), e2e-prod 스모크(smoke).
# 사용: sh qa/scripts/m9-chain3.sh <그룹>   환경은 m9-env.sh. 실행 중인 이 파일을 고쳐 쓰지 않는다. (m9-chain.sh·m9-chain2.sh와 따로 둔 이유: 그쪽이 돌고 있을 때 고쳐 쓰지 않으려고)
cd "$(dirname "$0")/../.." || exit 1
. qa/scripts/m9-env.sh
mkdir -p qa/results/m9/logs "$QA_SHOT_DIR"
run() { echo "=== $* $(date +%H:%M:%S)"; node "$@" 2>&1; }
L03CARDS=sweep/sw-present-school-tutoring,sweep/sw-past-infant-new-sibling,sweep/sw-future-middle-layoff,sweep/sw-present-school-academy-night,sweep/sw-future-school-academy-night,sweep/sw-past-school-family-priority,sweep/sw-present-senior-move-home,sweep/sw-future-senior-move-home,sweep/sw-past-youth-marriage,sweep/sw-past-youth-child
case "$1" in
  sweep) # M7b 2회차 L04·D65r + L03 그대로 재실행(결과는 qa/results/m9/m7b, 샷 없음)
     export QA_OUT=qa/results/m9/m7b
     mkdir -p $QA_OUT
     run qa/scripts/m7b-r2-sweep.mjs all 3
     AUDIT_OUT=l03.jsonl run qa/scripts/m7b-audit.mjs $L03CARDS 100,200 3 sheet,fold,inline
     export QA_OUT=qa/results/m9
     run qa/scripts/m9-sweep-compare.mjs ;;
  known) run qa/scripts/m9-known.mjs ;;
  wkvis) run qa/scripts/m9-wk-visual.mjs "$M9_SCR/wk-visual"; run qa/scripts/m9-wk-visual-case.mjs "$M9_SCR/wk-visual" ;;
  smoke) # e2e-prod/smoke.spec.ts를 루트 base 빌드(4907)에 — 결과 JSON은 세션 임시 폴더
     M9_SCR="$M9_SCR" ./node_modules/.bin/playwright test -c qa/scripts/m9-playwright.prod.config.mjs 2>&1 ;;
esac
echo "=== done $1 $(date +%H:%M:%S)"
