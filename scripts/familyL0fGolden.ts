import '../src/data/installAll';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { GENERATION_IDS, familyScheduleOf } from '../src/core';
import { L0F_REQUIRED_TAGS, bornGame, l0fGolden, serializeL0f, tagsOf, type L0fGolden } from '../tests/helpers/familyL0f';

/**
 * L0F 가족 골든 만들기 (SPEC-009 K6 직전, FS2 예외 ①): `tests/fixtures/family-golden.json`을 쓰는 **유일한 곳**이다 — 시험은 이 파일을 쓰지 않는다.
 *
 *   npm run golden:family                 지금 코드의 값과 골든을 견주어 달라진 칸만 알려 준다(쓰지 않는다 · 달라졌으면 종료 코드 1)
 *   npm run golden:family -- --write      골든을 지금 코드의 값으로 다시 쓴다
 *   npm run golden:family -- --scan [N]   가지(이혼·형제 별세·이른 부모 별세 …)를 지나는 시드를 세대마다 시드 1~N(기본 3000)에서 찾아 후보만 보여 준다(쓰지 않는다)
 *
 * **공개 배포(K6) 뒤에 --write는 이어하던 판의 가족이 바뀌는 One-way 변경이다** — 마스터 승인과 형진 님 확인 뒤에만, 성인 식구 표를 바꿀 때는 「로드 때 family.ad 스냅샷」을 먼저 배포한 뒤에만 쓴다(갱신 규칙 전문은 골든 파일 머리 `updateRule`).
 */
const PATH = 'tests/fixtures/family-golden.json';
const args = process.argv.slice(2);

function scan(max: number): void {
  console.log(`가지 후보 찾기: 세대마다 시드 1~${max} — 가지마다 세대별 첫 두 시드 (L0F_FEATURE_SEEDS에 손으로 옮긴다)`);
  const hits = new Map<string, Map<string, number[]>>();
  for (const gen of GENERATION_IDS) {
    for (let seed = 1; seed <= max; seed++) {
      const s = familyScheduleOf(bornGame(seed, gen));
      for (const tag of tagsOf(s.family, s)) {
        const byGen = hits.get(tag) ?? new Map<string, number[]>();
        const list = byGen.get(gen) ?? [];
        if (list.length < 2) list.push(seed);
        byGen.set(gen, list);
        hits.set(tag, byGen);
      }
    }
  }
  for (const tag of Object.keys(L0F_REQUIRED_TAGS)) {
    const byGen = hits.get(tag);
    console.log(`${tag} (${L0F_REQUIRED_TAGS[tag]}): ${byGen === undefined ? '— 찾지 못함' : [...byGen].map(([gen, seeds]) => `${gen} ${seeds.join(',')}`).join(' · ')}`);
  }
}

/** 칸 이름 → 글(비교용) */
function flat(g: L0fGolden): Map<string, string> {
  const m = new Map<string, string>();
  for (const [k, v] of Object.entries(g.wiring)) m.set(`wiring/${k}`, v.join(','));
  for (const [k, v] of Object.entries(g.tables.constants)) m.set(`tables/constants/${k}`, JSON.stringify(v));
  for (const [k, v] of Object.entries(g.tables.fingerprints)) m.set(`tables/fingerprints/${k}`, v);
  g.tables.namePools.forEach((v, i) => m.set(`tables/namePools/${i}`, v));
  for (const [k, c] of Object.entries(g.births)) {
    m.set(`births/${k}/head`, c.head);
    m.set(`births/${k}/family`, JSON.stringify(c.family));
    m.set(`births/${k}/plan`, c.plan);
    c.view.forEach((line, i) => m.set(`births/${k}/view${i}`, line));
  }
  for (const [k, row] of Object.entries(g.adult)) for (const [sc, line] of Object.entries(row)) m.set(`adult/${k}/${sc}`, line);
  return m;
}

if (args.includes('--scan')) {
  const n = Number(args[args.indexOf('--scan') + 1]);
  scan(Number.isInteger(n) && n > 0 ? n : 3000);
  process.exit(0);
}

const next = l0fGolden();
const text = serializeL0f(next);
const current = existsSync(PATH) ? readFileSync(PATH, 'utf-8') : null;
if (current === text) {
  console.log('골든과 지금 코드의 값이 같다 — 달라진 칸 없음');
  process.exit(0);
}
if (args.includes('--write')) {
  writeFileSync(PATH, text, 'utf-8');
  console.log(`family-golden.json을 다시 썼다 (${new TextEncoder().encode(text).length} B): 가족 값 ${Object.keys(next.births).length}판 · 성인기 식구 ${Object.keys(next.adult).length}판 × ${Object.keys(Object.values(next.adult)[0] ?? {}).length}가지 · 배선 ${Object.keys(next.wiring).length}줄`);
  console.log('주의: 공개 배포 뒤라면 이어하던 판의 가족이 바뀌는 One-way 변경이다 — 마스터 승인·형진 님 확인이 있었는가?');
  process.exit(0);
}
// 쓰지 않는다: 달라진 칸만 알려 준다
let before: L0fGolden | null = null;
try {
  before = current === null ? null : (JSON.parse(current) as L0fGolden);
} catch {
  before = null;
}
if (before === null) {
  console.error('골든 파일이 없거나 읽을 수 없다. 처음 만드는 것이라면 --write.');
} else {
  const a = flat(before);
  const b = flat(next);
  const keys = [...new Set([...a.keys(), ...b.keys()])];
  const diff = keys.filter((k) => a.get(k) !== b.get(k));
  console.error(`달라진 칸 ${diff.length}개 (전체 ${keys.length}칸) — 앞 20개:`);
  for (const k of diff.slice(0, 20)) console.error(`  ${k}\n    골든 ${a.get(k) ?? '(없음)'}\n    지금 ${b.get(k) ?? '(없음)'}`);
  if (diff.length === 0) console.error('칸 값은 같고 파일의 글(머리·표본 설명·줄 모양)만 다르다.');
}
console.error('쓰지 않았다. 의도한 변경이고 승인을 받았다면: npm run golden:family -- --write');
process.exit(1);
