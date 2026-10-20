#!/bin/sh
# QA-003 M9 최종 릴리스 QA 공통 환경 (source 해서 쓴다).
# 대상: PAGES_BASE=/spoongame/ prod 빌드(세션 임시 폴더) → vite preview 4906, 오라클·탐침용 개발 서버 5908. 외부 요청 0.
# 스크린샷은 세션 임시 폴더(QA_SHOT_DIR)로 찍고, 끝(m9-final-cases.mjs)에서 FAIL·RECORD 케이스의 대표 1장만 qa/screenshots/003/M9-<케이스ID>.png 로 옮긴다.
: "${M9_SCR:?M9_SCR 환경변수에 세션 임시 폴더(빌드·샷·임시 파일 위치)를 준다 — 예: M9_SCR=<임시 폴더>/qa-m9}"
export M9_SCR
export QA_PROD=http://127.0.0.1:4906/spoongame/
export QA_DEV=http://127.0.0.1:5908/
export QA_OUT=qa/results/m9
export QA_SHOT_PREFIX=M9
export QA_SHOT_DIR="$M9_SCR/shots"
export QA_SCRATCH="$M9_SCR"
export QA_CASES=qa/results/m9/cases.jsonl
export M8_K=1.25
