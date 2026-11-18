import { afterEach, describe, expect, it, vi } from 'vitest';
import { eraRowsOf, bandOfWealth, entryHeadline, eventPool, famSeedOf, heavyEvents, parseOpened, playToEnd, type CardRow, type EndingGame, type EraWindow, type FamilyCardModel, type HistoryEntry, type ProfileId } from '../src/core';
import { loadEraDecade, resetFamilyArtForTest } from '../src/data/familyArtLoader';
import { CREDITS_DECISION_IDS, isCreditsDecision } from '../src/credits/allowlist';
import { creditsDecadesOf } from '../src/credits/loader';
import { creditsChoicesOf, creditsEraOf, creditsModelOf, creditsPeopleOf } from '../src/credits/model';
import { CREDITS_TEXT } from '../src/credits/text';
import { creditsLength, elapsedAt, planOf, positionAt, readSeconds } from '../src/credits/timing';
import { VEIL_TEXT } from '../src/data/gentleText';
import { chooserFor, startLife } from '../scripts/simulateLib';
import age0 from './fixtures/save-v030-age0.json';
import age20 from './fixtures/save-v030-age20.json';
import age65 from './fixtures/save-v030-age65.json';
import mother20 from './fixtures/save-v040-mother-age20.json';
import fatherEndedRaw from './fixtures/save-v040-father-ended.json?raw';

/**
 * 「이 삶의 이름들」 줄 모델·길이·시간표 (SPEC-022 EC1 · 완료 기준 1~11). 줄 모델은 종료 상태에서만 파생하는 순수 함수다 — 화면·DOM·펼침·자동 이동은 e2e/ending-credits.spec.ts가 본다.
 */

const fsSpec = 'node:fs';
const fs = (await import(/* @vite-ignore */ fsSpec)) as { readFileSync(path: URL, encoding: 'utf-8'): string };
const read = (p: string): string => fs.readFileSync(new URL(p, import.meta.url), 'utf-8');

// 가족 카드를 시험이 정한 줄로 바꿀 수 있게 한 겹 감싼다(기본은 진짜 함수 — 명단 규칙 시험만 덮어쓴다)
const hook = vi.hoisted(() => ({ override: null as null | (() => unknown) }));
vi.mock('../src/core/familyCard', async (original) => {
  const m = await original<typeof import('../src/core/familyCard')>();
  return { ...m, familyCardOf: (g: Parameters<typeof m.familyCardOf>[0]) => (hook.override === null ? m.familyCardOf(g) : (hook.override() as FamilyCardModel)) };
});
afterEach(() => {
  hook.override = null;
});

const endedOf = (seed: number, era: ProfileId, strategy: 'auto' | 'random' = 'random'): EndingGame => playToEnd(startLife(seed, era), chooserFor(strategy, seed)).state as EndingGame;

/** 크레딧 로더가 받는 것과 같은 10년 덩어리의 합 */
async function windowsOf(g: EndingGame): Promise<EraWindow[]> {
  const parts = await Promise.all(creditsDecadesOf(g.character.birthYear, g.death.age, g.birthReport !== null).map(loadEraDecade));
  return parts.flatMap((p) => [...p.windows]);
}

const choice = (age: number, eventId: string, extra: Partial<HistoryEntry> = {}): HistoryEntry => ({ age, kind: 'choice', text: `${age}세 결과 문장입니다. 둘째 문장도 있습니다.`, title: `${eventId} 제목`, choice: `${eventId} 선택지`, eventId, question: `${eventId} 질문?`, ...extra });
const row = (key: string, role: CardRow['role'], label: string, name: string, extra: Partial<CardRow> = {}): CardRow => ({ key, role, label, name, age: 40, gender: 'female', state: 'with', closeness: null, closenessText: null, jobText: null, statusText: null, ...extra }) as CardRow;
const card = (g: Partial<FamilyCardModel>): FamilyCardModel => ({ together: [], apart: [], adult: [], friends: [], gone: [], pets: [], things: [], basis: [], counts: { people: 0, together: 0, apart: 0, adult: 0, gone: 0 }, ...g });

describe('완료 기준 1: 같은 입력은 같은 전문·N이고 게임 상태를 바꾸지 않는다', () => {
  it('같은 종료 상태·설정·windows면 줄이 글자 그대로 같고, 계산 전후 GameState(rngState 포함)가 같다', async () => {
    const g = endedOf(11, 'millennial');
    const windows = await windowsOf(g);
    const before = JSON.stringify(g);
    const a = creditsModelOf({ game: g, gentle: false, windows });
    const b = creditsModelOf({ game: g, gentle: false, windows });
    expect(a.lines).toEqual(b.lines);
    expect(creditsLength(a.lines)).toBe(creditsLength(b.lines));
    expect(JSON.stringify(g)).toBe(before);
    expect(JSON.stringify(g)).toContain('rngState');
  });
});

describe('완료 기준 2: 머리와 끝', () => {
  it('머리 = 「이 삶의 이름들」 · 이름 · 「{출생} — {출생 + 게임 사망 나이}」 · 출생 사실(지역 있음), 끝 = 「생애 기록」 · 이름 · 「{이름}의 생애 기록을 마쳤습니다.」', () => {
    const g = endedOf(5, 'genx');
    const m = creditsModelOf({ game: g, gentle: false, windows: [] });
    const c = g.character;
    expect(m.lines.slice(0, 4)).toEqual(['이 삶의 이름들', c.name, `${c.birthYear} — ${c.birthYear + g.death.age}`, `${c.birthYear}년, ${g.birthReport!.region}에서 태어났습니다.`]);
    expect(m.lines.slice(-3)).toEqual(['생애 기록', c.name, `${c.name}의 생애 기록을 마쳤습니다.`]);
    expect(m.lines.filter((l) => l === '생애 기록')).toHaveLength(1);
  });

  it('출생신고가 없으면 지역을 지어내지 않는다(「{연도}년에 태어났습니다.」) — 가족·시대 장도 없고 throw가 없다', () => {
    const g = { ...endedOf(5, 'genx'), birthReport: null } as EndingGame;
    const m = creditsModelOf({ game: g, gentle: false, windows: [] });
    expect(m.born).toBe(`${g.character.birthYear}년에 태어났습니다.`);
    expect(m.people).toEqual([]);
    expect(m.era).toEqual([]);
    expect(m.lines).not.toContain(CREDITS_TEXT.familyTitle);
    expect(m.lines.at(-1)).toBe(`${g.character.name}의 생애 기록을 마쳤습니다.`);
  });

  it('어느 판에서도 빈 장 제목·「없음」 글자가 없다', async () => {
    for (const [seed, era] of [[1, 'alpha'], [2, 'industrial'], [3, 'millennial']] as const) {
      const g = endedOf(seed, era);
      const m = creditsModelOf({ game: g, gentle: true, windows: await windowsOf(g) });
      const text = m.lines.join('\n');
      expect(text).not.toMatch(/없음|기록되지 않았습니다/);
      for (const title of [CREDITS_TEXT.familyTitle, CREDITS_TEXT.choiceTitle, CREDITS_TEXT.eraTitle]) {
        const at = m.lines.indexOf(title);
        if (at >= 0) expect(m.lines[at + 1], `${title} 다음에 장 내용이 있다`).toBeDefined();
      }
    }
  });
});

describe('완료 기준 3: 명단', () => {
  const game = endedOf(5, 'genx');
  const peopleWith = (c: FamilyCardModel): ReturnType<typeof creditsPeopleOf> => {
    hook.override = () => c;
    return creditsPeopleOf(game);
  };

  it('순서: 어머니 → 아버지 → 조부모(친→외) → 형제(위 → 아래) → 배우자 → 자녀 → 친구, 태어나기 전에 떠난 사람은 뺀다', () => {
    const list = peopleWith(
      card({
        together: [row('y1', 'sibling', '동생', '이둘'), row('mother', 'mother', '어머니', '이엄마'), row('mgm', 'grandparent', '외할머니', '김외')],
        apart: [row('father', 'father', '아버지', '이아빠'), row('pgf', 'grandparent', '친할아버지', '이친'), row('o1', 'sibling', '형', '이첫')],
        adult: [row('c2', 'child', '딸', '이둘째'), row('spouse', 'spouse', '배우자', '박배우'), row('c1', 'child', '아들', '이첫째')],
        friends: [row('f2', 'friend', '친구', '정둘'), row('f1', 'friend', '친구', '정첫')],
        gone: [row('pgm', 'grandparent', '친할머니', '최옛', { goneBeforeMe: true }), row('mgf', 'grandparent', '외할아버지', '최외')],
      }),
    );
    expect(list.map((p) => p.key)).toEqual(['mother', 'father', 'pgf', 'mgf', 'mgm', 'o1', 'y1', 'spouse', 'c1', 'c2', 'f1', 'f2']);
    expect(list.map((p) => p.key)).not.toContain('pgm');
  });

  it('같은 이름의 서로 다른 key는 둘 다 남고, 이름이 없으면 호칭만 줄이 되며, 22명이어도 자르지 않는다', () => {
    const many: CardRow[] = [row('mother', 'mother', '어머니', '김같음'), row('father', 'father', '아버지', '김같음'), row('f1', 'friend', '친구', '')];
    for (let i = 1; i <= 7; i++) many.push(row(`o${i}`, 'sibling', '형', `형${i}`), row(`y${i}`, 'sibling', '동생', `동생${i}`));
    for (let i = 1; i <= 4; i++) many.push(row(`c${i}`, 'child', '아들', `자녀${i}`));
    many.push(row('f2', 'friend', '친구', '벗'), row('f3', 'friend', '친구', '벗둘'), row('spouse', 'spouse', '배우자', '짝'));
    expect(many.length).toBeGreaterThan(21);
    hook.override = () => card({ together: many });
    const m = creditsModelOf({ game, gentle: false, windows: [] });
    expect(m.people).toHaveLength(many.length);
    expect(m.people.filter((p) => p.name === '김같음')).toHaveLength(2);
    expect(m.lines).toContain('친구');
    expect(m.lines).toContain('어머니 · 김같음');
    expect(m.lines).toContain('친구 · 벗');
  });

  it('호칭은 가족 카드의 라벨 그대로(전 배우자·연인·멀어진 친구), 반려동물·사인·추모 표식은 전문에 없다', () => {
    hook.override = () => card({ adult: [row('spouse', 'spouse', '전 배우자', '한때'), row('c1', 'child', '아들', '막내')], friends: [row('f1', 'friend', '멀어진 친구', '옛벗')], pets: [{ name: '초코', species: 'dog', speciesText: '강아지', status: 'with', statusText: '함께 삶' }] });
    const m = creditsModelOf({ game, gentle: false, windows: [] });
    expect(m.lines).toContain('전 배우자 · 한때');
    expect(m.lines).toContain('멀어진 친구 · 옛벗');
    expect(m.lines.join('\n')).not.toMatch(/초코|강아지|故|고인|삼가|별세|사망 원인/);
  });

  it('실제 판의 명단은 가족 카드의 사람(함께·따로·배우자/자녀·떠난·친구)과 같고 key가 겹치지 않는다', () => {
    const real = creditsPeopleOf(endedOf(8, 'millennial'));
    expect(real.length).toBeGreaterThan(0);
    expect(new Set(real.map((p) => p.key)).size).toBe(real.length);
  });
});

describe('완료 기준 4: 본인 큰 결정 — 단계마다 첫 적격 기록 한 건', () => {
  const none = (): boolean => false;

  it('단계마다 첫 적격 기록만(최대 4), 앞 index 우선, 허용 목록 밖·`by` 있는 기록은 빈 단계를 채우지 못한다', () => {
    const history: HistoryEntry[] = [
      { age: 0, kind: 'stage', text: '태어났습니다.' },
      choice(10, 'infant-toy', { text: '일상 선택의 결과입니다.' }), // 허용 목록 밖
      choice(15, 'school-high-pick', { by: 'parent' }), // 부모가 정함
      choice(19, 'school-exam'),
      choice(19, 'job-pick-field'), // 같은 단계, 뒤 index
      choice(25, 'youth-housing'),
      choice(30, 'youth-child'), // 같은 단계, 뒤
      choice(45, 'middle-business', { by: 'child' }),
      choice(50, 'middle-layoff'),
      choice(70, 'senior-estate'),
    ];
    const out = creditsChoicesOf(history, 1990, false, none);
    expect(out.map((r) => r.historyIndex)).toEqual([3, 5, 8, 9]);
    expect(out.map((r) => r.stageLine)).toEqual(['학창 · 2009년 · 20세', '청년 · 2015년 · 26세', '중년 · 2040년 · 51세', '노년 · 2060년 · 71세']);
    expect(out.every((r) => r.byLine === '본인이 정한 일')).toBe(true);
  });

  it('`by` 없는 옛 기록은 본인 선택이고, 미루기·거절 선택지도 첫 적격이면 뽑힌다. 일상 선택으로 빈 단계를 채우지 않는다', () => {
    const out = creditsChoicesOf([choice(33, 'youth-marriage', { choice: '결혼을 미룬다' }), choice(37, 'youth-first-job')], 2000, false, none);
    expect(out).toHaveLength(1);
    expect(out[0].pick).toBe('고른 길 · 결혼을 미룬다');
    expect(creditsChoicesOf([choice(33, 'youth-hobby-club')], 2000, false, none)).toEqual([]);
  });

  it('결과 문장은 전문이고 윗줄은 entryHeadline(질문, 없으면 제목)과 같다 — 사건 정의를 바꾼 합성 풀에서도 기록된 글자 그대로', () => {
    const withQ = choice(41, 'middle-home-loan', { title: '합성 제목', question: '합성 질문?', text: '첫 문장. 둘째 문장. 셋째 문장.' });
    const noQ = choice(66, 'senior-illness', { question: undefined, title: '기록된 제목' });
    const [a, b] = creditsChoicesOf([withQ, noQ], 1970, false, none);
    expect(a.result).toBe('첫 문장. 둘째 문장. 셋째 문장.');
    expect(a.question).toBe(entryHeadline(withQ));
    expect(a.question).toBe('합성 질문?');
    expect(b.question).toBe('기록된 제목');
  });

  it('기록에 없는 필드는 그 줄만 빠진다(빈 「고른 길 ·」 줄 없음) — 적격 기록이 없는 단계는 줄 전체가 없다', () => {
    const bare: HistoryEntry = { age: 45, kind: 'choice', text: '결과만 있습니다.', eventId: 'middle-layoff' };
    const [rec] = creditsChoicesOf([bare], 1970, false, none);
    expect(rec.question).toBeUndefined();
    expect(rec.pick).toBeUndefined();
    expect(rec.result).toBe('결과만 있습니다.');
    const m = creditsModelOf({ game: { ...endedOf(5, 'genx'), history: [bare], death: { age: 70, cause: '노환' } } as EndingGame, gentle: false, windows: [] });
    expect(m.lines).not.toContain('고른 길 · ');
    expect(m.lines.filter((l) => l.startsWith('고른 길'))).toEqual([]);
    expect(creditsChoicesOf([], 1970, false, none)).toEqual([]);
  });

  it('가림: gentle일 때 heavy 선택은 원문 필드를 채우지 않고(펼친 건만 채운다), 같은 history index가 gentle 켬·끔에서 같다', () => {
    const heavy = [...heavyEvents()].find(([id]) => isCreditsDecision(id));
    expect(heavy, '허용 목록 안에 무거운 장면 표지가 있는 사건').toBeDefined();
    const [id, kind] = heavy!;
    const age = eventPool().byId.get(id)!.stages.includes('senior') ? 70 : eventPool().byId.get(id)!.stages.includes('middle') ? 50 : 30;
    const history = [choice(age, id, { text: '가려질 결과 문장입니다.', question: '가려질 질문?', choice: '가려질 선택' })];
    const on = creditsChoicesOf(history, 1950, true, none)[0];
    const off = creditsChoicesOf(history, 1950, false, none)[0];
    expect(on.historyIndex).toBe(off.historyIndex);
    expect(on.stageLine).toBe(off.stageLine);
    expect(on.veil).not.toBeNull();
    expect(on.veil!.notice).toContain(VEIL_TEXT.rowLead);
    expect(on.veil!.open).toBe(false);
    expect(JSON.stringify(on)).not.toMatch(/가려질/);
    expect(off.veil).toBeNull();
    expect(off.result).toBe('가려질 결과 문장입니다.');
    const opened = creditsChoicesOf(history, 1950, true, (vid) => vid === on.veil!.id)[0];
    expect(opened.veil!.open).toBe(true);
    expect(opened.result).toBe('가려질 결과 문장입니다.');
    expect(kind).toBeTruthy();
  });
});

describe('완료 기준 5: 허용 목록', () => {
  it('모든 ID가 현재 사건 정의에 있고(없는 ID 0), 38개이며 plan-2 4-1의 승인 목록과 같다', () => {
    const pool = eventPool();
    const missing = CREDITS_DECISION_IDS.filter((id) => !pool.byId.has(id));
    expect(missing).toEqual([]);
    expect(CREDITS_DECISION_IDS).toHaveLength(38);
    expect(new Set(CREDITS_DECISION_IDS).size).toBe(38);
    const doc = read('../docs/design/codex/DSN-001-ending-credits/plan-2.md');
    const section = doc.slice(doc.indexOf('### 4-1.'), doc.indexOf('### 4-2.'));
    const ids = [...section.matchAll(/^\| (?:`[a-z]+\.json`|〃) \| `([a-z-]+)` \|/gm)].map((m) => m[1]);
    expect([...CREDITS_DECISION_IDS].sort()).toEqual([...ids].sort());
  });

  it('허용 목록은 데이터 파일 한 곳에만 있다 — src 아래 다른 파일에 목록의 ID가 흩어 적혀 있지 않다', () => {
    const files = import.meta.glob('../src/**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
    for (const [path, code] of Object.entries(files)) {
      if (path.endsWith('/credits/allowlist.ts')) continue;
      const hits = CREDITS_DECISION_IDS.filter((id) => code.includes(`'${id}'`) && /credits/i.test(path));
      expect(hits, `${path}에 허용 목록 ID`).toEqual([]);
    }
  });
});

describe('완료 기준 6·7: 시대 줄과 나이', () => {
  const sample = async (seed: number, era: ProfileId) => {
    const g = endedOf(seed, era);
    return { g, windows: await windowsOf(g) };
  };

  it('청년·중년·노년 단계마다 한 건 이하, 게임 나이 20 이상·예측·2027 이상 제외, heavy는 전체 한 건 이하, 인생 화면과 같은 인자의 eraRowsOf의 그 해 line과 같다', async () => {
    let seen = 0;
    for (const [seed, era] of [[1, 'millennial'], [2, 'millennial'], [3, 'genx'], [4, 'industrial'], [6, 'millennial'], [9, 'genx']] as const) {
      const { g, windows } = await sample(seed, era);
      const recs = creditsEraOf(g, false, windows, () => false);
      expect(recs.length).toBeLessThanOrEqual(3);
      const rows = eraRowsOf(g.character.birthYear, g.death.age, { regionKey: g.birthReport!.region, gentle: false, seed: famSeedOf(g.peerSeed ?? g.seed), windows, band: bandOfWealth(g.character.parentWealth) });
      let heavyCount = 0;
      for (const r of recs) {
        const src = rows.find((x) => x.year === r.year)!;
        expect(src.age).toBeGreaterThanOrEqual(20);
        expect(src.forecast).toBe(false);
        expect(r.year).toBeLessThanOrEqual(2026);
        expect(r.line).toBe(src.line);
        expect(JSON.stringify(r)).not.toContain(src.second ?? '\u0000없음');
        if (src.heavy) heavyCount++;
        seen++;
      }
      expect(heavyCount).toBeLessThanOrEqual(1);
      const stages = recs.map((r) => r.stageLine.split(' · ')[0]);
      expect(new Set(stages).size).toBe(stages.length);
    }
    expect(seen, '공허 통과 방지').toBeGreaterThan(3);
  });

  it('시스템 날짜를 바꿔도 결과가 같다(`ERA_ACTUAL_LAST_YEAR` 기준 — 컴퓨터 달력이 아님)', async () => {
    const { g, windows } = await sample(2, 'millennial');
    const a = creditsEraOf(g, false, windows, () => false);
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2060-06-01T00:00:00Z'));
      expect(creditsEraOf(g, false, windows, () => false)).toEqual(a);
    } finally {
      vi.useRealTimers();
    }
  });

  it('출생 연도 2007 이상인 판(알파 세대 성인)은 시대 줄 0이고 장 제목도 없으며, 받을 10년 덩어리도 없다', async () => {
    const g = endedOf(1, 'alpha');
    expect(g.character.birthYear).toBeGreaterThanOrEqual(2007);
    const m = creditsModelOf({ game: g, gentle: false, windows: await windowsOf(g) });
    expect(m.era).toEqual([]);
    expect(m.lines).not.toContain(CREDITS_TEXT.eraTitle);
    expect(creditsDecadesOf(g.character.birthYear, g.death.age, true)).toEqual([]);
  });

  it('heavy가 앞 단계에서 골라지면 뒤 단계는 가장 이른 non-heavy이고, 없으면 그 단계를 생략한다 (합성 장면)', () => {
    const base = endedOf(2, 'millennial');
    const birth = base.character.birthYear;
    const win = (year: number, line: string, heavy: boolean): EraWindow => ({ id: `t${year}`, kind: 'event', years: [year, year], approved: true, line, heavy, caption: '', draw: 'x' }) as unknown as EraWindow;
    const game = { ...base, death: { age: 80, cause: '노환' } } as EndingGame;
    const windows = [win(birth + 21, '청년 무거운 줄', true), win(birth + 41, '중년 무거운 줄', true), win(birth + 45, '중년 가벼운 줄', false), win(birth + 66, '노년 무거운 줄', true)];
    const bound = Math.min(birth + 80, 2026);
    const usable = windows.filter((w) => w.years[0] <= bound);
    const out = creditsEraOf(game, false, usable, () => false);
    // 2026년을 넘는 해는 줄이 되지 않는다 — 남은 줄만으로 위 규칙을 확인한다
    for (const r of out) expect(r.year).toBeLessThanOrEqual(2026);
    if (birth + 21 <= 2026) expect(out[0]?.line).toBe('청년 무거운 줄');
    if (birth + 45 <= 2026) expect(out.map((r) => r.line)).not.toContain('중년 무거운 줄');
    if (birth + 66 <= 2026) expect(out.map((r) => r.line)).not.toContain('노년 무거운 줄');
  });

  it('나이: 선택·시대 줄의 나이는 한국 나이(게임 22 → 「23세」), 단계 판정은 게임 나이(19는 학창, 20은 청년)', () => {
    const none = (): boolean => false;
    expect(creditsChoicesOf([choice(22, 'youth-housing')], 2000, false, none)[0].stageLine).toBe('청년 · 2022년 · 23세');
    expect(creditsChoicesOf([choice(19, 'school-exam')], 2000, false, none)[0].stageLine).toBe('학창 · 2019년 · 20세');
    expect(creditsChoicesOf([choice(20, 'job-pick-field')], 2000, false, none)[0].stageLine).toBe('청년 · 2020년 · 21세');
  });

  it('`tests/ageViewLint.test.ts`의 점검 대상에 `src/credits/`가 들어 있다', () => {
    expect(read('./ageViewLint.test.ts')).toContain('../src/credits/');
  });
});

describe('완료 기준 8: 가림 네 조합(모델 몫)', () => {
  it('gentleUsed → 안내 줄 유무는 설정과 무관하고, gentle 켬·끔에서 고른 선택의 history index와 시대 줄의 연도가 같으며, 닫힌 원문은 모델에 없다', async () => {
    const g = endedOf(2, 'millennial');
    const windows = await windowsOf(g);
    for (const used of [true, false]) {
      for (const gentle of [true, false]) {
        const game = { ...g, gentleUsed: used } as EndingGame;
        const m = creditsModelOf({ game, gentle, windows });
        expect(m.lines.includes(VEIL_TEXT.endingLine)).toBe(used);
      }
    }
    const on = creditsModelOf({ game: g, gentle: true, windows });
    const off = creditsModelOf({ game: g, gentle: false, windows });
    expect(on.choices.map((r) => r.historyIndex)).toEqual(off.choices.map((r) => r.historyIndex));
    expect(on.era.map((r) => r.year)).toEqual(off.era.map((r) => r.year));
    for (const r of [...on.choices, ...on.era]) {
      if (r.veil === null || r.veil.open) continue;
      expect(r.question ?? r.pick ?? r.result ?? r.line).toBeUndefined();
    }
  });
});

describe('완료 기준 9: 짧은 삶·옛 저장', () => {
  const modelOf = (g: EndingGame) => creditsModelOf({ game: g, gentle: false, windows: [] });

  it('게임 0·5·19세 사망은 시대 장 0 · 마칠 때 수저 없음이고, 게임 20세 사망부터 청년 선택이 자격을 얻는다', () => {
    const base = endedOf(2, 'millennial');
    for (const age of [0, 5, 19]) {
      const g = { ...base, death: { age, cause: '병' }, history: [] } as EndingGame;
      const m = modelOf(g);
      expect(m.era).toEqual([]);
      expect(m.lines).not.toContain(CREDITS_TEXT.eraTitle);
      expect(m.lines.join('')).not.toMatch(/수저/);
      expect(m.lines.at(-1)).toContain('생애 기록을 마쳤습니다.');
    }
    const twenty = { ...base, death: { age: 20, cause: '병' }, history: [choice(20, 'job-pick-field')] } as EndingGame;
    expect(modelOf(twenty).choices.map((r) => r.stageLine.split(' · ')[0])).toEqual(['청년']);
  });

  it('게임 19세에 school-exam을 본인이 고르고 같은 19세에 숨진 판은 학창 선택 1건, 같은 기록이 `by: parent`이면 선택 0건(장 제목 없음)', () => {
    const base = endedOf(2, 'millennial');
    const mine = modelOf({ ...base, death: { age: 19, cause: '병' }, history: [choice(19, 'school-exam')] } as EndingGame);
    expect(mine.choices).toHaveLength(1);
    expect(mine.lines).toContain(CREDITS_TEXT.choiceTitle);
    const theirs = modelOf({ ...base, death: { age: 19, cause: '병' }, history: [choice(19, 'school-exam', { by: 'parent' })] } as EndingGame);
    expect(theirs.choices).toEqual([]);
    expect(theirs.lines).not.toContain(CREDITS_TEXT.choiceTitle);
  });

  it('family === undefined이면 가족 장이 없고 throw가 없다', () => {
    const m = modelOf({ ...endedOf(2, 'millennial'), family: undefined } as EndingGame);
    expect(m.people).toEqual([]);
    expect(m.lines).not.toContain(CREDITS_TEXT.familyTitle);
  });

  it('옛 저장 스냅샷(`family.lg === 1`) — save-v030 0·20·65세를 끝까지 돌린 종료 상태의 명단이 가족 카드와 같다(생략 대상이 아니다)', () => {
    for (const fixture of [age0, age20, age65]) {
      const opened = parseOpened(JSON.stringify(fixture))!;
      expect(opened.family!.lg).toBe(1);
      const ended = playToEnd(opened, null).state as EndingGame;
      expect(ended.phase).toBe('ending');
      const m = creditsModelOf({ game: ended, gentle: false, windows: [] });
      expect(m.people.length).toBeGreaterThan(0);
      expect(m.people.map((p) => p.key)).toEqual(creditsPeopleOf(ended).map((p) => p.key));
      expect(m.lines.join('\n')).not.toMatch(/없음/);
    }
  });

  it('`persona` 없는 옛 판 — save-v040-*(family는 있고 lg·persona 없음)도 있는 장만으로 전문이 나오고 throw가 없다', () => {
    const ended = parseOpened(fatherEndedRaw)!;
    expect(ended.phase).toBe('ending');
    const a = creditsModelOf({ game: ended as EndingGame, gentle: false, windows: [] });
    expect(a.lines.at(-1)).toBe(`${ended.character!.name}의 생애 기록을 마쳤습니다.`);
    const played = playToEnd(parseOpened(JSON.stringify(mother20))!, null).state as EndingGame;
    const b = creditsModelOf({ game: played, gentle: false, windows: [] });
    expect(b.lines[0]).toBe('이 삶의 이름들');
    expect(b.lines.join('')).not.toContain('없음');
  });
});

describe('완료 기준 10: 길이 N', () => {
  const doc = read('../docs/design/codex/DSN-001-ending-credits/plan-2.md');
  const blocks = [...doc.slice(doc.indexOf('## 13. 실제 판')).matchAll(/```text\n([^]*?)```/g)].map((m) => m[1].trimEnd().split('\n'));
  const spoonOut = (lines: string[]): string[] => [...lines.slice(0, lines.indexOf('태어나고 마칠 때')), ...lines.slice(lines.indexOf('생애 기록'))];

  it('plan-2 13절 여섯 전문의 줄 배열을 넣으면 N = 568·689·749·174·465·705(D_read 90·107·115·33·75·109초)', () => {
    expect(blocks).toHaveLength(6);
    expect(blocks.map(creditsLength)).toEqual([568, 689, 749, 174, 465, 705]);
    expect(blocks.map((b) => readSeconds(creditsLength(b)))).toEqual([90, 107, 115, 33, 75, 109]);
  });

  it('수저 장면 줄을 뺀 배열(스위치 끔 — v0.6.1의 크레딧이 내는 전문)은 N = 489·602·670·124·386·626(78·94·104·26·64·98초)', () => {
    const ns = blocks.map((b) => creditsLength(spoonOut(b)));
    expect(ns).toEqual([489, 602, 670, 124, 386, 626]);
    expect(ns.map(readSeconds)).toEqual([78, 94, 104, 26, 64, 98]);
  });

  it('보조 평면 글자 한 자가 든 합성 이름에서 N이 1만 는다(UTF-16 단위였다면 2)', () => {
    expect(creditsLength(['가나'])).toBe(2);
    expect(creditsLength(['가나', '\u{20BB7}'])).toBe(3);
    expect('\u{20BB7}'.length).toBe(2);
    const g = endedOf(2, 'genx');
    const plain = creditsModelOf({ game: g, gentle: false, windows: [] });
    const wide = creditsModelOf({ game: { ...g, character: { ...g.character, name: `${g.character.name}\u{20BB7}` } } as EndingGame, gentle: false, windows: [] });
    // 이름은 머리·끝에 두 번, 끝 문장에 한 번 나온다 — 한 번당 코드 포인트 1
    expect(creditsLength(wide.lines) - creditsLength(plain.lines)).toBe(3);
  });

  it('줄바꿈은 세지 않는다 — 줄을 어떻게 나눠도(이어 붙인 글자가 같으면) N이 같다', () => {
    expect(creditsLength(['가나', '다라'])).toBe(creditsLength(['가나다라']));
  });
});

describe('완료 기준 11: 판정·시간표(순수 함수)', () => {
  const base = { people: 5, distance: 600, reduced: false, rootPx: 16 } as const;
  const nFor = (d: number): number => (d - 8) * 7; // readSeconds(nFor(d)) === d
  it('D_read 90은 자동·91은 정지 목록(N 574·575)', () => {
    expect(readSeconds(574)).toBe(90);
    expect(readSeconds(575)).toBe(91);
    expect(planOf({ ...base, n: 574, distance: 100 }).mode).toBe('auto');
    expect(planOf({ ...base, n: 575, distance: 100 })).toMatchObject({ mode: 'list', reason: 'long' });
    expect(readSeconds(0)).toBe(18);
  });

  it('36.0px/s는 자동·초과는 정지 목록', () => {
    const n = nFor(58); // D_read 58 → 가운데 50초
    expect(readSeconds(n)).toBe(58);
    expect(planOf({ ...base, n, distance: 36 * 50 }).mode).toBe('auto');
    expect(planOf({ ...base, n, distance: 36 * 50 + 1 })).toMatchObject({ mode: 'list', reason: 'fast' });
  });

  it('명단 22명 · 움직임 줄이기 · 루트 글자 크기 24px(150%) 이상 · 이동거리 0 이하는 정지 목록', () => {
    const n = nFor(40);
    expect(planOf({ ...base, n, people: 21 }).mode).toBe('auto');
    expect(planOf({ ...base, n, people: 22 })).toMatchObject({ reason: 'people' });
    expect(planOf({ ...base, n, reduced: true })).toMatchObject({ reason: 'reduced' });
    expect(planOf({ ...base, n, rootPx: 23.9 }).mode).toBe('auto');
    expect(planOf({ ...base, n, rootPx: 24 })).toMatchObject({ reason: 'large' });
    expect(planOf({ ...base, n, rootPx: 32 })).toMatchObject({ reason: 'large' });
    expect(planOf({ ...base, n, distance: 0 })).toMatchObject({ reason: 'short' });
    expect(planOf({ ...base, n, distance: -5 })).toMatchObject({ reason: 'short' });
  });

  it('시간 → 위치: 0~4초 처음 위치, 이후 선형, 마지막 4초 끝 위치', () => {
    const D = 48;
    const dist = 4000;
    expect(positionAt(0, D, dist)).toBe(0);
    expect(positionAt(4, D, dist)).toBe(0);
    expect(positionAt(4 + 20, D, dist)).toBeCloseTo(2000, 6); // 가운데 40초의 절반
    expect(positionAt(D - 4, D, dist)).toBe(dist);
    expect(positionAt(D - 2, D, dist)).toBe(dist);
    expect(positionAt(D + 10, D, dist)).toBe(dist);
    // 선형 — 같은 간격은 같은 거리
    expect(positionAt(14, D, dist) - positionAt(10, D, dist)).toBeCloseTo(positionAt(34, D, dist) - positionAt(30, D, dist), 6);
    // 「이어 보기」는 위치에서 시간을 거꾸로 구한다
    expect(positionAt(elapsedAt(1234, D, dist), D, dist)).toBeCloseTo(1234, 6);
  });
});

describe('로더의 10년 덩어리 범위 (완료 기준 19 ③)', () => {
  afterEach(() => resetFamilyArtForTest());
  it('출생 + 20세의 10년대부터 min(사망 연도, 2026)의 10년대까지 — 20세 전·출생 2007 이상·출생신고 없음은 비어 있다', () => {
    expect(creditsDecadesOf(1960, 80, true)).toEqual([1980, 1990, 2000, 2010, 2020]);
    expect(creditsDecadesOf(1995, 83, true)).toEqual([2010, 2020]);
    expect(creditsDecadesOf(1915, 60, true)[0]).toBe(1940);
    expect(creditsDecadesOf(1990, 19, true)).toEqual([]);
    expect(creditsDecadesOf(2007, 80, true)).toEqual([]);
    expect(creditsDecadesOf(1990, 80, false)).toEqual([]);
    expect(creditsDecadesOf(1960, 80, true).length).toBeLessThanOrEqual(7);
  });
});
