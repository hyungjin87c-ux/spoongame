import { describe, expect, it } from 'vitest';
import { ERA_FIRST_DECADE, ERA_FIRST_MAX, ERA_LAST_DECADE, ERA_LAST_YEAR, bandOfWealth, eraDecadeOf, eraOf, eraRowsOf, type EraContext, type EraWindow } from '../src/core/eraWindow';
import { ERA_DECADES_WITH_DATA, ERA_DECADE_LOADERS } from '../src/data/eraWindows';
import type { EraDecadeData } from '../src/data/eraWindows/types';
import { eraDecadeIfLoaded, loadEraDecade, resetFamilyArtForTest } from '../src/data/familyArtLoader';
import { SCENE_LIGHT } from '../src/data/familyArt/svg';
import { ALLOWED_CLASSES, parseSvgMarkup, type SvgNode } from '../src/ui/svgNodes';
import { ALT_1987_ID, ERA_EVENT_TABLE, REAL_DECADES, REAL_WINDOWS, realById } from './helpers/eraEventsTable';

/**
 * 시대의 창 데이터와 고르기 (SPEC-013 T1·T6·T7 개정 — 이전 SPEC-009 FM5·FM5b · SPEC-010 · SPEC-012 QF2·QF3의 시험을 새 규칙으로 바꿨다).
 * 데이터 파일 17개는 `npm run gen:era`가 사건 표(`scripts/eraEvents.ts`)와 designer 승인 조각에서 만든 생성 파일이고, 이 시험은 그 내용(승인·형식·색 class·defs 한 번)과 크기 예산, 고르기 규칙(`eraOf`)을 합성 데이터와 진짜 데이터 둘로 잠근다.
 * 「승인한 것만」(FT3): `EraWindow.approved`의 타입이 `true`뿐이라 미승인 장면은 데이터 파일에 쓰는 순간 `npm run typecheck`(= build의 첫 단계)가 막고, 이 시험이 파일 내용과 원문을 한 번 더 점검한다.
 *
 * **개정 사유(T7 — 바꾼 시험 목록은 dev 로그)**: 일상 장면·수저 변주(`band`)·사건 `ages`·같은 그림 3해 연속 금지·한 판에 한 번(QF2)·나이 규칙(QF3)은 SPEC-013이 코어에서 없앴다(사건은 한 해짜리라 같은 그림이 이어질 수 없고, 일상이 없고, 나이는 둘째 문장 `secondAges`만 본다).
 * 이 파일은 그 시험들을 「사건만 고르기 · 빈 해 · 가리기 · 둘째 문장」으로 바꿨다. 사건 표 대조(수·★·○·재사용 id)는 `tests/eraEvents.test.ts`, 사건 해의 캡션 화면은 `tests/eraCaption.test.tsx`다.
 */

const DECADES = REAL_DECADES as ReadonlyArray<readonly [number, EraDecadeData]>;
const ALL: readonly EraWindow[] = REAL_WINDOWS;
/** SPEC-010 전의 2020년대 덩어리 gzip(승인 11장, `JSON.stringify` 기준) — 2027년 이후가 늘린 양을 재는 기준선. 이 값은 고치지 않는다 */
const D2020_GZ_BEFORE_SPEC010 = 11_006;
/** SPEC-010 「예산」: 2027년 이후 덩어리가 늘린 양 한도 98.7KB(마스터 값 98,700B; 누적 230KB 한도에서 지금 쓰는 131,300B를 뺀 보수적 여유) — SPEC-013은 줄어드는 쪽이라 유지 */
const FUTURE_ADDED_MAX = 98_700;

const w = (id: string, years: [number, number], over: Partial<EraWindow> = {}): EraWindow => ({ id, years, kind: 'event', topic: '시험', line: `${id} 문장입니다.`, heavy: false, approved: true, draw: id, caption: `${id} 캡션`, ...over });
const ctx = (windows: readonly EraWindow[], over: Partial<EraContext> = {}): EraContext => ({ regionKey: '서울', gentle: false, seed: 777, windows, ...over });

async function gzipOf(text: string): Promise<number> {
  const zspec = 'node:zlib';
  const bspec = 'node:buffer';
  const zlib = (await import(/* @vite-ignore */ zspec)) as { gzipSync(b: unknown): { length: number } };
  const buf = (await import(/* @vite-ignore */ bspec)) as { Buffer: { from(s: string, e: string): unknown } };
  return zlib.gzipSync(buf.Buffer.from(text, 'utf8')).length;
}
async function readText(relative: string): Promise<string> {
  const spec = 'node:fs';
  const fs = (await import(/* @vite-ignore */ spec)) as { readFileSync(path: URL, encoding: 'utf-8'): string };
  return fs.readFileSync(new URL(relative, import.meta.url), 'utf-8');
}

describe('데이터 파일 — 승인한 것만 (FT3)', () => {
  it('10년 덩어리 17개가 모두 있고, 승인된 51장이 열일곱 덩어리에 있다(장면 2·3·4·4·5·4·4·4·4·2·2·2·2·2·3·1·3) — 사건 49 + 1987 대체 1(1980년대) + 끝 장면 1(2100년대)', () => {
    expect(DECADES.map(([d]) => d)).toEqual([1940, 1950, 1960, 1970, 1980, 1990, 2000, 2010, 2020, 2030, 2040, 2050, 2060, 2070, 2080, 2090, 2100]);
    expect(DECADES.map(([, d]) => d.windows.length)).toEqual([2, 3, 4, 4, 5, 4, 4, 4, 4, 2, 2, 2, 2, 2, 3, 1, 3]);
    expect(ALL.length).toBe(51);
    expect([...ERA_DECADES_WITH_DATA]).toEqual(DECADES.map(([d]) => d));
    expect(Object.keys(ERA_DECADE_LOADERS).map(Number)).toEqual(DECADES.map(([d]) => d));
  });

  it('승인된 51장의 구성: 사건 50(49 + 1987 대체) / 끝 장면 1, 무거운 장면 16장(재난·정치만), 일상·수저 구간 분기(band)·사건 나이대(ages) 0', () => {
    expect(ALL.filter((x) => x.kind === 'event').length).toBe(50);
    expect(ALL.filter((x) => x.kind === 'base').map((x) => x.id)).toEqual(['era-end-horizon']);
    expect(ALL.filter((x) => x.heavy).map((x) => x.id).sort()).toEqual(ERA_EVENT_TABLE.filter((r) => r.heavy).map((r) => r.id).sort());
    expect(ALL.filter((x) => x.heavy).length).toBe(16);
    for (const x of ALL.filter((y) => y.heavy)) expect(['정치', '재난'], `${x.id}: 가리기 대상은 재난·정치뿐`).toContain(x.topic);
    for (const x of ALL.filter((y) => !y.heavy && y.topic !== '정치')) expect(x.heavy, x.id).toBe(false);
    for (const x of ALL) {
      expect('band' in x, `${x.id}: band 0`).toBe(false);
      expect('ages' in x, `${x.id}: ages 0`).toBe(false);
    }
  });

  it('모든 장면은 approved: true이고, 10년대 안에 있으며, 첫 문장이 32자 이하이고, 그림 조각이 있으며, id가 유일하다', () => {
    const ids = new Set<string>();
    for (const [decade, data] of DECADES) {
      for (const win of data.windows) {
        expect(win.approved as boolean, `${win.id}: 미승인 장면은 데이터에 들어올 수 없다`).toBe(true);
        if (win.kind === 'base') {
          // 끝 장면(SPEC-010 U46, R-602)만 10년을 넘는다: 2110~2130을 덮되 덩어리는 2100년대로 고정(안 그러면 d2110.ts가 생겨 영영 요청되지 않는다)
          expect({ decade, id: win.id, years: win.years }, `${win.id}: kind base는 2100년대 덩어리의 끝 장면 하나뿐이다`).toEqual({ decade: 2100, id: 'era-end-horizon', years: [2110, 2130] });
          expect(win.years[0], win.id).toBe(ERA_LAST_YEAR + 1);
        } else {
          expect(win.years[0], win.id).toBeGreaterThanOrEqual(decade);
          expect(win.years[1], win.id).toBeLessThanOrEqual(decade + 9);
          expect(win.years[0], `${win.id}: 사건은 한 해짜리`).toBe(win.years[1]);
        }
        expect(win.line.length, `${win.id}: 첫 문장 ${win.line.length}자`).toBeLessThanOrEqual(ERA_FIRST_MAX);
        expect(win.line, `${win.id}: 물음표·느낌표 없음`).not.toMatch(/[?!]/);
        expect(data.art[win.draw], `${win.id}: 조각 ${win.draw} 마크업이 없다`).toBeTypeOf('string');
        expect(ids.has(win.id), `${win.id}: id 중복`).toBe(false);
        ids.add(win.id);
      }
      expect(Object.keys(data.art).sort(), `${decade}: 조각은 장면의 draw와 일대일`).toEqual(data.windows.map((x) => x.draw).sort());
      expect(ERA_DECADES_WITH_DATA.includes(decade), `${decade}: 데이터가 있으면 ERA_DECADES_WITH_DATA에 적는다`).toBe(data.windows.length > 0);
      expect(data.defs !== undefined, `${decade}: 데이터가 있는 덩어리에만 defs가 있다`).toBe(data.windows.length > 0);
    }
  });

  it('조각 마크업의 색은 class(e-·es-·et-·eb-·eh-·ek-)뿐이다: 허용 목록 밖 class 0 · 토큰이 아닌 fill/stroke 0 · <style>·글자·그림 태그·style 속성 0 (그림 안 글자 0 — 허용 목록은 비어 있다)', () => {
    const FILL = /\s(?:fill|stroke)="([^"]*)"/g;
    const lightHex = new Set<string>(Object.values(SCENE_LIGHT));
    for (const [, data] of DECADES) {
      for (const [id, body] of Object.entries(data.art)) {
        expect(body, `${id}: <style>·글자·그림·스크립트·style 속성 0`).not.toMatch(/<style|<text|<tspan|<image|<foreignObject|<script|\sstyle=|\son[a-z]+=/i);
        for (const m of body.matchAll(/\sclass="([^"]*)"/g)) for (const c of m[1].split(/\s+/)) expect(ALLOWED_CLASSES.has(c), `${id}: 허용 목록 밖 class ${c}`).toBe(true);
        // 한 요소에 class 속성이 둘이면 뒤쪽이 버려진다
        expect(body, `${id}: 한 요소에 class가 둘`).not.toMatch(/<[^>]*\sclass="[^"]*"[^>]*\sclass="/);
        for (const m of body.matchAll(FILL)) {
          const v = m[1];
          const ok = v === 'none' || /^url\(#[\w-]+\)$/.test(v) || /^var\(--c-scene-[a-z0-9]+,[^)]*\)?\)$/.test(v);
          expect(ok, `${id}: 조각 본문의 색은 class이거나 none·패턴 참조여야 한다 (${v})`).toBe(true);
        }
        expect(body.startsWith('<g>') && body.endsWith('</g>'), `${id}: 본문은 <g>…</g> 하나`).toBe(true);
        expect(body, `${id}: defs는 덩어리에 한 번 — 조각에는 <defs>·<symbol>·<pattern>이 없다`).not.toMatch(/<defs|<symbol|<pattern/);
      }
      for (const m of (data.defs ?? '').matchAll(FILL)) {
        const v = m[1];
        // 무늬·사람 심볼의 색: 토큰 변수(--c-scene-*)이거나, 사람 색 변수(--t·--b·--h·--k)와 라이트 값 fallback
        const mt = /^var\(--([tbhk]),(#[0-9a-f]{6})\)$/.exec(v);
        const ok = v === 'none' || /^var\(--c-scene-[a-z0-9]+,[^)]*\)?\)$/.test(v) || (mt !== null && lightHex.has(mt[2]));
        expect(ok, `defs의 색 ${v}`).toBe(true);
      }
    }
  });

  it('defs는 10년 덩어리마다 한 번이고 최소다: 그 덩어리 조각이 참조하는 무늬·심볼만 담고, 조각이 참조한 id는 전부 defs에 있다(끊긴 참조 0)', () => {
    for (const [decade, data] of DECADES) {
      if (data.windows.length === 0) continue;
      const defs = data.defs!;
      expect(defs.startsWith('<defs>') && defs.endsWith('</defs>'), `${decade}`).toBe(true);
      expect(defs.match(/<defs>/g)?.length, `${decade}: defs는 하나`).toBe(1);
      const defined = [...defs.matchAll(/<(?:pattern|symbol)\b[^>]*\bid="([^"]+)"/g)].map((m) => m[1]);
      expect(new Set(defined).size, `${decade}: defs id 중복`).toBe(defined.length);
      const used = new Set<string>();
      for (const body of Object.values(data.art)) for (const m of body.matchAll(/url\(#([\w-]+)\)|href="#([\w-]+)"/g)) used.add(m[1] ?? m[2]);
      for (const id of used) expect(defined, `${decade}: 참조한 ${id}가 defs에 없다`).toContain(id);
      // 심볼이 다른 것을 참조하면 그것도 필요하다 — 닫힘
      for (const m of defs.matchAll(/url\(#([\w-]+)\)|href="#([\w-]+)"/g)) used.add(m[1] ?? m[2]);
      for (const id of defined) expect(used.has(id), `${decade}: 쓰이지 않는 defs ${id}`).toBe(true);
    }
  });

  it('파서를 거치면 한 요소도 버려지지 않는다: defs + 조각의 도형 태그 수 = 파싱한 노드 수(허용 태그·속성·class 밖의 것이 있으면 줄어든다)', () => {
    const count = (nodes: SvgNode[]): number => nodes.reduce((a, n) => a + 1 + count(n.children), 0);
    for (const [decade, data] of DECADES) {
      for (const [id, body] of Object.entries(data.art)) {
        const markup = (data.defs ?? '') + body;
        const tags = (markup.match(/<(?:defs|pattern|symbol|g|rect|circle|ellipse|path|line|use)\b/g) ?? []).length;
        const nodes = parseSvgMarkup(markup, 'x');
        expect(count(nodes), `${decade} ${id}`).toBe(tags);
        // class가 하나도 버려지지 않는다
        const classes = (markup.match(/\sclass="/g) ?? []).length;
        const kept = (function walk(ns: SvgNode[]): number { return ns.reduce((a, n) => a + (n.props.className !== undefined ? 1 : 0) + walk(n.children), 0); })(nodes);
        expect(kept, `${decade} ${id}: class`).toBe(classes);
      }
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

  it('덩어리 크기(마스터 결정): 10년 덩어리 하나 gzip ≤ 24KB, 전부 합쳐 ≤ 230KB(누적·지연), 판 하나가 한 번에 받는 양(그림 덩어리 + 표 덩어리 + 가장 큰 10년 덩어리) ≤ 75KB, 2027년 이후가 늘린 양 ≤ 98.7KB — 예측 근거 글(FU11)의 바이트도 덩어리에 들어 있다', async () => {
    let total = 0;
    let maxDecade = 0;
    let future = 0;
    const sizes: string[] = [];
    for (const [d, data] of DECADES) {
      const gz = data.windows.length === 0 ? 0 : await gzipOf(JSON.stringify(data));
      expect(gz, `${d}년대 덩어리 gzip`).toBeLessThanOrEqual(24 * 1024);
      total += gz;
      maxDecade = Math.max(maxDecade, gz);
      // SPEC-010 FU9: 2027년 이후가 늘린 양 = 2030년대 이후 새 덩어리 + 2020년대 덩어리가 SPEC-010 전(11,006B)보다 늘어난 만큼
      if (d >= 2030) future += gz;
      if (d === 2020) future += gz - D2020_GZ_BEFORE_SPEC010;
      if (gz > 0) sizes.push(`${d}:${gz}`);
    }
    expect(total).toBeLessThanOrEqual(230 * 1024);
    expect(future, `2027년 이후가 늘린 양 ${future}B`).toBeLessThanOrEqual(FUTURE_ADDED_MAX);
    // 그림 덩어리(familyArt)와 표 덩어리(familyData)는 원료 파일의 gzip으로 어림한다 — 진짜 빌드 덩어리는 e2e-prod가 잰다
    const art = (await gzipOf(await readText('../src/data/familyArt/pieces.json'))) + (await gzipOf((await readText('../src/data/familyArt/figure.ts')) + (await readText('../src/data/familyArt/house.ts')) + (await readText('../src/data/familyArt/svg.ts'))));
    const tables = await gzipOf(await readText('../src/data/family/tables.json'));
    const oneShot = art + tables + maxDecade;
    const foresightGz = await gzipOf(JSON.stringify(ALL.flatMap((x) => (x.foresight === undefined ? [] : [x.foresight]))));
    console.log(`[SPEC-013 시대의 창 크기] 10년 덩어리 gzip ${sizes.join(' · ')} · 합 ${total}B(한도 ${230 * 1024}B, 옛 211,910B) · 가장 큰 덩어리 ${maxDecade}B(한도 ${24 * 1024}B) · 2027년 이후가 늘린 양 ${future}B(한도 ${FUTURE_ADDED_MAX}B) · 예측 근거 글만 gzip ${foresightGz}B · 판 하나가 한 번에 받는 양(어림) 그림 ${art}B + 표 ${tables}B + 최대 10년 ${maxDecade}B = ${oneShot}B`);
    expect(oneShot).toBeLessThanOrEqual(75 * 1024);
  });
});

describe('그림 한 장의 크기 (r5 예산, era-window.md 9-2·10-3절)', () => {
  it('조각 하나 gzip ≤ 2.5KB, 군중이 많은 무거운 장면은 ≤ 3.5KB — 2.5KB를 넘는 장은 무거운 군중 장면(1980 금남로)뿐이다 (2009 철거 현장은 퇴역)', async () => {
    const over: string[] = [];
    for (const [, data] of DECADES) {
      for (const win of data.windows) {
        const gz = await gzipOf(data.art[win.draw]);
        expect(gz, `${win.id} gzip ${gz}B`).toBeLessThanOrEqual(win.heavy ? 3500 : 2500);
        if (gz > 2500) over.push(win.id);
      }
    }
    expect(over.sort()).toEqual(['era-1980-may-geumnam-ro']);
  });
});

describe('10년 덩어리 로더 (A-10)', () => {
  it('데이터가 있는 10년대(1980)는 덩어리를 받아 장면 5장과 defs를 돌려주고, 같은 10년대를 다시 부르면 같은 약속·같은 결과다', async () => {
    resetFamilyArtForTest();
    expect(eraDecadeIfLoaded(1980)).toBeNull();
    const a = loadEraDecade(1980);
    expect(loadEraDecade(1980)).toBe(a);
    const data = await a;
    expect(data.windows.length).toBe(5);
    expect(data.defs).toMatch(/^<defs><(pattern|symbol) id="/); // 이 10년 덩어리의 그림이 쓰는 반복 무늬·사람 심볼만 담는다
    expect(eraDecadeIfLoaded(1980)).toBe(data);
  });
  it('승인된 그림이 있는 10년대는 모두 자기 덩어리를 받는다(2000~2100년대 포함) — 목록에 없는 10년대(1930·2110: 표 밖)만 아무 덩어리도 받지 않고 빈 데이터를 돌려준다 (2110년 뒤의 끝 장면은 2100년대 덩어리에 있다)', async () => {
    resetFamilyArtForTest();
    for (const [d, n] of [[2000, 4], [2010, 4], [2020, 4], [2030, 2], [2040, 2], [2050, 2], [2060, 2], [2070, 2], [2080, 3], [2090, 1], [2100, 3]] as const) {
      const data = await loadEraDecade(d);
      expect(data.windows.length, `${d}`).toBe(n);
      expect(data.defs, `${d}`).toMatch(/^<defs>/);
    }
    for (const d of [1930, 2110]) expect(await loadEraDecade(d)).toEqual({ windows: [], art: {} });
    expect((await loadEraDecade(2100)).windows.some((x) => x.kind === 'base' && x.years[0] === 2110), '2110년 뒤를 덮는 끝 장면은 2100년대 덩어리에 들어 있다').toBe(true);
  });
});

describe('eraOf — 사건만 고르기 (SPEC-013 T1 1·2·3, 완료 기준 1·3)', () => {
  const ev88 = w('올림픽', [1988, 1988], { hCode: 'H-C03' });
  const reg88 = w('지역일', [1988, 1988], { regionKey: '부산', line: '부산 소식입니다.' });
  const ev74 = w('지하철', [1974, 1974]);
  const heavy80 = w('오월', [1980, 1980], { heavy: true, line: '5월의 일입니다.' });
  const june = w('유월', [1987, 1987], { heavy: true });
  const dec = w('십이월', [1987, 1987], { caption: '12월 투표' });

  it('승인 후보가 없으면 빈 해(pic·line·둘째 문장·캡션 null)', () => {
    expect(eraOf(1988, ctx([]))).toEqual({ pic: null, line: null, veiled: false, sourceYear: 1988, second: null, caption: null });
    expect(eraRowsOf(1980, 40, ctx([]))).toEqual([]);
  });
  it('사건이 있는 해만 그림·줄이 있고 그 밖의 해는 빈 해다 — 일상·기본 장면으로 내려가지 않는다 (10년의 어느 해든)', () => {
    const pool = [ev88, ev74];
    expect(eraOf(1988, ctx(pool))).toMatchObject({ pic: ev88, line: ev88, veiled: false, caption: '올림픽 캡션', sourceYear: 1988 });
    for (const y of [1970, 1975, 1980, 1985, 1987, 1989, 2000]) expect(eraOf(y, ctx(pool)), `${y}`).toMatchObject({ pic: null, line: null, caption: null, second: null });
  });
  it('우선순위: 출생 시도의 지역 사건 > 전국 사건, 출생 시도가 다른 지역 사건은 후보가 아니다', () => {
    expect(eraOf(1988, ctx([ev88, reg88], { regionKey: '부산' })).pic?.id).toBe('지역일');
    expect(eraOf(1988, ctx([ev88, reg88], { regionKey: '서울' })).pic?.id).toBe('올림픽');
  });
  it('같은 해 사건이 둘이면 무거운 쪽(1987 6월 > 12월 투표소), 둘 다 무겁지 않으면 시드로 하나 — 같은 판은 늘 같고 시드가 다르면 갈린다', () => {
    for (let seed = 0; seed < 30; seed++) expect(eraOf(1987, ctx([dec, june], { seed })).pic?.id, `시드 ${seed}`).toBe('유월');
    const a = eraOf(1987, ctx([w('가', [1987, 1987]), w('나', [1987, 1987])], { seed: 1 })).pic?.id;
    expect(eraOf(1987, ctx([w('나', [1987, 1987]), w('가', [1987, 1987])], { seed: 1 })).pic?.id, '목록 순서와 무관').toBe(a);
    const picks = new Set(Array.from({ length: 60 }, (_, s) => eraOf(1987, ctx([w('가', [1987, 1987]), w('나', [1987, 1987])], { seed: s * 7919 })).pic?.id));
    expect(picks.size).toBe(2);
  });
  it('미승인(approved가 true가 아닌 것)은 후보가 아니다 — 데이터 파일 밖 경로(합성)에서도 빌드가 막지 못한 것을 고르기가 한 번 더 막는다', () => {
    const sneaky = { ...ev88, approved: false } as unknown as EraWindow;
    expect(eraOf(1988, ctx([sneaky])).pic).toBeNull();
  });
  it('해마다 독립이다: 이전 해를 걸어오지 않는다 — 어느 순서로 불러도 eraOf(해)는 같고, 같은 그림 3해 연속·한 판에 한 번 같은 상태가 없다', () => {
    const pool = [ev88, ev74, heavy80, june, dec];
    const years = [1990, 1988, 1974, 1987, 1980, 1988, 1974];
    const first = years.map((y) => eraOf(y, ctx(pool, { birthYear: 1970 })));
    const second = [...years].reverse().map((y) => eraOf(y, ctx(pool, { birthYear: 1970 }))).reverse();
    expect(second).toEqual(first);
  });

  it('가리기: 꺼짐(기본)이면 그대로, 켜면 무거운 사건은 veiled — 대체 사건 그림이 없으면 그림 없는 빈 틀(캡션 null — 화면이 「가려 둔 장면」)이고 줄은 가려진 사건 그대로다', () => {
    expect(eraOf(1980, ctx([heavy80], { gentle: false }))).toMatchObject({ veiled: false, caption: '오월 캡션' });
    expect(eraOf(1980, ctx([heavy80], { gentle: false })).pic?.id).toBe('오월');
    const on = eraOf(1980, ctx([heavy80], { gentle: true }));
    expect(on).toMatchObject({ pic: null, veiled: true, caption: null, second: null });
    expect(on.line?.id).toBe('오월');
    // 무겁지 않은 사건은 가리기와 무관
    expect(eraOf(1988, ctx([ev88], { gentle: true })).veiled).toBe(false);
    expect(eraOf(1988, ctx([ev88], { gentle: true })).pic?.id).toBe('올림픽');
  });
  it('가리기: 같은 해에 무겁지 않은 사건 그림(12월 투표소)이 따로 있으면 그것과 그 캡션이 대체다 — 줄은 가려진 6월 그대로 (FM5b 마스터 결정 2026-10-28)', () => {
    const on = eraOf(1987, ctx([june, dec], { gentle: true }));
    expect(on.pic?.id).toBe('십이월');
    expect(on.caption).toBe('12월 투표');
    expect(on.line?.id).toBe('유월');
    expect(on.veiled).toBe(true);
    // 꺼져 있으면 무거운 쪽(6월)이 그대로 그림이다
    const off = eraOf(1987, ctx([june, dec], { gentle: false }));
    expect(off.pic?.id).toBe('유월');
    expect(off.veiled).toBe(false);
    expect(off.caption).toBe('유월 캡션');
  });
  it('가리기의 대체 사건은 지역 사건·전국 사건 순서를 지킨다: 무거운 사건이 있는 해에 무겁지 않은 전국 사건이 대체가 된다', () => {
    expect(eraOf(1987, ctx([june, w('십이월전국', [1987, 1987])], { gentle: true })).pic?.id).toBe('십이월전국');
  });
  it('10년 덩어리 번호: 1940~2109 → 1940~2100, 그 앞·뒤는 가장자리 10년대 (SPEC-010 FU7: 2060 → 2060, 2200 → 2100)', () => {
    expect([1940, 1949, 1950, 1999, 2000, 2025, 2026, 2060, 2109, 2110].map(eraDecadeOf)).toEqual([1940, 1940, 1950, 1990, 2000, 2020, 2020, 2060, 2100, 2100]);
    expect(eraDecadeOf(1920)).toBe(ERA_FIRST_DECADE);
    expect(eraDecadeOf(2200)).toBe(ERA_LAST_DECADE);
  });
  it('수저 구간 변환: 재력 1·2 아래 · 3 가운데 · 4·5 위', () => {
    expect([1, 2, 3, 4, 5].map(bandOfWealth)).toEqual(['low', 'low', 'mid', 'high', 'high']);
  });
});

describe('eraOf — 수저 둘째 문장 (SPEC-013 T1 4, 완료 기준 4·8)', () => {
  const second = { low: '집에서는 가 문장입니다.', mid: '집에서는 나 문장입니다.', high: '집에서는 다 문장입니다.' };
  const star = w('별', [1997, 1997], { second });
  const kid = w('아이', [1997, 1997], { second, secondAges: [7, 19] });

  it('고른 구간의 둘째 문장이 오른다: 아래·가운데·위, band를 안 주면 가운데 — 첫 문장·그림·캡션은 구간과 무관하게 같다', () => {
    for (const [band, s] of [['low', second.low], ['mid', second.mid], ['high', second.high]] as const) {
      const p = eraOf(1997, ctx([star], { band }));
      expect(p.second, band).toBe(s);
      expect(p.pic?.id).toBe('별');
      expect(p.line?.line).toBe('별 문장입니다.');
      expect(p.caption).toBe('별 캡션');
    }
    expect(eraOf(1997, ctx([star])).second, 'band를 안 주면 가운데').toBe(second.mid);
    expect(eraOf(1997, ctx([w('둘째 없음', [1997, 1997])], { band: 'low' })).second, '★ 아닌 사건은 둘째 문장이 없다').toBeNull();
  });
  it('secondAges 밖에서는 둘째 문장만 빠지고 첫 문장은 나온다(0세 포함) — 안에서는 나온다, 출생 연도를 모르면 나이를 보지 않는다', () => {
    const c = (age: number): EraContext => ctx([kid], { band: 'mid', birthYear: 1997 - age });
    for (const age of [0, 3, 6, 20, 60]) {
      const p = eraOf(1997, c(age));
      expect(p.second, `${age}세`).toBeNull();
      expect(p.line?.line, `${age}세: 첫 문장은 나온다`).toBe('아이 문장입니다.');
      expect(p.pic?.id).toBe('아이');
    }
    for (const age of [7, 12, 19]) expect(eraOf(1997, c(age)).second, `${age}세`).toBe(second.mid);
    expect(eraOf(1997, ctx([kid], { band: 'mid' })).second, '출생 연도 없음').toBe(second.mid);
    // 줄(eraRowsOf)도 같다: 0세에 첫 문장만
    const rows = eraRowsOf(1997, 10, ctx([kid], { band: 'high' }));
    expect(rows.map((r) => [r.age, r.second])).toEqual([[0, undefined]]);
    expect(eraRowsOf(1990, 10, ctx([kid], { band: 'high' }))[0]).toMatchObject({ age: 7, year: 1997, line: '아이 문장입니다.', second: second.high });
  });
  it('가린 해에는 둘째 문장이 없다(○ 사건에는 둘째 문장이 없다)', () => {
    const heavyStar = w('무거운별', [1980, 1980], { heavy: true, second });
    expect(eraOf(1980, ctx([heavyStar], { gentle: true, band: 'low' })).second).toBeNull();
  });
});

describe('eraOf — 진짜 데이터 (사건 해만 · 빈 해 · 가리기 · 둘째 문장)', () => {
  const real = (o: Partial<EraContext> = {}): EraContext => ctx(ALL, o);
  const eventYears = [...new Set(ALL.filter((x) => x.kind === 'event').map((x) => x.years[0]))];

  it('사건 49개 해(1987은 둘)에만 그림·줄이 있다: 1940~2109 어느 구간·시드·출생에서도 사건 해는 그 사건의 그림, 그 밖의 120 + 해는 빈 해다', () => {
    expect(eventYears.length).toBe(49);
    for (const band of ['low', 'mid', 'high'] as const) {
      for (const seed of [1, 99, 4242]) {
        let blanks = 0;
        for (let y = 1940; y <= 2109; y++) {
          const p = eraOf(y, real({ band, seed, birthYear: y - 30 }));
          if (eventYears.includes(y)) {
            expect(p.pic, `${band}/${y}`).not.toBeNull();
            expect(p.pic!.kind).toBe('event');
            expect(p.pic!.years).toEqual([y, y]);
            expect(p.line).toBe(p.pic);
            expect(p.veiled).toBe(false);
            expect(p.caption, `${y}: 캡션`).toBe(p.pic!.caption);
          } else {
            blanks++;
            expect(p, `${band}/${y}`).toMatchObject({ pic: null, line: null, veiled: false, second: null, caption: null });
          }
        }
        expect(blanks, '1940~2109 170해 − 사건 49해').toBe(121);
      }
    }
  });
  it('1987은 6월 시위(무거움)가 그림이고, 가리기를 켜면 12월 투표 그림과 캡션 「12월 직선제 투표」로 바뀌되 줄은 가려진 6월이다', () => {
    expect(eraOf(1987, real()).pic?.id).toBe('era-1987-june-street');
    const on = eraOf(1987, real({ gentle: true }));
    expect(on.pic?.id).toBe(ALT_1987_ID);
    expect(on.caption).toBe('12월 직선제 투표');
    expect(on.line?.id).toBe('era-1987-june-street');
    expect(on.veiled).toBe(true);
  });
  it('무거운 사건(재난·정치 16건)은 가리기를 켜면 veiled이고 줄은 그 사건 그대로이며 그림은 없다(1987만 대체 그림) — 경제·감염병·스포츠는 가리지 않는다', () => {
    for (const hv of ALL.filter((x) => x.heavy)) {
      const year = hv.years[0];
      const off = eraOf(year, real({ gentle: false, birthYear: year - 30 }));
      expect(off.veiled, hv.id).toBe(false);
      expect(off.pic?.id, hv.id).toBe(hv.id);
      const on = eraOf(year, real({ gentle: true, birthYear: year - 30 }));
      expect(on.veiled, `${hv.id}: 가리기를 켜면 가려진다`).toBe(true);
      expect(on.line?.id, hv.id).toBe(hv.id);
      expect(on.second, hv.id).toBeNull();
      if (hv.id === 'era-1987-june-street') expect(on.pic?.id).toBe(ALT_1987_ID);
      else expect(on.pic, `${hv.id}: 대체 그림 없음 → 빈 틀`).toBeNull();
    }
    for (const calm of ALL.filter((x) => !x.heavy && x.kind === 'event' && x.id !== ALT_1987_ID)) {
      const p = eraOf(calm.years[0], real({ gentle: true }));
      expect(p.veiled, calm.id).toBe(false);
      expect(p.pic?.id, calm.id).toBe(calm.id);
    }
  });
  it('★ 17건은 구간마다 다른 둘째 문장이 오른다(한 해 한 사건 — 같은 그림·같은 첫 문장), 그 밖의 해·○ 사건은 둘째 문장이 없다', () => {
    for (const row of ERA_EVENT_TABLE) {
      const win = realById(row.id);
      const y = win.years[0];
      const sentences = (['low', 'mid', 'high'] as const).map((band) => eraOf(y, real({ band, birthYear: y - 30 })));
      expect(new Set(sentences.map((p) => p.pic?.id)).size, `${row.no}: 구간과 무관하게 같은 그림`).toBe(1);
      expect(new Set(sentences.map((p) => p.line?.line)).size).toBe(1);
      if (row.star) expect(sentences.map((p) => p.second), row.no).toEqual([win.second!.low, win.second!.mid, win.second!.high]);
      else for (const p of sentences) expect(p.second, row.no).toBeNull();
    }
  });
  it('2026년과 2110년 뒤 규칙은 그대로다: 2026 사건 줄 · 2027~2029 빈 해 · 2109 이후는 끝 장면 (칩·캡션 없음)', () => {
    expect(eraOf(2026, real()).pic?.id).toBe('era-2026-job-board-waiting');
    for (const y of [2027, 2028, 2029]) expect(eraOf(y, real()).pic, `${y}`).toBeNull();
    expect(eraOf(2110, real())).toMatchObject({ line: expect.objectContaining({ id: 'era-end-horizon' }), caption: null, second: null });
    expect(eraOf(2111, real()).line).toBeNull();
    expect(eraOf(2111, real()).pic?.id).toBe('era-end-horizon');
  });
  it('덩어리를 못 받은 판(2060년대 이후 덩어리가 오지 않은 상태): 받지 못한 10년대의 해는 빈 해이고 줄이 없다 — 받은 2050년대까지는 사건 그림이 있다 (SPEC-010, QA-009-FM4b F01)', () => {
    const got = DECADES.filter(([d]) => d <= 2050).flatMap(([, data]) => data.windows);
    for (let y = 2060; y <= 2112; y++) {
      const pick = eraOf(y, ctx(got, { birthYear: y - 30, seed: 99 }));
      expect(pick.pic, `${y}`).toBeNull();
      expect(pick.line, `${y}`).toBeNull();
    }
    for (const y of [2030, 2035, 2040, 2044, 2050, 2055]) expect(eraOf(y, ctx(got, { seed: 99 })).pic, `${y}: 받은 덩어리의 사건 해`).not.toBeNull();
  });
});

describe('eraRowsOf — 인생 기록의 시대 줄(저장하지 않는 파생 줄, A-12)', () => {
  it('출생부터 지금 나이까지 사건이 있던 해만 담고, 연도 = 출생 연도 + 나이, 같은 입력은 같은 줄이다', () => {
    const wins = [w('올림픽', [1988, 1988]), w('지하철', [1974, 1974]), w('외환', [1997, 1997])];
    const rows = eraRowsOf(1985, 14, ctx(wins));
    expect(rows.map((r) => [r.age, r.year, r.line])).toEqual([
      [3, 1988, '올림픽 문장입니다.'],
      [12, 1997, '외환 문장입니다.'],
    ]);
    expect(eraRowsOf(1985, 14, ctx(wins))).toEqual(rows);
    for (const r of rows) expect(r.year).toBe(1985 + r.age);
  });
  it('가려진 해는 줄에 veiled가 켜진다(문장은 화면의 가리기 부품이 가린다)', () => {
    const rows = eraRowsOf(1978, 4, ctx([w('오월', [1980, 1980], { heavy: true })], { gentle: true }));
    expect(rows).toEqual([{ year: 1980, age: 2, line: '오월 문장입니다.', heavy: true, veiled: true, forecast: false }]); // 2026 이하는 「예측」 줄이 아니다 (SPEC-010 EraRow.forecast)
    expect(eraRowsOf(1978, 4, ctx([w('오월', [1980, 1980], { heavy: true })], { gentle: false }))[0].veiled).toBe(false);
  });
  it('실제 데이터: 1962년생의 시대 줄은 사건 해마다 한 줄이고, 줄은 칸(eraOf)이 그해 띄우는 사건의 첫 문장·둘째 문장과 같다', () => {
    const rows = eraRowsOf(1962, 64, ctx(ALL, { band: 'low' }));
    expect(rows.map((r) => r.year)).toEqual([...new Set(ALL.filter((x) => x.kind === 'event' && x.years[0] >= 1962 && x.years[0] <= 2026).map((x) => x.years[0]))].sort((a, b) => a - b));
    for (const r of rows) {
      const pick = eraOf(r.year, ctx(ALL, { band: 'low', birthYear: 1962 }));
      expect(pick.line?.line, `${r.year}`).toBe(r.line);
      expect(pick.second ?? undefined, `${r.year}`).toBe(r.second);
      expect(r.age).toBe(r.year - 1962);
    }
    expect(rows.find((r) => r.year === 1980)).toMatchObject({ age: 18, line: '5월, 광주에 민주화 시위가 있었습니다.', heavy: true, veiled: false });
    expect(rows.find((r) => r.year === 1997)).toMatchObject({ line: '11월, 외환위기가 닥쳐 나라가 구제금융을 요청했습니다.', second: '집에서는 다니던 일터가 문을 닫았습니다.' });
    expect(eraRowsOf(1962, 64, ctx(ALL, { band: 'high' })).find((r) => r.year === 1997)?.second).toBe('집에서는 크게 달라진 게 없었습니다.');
  });
  it('0세: 출생 해에 사건이 있으면 0세 기록에 첫 문장이 나온다 (QA-012 RECORD 2 — 사회 줄은 나이와 무관하게 읽힌다)', () => {
    for (const year of [1945, 1969, 1988, 1997, 2002, 2020, 2022, 2026]) {
      const rows = eraRowsOf(year, 5, ctx(ALL, { band: 'mid' }));
      expect(rows[0], `${year}년생`).toMatchObject({ age: 0, year });
      expect(rows[0].line.length).toBeGreaterThan(0);
    }
  });
});
