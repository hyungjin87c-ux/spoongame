#!/bin/sh
# F-A99: 이벤트 JSON을 일부러 깨고 check:events·build가 실패하는지 확인한다. 프로젝트 복사본(임시 폴더)에서만 한다 — 원본은 건드리지 않는다.
# 프로젝트 루트 = 이 스크립트 위치(qa/scripts)의 두 단계 위. Windows(Git Bash)에서는 PowerShell도 읽는 C:/… 꼴(pwd -W), 그 밖에서는 보통 경로.
ROOT="$(cd "$(dirname "$0")/../.." && { pwd -W 2>/dev/null || pwd; })"
COPY="$1"
OUT="$ROOT/qa/results/final/F-A99-break-events.txt"
rm -rf "$COPY"; mkdir -p "$COPY"
cd "$ROOT" || exit 1
cp -r src scripts docs tsconfig.json tsconfig.node.json package.json package-lock.json node-globals.d.ts vite.config.ts index.html "$COPY"/
powershell -NoProfile -Command "New-Item -ItemType Junction -Path '$COPY/node_modules' -Target '$ROOT/node_modules' | Out-Null"
cd "$COPY" || exit 1
: > "$OUT"
say() { echo "$@" | tee -a "$OUT"; }
ev() { npx vite-node scripts/validateEvents.ts > "$COPY/out.txt" 2>&1; echo "exit=$?" >> "$COPY/out.txt"; tail -4 "$COPY/out.txt" | tee -a "$OUT"; }
say "== 0) 복사본 그대로 (기대: 통과, exit=0)"
ev
say "== 1) JSON 문법 깨기: school.json 첫 '{' 뒤 쉼표 삭제 흉내 (기대: 실패 exit!=0)"
cp src/data/events/school.json school.json.bak
node -e "const fs=require('fs');const p='src/data/events/school.json';let s=fs.readFileSync(p,'utf8');s=s.replace('\"events\": [','\"events\" [');fs.writeFileSync(p,s)"
ev
cp school.json.bak src/data/events/school.json
say "== 2) 느낌표 넣기: infant.json 이벤트 본문에 ! 추가 (기대: 실패)"
cp src/data/events/infant.json infant.json.bak
node -e "const fs=require('fs');const p='src/data/events/infant.json';let s=fs.readFileSync(p,'utf8');s=s.replace('첫 말에','첫 말에!');const j=JSON.parse(s);j.events[0].text=j.events[0].text+'!';fs.writeFileSync(p,JSON.stringify(j,null,2))"
ev
say "== 2b) npm run build 도 같은 상태에서 실패하고 dist가 만들어지지 않아야 한다"
rm -rf dist
npm run build > "$COPY/build.txt" 2>&1; echo "build exit=$?" | tee -a "$OUT"; tail -3 "$COPY/build.txt" | tee -a "$OUT"
[ -d dist ] && say "dist 생김(결함)" || say "dist 없음(정상)"
cp infant.json.bak src/data/events/infant.json
say "== 3) 선택지 1개로 줄이기(스키마 위반): middle.json 첫 선택지 이벤트 (기대: 실패)"
cp src/data/events/middle.json middle.json.bak
node -e "const fs=require('fs');const p='src/data/events/middle.json';const j=JSON.parse(fs.readFileSync(p,'utf8'));const e=j.events.find(x=>x.choices);e.choices=e.choices.slice(0,1);fs.writeFileSync(p,JSON.stringify(j,null,2))"
ev
cp middle.json.bak src/data/events/middle.json
say "== 4) 존재하지 않는 시대 id 넣기: youth.json (기대: 실패)"
cp src/data/events/youth.json youth.json.bak
node -e "const fs=require('fs');const p='src/data/events/youth.json';const j=JSON.parse(fs.readFileSync(p,'utf8'));j.events[0].eras=['mars'];fs.writeFileSync(p,JSON.stringify(j,null,2))"
ev
cp youth.json.bak src/data/events/youth.json
say "== 5) 원복 확인: 복사본이 원본과 같아졌는가 (기대: 통과, 바이트 동일)"
ev
for f in infant school youth middle senior; do cmp "src/data/events/$f.json" "$ROOT/src/data/events/$f.json" && say "$f.json 복사본 = 원본(바이트 동일)"; done
