import { mkdirSync, writeFileSync } from 'node:fs';
import '../src/data/installAll';
import { autoResolveStep, eventPool, familyScheduleOf, playToEnd, serializeGame, stepYear, type GameState, type ProfileId } from '../src/core';
import { startLife } from './simulateLib';

/**
 * v0.4.0 저장 원문 고정 파일 만들기 (SPEC-011 DS4, 완료 기준 22): 도장 주어를 **그릴 때** 정하므로(`HistoryEntry.by`만 저장된다) v0.4.0이 낸 실제 저장 원문을 열어 어린 시절 줄이 그 줄의 나이로 바르게 그려지는지 본다.
 * **v0.4.0 빌드로 돌려야 한다.** 이 파일을 만들 때(2026-11-07) 저장소의 `src/`는 태그 `v0.4.0`(6aadd90)과 바이트까지 같았다(`git diff 6aadd90 HEAD --stat -- src` 출력 없음, 작업 사본 HEAD 9c40d26 · src 수정 전) —
 * 그래서 이 스크립트를 SPEC-011 코드를 넣기 **전에** 그 상태로 돌린 출력이 v0.4.0의 `serializeGame` 원문이다. 한 번 만들어 고정한다(다시 돌리면 AK 코드가 낸 판이 섞이므로 돌리지 않는다 — 시드·시대는 아래 상수).
 * 만든 파일 셋 (tests/fixtures/, 시험은 tests/parentSubjectStorage.test.ts):
 *   - save-v040-both-age20.json      — 20세까지 두 분 함께(이혼·별세 없음), 살아 있는 판
 *   - save-v040-mother-age20.json    — 아버지가 일찍 따로 사는 판(이혼 계획 leaver 1): 이혼이 난 해까지 두 분, 그 뒤 어머니만. 20세, 살아 있는 판
 *   - save-v040-father-ended.json    — 어머니가 일찍 별세하는 판(firstGone who 0): 그 해(줄이 그 나이에 있다)까지 두 분, 그 뒤 아버지만. 끝까지 살아 엔딩 상태, `parents_gone`이 켜진 판(아버지 별세 사건 뒤)
 * 사용: ./node_modules/.bin/vite-node scripts/genSaveFixtures040.ts [출력 폴더, 기본 tests/fixtures]
 */
const OUT = process.argv[2] ?? 'tests/fixtures';
/** 시대(세대): 이혼은 X세대에서 드물어(1195판 중 아버지가 3~8세에 떠나는 판 5) Z세대로 한다(50판) */
const ERA_OF: Record<'both' | 'mother' | 'father', ProfileId> = { both: 'genx', mother: 'genz', father: 'genx' };

/** 지정한 나이(선택지 대기 없이)에 닿을 때까지 자동 선택으로 돌린다. 그 전에 끝나면 null */
function advanceTo(start: GameState, age: number): GameState | null {
  let s = start;
  for (let i = 0; i < 5000 && s.phase === 'life' && !(s.age === age && s.pending === null); i++) {
    const r = s.pending !== null ? autoResolveStep(s, s.pending.key, eventPool()) : stepYear(s, eventPool());
    s = r.state;
  }
  return s.phase === 'life' && s.age === age ? s : null;
}

const parentLines = (s: GameState): number[] => s.history.filter((h) => h.kind === 'choice' && h.by === 'parent').map((h) => h.age);

mkdirSync(OUT, { recursive: true });
const found: Record<string, number> = {};

for (let seed = 5; seed < 6000 && Object.keys(found).length < 3; seed++) {
  if (found.both === undefined) {
    const s0 = startLife(seed, ERA_OF.both);
    const { firstGone, divorce } = familyScheduleOf(s0);
    if (divorce === null && (firstGone === null || firstGone.at >= 19)) {
      const s20 = advanceTo(s0, 20);
      if (s20 !== null && parentLines(s20).length >= 3) {
        writeFileSync(`${OUT}/save-v040-both-age20.json`, serializeGame(s20) + '\n', 'utf-8');
        found.both = seed;
        console.log(`both: ${ERA_OF.both} seed ${seed} · 부모 결정 줄 나이 ${JSON.stringify(parentLines(s20))}`);
      }
    }
  }

  if (found.mother === undefined) {
    const s0 = startLife(seed, ERA_OF.mother);
    const { firstGone, divorce } = familyScheduleOf(s0);
    if (divorce !== null && divorce.leaver === 1 && divorce.at >= 3 && divorce.at <= 8 && (firstGone === null || firstGone.at >= 19)) {
      const s20 = advanceTo(s0, 20);
      const ages = s20 === null ? [] : parentLines(s20);
      if (s20 !== null && ages.some((a) => a < divorce.at) && ages.includes(divorce.at) && ages.some((a) => a > divorce.at)) {
        writeFileSync(`${OUT}/save-v040-mother-age20.json`, serializeGame(s20) + '\n', 'utf-8');
        found.mother = seed;
        console.log(`mother: ${ERA_OF.mother} seed ${seed} · 이혼 ${divorce.at}세(떠난 쪽 아버지) · 부모 결정 줄 나이 ${JSON.stringify(ages)}`);
      }
    }
  }

  if (found.father === undefined) {
    const s0 = startLife(seed, ERA_OF.father);
    const { firstGone, divorce } = familyScheduleOf(s0);
    if (firstGone !== null && firstGone.who === 0 && firstGone.at >= 3 && firstGone.at <= 8 && divorce === null) {
      const ended = playToEnd(s0, null).state;
      const ages = parentLines(ended);
      if (ended.phase === 'ending' && ended.flags.includes('parents_gone') && ages.some((a) => a < firstGone.at) && ages.includes(firstGone.at) && ages.some((a) => a > firstGone.at)) {
        writeFileSync(`${OUT}/save-v040-father-ended.json`, serializeGame(ended) + '\n', 'utf-8');
        found.father = seed;
        console.log(`father: ${ERA_OF.father} seed ${seed} · 어머니 별세 ${firstGone.at}세 · 부모 결정 줄 나이 ${JSON.stringify(ages)} · 사망 ${ended.death?.age}세`);
      }
    }
  }
}
for (const key of ['both', 'mother', 'father']) if (found[key] === undefined) throw new Error(`${key}: 맞는 시드를 찾지 못했다`);
