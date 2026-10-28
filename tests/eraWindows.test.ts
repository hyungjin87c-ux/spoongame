import { describe, expect, it } from 'vitest';
import { ERA_FIRST_DECADE, ERA_LAST_DECADE, ERA_LAST_YEAR, ERA_LINE_MAX, eraDecadeOf, eraOf, eraRowsOf, type EraContext, type EraWindow } from '../src/core/eraWindow';
import { ERA_DECADES_WITH_DATA, ERA_DECADE_LOADERS } from '../src/data/eraWindows';
import { ERA_DECADE as D1940 } from '../src/data/eraWindows/d1940';
import { ERA_DECADE as D1950 } from '../src/data/eraWindows/d1950';
import { ERA_DECADE as D1960 } from '../src/data/eraWindows/d1960';
import { ERA_DECADE as D1970 } from '../src/data/eraWindows/d1970';
import { ERA_DECADE as D1980 } from '../src/data/eraWindows/d1980';
import { ERA_DECADE as D1990 } from '../src/data/eraWindows/d1990';
import { ERA_DECADE as D2000 } from '../src/data/eraWindows/d2000';
import { ERA_DECADE as D2010 } from '../src/data/eraWindows/d2010';
import { ERA_DECADE as D2020 } from '../src/data/eraWindows/d2020';
import type { EraDecadeData } from '../src/data/eraWindows/types';
import { eraDecadeIfLoaded, loadEraDecade, resetFamilyArtForTest } from '../src/data/familyArtLoader';

/**
 * 시대의 창 데이터와 고르기 (SPEC-009 FM5, FT1~FT6, family-model.md 9절 · T-ERA). 지금(FM5)은 **승인된 그림이 0장**이라 데이터 파일은 비어 있고, 고르기·줄 만들기는 합성 데이터로 시험한다.
 * 「승인한 것만」(FT3): `EraWindow.approved`의 타입이 `true`뿐이라 미승인 장면은 데이터 파일에 쓰는 순간 `npm run typecheck`(= build의 첫 단계)가 막고, 이 시험이 파일 내용과 원문을 한 번 더 점검한다.
 */

const DECADES: Array<[number, EraDecadeData]> = [
  [1940, D1940], [1950, D1950], [1960, D1960], [1970, D1970], [1980, D1980], [1990, D1990], [2000, D2000], [2010, D2010], [2020, D2020],
];

const w = (id: string, years: [number, number], over: Partial<EraWindow> = {}): EraWindow => ({ id, years, kind: 'event', topic: '시험', line: `${id} 문장입니다.`, heavy: false, approved: true, draw: id, ...over });
const ctx = (windows: readonly EraWindow[], over: Partial<EraContext> = {}): EraContext => ({ regionKey: '서울', gentle: false, seed: 777, windows, ...over });

describe('데이터 파일 — 승인한 것만 (FT3)', () => {
  it('10년 덩어리 9개가 모두 있고, 지금은 승인된 그림이 0장이다(창은 빈 틀) — 승인된 장면이 오면 이 시험의 기대를 함께 고친다', () => {
    expect(DECADES.map(([d]) => d)).toEqual([1940, 1950, 1960, 1970, 1980, 1990, 2000, 2010, 2020]);
    expect(DECADES.reduce((n, [, d]) => n + d.windows.length, 0)).toBe(0);
    expect([...ERA_DECADES_WITH_DATA]).toEqual([]);
    expect(Object.keys(ERA_DECADE_LOADERS).map(Number)).toEqual(DECADES.map(([d]) => d));
  });

  it('모든 장면은 approved: true이고, 10년대 안에 있으며, 문장이 22자 이하이고, 그림 조각이 있고 토큰 색뿐이며, id가 유일하다 (지금은 빈 목록이라 형식 점검)', () => {
    const ids = new Set<string>();
    for (const [decade, data] of DECADES) {
      for (const win of data.windows) {
        expect(win.approved, `${win.id}: 미승인 장면은 데이터에 들어올 수 없다`).toBe(true);
        expect(win.years[0], win.id).toBeGreaterThanOrEqual(decade);
        expect(win.years[1], win.id).toBeLessThanOrEqual(decade + 9);
        expect(win.years[0], win.id).toBeLessThanOrEqual(win.years[1]);
        expect(win.line.length, `${win.id}: 시대 줄 문장 ${win.line.length}자`).toBeLessThanOrEqual(ERA_LINE_MAX);
        expect(win.line, `${win.id}: 평가어·물음표 없음`).not.toMatch(/[?!]/);
        const art = data.art[win.draw];
        expect(art, `${win.id}: 조각 ${win.draw} 마크업이 없다`).toBeTypeOf('string');
        for (const m of art.matchAll(/\s(?:fill|stroke)="([^"]*)"/g)) expect(m[1] === 'none' || /^var\(--c-scene-[a-z0-9]+,/.test(m[1]) || /^url\(#[\w-]+\)$/.test(m[1]), `${win.id}: 토큰이 아닌 색 ${m[1]}`).toBe(true);
        expect(art, `${win.id}: 그림 안 글자 0`).not.toMatch(/<text|<tspan|<image|<script|style=/i);
        expect(ids.has(win.id), `${win.id}: id 중복`).toBe(false);
        ids.add(win.id);
      }
      expect(ERA_DECADES_WITH_DATA.includes(decade), `${decade}: 데이터가 있으면 ERA_DECADES_WITH_DATA에 적는다`).toBe(data.windows.length > 0);
    }
  });

  it('원문 점검: 10년 덩어리 파일 어디에도 `approved: false`가 없다 — 미승인 그림은 빌드에 들어오지 않는다', () => {
    const sources = import.meta.glob('../src/data/eraWindows/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
    const names = Object.keys(sources).map((p) => p.slice(p.lastIndexOf('/') + 1));
    expect(names).toEqual(expect.arrayContaining(['d1940.ts', 'd2020.ts', 'index.ts', 'types.ts']));
    for (const [path, src] of Object.entries(sources)) {
      const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');
      expect(code, path).not.toMatch(/approved\s*:\s*false/);
    }
  });

  it('덩어리 크기: 10년 덩어리 하나의 gzip ≤ 16KB(판 하나가 한 번에 받는 양, 마스터 결정 ≤ 75KB 안), 전부 합쳐도 ≤ 110KB — 지금은 0B', async () => {
    const zspec = 'node:zlib';
    const bspec = 'node:buffer';
    const zlib = (await import(/* @vite-ignore */ zspec)) as { gzipSync(b: unknown): { length: number } };
    const buf = (await import(/* @vite-ignore */ bspec)) as { Buffer: { from(s: string, e: string): unknown } };
    let total = 0;
    for (const [d, data] of DECADES) {
      const gz = data.windows.length === 0 ? 0 : zlib.gzipSync(buf.Buffer.from(JSON.stringify(data), 'utf8')).length;
      expect(gz, `${d}년대 덩어리 gzip`).toBeLessThanOrEqual(16 * 1024);
      total += gz;
    }
    expect(total).toBeLessThanOrEqual(110 * 1024);
  });
});

describe('10년 덩어리 로더 (A-10)', () => {
  it('승인된 그림이 없는 10년대는 아무 덩어리도 받지 않고 빈 데이터를 돌려주며, 같은 10년대를 다시 부르면 같은 약속·같은 결과다', async () => {
    resetFamilyArtForTest();
    expect(eraDecadeIfLoaded(1980)).toBeNull();
    const a = loadEraDecade(1980);
    expect(loadEraDecade(1980)).toBe(a);
    expect(await a).toEqual({ windows: [], art: {} });
    expect(eraDecadeIfLoaded(1980)).toEqual({ windows: [], art: {} });
  });
});

describe('eraOf — 순수 고르기 (9-2절)', () => {
  const nat1988 = w('올림픽', [1988, 1988], { hCode: 'H-C03' });
  const reg1988 = w('지역일', [1988, 1988], { regionKey: '부산', line: '부산 소식입니다.' });
  const daily70 = w('연탄골목', [1970, 1979], { kind: 'daily', line: '골목마다 연탄불이 피었습니다.' });
  const daily70b = w('도시락', [1970, 1979], { kind: 'daily', line: '난로 위에 도시락이 올랐습니다.' });
  const base = w('창가', [1940, 2025], { kind: 'base', line: '그해에도 하루는 이어졌습니다.' });
  const heavy80 = w('오월', [1980, 1980], { heavy: true, line: '5월의 일입니다.' });

  it('승인 후보가 없으면 빈 틀(pic·line null) — 지금의 상태', () => {
    expect(eraOf(1988, ctx([]))).toEqual({ pic: null, line: null, veiled: false, sourceYear: 1988 });
    expect(eraRowsOf(1980, 40, ctx([]))).toEqual([]);
  });
  it('우선순위: 지역 사건 > 전국 사건 > 생활 장면 > 기본 장면, 출생 시도가 다른 지역 사건은 후보가 아니다', () => {
    expect(eraOf(1988, ctx([nat1988, reg1988, daily70, base], { regionKey: '부산' })).pic?.id).toBe('지역일');
    expect(eraOf(1988, ctx([nat1988, reg1988, daily70, base], { regionKey: '서울' })).pic?.id).toBe('올림픽');
    expect(eraOf(1975, ctx([nat1988, daily70, base])).pic?.id).toBe('연탄골목');
    expect(eraOf(1955, ctx([nat1988, daily70, base])).pic?.id).toBe('창가');
    expect(eraOf(1955, ctx([nat1988, daily70])).pic).toBeNull();
  });
  it('후보가 둘이면 시드로 하나 — 같은 판·같은 해는 늘 같은 그림이고, 시드가 다르면 갈린다(같은 입력 → 같은 출력)', () => {
    const a = eraOf(1975, ctx([daily70, daily70b], { seed: 1 })).pic?.id;
    expect(eraOf(1975, ctx([daily70b, daily70], { seed: 1 })).pic?.id, '목록 순서와 무관').toBe(a);
    const picks = new Set(Array.from({ length: 60 }, (_, s) => eraOf(1975, ctx([daily70, daily70b], { seed: s * 7919 })).pic?.id));
    expect(picks.size).toBe(2);
  });
  it('미승인(approved가 true가 아닌 것)은 후보가 아니다 — 데이터 파일 밖 경로(합성)에서도 빌드가 막지 못한 것을 고르기가 한 번 더 막는다', () => {
    const sneaky = { ...nat1988, approved: false } as unknown as EraWindow;
    expect(eraOf(1988, ctx([sneaky])).pic).toBeNull();
    expect(eraOf(1988, ctx([sneaky, base])).pic?.id).toBe('창가');
  });
  it('2026년 이후: 사건은 쓰지 않고(출처 없는 미래 사건 금지) 2025년의 생활·기본 장면을 유지한다', () => {
    const ev2025 = w('이천이십오', [2025, 2025]);
    const daily2025 = w('요즘', [2020, 2025], { kind: 'daily' });
    const pick = eraOf(2031, ctx([ev2025, daily2025]));
    expect(pick.pic?.id).toBe('요즘');
    expect(pick.sourceYear).toBe(ERA_LAST_YEAR);
    expect(eraOf(2031, ctx([ev2025])).pic).toBeNull();
  });
  it('무거운 장면 가리기: 꺼짐(기본)이면 그대로, 켜면 그해 일상 그림으로 바뀌고 줄은 가려진다 — 일상이 없으면 빈 틀', () => {
    const d80 = w('도시락80', [1980, 1989], { kind: 'daily' });
    expect(eraOf(1980, ctx([heavy80, d80], { gentle: false }))).toMatchObject({ veiled: false });
    expect(eraOf(1980, ctx([heavy80, d80], { gentle: false })).pic?.id).toBe('오월');
    const on = eraOf(1980, ctx([heavy80, d80], { gentle: true }));
    expect(on).toMatchObject({ veiled: true });
    expect(on.pic?.id).toBe('도시락80');
    expect(on.line?.id).toBe('오월');
    const empty = eraOf(1980, ctx([heavy80], { gentle: true }));
    expect(empty).toMatchObject({ pic: null, veiled: true });
    expect(empty.line?.id).toBe('오월');
    // 무겁지 않은 장면은 가리기와 무관
    expect(eraOf(1988, ctx([nat1988], { gentle: true })).veiled).toBe(false);
  });
  it('가려진 해에도 무거운 일상(heavy)을 대신 띄우지 않는다', () => {
    const heavyDaily = w('무거운일상', [1980, 1989], { kind: 'daily', heavy: true });
    expect(eraOf(1980, ctx([heavy80, heavyDaily], { gentle: true })).pic).toBeNull();
  });
  it('10년 덩어리 번호: 1940~2029 → 1940~2020, 그 앞·뒤는 가장자리 10년대', () => {
    expect([1940, 1949, 1950, 1999, 2000, 2025, 2026, 2060].map(eraDecadeOf)).toEqual([1940, 1940, 1950, 1990, 2000, 2020, 2020, 2020]);
    expect(eraDecadeOf(1920)).toBe(ERA_FIRST_DECADE);
    expect(eraDecadeOf(2200)).toBe(ERA_LAST_DECADE);
  });
});

describe('eraRowsOf — 인생 기록의 시대 줄(저장하지 않는 파생 줄, A-12)', () => {
  it('출생부터 지금 나이까지 해마다 줄을 낳는 해만 담고, 연도 = 출생 연도 + 나이, 같은 입력은 같은 줄이다', () => {
    const wins = [w('올림픽', [1988, 1988]), w('창가', [1980, 1999], { kind: 'daily', line: '그해에도 하루는 이어졌습니다.' })];
    const rows = eraRowsOf(1985, 6, ctx(wins));
    expect(rows.map((r) => [r.age, r.year, r.line])).toEqual([
      [0, 1985, '그해에도 하루는 이어졌습니다.'],
      [1, 1986, '그해에도 하루는 이어졌습니다.'],
      [2, 1987, '그해에도 하루는 이어졌습니다.'],
      [3, 1988, '올림픽 문장입니다.'],
      [4, 1989, '그해에도 하루는 이어졌습니다.'],
      [5, 1990, '그해에도 하루는 이어졌습니다.'],
      [6, 1991, '그해에도 하루는 이어졌습니다.'],
    ]);
    expect(eraRowsOf(1985, 6, ctx(wins))).toEqual(rows);
    for (const r of rows) expect(r.year).toBe(1985 + r.age);
  });
  it('가려진 해는 줄에 veiled가 켜진다(문장은 화면의 가리기 부품이 가린다)', () => {
    const rows = eraRowsOf(1978, 4, ctx([w('오월', [1980, 1980], { heavy: true })], { gentle: true }));
    expect(rows).toEqual([{ year: 1980, age: 2, line: '오월 문장입니다.', heavy: true, veiled: true }]);
    expect(eraRowsOf(1978, 4, ctx([w('오월', [1980, 1980], { heavy: true })], { gentle: false }))[0].veiled).toBe(false);
  });
});
