#!/bin/sh
# 보호 대상 파일 sha256 목록 (src tests e2e e2e-prod docs scripts harness 설정 파일)
cd "$(dirname "$0")/../.." || exit 1
{
  find src tests e2e e2e-prod docs scripts harness -type f 2>/dev/null
  ls package.json package-lock.json tsconfig.json tsconfig.node.json vite.config.ts playwright.config.ts playwright.prod.config.ts index.html node-globals.d.ts CLAUDE.md .gitignore 2>/dev/null
} | LC_ALL=C sort | while read -r f; do printf '%s  %s\n' "$(sha256sum "$f" | cut -d' ' -f1)" "$f"; done
