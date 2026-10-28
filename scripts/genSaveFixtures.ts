import { mkdirSync, writeFileSync } from 'node:fs';
import '../src/data/installAll';
import { autoResolveStep, eventPool, serializeGame, stepYear, type GameState } from '../src/core';
import { startLife } from './simulateLib';

/**
 * v0.3.0 저장 원문 고정 파일 만들기 (SPEC-009 FM4a, docs/data/family-model.md 2-4절·12-3절 ⑤, R-531).
 * **반드시 v0.3.0 빌드(태그 `v0.3.0`, 커밋 50e524c8135b3344d7cbf48434c0e1162f6dba11)의 worktree에서 돌린다** — 그 빌드의 core로 genx 판을 0·20·65세까지 돌리고 **그 빌드의 `serializeGame` 원문**을 그대로 쓴다.
 * (지금 코드로 돌리면 `family`가 든 저장이 나오므로 아래 검사가 막는다.)
 *  1) git worktree add --detach <저장소 밖 경로> v0.3.0
 *  2) 그 worktree에 이 파일을 scripts/genSaveFixtures.ts로 복사하고 `npm ci --ignore-scripts` (lockfile 그대로, 맨 npx 금지)
 *  3) ./node_modules/.bin/vite-node scripts/genSaveFixtures.ts <출력 폴더>   (기본 tests/fixtures) → 만든 save-v030-age{0,20,65}.json을 이 저장소의 tests/fixtures/로 복사
 *  4) git worktree remove <경로>
 * 사용한 커밋: 50e524c (v0.3.0). 한 번 만들어 고정한다 — 시험(`tests/familyStorage.test.ts`)이 지금 빌드가 이 원문을 열어 같은 판이 이어지는지 본다.
 */
const OUT = process.argv[2] ?? 'tests/fixtures';

/** 지정한 나이(선택지 대기 없이)에 닿을 때까지 돌린다. 그 전에 끝나면 null */
function advanceTo(start: GameState, age: number): GameState | null {
  let s = start;
  for (let i = 0; i < 5000 && s.phase === 'life' && !(s.age === age && s.pending === null); i++) {
    const r = s.pending !== null ? autoResolveStep(s, s.pending.key, eventPool()) : stepYear(s, eventPool());
    s = r.state;
  }
  return s.phase === 'life' && s.age === age ? s : null;
}

/** 65세까지 사는 판을 찾는다: 시드를 올려 가며 0 → 20 → 65세 상태를 한 판에서 얻는다 */
mkdirSync(OUT, { recursive: true });
for (let seed = 5; seed < 200; seed++) {
  const s0 = startLife(seed, 'genx');
  const s20 = advanceTo(s0, 20);
  const s65 = s20 === null ? null : advanceTo(s20, 65);
  if (s20 === null || s65 === null) continue;
  for (const [age, s] of [[0, s0], [20, s20], [65, s65]] as const) {
    if ('family' in s) throw new Error('이 빌드는 family를 만든다 — v0.3.0(50e524c) worktree에서 돌려야 한다');
    writeFileSync(`${OUT}/save-v030-age${age}.json`, serializeGame(s) + '\n', 'utf-8');
    console.log(`seed ${seed} age ${age}: phase ${s.phase}, flags ${s.flags.length}, history ${s.history.length}, seen ${Object.keys(s.seen).length}`);
  }
  break;
}
