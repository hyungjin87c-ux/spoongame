import { writeFileSync } from 'node:fs';
import '../src/data/installAll';
import { SCHEMA_VERSION, autoResolveStep, eventPool, stepYear, type GameState } from '../src/core';
import { startLife } from './simulateLib';

/**
 * 가족 모델 이전(v0.3.0) 저장 원문 고정 파일 만들기 (SPEC-009 FM4a, docs/data/family-model.md 2-4절·12-3절 ⑤).
 * 이전 빌드가 쓰는 저장 모양은 지금 모양에서 `family` 필드만 뺀 것이다(그 밖의 코드 경로는 해시 불변 시험이 같음을 잠근다) — 그래서 지금 코드로 판을 0·20·65세까지 돌린 뒤 `family`를 지워 봉투에 싼다.
 * 한 번 만들어 `tests/fixtures/save-v030-age{0,20,65}.json`으로 고정한다 — 다시 만들 일이 없다(시험이 새 빌드가 이 원문을 열어 같은 판이 이어지는지 본다).
 * 실행: ./node_modules/.bin/vite-node scripts/genSaveFixtures.ts
 */
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
for (let seed = 5; seed < 200; seed++) {
  const s0 = startLife(seed, 'genx');
  const s20 = advanceTo(s0, 20);
  const s65 = s20 === null ? null : advanceTo(s20, 65);
  if (s20 === null || s65 === null) continue;
  for (const [age, s] of [[0, s0], [20, s20], [65, s65]] as const) {
    const { family: _drop, ...old } = s as GameState & { family?: unknown };
    void _drop;
    writeFileSync(`tests/fixtures/save-v030-age${age}.json`, JSON.stringify({ version: SCHEMA_VERSION, data: old }) + '\n', 'utf-8');
    console.log(`seed ${seed} age ${age}: phase ${s.phase}, flags ${s.flags.length}, history ${s.history.length}, seen ${Object.keys(s.seen).length}`);
  }
  break;
}
