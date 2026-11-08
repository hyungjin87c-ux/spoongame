import { describe, expect, it } from 'vitest';
import golden from './fixtures/scene-golden.json';
import { ALL_ERA_WINDOWS, ERA_GOLDEN_BANDS, ERA_GOLDEN_BIRTHS, ERA_GOLDEN_SEEDS, SCENE_ADULT_RULE, SCENE_ADULT_SCENARIOS, SCENE_ADULT_SEEDS, SCENE_GOLDEN_AGES, SCENE_GOLDEN_SEEDS, eraGolden, sceneAdultGolden, sceneAdultScenarioText, sceneGolden } from './helpers/sceneGolden';
import { readRepoText } from './helpers/repoFiles';
import { GENERATION_IDS } from '../src/core';

/**
 * 집 그림(`sceneOf`)과 시대의 창(`eraOf`)의 고정 시드 골든 (SPEC-009 FM5b, 검수 R-546). 골든은 `scripts/sceneGolden.ts`(`npm run golden:scene -- --write`)가 만든다 — 규칙·표·승인된 데이터를 **일부러** 바꿀 때만 다시 만들고
 * 바뀐 글을 눈으로 확인한다. 이 시험이 깨졌다면 의도한 변경인지 먼저 본다(예: 소품 개수·집 크기 규칙, 시대의 창 고르기·데이터).
 * **FM4b 갱신(2026-10-28)**: 골든을 다시 만들었다. 사유 둘 — ① 집 종류·방 수가 출생 때 정한 값(`family.h`, 묶음 B)으로 채워져 장면 칸 104개의 집 모양·크기가 표의 모양대로 달라졌다(이전: 점유 형태 기본 모양)
 * ② 가리기를 켠 1987년의 대체 그림이 12월 투표소가 되었다(FM5b 마스터 결정) — 시대의 창 칸 중 1987년 가리기 칸만 달라졌다.
 * **FM4b 검수 1회차 반영 갱신(2026-11-02, R-557·R-558·R-565)**: 장면 189칸 중 4칸(식구 수·열쇠 해시)을 다시 만들었다 — 조부모 별세 해·함께 사는 쪽·동생 구성이 달라져 그 나이의 식구 수가 달라진 칸이다(ai-log/2026-11-02_SPEC-009_dev-FM4b-r2.md 2절).
 * **시대의 창 r5 반영 갱신(2026-11-02)**: ① 장면 189칸 중 2칸(`boomer/1000041/9` · `g86/2000081/4`)의 집이 `house-detached-h2`에서 지붕이 초가인 `house-detached-h1×0.86`으로 바뀌었다 — 초가 규칙(단독 · 시골/해안 · 재력 ≤ 2 · ~1975, era-window.md 9-4절 ③)이 1970~75에도 h1을 쓰게 했다. 나머지 187칸은 그대로다. ② 시대의 창 72행은 그림 번호표가 43장 → 94장이라 번호가 모두 새로 매겨졌다. 번호를 id로 풀어 견주면 1990년 앞 해(1940~1989)의 그림·가림 표시는 바뀌지 않았고, 바뀐 칸은 모두 1990년 이후 해다(ai-log/2026-11-02_SPEC-009_dev-era-r5.md 3절).
 * **FM6 갱신(2026-11-02)**: 장면 189칸 중 76칸의 열쇠 해시를 다시 만들었다(시대의 창 72행은 그대로). 사유 하나 — 「가진 것」(FK2)과 묶인 소품(`prop-antenna`·`prop-ac-unit`·`prop-car`·`prop-ev-charger`)이 이제 그려진다:
 * `sceneInputOf`가 `possessionTiesOf`(집의 순위와 항목 보급률)를 기본으로 읽는다. 일찍 텔레비전·에어컨·승용차를 들인 집에만 나오므로 0~85세 모든 나이에서 칸이 바뀐다 — 달라진 칸은 앞 소품 73 · 뒤+앞 소품 3이고
 * 집 종류·배경·식구 수·반려동물은 한 칸도 달라지지 않았다(골든 판은 플래그가 없어 배우자·자녀 경로는 `tests/familyCard.test.ts`·`sceneFamily.test.ts`가 본다).
 * **FM7a 갱신(2026-11-06)**: 장면 189칸 중 3칸(`boomer/1000041/9·15·22`)의 식구 수가 하나씩 줄었다(8→7 · 8→7 · 6→5) — 사유 하나: 어린 형제의 이른 별세(Q3, `familyBirth.ts#siblingLossPlan`, 형진 님 승인·배율 1.0)가
 * 이 판의 아래 동생 `y1`(주인공 2세에 태어남)을 4살에 떠나게 해(주인공 6세의 해, 보기에서는 7세부터 떠난 사람) 그 뒤 나이의 「함께 사는 사람」에서 빠졌다. 같은 변경의 R-618(별세·이혼 하한 1세)·R-586(자녀 독립 나이)은
 * 이 골든 21판의 칸을 바꾸지 않았다(골든 판은 플래그가 없어 자녀 경로는 `tests/familyCard.test.ts`·`sceneFamily.test.ts`가 본다). 시대의 창 72행은 그대로다. 나머지 186칸은 열쇠 해시까지 같다.
 * **L0F 보강(2026-11-06, SPEC-009 K6 직전)**: 파일 끝에 새 묶음 `sceneAdult` 98칸을 **더했다** — 혼인·자녀·이혼 플래그와 본 사건의 나이를 고정한 판(7세대 × 2시드 × 시나리오 4 × 나이 1~3)의 집 그림이다. 위 `scene` 189칸·`era` 72행은 한 글자도 바뀌지 않았다
 * (git diff가 더한 줄뿐임을 보였다). 이유: 골든 판은 플래그가 없어 배우자·자녀 그림이 골든 밖이었다(REV-009-FM6-1 3절). 칸 값에는 그림에 나온 식구 id(`spouse,c1,c2` …)와 바뀐 종류가 더 들어 있다.
 * **SPEC-012 QF3 갱신(2026-11-08, v0.4.1 — 시대의 창 나이 규칙)**: `era` 72행 중 **66행**(251해 칸 — 처음 17줄판은 62행·241칸, 리뷰 뒤 부록 A 두 줄(1948 투표 21세 · 떡볶이집 7세)로 +4행·+10칸)을 다시 만들었다. 사유 하나 — 시대의 창이 나이를 지킨다: ① 사건도 `ages`를 지킨다 ② 일상의 옛 4단계(나이를 풀어서 그 10년의 아무 일상)를 없앴다
 * ③ 개인 행동 줄 18개에 최소 나이(`ages`)를 달았다(`scripts/genEraWindows.ts#AGES_FIX`, 부록 A 「A 표」: 7·13·20·21세). 그래서 어린 나이(0~6세)나 어른(30세 이상)의 해에 나이에 안 맞는 줄이 올라오던 칸이 다른 그림이나 빈 틀(00)로 바뀌었다.
 * 달라진 해(칸)는 10년대별 1940년대 48 · 1970년대 46 · 1980년대 21 · 1990년대 92 · 2000년대 44이고(1950·1960·2010·2020년대 0) 해로는 1945~49 · 1970~73 · 1977~81 · 1984 · 1989 · 1992~96 · 2000 · 2001 · 2003 · 2007~2009다(ai-log/2026-11-08_SPEC-012_dev.md).
 * 시대 줄·창은 저장하지 않는 파생값이라 Two-way다. **`scene` 189칸·`sceneAdult` 98칸·가족 골든(L0F)은 한 글자도 바뀌지 않았다**(git diff는 `era` 행뿐). 같은 변경의 QF2(2027년 이후 한 판에 한 번)는 이 골든(출생~2025, 94장)에 닿지 않는다 —
 * QF2를 끈 채로 돌려도 달라진 칸이 같은 66개였다. 2027년 이후는 `tests/eraFuture.test.ts`가 잰다.
 *
 * 갱신 규칙(One-way) — 파일의 `noteAdult`와 같은 말: `sceneAdult`를 공개 배포(K6) 뒤에 다시 만드는 것은 이어하던 판의 배우자·자녀 그림이 바뀌는 One-way 변경이다 — 배우자·자녀는 저장하지 않고 플래그·`seen`·표에서 다시 계산하기 때문이다(`adultSlotsOf`).
 * 그래서 **마스터 승인과 형진 님 확인**이 필요하고, 성인 식구 표(이름 풀·`design.adult`·`NAME_KEY`·성인 플래그를 켜는 사건)를 바꿀 때는 「로드 때 `family.ad` 스냅샷」을 먼저 한 번 배포한다(SPEC-009 FS2 예외 ③).
 * 다시 만드는 명령은 `npm run golden:scene -- --write` 한 곳이다(`--write` 없이 돌리면 쓰지 않고 달라진 칸만 알려 준다 — L0F에서 `golden:family`와 같은 규칙으로 맞췄다). 쓰면 이 파일 전체를 다시 쓰므로 기존 `scene`·`era` 칸이 바뀌지 않았는지 git diff로 본다. **이 시험은 골든을 절대 쓰지 않는다.** 짝이 되는 시험은 `tests/familyGolden.test.ts`(가족 값 · `adultSlotsOf`).
 */
describe('고정 시드 골든 — 집 그림 sceneOf (7세대 × 3시드 × 9나이)', () => {
  const now = sceneGolden();
  it('골든이 정한 칸(세대·시드·나이)과 지금 시험이 도는 칸이 같다', () => {
    expect(golden.sceneSeeds).toBe(SCENE_GOLDEN_SEEDS);
    expect(golden.sceneAges).toEqual([...SCENE_GOLDEN_AGES]);
    expect(Object.keys(now).sort()).toEqual(Object.keys(golden.scene).sort());
    expect(Object.keys(now).length).toBe(7 * SCENE_GOLDEN_SEEDS * SCENE_GOLDEN_AGES.length);
  });
  it('모든 칸의 배경·집(크기·지붕)·식구 수·소품·반려동물·열쇠 해시가 골든과 같다', () => {
    const diff = Object.entries(golden.scene).filter(([k, v]) => now[k] !== v).map(([k, v]) => `${k}\n  골든 ${v}\n  지금 ${now[k]}`);
    expect(diff.slice(0, 5), `달라진 칸 ${diff.length}개 — 의도한 변경이면 npm run golden:scene -- --write`).toEqual([]);
  });
});

describe('고정 시드 골든 — 시대의 창 eraOf (시드 2 × 수저 구간 3 × 가리기 2 × 출생 6, 출생~2025)', () => {
  const now = eraGolden();
  it('골든이 정한 칸과 같고, 그림 번호표(승인된 94장)가 같다', () => {
    expect(golden.eraSeeds).toEqual([...ERA_GOLDEN_SEEDS]);
    expect(golden.eraBands).toEqual([...ERA_GOLDEN_BANDS]);
    expect(golden.eraBirths).toEqual([...ERA_GOLDEN_BIRTHS]);
    expect(ALL_ERA_WINDOWS.length).toBe(94);
    expect(now.ids).toEqual(golden.eraIds);
    expect(Object.keys(now.rows).sort()).toEqual(Object.keys(golden.era).sort());
  });
  it('모든 칸의 해마다 그림·가림 표시가 골든과 같다', () => {
    const diff = Object.entries(golden.era).filter(([k, v]) => now.rows[k] !== v).map(([k]) => k);
    expect(diff, '달라진 칸 — 의도한 변경이면 npm run golden:scene -- --write').toEqual([]);
  });
  it('골든 자체가 공허하지 않다: 그림이 있는 해가 많고, 가리기 칸에는 가려진 해가 있으며, 안 가리는 칸에는 없다', () => {
    const rows = Object.entries(golden.era);
    for (const [k, line] of rows) {
      const pics = (line.match(/\d\d[.v]/g) ?? []).filter((c) => c.slice(0, 2) !== '00').length;
      // 승인된 그림이 1940~2025 모든 해에 닿으므로(94장) 어느 출생이든 그림이 있는 해가 있어야 한다 — 2003년생도 (2003~2025)
      expect(pics, k).toBeGreaterThan(0);
      if (k.includes('/plain/')) expect(line.includes('v'), k).toBe(false);
    }
    expect(rows.filter(([k, line]) => k.includes('/gentle/') && k.endsWith('/1944') && line.includes('v')).length).toBeGreaterThan(0);
  });
});

describe('L0F 보강 — 성인 플래그를 켠 판의 집 그림 sceneAdult (7세대 × 2시드 × 시나리오 4 × 나이 1~3)', () => {
  const now = sceneAdultGolden();
  const cells = Object.entries(golden.sceneAdult as Record<string, string>);
  const membersOf = (line: string): string[] => line.split('|')[7].split(',').filter((m) => m !== '');

  it('골든이 정한 칸(세대·시드·시나리오·나이)과 지금 시험이 도는 칸이 같다', () => {
    expect(golden.sceneAdultSeeds).toBe(SCENE_ADULT_SEEDS);
    expect(golden.sceneAdultScenarios).toEqual(SCENE_ADULT_SCENARIOS.map(sceneAdultScenarioText));
    expect(Object.keys(now).sort()).toEqual(Object.keys(golden.sceneAdult).sort());
    expect(Object.keys(now).length).toBe(7 * SCENE_ADULT_SEEDS * SCENE_ADULT_SCENARIOS.reduce((n, s) => n + s.ages.length, 0));
  });

  it('모든 칸의 배경·집·식구 수·소품·열쇠 해시·그림에 나온 식구·바뀐 종류가 골든과 같다', () => {
    const diff = cells.filter(([k, v]) => now[k] !== v).map(([k, v]) => `${k}\n  골든 ${v}\n  지금 ${now[k]}`);
    expect(diff.slice(0, 5), `달라진 칸 ${diff.length}개 — 의도한 변경이면 마스터 승인·형진 님 확인 뒤 npm run golden:scene -- --write (공개 뒤라면 One-way — 이 파일 머리 주석의 갱신 규칙)`).toEqual([]);
  });

  it('골든 자체가 공허하지 않다: 배우자만·배우자와 자녀·자녀만(이혼) 그림이 모두 있고, 자녀 셋이 함께 나오는 칸과 자녀가 독립해 줄어든 칸이 있다', () => {
    const bySc = (id: string): string[][] => cells.filter(([k]) => k.split('/')[2] === id).map(([, v]) => membersOf(v));
    expect(bySc('couple').every((m) => m.join() === 'spouse'), '혼인만: 배우자 한 명').toBe(true);
    expect(bySc('family').some((m) => m.includes('spouse') && m.includes('c1')), '혼인 + 자녀').toBe(true);
    expect(bySc('late').some((m) => m.includes('spouse') && m.includes('c1')), '미룬 자녀').toBe(true);
    expect(bySc('ex').every((m) => !m.includes('spouse')), '이혼: 배우자는 따로 살아 그림에 없다').toBe(true);
    expect(bySc('ex').some((m) => m.includes('c1')), '이혼 뒤에도 자녀는 함께 산다').toBe(true);
    expect(cells.some(([, v]) => membersOf(v).filter((m) => /^c\d$/.test(m)).length >= 3), '자녀 셋이 한 그림에').toBe(true);
    // 같은 판·시나리오에서 나이가 들면 자녀가 독립해 그림의 자녀가 줄어든다(55세 칸이 40세 칸보다 자녀가 적은 판)
    const kids = (gen: string, seed: string, age: number): number => membersOf(golden.sceneAdult[`${gen}/${seed}/family/${age}` as keyof typeof golden.sceneAdult] as string).filter((m) => /^c\d$/.test(m)).length;
    const seedsOf = [...new Set(cells.map(([k]) => k.split('/').slice(0, 2).join('/')))];
    expect(seedsOf.some((gs) => kids(gs.split('/')[0], gs.split('/')[1], 55) < kids(gs.split('/')[0], gs.split('/')[1], 40)), '자녀 독립으로 줄어든 판').toBe(true);
    for (const gen of GENERATION_IDS) expect(cells.some(([k]) => k.startsWith(`${gen}/`)), gen).toBe(true);
    // 값이 칸마다 다르다(한 칸이 복사된 골든이 아니다): 열쇠 해시가 서로 다른 칸이 많다
    expect(new Set(cells.map(([, v]) => v.split('|')[6])).size).toBeGreaterThan(cells.length / 2);
  });

  it('이 묶음의 갱신 규칙이 파일 머리(noteAdult)와 이 시험 머리 주석에 있다 — One-way · 마스터 승인 · 형진 님 · family.ad 스냅샷 · 명령 한 곳', () => {
    expect(golden.noteAdult).toBe(SCENE_ADULT_RULE);
    // 이 시험의 단언 줄(아래 배열)에도 같은 글이 있어 파일 전체를 보면 늘 통과한다 — 첫 블록 주석(머리 주석)만 본다
    const source = readRepoText('tests/sceneGolden.test.ts') ?? '';
    const self = source.slice(source.indexOf('/**'), source.indexOf('*/') + 2);
    expect(self.length, '머리 주석을 읽었다(공허 통과 방지)').toBeGreaterThan(1000);
    for (const phrase of ['One-way', '마스터 승인', '형진 님', 'family.ad', '로드 때', 'npm run golden:scene -- --write', '쓰지 않는다']) {
      expect(golden.noteAdult, phrase).toContain(phrase);
      expect(self, `시험 머리 주석: ${phrase}`).toContain(phrase);
    }
  });

  it('다시 만드는 명령은 한 곳(package.json의 golden:scene)뿐이고, 시험·helper는 파일을 쓰지 않으며, 스크립트는 --write가 있어야만 쓴다 (golden:family와 같은 규칙)', () => {
    const pkg = JSON.parse(readRepoText('package.json') ?? '{"scripts":{}}') as { scripts: Record<string, string> };
    expect(pkg.scripts['golden:scene']).toMatch(/sceneGolden/);
    // 글자 그대로 적으면 이 줄이 스스로 걸리므로 조각을 이어 만든다
    const writers = ['write' + 'File', 'append' + 'File', 'create' + 'WriteStream', 'rm' + 'Sync', 'unlink' + 'Sync'].map((w) => new RegExp(String.raw`\b${w}`));
    const sources = import.meta.glob(['./helpers/sceneGolden.ts', '../scripts/sceneGolden.ts'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
    for (const [name, text] of [['시험', readRepoText('tests/sceneGolden.test.ts') ?? ''], ['helper', sources['./helpers/sceneGolden.ts'] ?? '']] as const) {
      expect(text.length, `${name}를 읽었다(공허 통과 방지)`).toBeGreaterThan(1000);
      for (const re of writers) expect(text, `${name}에 ${re.source}`).not.toMatch(re);
    }
    const script = sources['../scripts/sceneGolden.ts'] ?? '';
    expect(script.length, '스크립트를 읽었다').toBeGreaterThan(1000);
    expect(script).toMatch(/args\.includes\('--write'\)/);
    expect(script.match(new RegExp('write' + String.raw`FileSync\(`, 'g')), '쓰는 줄은 --write 판 안에 하나뿐이다').toHaveLength(1);
    expect(script, '그 줄은 --write 판의 첫 줄이다').toMatch(new RegExp(String.raw`if \(args\.includes\('--write'\)\) \{\s*` + 'write' + String.raw`FileSync\(`));
  });
});
