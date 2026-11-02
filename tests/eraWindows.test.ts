import { describe, expect, it } from 'vitest';
import { ERA_FIRST_DECADE, ERA_LAST_DECADE, ERA_LAST_YEAR, ERA_LINE_MAX, bandOfWealth, eraDecadeOf, eraOf, eraRowsOf, type EraBand, type EraContext, type EraWindow } from '../src/core/eraWindow';
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
import { SCENE_LIGHT } from '../src/data/familyArt/svg';
import { ALLOWED_CLASSES, parseSvgMarkup, type SvgNode } from '../src/ui/svgNodes';

/**
 * 시대의 창 데이터와 고르기 (SPEC-009 FM5·FM5b, FT1~FT6, family-model.md 9절 · era-window.md 3-1·8절 · T-ERA).
 * FM5b에서 형진 님이 승인한 43장(r3 15 + 1987년 12월 1 + r4 27)이, 시대의 창 r5 반영(2026-11-02)에서 나머지 51장(r5 40 + r5b 11)이 들어와 **승인 94장**이 10년 덩어리 아홉(1940~2020년대)에 있다. 데이터 파일은 `npm run gen:era`가 designer 조각에서 만든 생성 파일이고,
 * 이 시험은 그 내용(승인·형식·색 class·defs 한 번)과 크기 예산, 고르기 규칙(`eraOf`)을 합성 데이터와 진짜 데이터 둘로 잠근다.
 * 「승인한 것만」(FT3): `EraWindow.approved`의 타입이 `true`뿐이라 미승인 장면은 데이터 파일에 쓰는 순간 `npm run typecheck`(= build의 첫 단계)가 막고, 이 시험이 파일 내용과 원문을 한 번 더 점검한다.
 */

const DECADES: Array<[number, EraDecadeData]> = [
  [1940, D1940], [1950, D1950], [1960, D1960], [1970, D1970], [1980, D1980], [1990, D1990], [2000, D2000], [2010, D2010], [2020, D2020],
];
const ALL: readonly EraWindow[] = DECADES.flatMap(([, d]) => d.windows);
const byId = (id: string): EraWindow => ALL.find((w) => w.id === id)!;

const w = (id: string, years: [number, number], over: Partial<EraWindow> = {}): EraWindow => ({ id, years, kind: 'event', topic: '시험', line: `${id} 문장입니다.`, heavy: false, approved: true, draw: id, ...over });
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
  it('10년 덩어리 9개가 모두 있고, 승인된 94장이 아홉 덩어리에 있다(장면 6·8·10·7·10·14·15·13·11) — r3 16 + r4 27 + r5 40 + r5b 11 (scripts/genEraWindows.ts의 승인 장수 가드와 같은 수)', () => {
    expect(DECADES.map(([d]) => d)).toEqual([1940, 1950, 1960, 1970, 1980, 1990, 2000, 2010, 2020]);
    expect(DECADES.map(([, d]) => d.windows.length)).toEqual([6, 8, 10, 7, 10, 14, 15, 13, 11]);
    expect(ALL.length).toBe(94);
    expect([...ERA_DECADES_WITH_DATA]).toEqual([1940, 1950, 1960, 1970, 1980, 1990, 2000, 2010, 2020]);
    expect(Object.keys(ERA_DECADE_LOADERS).map(Number)).toEqual(DECADES.map(([d]) => d));
  });

  it('승인된 94장의 구성: 사건 55 / 일상 39, 무거운 장면 20장(재난·정치만), 수저 구간 분기 14장(변주 일상 12 + 2009년 사건 2)', () => {
    expect(ALL.filter((x) => x.kind === 'event').length).toBe(55); // 승인 43장의 사건 24 + r5 사건 20 + r5b 11(모두 사건)
    expect(ALL.filter((x) => x.kind === 'daily').length).toBe(39); // 승인 43장의 일상 19(변주 4 포함) + r5 일상 12 + r5 변주 8
    expect(ALL.filter((x) => x.heavy).map((x) => x.id).sort()).toEqual([
      'era-1945-liberation-street', 'era-1948-polling-queue', 'era-1950-refugee-column', 'era-1952-ruins-shanty', 'era-1960-april-street', 'era-1961-dawn-tank',
      'era-1979-autumn-martial-street', 'era-1980-may-geumnam-ro', 'era-1987-june-street', 'era-1994-bridge-collapse', 'era-1995-sampoong-rescue', 'era-2003-subway-entrance-smoke',
      'era-2008-candle-summer', 'era-2009-demolition-fire', 'era-2009-square-mourning-queue', 'era-2010-west-sea-search', 'era-2014-tilted-ferry-ribbons', 'era-2016-candle-winter',
      'era-2017-quake-street', 'era-2022-alley-tape-flowers',
    ]);
    for (const x of ALL.filter((y) => y.heavy)) expect(['정치', '재난'], `${x.id}: 가리기 대상은 재난·정치뿐`).toContain(x.topic);
    for (const x of ALL.filter((y) => !y.heavy && y.topic !== '정치')) expect(x.heavy, x.id).toBe(false);
    expect(ALL.filter((x) => x.band !== undefined).map((x) => `${x.id}:${x.band}`).sort()).toEqual([
      'era-1970s-high-piano-living:high', 'era-1970s-low-kerosene-room:low', 'era-1980s-high-apt-stereo:high', 'era-1980s-low-banjiha-room:low',
      'era-1990s-high-newtown-living:high', 'era-1990s-low-rooftop-room:low', 'era-2000s-high-hagwon-street:high', 'era-2000s-low-goshiwon:low',
      'era-2009-demolition-fire:low', 'era-2009-first-smartphone:high', 'era-2010s-high-airport-departure:high', 'era-2010s-low-studio-room:low',
      'era-2020s-high-highrise-wfh:high', 'era-2020s-low-logistics-dawn:low',
    ]);
    // 사건에 band가 있는 것은 2009년 둘뿐이다(철거 현장 low ○ · 첫 스마트폰 high), 가운데 구간의 5월 조문 줄은 band가 없다 (era-window.md 10-1절)
    expect(ALL.filter((x) => x.kind === 'event' && x.band !== undefined).map((x) => `${x.id}:${x.band}:${x.heavy}`).sort()).toEqual(['era-2009-demolition-fire:low:true', 'era-2009-first-smartphone:high:false']);
    expect(byId('era-2009-square-mourning-queue').band).toBeUndefined();
    expect(ALL.filter((x) => x.kind === 'event' && x.years[0] <= 2009 && x.years[1] >= 2009).length).toBe(3);
    // 1987년은 6월(무거움)과 12월 투표소 둘
    expect(ALL.filter((x) => x.kind === 'event' && x.years[0] <= 1987 && x.years[1] >= 1987).map((x) => x.id).sort()).toEqual(['era-1987-june-street', 'era-1987-polling-station-r3']);
  });

  it('r5·r5b 문장은 era-window.md 승인 표기 그대로다: 2009년 세 갈래(철거 현장·조문 줄·첫 스마트폰), 1997 인력시장·1998 급식 줄, 다시 그린 장면의 줄', () => {
    expect(byId('era-2009-demolition-fire').line).toBe('1월, 철거 현장에서 불이 났습니다.');
    expect(byId('era-2009-square-mourning-queue').line).toBe('5월, 광장에 조문 줄이 길었습니다.');
    expect(byId('era-2009-first-smartphone').line).toBe('첫 스마트폰이 손에 들어왔습니다.');
    expect(byId('era-1997-dawn-labor-market').line).toBe('새벽 인력시장에 사람이 늘었습니다.');
    expect(byId('era-1998-station-soup-queue').line).toBe('역 광장에 무료 급식 줄이 늘어섰습니다.');
    expect(byId('era-2022-alley-tape-flowers').line).toBe('10월, 좁은 골목에서 참사가 났습니다.');
    expect(byId('era-1994-bridge-collapse').line).toBe('한강 다리의 한 구간이 무너졌습니다.');
  });

  it('r5b가 다시 그린 아홉은 같은 id가 한 번씩만 있다(r5판과 r5b판이 겹쳐 들어오지 않는다) — 조각이 designer 조각과 같은지는 `npm run gen:era -- --check`가 잠근다', () => {
    const redrawn = ['era-1994-bridge-collapse', 'era-2003-subway-entrance-smoke', 'era-2008-candle-summer', 'era-2009-square-mourning-queue', 'era-2010-west-sea-search', 'era-2014-tilted-ferry-ribbons', 'era-2016-candle-winter', 'era-2017-quake-street', 'era-2022-alley-tape-flowers'];
    for (const id of redrawn) expect(ALL.filter((x) => x.id === id).length, id).toBe(1);
  });

  it('한 줄 문장은 era-window.md 문장 표 그대로다: 1958은 r4b의 「보릿고개에는 나물로 끼니를 이었습니다.」, 1961·1970년대 셋방·1980년대 반지하도 r4b 문장', () => {
    expect(byId('era-1958-barley-spring').line).toBe('보릿고개에는 나물로 끼니를 이었습니다.');
    expect(byId('era-1961-dawn-tank').line).toBe('5월 새벽, 거리에 탱크가 섰습니다.');
    expect(byId('era-1970s-low-kerosene-room').line).toBe('셋방 부엌의 석유곤로로 밥을 지었습니다.');
    expect(byId('era-1980s-low-banjiha-room').line).toBe('반지하 창으로 지나는 발이 보였습니다.');
    expect(byId('era-1980-may-geumnam-ro').line).toBe('5월, 광주에 민주화 시위가 있었습니다.');
    expect(byId('era-1987-june-street').line).toBe('6월, 거리마다 시위가 이어졌습니다.');
    expect(byId('era-1995-sampoong-rescue').line).toBe('서울의 백화점이 무너져 내렸습니다.');
    expect(byId('era-1945-liberation-street').line).toBe('8월, 거리가 태극기로 가득 찼습니다.');
  });

  it('연도 조정 5건(같은 해의 일상·다른 사건이 사건에 가리지 않게): 1998 금 모으기는 1998만(1997은 새벽 인력시장)이고, 1954 구호물자 · 1957 새 기와 · 1962 2부제 · 1966 완행열차의 범위가 한 해이며, 그 사이 해(1955·56·58·65·67)에 일상이 있다', () => {
    expect(byId('era-1998-gold-drive-queue').years).toEqual([1998, 1998]);
    expect(byId('era-1997-dawn-labor-market').years).toEqual([1997, 1997]);
    expect(ALL.filter((x) => x.kind === 'event' && x.years[0] <= 1997 && x.years[1] >= 1997).map((x) => x.id)).toEqual(['era-1997-dawn-labor-market']);
    for (const [id, y] of [['era-1954-relief-queue', 1954], ['era-1957-new-roof-tiles', 1957], ['era-1962-two-shift-gate', 1962], ['era-1966-slow-train-platform', 1966]] as const) expect(byId(id).years, id).toEqual([y, y]);
    for (const [id, y] of [['era-1955-radio-evening', 1955], ['era-1956-alley-marbles', 1956], ['era-1958-barley-spring', 1958], ['era-1965-neighbors-tv', 1965], ['era-1967-wood-stove-kitchen', 1967]] as const) {
      expect(byId(id).kind, id).toBe('daily');
      expect(byId(id).years, id).toEqual([y, y]);
      expect(ALL.filter((x) => x.kind === 'event' && x.years[0] <= y && x.years[1] >= y).map((x) => x.id), `${y}년에는 사건이 없어 ${id}가 보인다`).toEqual([]);
    }
  });

  it('모든 장면은 approved: true이고, 10년대 안에 있으며, 문장이 22자 이하이고, 그림 조각이 있으며, id가 유일하다', () => {
    const ids = new Set<string>();
    for (const [decade, data] of DECADES) {
      for (const win of data.windows) {
        expect(win.approved, `${win.id}: 미승인 장면은 데이터에 들어올 수 없다`).toBe(true);
        expect(win.years[0], win.id).toBeGreaterThanOrEqual(decade);
        expect(win.years[1], win.id).toBeLessThanOrEqual(decade + 9);
        expect(win.years[0], win.id).toBeLessThanOrEqual(win.years[1]);
        expect(win.line.length, `${win.id}: 시대 줄 문장 ${win.line.length}자`).toBeLessThanOrEqual(ERA_LINE_MAX);
        expect(win.line, `${win.id}: 평가어·물음표 없음`).not.toMatch(/[?!]/);
        expect(data.art[win.draw], `${win.id}: 조각 ${win.draw} 마크업이 없다`).toBeTypeOf('string');
        expect(ids.has(win.id), `${win.id}: id 중복`).toBe(false);
        ids.add(win.id);
        if (win.ages !== undefined) expect(win.ages[0], win.id).toBeLessThanOrEqual(win.ages[1]);
      }
      expect(Object.keys(data.art).sort(), `${decade}: 조각은 장면의 draw와 일대일`).toEqual(data.windows.map((x) => x.draw).sort());
      expect(ERA_DECADES_WITH_DATA.includes(decade), `${decade}: 데이터가 있으면 ERA_DECADES_WITH_DATA에 적는다`).toBe(data.windows.length > 0);
      expect(data.defs !== undefined, `${decade}: 데이터가 있는 덩어리에만 defs가 있다`).toBe(data.windows.length > 0);
    }
  });

  it('조각 마크업의 색은 class(e-·es-·et-·eb-·eh-·ek-)뿐이다: 허용 목록 밖 class 0 · 토큰이 아닌 fill/stroke 0 · <style>·글자·그림 태그·style 속성 0', () => {
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

  it('덩어리 크기(마스터 결정): 10년 덩어리 하나 gzip ≤ 24KB, 전부 합쳐 ≤ 230KB(누적·지연), 판 하나가 한 번에 받는 양(그림 덩어리 + 표 덩어리 + 가장 큰 10년 덩어리) ≤ 75KB', async () => {
    let total = 0;
    let maxDecade = 0;
    const sizes: string[] = [];
    for (const [d, data] of DECADES) {
      const gz = data.windows.length === 0 ? 0 : await gzipOf(JSON.stringify(data));
      expect(gz, `${d}년대 덩어리 gzip`).toBeLessThanOrEqual(24 * 1024);
      total += gz;
      maxDecade = Math.max(maxDecade, gz);
      if (gz > 0) sizes.push(`${d}:${gz}`);
    }
    expect(total).toBeLessThanOrEqual(230 * 1024);
    // 그림 덩어리(familyArt)와 표 덩어리(familyData)는 원료 파일의 gzip으로 어림한다 — 진짜 빌드 덩어리는 e2e-prod가 잰다
    const art = (await gzipOf(await readText('../src/data/familyArt/pieces.json'))) + (await gzipOf((await readText('../src/data/familyArt/figure.ts')) + (await readText('../src/data/familyArt/house.ts')) + (await readText('../src/data/familyArt/svg.ts'))));
    const tables = await gzipOf(await readText('../src/data/family/tables.json'));
    const oneShot = art + tables + maxDecade;
    console.log(`[FM5b 시대의 창 크기] 10년 덩어리 gzip ${sizes.join(' · ')} · 합 ${total}B · 판 하나가 한 번에 받는 양(어림) 그림 ${art}B + 표 ${tables}B + 최대 10년 ${maxDecade}B = ${oneShot}B`);
    expect(oneShot).toBeLessThanOrEqual(75 * 1024);
  });
});

describe('그림 한 장의 크기 (r5 예산, era-window.md 9-2·10-3절)', () => {
  it('조각 하나 gzip ≤ 2.5KB, 군중이 많은 무거운 장면은 ≤ 3.5KB — 2.5KB를 넘는 장은 무거운 군중 장면 둘(1980 금남로 · 2009 철거 현장)뿐이다', async () => {
    const over: string[] = [];
    for (const [, data] of DECADES) {
      for (const win of data.windows) {
        const gz = await gzipOf(data.art[win.draw]);
        expect(gz, `${win.id} gzip ${gz}B`).toBeLessThanOrEqual(win.heavy ? 3500 : 2500);
        if (gz > 2500) over.push(win.id);
      }
    }
    expect(over.sort()).toEqual(['era-1980-may-geumnam-ro', 'era-2009-demolition-fire']);
  });
});

describe('10년 덩어리 로더 (A-10)', () => {
  it('데이터가 있는 10년대(1980)는 덩어리를 받아 장면 10장과 defs를 돌려주고, 같은 10년대를 다시 부르면 같은 약속·같은 결과다', async () => {
    resetFamilyArtForTest();
    expect(eraDecadeIfLoaded(1980)).toBeNull();
    const a = loadEraDecade(1980);
    expect(loadEraDecade(1980)).toBe(a);
    const data = await a;
    expect(data.windows.length).toBe(10);
    expect(data.defs).toContain('<symbol id="pf"'); // 이 10년 덩어리의 그림이 쓰는 사람 심볼만 담는다
    expect(eraDecadeIfLoaded(1980)).toBe(data);
  });
  it('승인된 그림이 있는 10년대는 모두 자기 덩어리를 받는다(2000·2010·2020 포함) — 목록에 없는 10년대(1930·2030)만 아무 덩어리도 받지 않고 빈 데이터를 돌려준다', async () => {
    resetFamilyArtForTest();
    for (const [d, n] of [[2000, 15], [2010, 13], [2020, 11]] as const) {
      const data = await loadEraDecade(d);
      expect(data.windows.length, `${d}`).toBe(n);
      expect(data.defs, `${d}`).toMatch(/^<defs>/);
    }
    for (const d of [1930, 2030]) expect(await loadEraDecade(d)).toEqual({ windows: [], art: {} });
  });
});

describe('eraOf — 순수 고르기 (9-2절 · era-window.md 3-1·8-2)', () => {
  const nat1988 = w('올림픽', [1988, 1988], { hCode: 'H-C03' });
  const reg1988 = w('지역일', [1988, 1988], { regionKey: '부산', line: '부산 소식입니다.' });
  const daily70 = w('연탄골목', [1970, 1979], { kind: 'daily', line: '골목마다 연탄불이 피었습니다.' });
  const daily70b = w('도시락', [1970, 1979], { kind: 'daily', line: '난로 위에 도시락이 올랐습니다.' });
  const base = w('창가', [1940, 2025], { kind: 'base', line: '그해에도 하루는 이어졌습니다.' });
  const heavy80 = w('오월', [1980, 1980], { heavy: true, line: '5월의 일입니다.' });

  it('승인 후보가 없으면 빈 틀(pic·line null)', () => {
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
  it('사건이 둘이면 무거운 쪽(1987 6월 > 12월 투표소), 둘 다 무겁지 않으면 시드로 하나', () => {
    const june = w('유월', [1987, 1987], { heavy: true });
    const dec = w('십이월', [1987, 1987]);
    for (let seed = 0; seed < 30; seed++) expect(eraOf(1987, ctx([dec, june], { seed })).pic?.id, `시드 ${seed}`).toBe('유월');
    const picks = new Set(Array.from({ length: 60 }, (_, s) => eraOf(1987, ctx([dec, w('십일월', [1987, 1987])], { seed: s * 7919 })).pic?.id));
    expect(picks.size).toBe(2);
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
  it('2026년 이후: 사건은 쓰지 않고(출처 없는 미래 사건 금지) 2025년의 생활·기본 장면을 유지한다 — 해가 달라도 같은 그림', () => {
    const ev2025 = w('이천이십오', [2025, 2025]);
    const daily2025 = w('요즘', [2020, 2025], { kind: 'daily' });
    const daily2025b = w('요즘둘', [2020, 2025], { kind: 'daily' });
    const pick = eraOf(2031, ctx([ev2025, daily2025]));
    expect(pick.pic?.id).toBe('요즘');
    expect(pick.sourceYear).toBe(ERA_LAST_YEAR);
    expect(eraOf(2031, ctx([ev2025])).pic).toBeNull();
    const ids = new Set([2026, 2030, 2044, 2090].map((y) => eraOf(y, ctx([ev2025, daily2025, daily2025b])).pic?.id));
    expect(ids.size, '전망 구간은 2025년 그림을 유지한다').toBe(1);
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
  it('가리기: 같은 해에 무겁지 않은 사건 그림(12월 투표소)이 따로 있으면 그것이 대체 그림이다 — 줄은 가려진 6월 그대로 (FM5b 마스터 결정 2026-10-28)', () => {
    const dec = w('십이월', [1987, 1987]);
    const june = w('유월', [1987, 1987], { heavy: true });
    const d80 = w('일상80', [1980, 1989], { kind: 'daily' });
    const on = eraOf(1987, ctx([june, dec, d80], { gentle: true }));
    expect(on.pic?.id).toBe('십이월');
    expect(on.line?.id).toBe('유월');
    expect(on.veiled).toBe(true);
    // 꺼져 있으면 무거운 쪽(6월)이 그대로 그림이다
    const off = eraOf(1987, ctx([june, dec, d80], { gentle: false }));
    expect(off.pic?.id).toBe('유월');
    expect(off.veiled).toBe(false);
    // 무겁지 않은 사건이 없는 해(1980 광주 하나뿐)는 그 10년 일상으로 간다
    expect(eraOf(1980, ctx([heavy80, d80], { gentle: true })).pic?.id).toBe('일상80');
  });
  it('가리기의 대체 사건은 지역 사건·전국 사건 순서를 지킨다: 무거운 지역 사건이면 같은 해의 무겁지 않은 지역 사건이 먼저', () => {
    const june = w('유월', [1987, 1987], { heavy: true });
    const decNat = w('십이월전국', [1987, 1987]);
    expect(eraOf(1987, ctx([june, decNat], { gentle: true })).pic?.id).toBe('십이월전국');
  });
  it('10년 덩어리 번호: 1940~2029 → 1940~2020, 그 앞·뒤는 가장자리 10년대', () => {
    expect([1940, 1949, 1950, 1999, 2000, 2025, 2026, 2060].map(eraDecadeOf)).toEqual([1940, 1940, 1950, 1990, 2000, 2020, 2020, 2020]);
    expect(eraDecadeOf(1920)).toBe(ERA_FIRST_DECADE);
    expect(eraDecadeOf(2200)).toBe(ERA_LAST_DECADE);
  });
  it('수저 구간 변주: 아래·위 구간은 사건 없는 해에 자기 구간 변주를 먼저 보고, 가운데는 변주를 보지 않는다', () => {
    const low = w('셋방', [1970, 1979], { kind: 'daily', band: 'low' });
    const high = w('양옥', [1970, 1979], { kind: 'daily', band: 'high' });
    const plain = w('연탄', [1970, 1979], { kind: 'daily' });
    const pool = [low, high, plain];
    expect(eraOf(1973, ctx(pool, { band: 'low' })).pic?.id).toBe('셋방');
    expect(eraOf(1973, ctx(pool, { band: 'high' })).pic?.id).toBe('양옥');
    for (let seed = 0; seed < 20; seed++) expect(eraOf(1973, ctx(pool, { band: 'mid', seed })).pic?.id).toBe('연탄');
    expect(eraOf(1973, ctx(pool)).pic?.id, 'band를 안 주면 가운데').toBe('연탄');
    // 사건이 있는 해는 구간과 무관하게 사건
    expect(eraOf(1974, ctx([...pool, w('지하철', [1974, 1974])], { band: 'low' })).pic?.id).toBe('지하철');
    // 변주가 없는 10년대는 기본 일상으로 닿는다
    expect(eraOf(1985, ctx([...pool, w('팔십', [1980, 1989], { kind: 'daily' })], { band: 'low' })).pic?.id).toBe('팔십');
    // 가리기도 구간 변주를 먼저 본다
    expect(eraOf(1979, ctx([...pool, w('계엄', [1979, 1979], { heavy: true })], { band: 'high', gentle: true })).pic?.id).toBe('양옥');
    expect(bandOfWealth(1)).toBe('low');
    expect(bandOfWealth(2)).toBe('low');
    expect(bandOfWealth(3)).toBe('mid');
    expect(bandOfWealth(4)).toBe('high');
    expect(bandOfWealth(5)).toBe('high');
  });
  it('나이대: 나이가 일상의 나이대(ages) 안일 때만 고르고, 맞는 것이 없으면 그 10년의 다른 일상으로 내려간다', () => {
    const child = w('교실', [1970, 1970], { kind: 'daily', ages: [7, 12] });
    const adult = w('공단', [1970, 1970], { kind: 'daily', ages: [15, 29] });
    const any = w('연탄', [1971, 1979], { kind: 'daily' });
    expect(eraOf(1970, ctx([child, adult, any], { birthYear: 1961 })).pic?.id, '9세').toBe('교실');
    expect(eraOf(1970, ctx([child, adult, any], { birthYear: 1950 })).pic?.id, '20세').toBe('공단');
    expect(eraOf(1970, ctx([child, adult, any], { birthYear: 1920 })).pic?.id, '50세는 둘 다 안 맞아 그 10년의 나이대 없는 일상').toBe('연탄');
    expect(eraOf(1970, ctx([child, adult], { birthYear: 1920 })).pic, '맞는 것이 하나도 없으면 나이대를 풀어서라도 그 10년 일상').not.toBeNull();
    expect(['교실', '공단'], '출생 연도를 모르면 나이대를 보지 않는다').toContain(eraOf(1970, ctx([child, adult, any])).pic?.id);
  });
  it('같은 그림을 3해 연속 쓰지 않는다: 후보가 둘 이상이면 어느 시드·구간·출생에서도 이어진 세 해가 같은 그림이 아니다', () => {
    const low = w('셋방', [1970, 1979], { kind: 'daily', band: 'low' });
    const a = w('연탄', [1970, 1979], { kind: 'daily' });
    const b = w('도시락', [1970, 1979], { kind: 'daily' });
    for (const pool of [[low, a], [low, a, b], [a, b]]) {
      for (let seed = 0; seed < 30; seed++) {
        const picks = Array.from({ length: 10 }, (_, i) => eraOf(1970 + i, ctx(pool, { band: 'low', seed, birthYear: 1950 })).pic?.id);
        for (let i = 2; i < picks.length; i++) expect(picks[i - 2] === picks[i - 1] && picks[i - 1] === picks[i], `시드 ${seed}: ${picks.join(',')}`).toBe(false);
      }
    }
    // 후보가 하나뿐이면 어쩔 수 없이 이어진다(빈 틀보다 낫다)
    expect(Array.from({ length: 6 }, (_, i) => eraOf(1970 + i, ctx([a], { birthYear: 1950 })).pic?.id)).toEqual(['연탄', '연탄', '연탄', '연탄', '연탄', '연탄']);
  });
  it('실제 승인 데이터: 1940~2025 어느 해·시드·구간·가리기·출생에서도 같은 그림이 3해 연속 이어지지 않는다', () => {
    const bands: EraBand[] = ['low', 'mid', 'high'];
    for (const seed of [1, 99, 4242, 123456]) {
      for (const band of bands) {
        for (const gentle of [false, true]) {
          for (const birthYear of [1940, 1951, 1964, 1977, 1986, 1999]) {
            const picks: Array<string | undefined> = [];
            for (let y = birthYear; y <= 2025; y++) picks.push(eraOf(y, ctx(ALL, { seed, band, gentle, birthYear })).pic?.id);
            for (let i = 2; i < picks.length; i++) {
              if (picks[i] === undefined) continue;
              expect(picks[i - 2] === picks[i - 1] && picks[i - 1] === picks[i], `${seed}/${band}/${gentle}/${birthYear} ${birthYear + i}: ${picks[i]}`).toBe(false);
            }
          }
        }
      }
    }
  });
  it('실제 승인 데이터: 사건 해는 사건 그림, 1958은 보릿고개, 1970년대 아래·위 구간은 셋방·양옥, 1980년대는 반지하·아파트 거실, 1990년대 이후도 해마다 그림이 닿는다', () => {
    const c = (o: Partial<EraContext> = {}): EraContext => ctx(ALL, o);
    expect(eraOf(1980, c()).pic?.id).toBe('era-1980-may-geumnam-ro');
    expect(eraOf(1987, c()).pic?.id, '6월(무거움) > 12월').toBe('era-1987-june-street');
    expect(eraOf(1995, c()).pic?.id).toBe('era-1995-sampoong-rescue');
    // 1997은 새벽 인력시장(금 모으기는 1998만 — TRIM), 1998은 금 모으기 ↔ 역 광장 급식 줄(둘 다 무겁지 않아 시드로 하나, 둘 다 나온다)
    expect(eraOf(1997, c()).pic?.id).toBe('era-1997-dawn-labor-market');
    const y98 = new Set(Array.from({ length: 60 }, (_, s) => eraOf(1998, c({ seed: s * 7919 })).pic?.id));
    expect([...y98].sort()).toEqual(['era-1998-gold-drive-queue', 'era-1998-station-soup-queue']);
    expect(eraOf(1998, c({ gentle: true })).veiled, '경제 장면은 가리기 대상이 아니다').toBe(false);
    expect(eraOf(2014, c()).pic?.id).toBe('era-2014-tilted-ferry-ribbons');
    expect(eraOf(2022, c()).pic?.id).toBe('era-2022-alley-tape-flowers');
    expect(eraOf(1958, c({ birthYear: 1950 })).pic?.id).toBe('era-1958-barley-spring');
    expect(eraOf(1961, c()).pic?.id).toBe('era-1961-dawn-tank');
    expect(eraOf(1973, c({ band: 'low', birthYear: 1950 })).pic?.id).toBe('era-1970s-low-kerosene-room');
    expect(eraOf(1973, c({ band: 'high', birthYear: 1950 })).pic?.id).toBe('era-1970s-high-piano-living');
    expect(eraOf(1983, c({ band: 'low', birthYear: 1960 })).pic?.id).toBe('era-1980s-low-banjiha-room');
    expect(eraOf(1983, c({ band: 'high', birthYear: 1960 })).pic?.id).toBe('era-1980s-high-apt-stereo');
    // 1990년대 이후도 사건 없는 해는 그 10년의 일상, 사건이 있는 해는 사건이다
    for (const [year, kind, dec] of [[1992, 'daily', 1990], [2007, 'daily', 2000], [2013, 'daily', 2010], [2010, 'event', 2010], [2025, 'event', 2020]] as const) {
      const pick = eraOf(year, c({ birthYear: year - 25 }));
      expect(pick.pic, `${year}`).not.toBeNull();
      expect(pick.pic!.kind, `${year}`).toBe(kind);
      expect(Math.floor(pick.pic!.years[0] / 10) * 10, `${year}`).toBe(dec);
    }
    // 전망 구간: 2026년 이후는 사건을 쓰지 않고 2020년대 일상이 오른다(2025 사건이 아니라)
    expect(eraOf(2031, c({ birthYear: 2010 })).pic?.kind).toBe('daily');
    expect(eraOf(2031, c({ birthYear: 2010 })).sourceYear).toBe(ERA_LAST_YEAR);
  });

  it('실제 승인 데이터: 1940~2040 어느 해·구간·나이에서도 승인된 그림이 닿는다 — 빈 틀은 데이터가 안 온 때(덩어리 실패)뿐이다', () => {
    for (const band of ['low', 'mid', 'high'] as const) {
      for (const gentle of [false, true]) {
        for (let y = 1940; y <= 2040; y++) {
          for (const birthYear of [y - 3, y - 15, y - 25, y - 45, y - 70]) {
            if (birthYear > y || y - birthYear > 100) continue;
            const pick = eraOf(y, ctx(ALL, { band, gentle, birthYear, seed: 99 }));
            expect(pick.pic, `${band}/${gentle}/${y}/${birthYear}년생`).not.toBeNull();
          }
        }
      }
    }
  });
  it('실제 승인 데이터 · 가리기: 무거운 장면(재난·정치) 20장의 해는 가려지고 그해 일상 그림(1987년은 12월 투표소)으로 바뀐다 — 경제(1997~98)는 가리지 않는다. 2009 철거 현장은 아래 구간에게만 보이므로 아래 구간으로 본다', () => {
    for (const hv of ALL.filter((x) => x.heavy)) {
      const year = hv.years[0];
      const band: EraBand = hv.band ?? 'mid'; // 그 장면을 보는 구간 (band 없는 장면은 가운데도 본다)
      const off = eraOf(year, ctx(ALL, { gentle: false, birthYear: year - 30, band }));
      expect(off, hv.id).toMatchObject({ veiled: false });
      expect(off.pic?.id, hv.id).toBe(hv.id);
      const on = eraOf(year, ctx(ALL, { gentle: true, birthYear: year - 30, band }));
      expect(on.veiled, `${hv.id}: 가리기를 켜면 가려진다`).toBe(true);
      expect(on.line?.id, hv.id).toBe(hv.id);
      if (on.pic !== null) {
        expect(on.pic.heavy, `${hv.id}: 대신 띄우는 그림은 무겁지 않다`).toBe(false);
        // 1987년만 같은 해에 무겁지 않은 사건 그림(12월 투표소)이 있어 그것이 대체 그림이다(FM5b 마스터 결정) — 그 밖은 그 10년의 일상
        if (hv.id === 'era-1987-june-street') {
          expect(on.pic.id).toBe('era-1987-polling-station-r3');
          expect(on.pic.kind).toBe('event');
        } else expect(on.pic.kind, hv.id).toBe('daily');
        expect(on.pic.id).not.toBe(hv.id);
      }
    }
    expect(eraOf(1998, ctx(ALL, { gentle: true })).veiled).toBe(false);
    expect(eraOf(1980, ctx(ALL, { gentle: true, birthYear: 1950 })).pic, '1980년대에는 대신 띄울 일상이 있다').not.toBeNull();
    // 1990년대도 일상이 있다 — 나이대가 안 맞아도(30세) 풀어서라도 그 10년의 일상을 띄운다
    const nineties = eraOf(1995, ctx(ALL, { gentle: true, birthYear: 1965 }));
    expect(nineties.pic?.kind).toBe('daily');
    expect(nineties.pic?.heavy).toBe(false);
    expect(nineties.line?.id).toBe('era-1995-sampoong-rescue');
  });
});

describe('eraOf — 사건의 수저 구간 분기, 2009년 세 갈래 (era-window.md 10-1절)', () => {
  // 합성: 같은 해의 band 사건 둘 + band 없는 사건 하나
  const demo = w('철거', [2009, 2009], { band: 'low', heavy: true, topic: '재난', line: '철거 현장 문장입니다.' });
  const mourn = w('조문', [2009, 2009], { heavy: true, topic: '정치', line: '조문 줄 문장입니다.' });
  const phone = w('스마트폰', [2009, 2009], { band: 'high', line: '스마트폰 문장입니다.' });
  // 일상은 2009 한 해만 — 앞선 두 해에 같은 일상이 이어져 3해 연속 규칙에 걸리는 일이 없다
  const lowDaily = w('고시원', [2009, 2009], { kind: 'daily', band: 'low', line: '고시원 문장입니다.' });
  const plainDaily = w('분식', [2009, 2009], { kind: 'daily', line: '분식 문장입니다.' });
  const pool = [demo, mourn, phone, lowDaily, plainDaily];

  it('① 같은 구간의 band 사건 → ② band 없는 사건 → ③ 일상: 아래는 철거 현장, 가운데는 조문 줄, 위는 첫 스마트폰 (band를 안 주면 가운데)', () => {
    for (let seed = 0; seed < 20; seed++) {
      expect(eraOf(2009, ctx(pool, { band: 'low', seed })).pic?.id, `low ${seed}`).toBe('철거');
      expect(eraOf(2009, ctx(pool, { band: 'mid', seed })).pic?.id, `mid ${seed}`).toBe('조문');
      expect(eraOf(2009, ctx(pool, { band: 'high', seed })).pic?.id, `high ${seed}`).toBe('스마트폰');
      expect(eraOf(2009, ctx(pool, { seed })).pic?.id, 'band를 안 주면 가운데').toBe('조문');
    }
    // 줄은 그림의 문장이다
    expect(eraOf(2009, ctx(pool, { band: 'low' })).line?.line).toBe('철거 현장 문장입니다.');
  });
  it('같은 구간의 band 사건은 band 없는 사건이 더 무거워도 먼저다(① → ②) — 그 구간이 아닌 band 사건은 보이지 않는다', () => {
    const calmLow = w('저구간', [2009, 2009], { band: 'low', line: '아래 구간 문장입니다.' });
    expect(eraOf(2009, ctx([calmLow, mourn], { band: 'low' })).pic?.id).toBe('저구간');
    expect(eraOf(2009, ctx([calmLow, mourn], { band: 'high' })).pic?.id, '위 구간은 아래 구간의 사건을 보지 않는다').toBe('조문');
    expect(eraOf(2009, ctx([calmLow, mourn], { band: 'mid' })).pic?.id, '가운데는 band 사건을 보지 않는다').toBe('조문');
    // band 사건뿐인 해: 가운데는 그 사건을 못 보고 일상으로 내려간다 (사건이 없는 해 → 일상)
    expect(eraOf(2009, ctx([phone, plainDaily], { band: 'mid' })).pic?.id).toBe('분식');
    expect(eraOf(2009, ctx([phone, plainDaily], { band: 'low' })).pic?.id, '아래 구간도 위 구간의 사건은 못 본다').toBe('분식');
    expect(eraOf(2009, ctx([phone, plainDaily], { band: 'high' })).pic?.id).toBe('스마트폰');
  });
  it('가리기를 켜면: 무거운 사건(철거·조문)은 그해 일상으로 — 아래는 구간 변주 일상 먼저, 가운데는 변주 없는 일상 · 줄은 가려진 사건 그대로 · 위의 스마트폰은 무겁지 않아 가리기와 무관', () => {
    const low = eraOf(2009, ctx(pool, { band: 'low', gentle: true }));
    expect(low).toMatchObject({ veiled: true });
    expect(low.pic?.id).toBe('고시원');
    expect(low.line?.id).toBe('철거');
    const mid = eraOf(2009, ctx(pool, { band: 'mid', gentle: true }));
    expect(mid).toMatchObject({ veiled: true });
    expect(mid.pic?.id, '가운데는 구간 변주를 보지 않는다').toBe('분식');
    expect(mid.line?.id).toBe('조문');
    const high = eraOf(2009, ctx(pool, { band: 'high', gentle: true }));
    expect(high).toMatchObject({ veiled: false });
    expect(high.pic?.id).toBe('스마트폰');
    // 가리기 대체 그림은 내 구간에게 보이는 무겁지 않은 사건이 먼저다 — 보이지 않는 band 사건은 대체 그림이 되지 않는다
    expect(eraOf(2009, ctx([mourn, phone, plainDaily], { band: 'mid', gentle: true })).pic?.id).toBe('분식');
    expect(eraOf(2009, ctx([mourn, phone, plainDaily], { band: 'low', gentle: true })).pic?.id).toBe('분식');
  });

  const real = (o: Partial<EraContext>): ReturnType<typeof eraOf> => eraOf(2009, ctx(ALL, { birthYear: 1984, ...o }));
  it('실제 승인 데이터 · 고정: 2009년 아래(1·2단계)는 철거 현장, 가운데(3)는 5월 조문 줄, 위(4·5)는 첫 스마트폰 — 어느 시드·출생에서도, 줄은 승인 표기 문장 그대로', () => {
    const cases: Array<[number, EraBand, string, string, boolean]> = [
      [1, 'low', 'era-2009-demolition-fire', '1월, 철거 현장에서 불이 났습니다.', true],
      [2, 'low', 'era-2009-demolition-fire', '1월, 철거 현장에서 불이 났습니다.', true],
      [3, 'mid', 'era-2009-square-mourning-queue', '5월, 광장에 조문 줄이 길었습니다.', true],
      [4, 'high', 'era-2009-first-smartphone', '첫 스마트폰이 손에 들어왔습니다.', false],
      [5, 'high', 'era-2009-first-smartphone', '첫 스마트폰이 손에 들어왔습니다.', false],
    ];
    for (const [wealth, band, id, line, heavy] of cases) {
      expect(bandOfWealth(wealth), `재력 ${wealth}`).toBe(band);
      for (const seed of [1, 99, 4242, 123456]) {
        for (const birthYear of [1944, 1962, 1984, 1991, 2003]) {
          const p = real({ band: bandOfWealth(wealth), seed, birthYear });
          expect(p.pic?.id, `재력 ${wealth} 시드 ${seed} ${birthYear}년생`).toBe(id);
          expect(p.line?.line).toBe(line);
          expect(p.pic?.heavy).toBe(heavy);
          expect(p.veiled).toBe(false);
        }
      }
    }
  });
  it('실제 승인 데이터 · 2009 가리기: 아래·가운데는 무거운 사건 대신 2000년대 일상(무겁지 않음)이 오르고 줄은 가려진 사건 그대로, 위 구간은 가리기와 무관하다', () => {
    const low = real({ band: 'low', gentle: true });
    expect(low).toMatchObject({ veiled: true });
    expect(low.pic?.kind).toBe('daily');
    expect(low.pic?.heavy).toBe(false);
    expect(low.line?.id).toBe('era-2009-demolition-fire');
    const mid = real({ band: 'mid', gentle: true });
    expect(mid).toMatchObject({ veiled: true });
    expect(mid.pic?.kind).toBe('daily');
    expect(mid.pic?.band, '가운데는 구간 변주를 보지 않는다').toBeUndefined();
    expect(mid.line?.id).toBe('era-2009-square-mourning-queue');
    const high = real({ band: 'high', gentle: true });
    expect(high).toMatchObject({ veiled: false });
    expect(high.pic?.id).toBe('era-2009-first-smartphone');
  });
  it('실제 승인 데이터 · 인생 기록의 시대 줄: 2009년 줄도 칸이 그해 띄우는 그림의 문장이다 — 구간마다 다른 줄, 가리기 켠 아래·가운데 줄은 가림 표시', () => {
    for (const [band, line, veiled] of [['low', '1월, 철거 현장에서 불이 났습니다.', true], ['mid', '5월, 광장에 조문 줄이 길었습니다.', true], ['high', '첫 스마트폰이 손에 들어왔습니다.', false]] as const) {
      const row = eraRowsOf(1984, 30, ctx(ALL, { band, gentle: true })).find((r) => r.year === 2009)!;
      expect(row.line, band).toBe(line);
      expect(row.veiled, band).toBe(veiled);
      expect(eraRowsOf(1984, 30, ctx(ALL, { band, gentle: false })).find((r) => r.year === 2009)!.veiled, band).toBe(false);
    }
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
  it('실제 승인 데이터: 1962년생의 시대 줄은 사건·일상 문장을 해마다 담고, 줄의 해는 칸(eraOf)이 그해 띄우는 그림의 문장과 같다', () => {
    const rows = eraRowsOf(1962, 40, ctx(ALL, { band: 'low' }));
    expect(rows.length).toBeGreaterThan(25);
    for (const r of rows) {
      const pick = eraOf(r.year, ctx(ALL, { band: 'low', birthYear: 1962 }));
      expect(pick.line?.line, `${r.year}`).toBe(r.line);
      expect(r.age).toBe(r.year - 1962);
    }
    expect(rows.find((r) => r.year === 1980)).toMatchObject({ age: 18, line: '5월, 광주에 민주화 시위가 있었습니다.', heavy: true, veiled: false });
  });
});
