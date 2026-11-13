import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SIM_PROFILES, startLife } from '../scripts/simulateLib';
import { DEFAULT_SETTINGS, advanceUntilDecision, createInitialState, generateBirthFromSeed, stepYear, type GameState, type Settings } from '../src/core';
import { ageText } from '../src/core/format';
import type { EraWindow } from '../src/core/eraWindow';
import { petPhrases, sceneInputOf, sceneLineOf, sceneOf, scenePetsText, sceneRowsOf } from '../src/core/scene';
import { LifeScreen } from '../src/screens/LifeScreen';
import { familyArtIfLoaded, loadFamilyArt } from '../src/data/familyArtLoader';
import type { FamilyArt } from '../src/data/sceneTables';
import { SCENE_PIECES } from '../src/data/sceneTables';
import { SCENE_TEXT } from '../src/data/sceneText';
import { resolvePiece } from '../src/ui/scene/SceneSvg';
import type { LifeGame } from '../src/ui/dash/Cards';
import { EraCard, SceneCard } from '../src/ui/scene/SceneCard';
import type { SceneArt } from '../src/ui/scene/useFamilyArt';
import { mergeEraData } from '../src/ui/scene/useFamilyArt';
import { ERA_DECADE as D1940 } from '../src/data/eraWindows/d1940';
import { ERA_DECADE as D1950 } from '../src/data/eraWindows/d1950';
import { ERA_DECADE as D1960 } from '../src/data/eraWindows/d1960';
import { ERA_DECADE as D1970 } from '../src/data/eraWindows/d1970';
import { ERA_DECADE as D1980 } from '../src/data/eraWindows/d1980';
import { ERA_DECADE as D1990 } from '../src/data/eraWindows/d1990';
import { ERA_DECADE as D2000 } from '../src/data/eraWindows/d2000';
import { ERA_DECADE as D2010 } from '../src/data/eraWindows/d2010';
import { ERA_DECADE as D2020 } from '../src/data/eraWindows/d2020';
import type { YearClock } from '../src/ui/useYearClock';

/**
 * **SPEC-013 T7 개정**: 시대의 창 칸이 「사건이 있던 해만 그림 + 캡션, 그 밖의 해는 빈 종이틀」로 바뀌었다 — 일상 그림(가리기 대체 일상 포함)·수저 구간 변주 그림(2009 세 갈래·1973 셋방/양옥)·덩어리 없는 해의 일상 시험은 사건 해·빈 해·가리기(대체 사건 그림 또는 빈 틀 + 「가려 둔 장면」)·접근 이름 시험으로 바꿨다.
 * 집과 가족 그림 카드 서버 렌더 시험 (SPEC-009 FM5, FH1·FH3·FH6·FH9·FT1~FT6): 구조·대체 글·연도 표·시대의 창 빈 틀(미승인 그림 0)·「무거운 장면 가리기」·접기·로딩/실패 상태·가운데 열 순서를 본다.
 * 실제 브라우저가 있어야 하는 것(2:1·띠 배치의 실측 폭, 접기 저장, 360 가로 넘침, 다크, 그림 덩어리 요청 차단)은 `e2e/family-scene.spec.ts`가 본다.
 */

const art: FamilyArt = await loadFamilyArt(); // 그림 덩어리는 「태어나기」 뒤 지연 로드 — 시험은 먼저 받아 둔다(ready 상태)

const noop = () => undefined;
const scene = (over: Partial<SceneArt> = {}): SceneArt => ({ art, status: 'ready', retry: noop, era: { windows: [], art: {} }, ...over });

function life(seed: number, gen: 'alpha' | 'industrial' | 'genx' = 'alpha', age = 4): GameState {
  let g = startLife(seed, gen);
  for (let i = 0; i < 200 && g.phase === 'life' && g.age < age; i++) g = g.pending ? { ...g, pending: null } : stepYear(g).state;
  return g;
}
// SPEC-016 H4: 시대의 창은 집과 가족 그림 카드에서 떨어져 나가 따로 카드(`EraCard`)가 됐다 — 이 시험의 `html`은 두 카드의 마크업을 이어 붙인 것이라 (집 그림 + 시대의 창) 예전 단언이 그대로 두 카드를 함께 본다.
// 집 그림 카드만 보려면 `houseHtml`, 시대의 창 카드만 보려면 `eraHtml`.
const houseHtml = (g: GameState, o: { fold?: boolean; s?: SceneArt } = {}): string => renderToStaticMarkup(<SceneCard game={g} fold={o.fold ?? false} onFold={noop} scene={o.s ?? scene()} animate={false} />);
const eraHtml = (g: GameState, o: { gentle?: boolean; s?: SceneArt } = {}): string => renderToStaticMarkup(<EraCard game={g} gentle={o.gentle ?? false} scene={o.s ?? scene()} animate={false} />);
const html = (g: GameState, o: { fold?: boolean; gentle?: boolean; s?: SceneArt } = {}): string => houseHtml(g, o) + eraHtml(g, o);
const text = (h: string): string => h.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

describe('집과 가족 그림 카드 — 구조와 대체 글 (FH3·FH6)', () => {
  const g = life(12, 'alpha', 4);
  const out = html(g);
  const input = sceneInputOf(g);
  const spec = sceneOf(input);

  it('섹션 · 숨은 제목 「집과 가족」 · 그림(role=img)이 연도 표·아래 한 줄·(반려동물 문장)을 이어 읽는다 — 그림 안 글자 0', () => {
    expect(out).toContain('data-testid="family-scene"');
    expect(out).toMatch(/<h2 id="scene-title" class="sr-only">집과 가족<\/h2>/);
    expect(out).toMatch(/<svg class="scene__svg"[^>]*role="img"[^>]*aria-labelledby="scene-year scene-line"/);
    expect(out).toContain(`<time dateTime="${input.state.calYear}">${input.state.calYear}년</time>`);
    expect(out).toContain(`id="scene-line"`);
    expect(out).toContain(sceneLineOf(input));
    const svg = out.slice(out.indexOf('<svg class="scene__svg"'), out.indexOf('</svg>') + 6);
    expect(svg).not.toMatch(/<text|<tspan/);
    expect(out).not.toContain('scene-pets'); // 반려동물이 없으면 문장도 없다
  });

  it('층 여섯이 이 순서로 있고(배경 → 소품-뒤 → 집 → 소품-앞 → 반려동물 → 식구), 식구 층의 조각 수 = spec의 식구 수(주인공 포함 — 업힌 아기도 한 조각)', () => {
    const layers = [...out.matchAll(/data-layer="([^"]+)"/g)].map((m) => m[1]);
    expect(layers).toEqual(['배경', '소품-뒤', '집', '소품-앞', '반려동물', '식구']);
    const family = out.slice(out.indexOf('data-layer="식구"'));
    expect((family.match(/data-piece="/g) ?? []).length).toBe(spec.family.length);
    const svgOnly = out.slice(out.indexOf('<svg class="scene__svg"'), out.indexOf('</svg>') + 6);
    expect((svgOnly.match(/data-self="true"/g) ?? []).length, '그림 안에서 주인공 조각은 하나').toBe(1);
  });

  it('펼침 「함께 사는 사람」: 그림과 같은 집합(주인공 「나」 포함), 반려동물 줄, 「가족과 삶 열기」 — details/summary(키보드로 열린다)', () => {
    const { rows } = sceneRowsOf(input);
    expect(out).toMatch(/<details class="scene__more" id="scene-more"[^>]*><summary>함께 사는 사람<\/summary>/);
    for (const r of rows) expect(text(out)).toContain(`${r.label} · ${ageText(r.age, 'korean')}`); // 한국 나이가 기본(SPEC-019)
    expect(out).toContain('가족과 삶 열기');
    expect(out).toContain('data-testid="scene-open-family"');
  });

  it('반려동물이 있으면(pet_* 플래그) 대체 글 문장이 aria-labelledby에 더해지고 펼침에도 한 줄이 나온다', () => {
    const withPet: GameState = { ...g, flags: [...g.flags, 'pet_dog'] };
    const o = html(withPet);
    const pets = scenePetsText(sceneOf(sceneInputOf(withPet)).pets);
    expect(pets).toMatch(/기르는 개 한 마리가 있습니다\.$/);
    expect(o).toMatch(/aria-labelledby="scene-year scene-line scene-pets"/);
    expect(o).toContain(`<p class="sr-only" id="scene-pets" data-testid="scene-pets">${pets}</p>`);
    for (const p of petPhrases(sceneOf(sceneInputOf(withPet)).pets)) expect(o).toContain(`<li>${p}</li>`);
  });

  it('접기: 기본은 펼침(aria-expanded=true, 「그림 접기」), 접으면 data-fold=true · 「그림 펼치기」 · aria-expanded=false — 아래 한 줄과 펼침은 남는다', () => {
    expect(out).toContain('data-fold="false"');
    expect(out).toMatch(/<button type="button" class="btn btn--ghost btn--sm scene__fold" aria-expanded="true" aria-controls="scene-pic" data-testid="scene-fold">그림 접기<\/button>/);
    const folded = html(g, { fold: true });
    expect(folded).toContain('data-fold="true"');
    expect(folded).toMatch(/aria-expanded="false"[^>]*>그림 펼치기<\/button>/);
    expect(folded).toContain(sceneLineOf(input));
    expect(folded).toContain('id="scene-more"');
  });
});

describe('시대의 창 칸 — 승인된 그림 0장이면 빈 틀 (FT3)', () => {
  const g = life(12, 'alpha', 4);

  it('연도 표만 있고 링크도 그림도 없다: .era[data-empty] 안에 장식 틀뿐이고, #log-y 링크·툴팁이 없다', () => {
    const out = html(g);
    expect(out).toMatch(/<div class="era" id="scene-era" data-empty="true" data-hidden="false">/);
    expect(out).not.toContain('<a class="era"');
    expect(out).not.toContain('#log-y');
    expect(out).toContain('era__pic era__pic--empty');
    expect(out).toContain('<i class="era__sheet"></i>'); // 빈 종이틀 안 B(SPEC-013 T3 — 점무늬 없음)
    expect(out).not.toContain('era-paper');
    expect(out).not.toContain('era__cap'); // 빈 해에는 캡션 요소가 없다
    expect(out).toContain('aria-hidden="true"'); // 빈 틀은 장식
    // SPEC-016 H4: 카드 제목 「시대의 창」은 이제 따로 카드의 보이는 제목이다 — 빈 칸(.era) **안**에는 글자가 하나도 없다는 단언으로 옮겼다(예전: 카드 전체에 「시대의 창」 글자 없음)
    const cell = /<div class="era"[^>]*>([\s\S]*?)<\/div>/.exec(out);
    expect(cell, '.era 빈 칸').not.toBeNull();
    expect(text(cell![1])).toBe('');
    expect(text(eraHtml(g))).toContain('시대의 창'); // 카드 제목(h2)
  });

  const approved = (id: string, years: [number, number], over: Partial<EraWindow> = {}): EraWindow => ({ id, years, kind: 'event', topic: '시험', line: `${id} 한 줄입니다.`, heavy: false, approved: true, draw: id, caption: `${id} 캡션`, ...over });
  const MARKUP = '<rect x="0" y="0" width="40" height="32" fill="var(--c-scene-sky,#dfe6ed)"/>';
  const year = sceneInputOf(g).state.calYear;

  it('승인된 그림이 있으면 칸 전체가 그해 줄로 가는 링크 하나다: href="#log-y<연도>" · title = 캡션. 문장 · 보이는 캡션 글자(era__cap, 시각용) · 접근 이름(sr-only)이 캡션을 담는다 · 그림은 aria-hidden', () => {
    const w = approved('시험장면', [year, year]);
    const out = html(g, { s: scene({ era: { windows: [w], art: { 시험장면: MARKUP } } }) });
    expect(out).toContain(`<a class="era" id="scene-era" href="#log-y${year}"`);
    expect(out).toContain('data-era="시험장면"');
    expect(out).toContain('title="시험장면 캡션. 시험장면 한 줄입니다."');
    expect(out).toContain('<span class="era__cap" data-testid="era-caption" aria-hidden="true">시험장면 캡션</span>');
    expect(out).toContain('<span class="sr-only">시험장면 캡션. 시험장면 한 줄입니다. 그해 기록으로</span>');
    expect(out).toMatch(/<span class="era__pic" aria-hidden="true">[\s\S]*<svg viewBox="0 0 40 32"/);
    expect((out.match(/<a /g) ?? []).length, '이 카드의 링크는 시대의 창 하나뿐(초점 정지점 1 — 펼침·접기는 버튼)').toBe(1);
  });

  it('무거운 장면 가리기: 꺼짐이면 사건 그림 그대로, 켜면 같은 해의 무겁지 않은 사건 그림(12월 투표)과 그 캡션으로 — 없으면 빈 해와 같은 종이틀 + 캡션 「가려 둔 장면」(문장은 어디에도 없다)', () => {
    const heavy = approved('큰사건', [year, year], { heavy: true, line: '큰 사건입니다.' });
    const alt = approved('대체', [year, year], { line: '평범한 날입니다.', caption: '12월 투표' });
    const data = { windows: [heavy, alt], art: { 큰사건: MARKUP, 대체: MARKUP } };
    const off = html(g, { gentle: false, s: scene({ era: data }) });
    expect(off).toContain('data-era="큰사건"');
    expect(off).toContain('title="큰사건 캡션. 큰 사건입니다."');
    const on = html(g, { gentle: true, s: scene({ era: data }) });
    expect(on).toContain('data-era="대체"');
    expect(on).toContain('data-hidden="false"'); // 대체 그림이 있어 그림이 오른다
    expect(on).toContain('<span class="era__cap" data-testid="era-caption" aria-hidden="true">12월 투표</span>');
    expect(on).toContain('title="12월 투표."'); // 가린 해에는 가려진 사건의 문장을 말하지 않는다
    expect(on).not.toContain('큰 사건입니다.');
    const veiled = html(g, { gentle: true, s: scene({ era: { windows: [heavy], art: { 큰사건: MARKUP } } }) });
    expect(veiled).toContain('data-hidden="true"');
    expect(veiled).toContain('title="가려 둔 장면."');
    expect(veiled).toContain('<span class="era__cap" data-testid="era-caption" aria-hidden="true">가려 둔 장면</span>');
    expect(veiled).toContain('가려 둔 장면. 그해 기록으로');
    expect(veiled).toContain('<i class="era__sheet"></i>'); // 빈 해와 같은 틀
    expect(veiled).not.toContain('큰 사건입니다.');
    expect(veiled).not.toMatch(/<svg viewBox="0 0 40 32"/);
    expect((veiled.match(/<a /g) ?? []).length, '가려 둔 해에도 링크는 하나(그해 기록으로)').toBe(1);
  });

  it('미승인 그림(approved가 true가 아님)은 칸에 오르지 않는다 — 고르기가 한 번 더 막는다', () => {
    const sneaky = { ...approved('몰래', [year, year]), approved: false } as unknown as EraWindow;
    const out = html(g, { s: scene({ era: { windows: [sneaky], art: { 몰래: MARKUP } } }) });
    expect(out).toContain('data-empty="true"');
    expect(out).not.toContain('몰래');
  });
});

describe('그림 덩어리 상태 (FH9) — 글을 먼저, 실패해도 글은 그대로', () => {
  const g = life(12, 'alpha', 4);
  const input = sceneInputOf(g);

  it('로딩 중: 크기가 고정된 자리 틀(placeholder, 같은 대체 글)과 아래 한 줄·펼침이 먼저 보이고, 조각은 없다', () => {
    const out = html(g, { s: scene({ art: null, status: 'loading' }) });
    expect(out).toContain('data-scene-art="loading"');
    expect(out).toMatch(/<div class="scene__svg scene__ph"[^>]*role="img"[^>]*aria-labelledby="scene-year scene-line"/);
    expect(out).not.toContain('data-piece=');
    expect(out).toContain(sceneLineOf(input));
    expect(out).toContain('id="scene-more"');
    expect(out).toContain(`${input.state.calYear}년`);
    expect(out).not.toContain('scene-art-retry');
  });
  it('실패: 안내 한 줄과 「다시 불러오기」, 그림 칸은 틀만 — 아래 한 줄·펼침은 그대로(게임은 계속된다)', () => {
    const out = html(g, { s: scene({ art: null, status: 'failed' }) });
    expect(out).toContain('data-scene-art="failed"');
    expect(out).toContain(SCENE_TEXT.artFailed);
    expect(out).toMatch(/data-testid="scene-art-retry">다시 불러오기<\/button>/);
    expect(out).toContain('scene__ph');
    expect(out).toContain(sceneLineOf(input));
  });
  it('이미 받은 덩어리는 훅의 첫 렌더부터 ready다(깜박이지 않는다)', () => {
    expect(familyArtIfLoaded()).toBe(art);
  });
  it('FM5b: 모든 조각이 그려져 있어 대신 그림(data-via)이 한 번도 나오지 않는다 — 25판 × 세 시대, 표의 모든 조각이 덩어리에서 직접 마크업을 받는다', () => {
    for (const gen of ['alpha', 'genx', 'industrial'] as const) {
      for (let seed = 1; seed <= 25; seed++) expect(html(life(seed, gen, 6)), `${gen} ${seed}`).not.toContain('data-via="');
    }
    for (const p of SCENE_PIECES) expect(resolvePiece(art, p.id), p.id).toMatchObject({ markup: expect.any(String) });
    for (const p of SCENE_PIECES) expect(resolvePiece(art, p.id)!.via, p.id).toBeUndefined();
  });
});

describe('가운데 열 순서와 설정 (FH1) — 결정 카드 → 집과 가족 그림 → 인생 기록', () => {
  const CLOCK: YearClock = { get: () => 0, subscribe: () => () => undefined };
  const asLife = (g: GameState): LifeGame => ({ ...g, character: g.character!, generation: g.generation!, birthReport: g.birthReport!, peerSeed: g.peerSeed! });
  const settingsOf = (o: Partial<Settings> = {}): Settings => ({ ...DEFAULT_SETTINGS, speed: 1, autoMode: false, ...o });
  const screen = (g: GameState, o: Partial<Settings> = {}): string =>
    renderToStaticMarkup(
      <LifeScreen game={asLife(g)} settings={settingsOf(o)} clock={CLOCK} exitOpen={false} onExitOpen={noop} onChoose={noop} onSkip={noop} onSpeed={noop} onAuto={noop} onPause={noop} onBgm={noop} onTheme={noop} onExit={noop} minute={29_846_880} />,
    );

  it('인생 화면: 집과 가족 그림 카드가 인생 기록 카드 앞에 있고, 둘 다 가운데 열 안에 있다', () => {
    const out = screen(life(12, 'alpha', 4));
    const sceneAt = out.indexOf('data-testid="family-scene"');
    const logAt = out.indexOf('data-testid="log"');
    expect(sceneAt).toBeGreaterThan(0);
    expect(logAt).toBeGreaterThan(sceneAt);
    const center = out.slice(out.indexOf('col col--center'), out.indexOf('col col--right'));
    expect(center).toContain('data-testid="family-scene"');
    expect(center).toContain('data-testid="log"');
  });
  it('결정 카드가 떠 있어도(인라인 카드 — 자동 모드) 그림은 결정 카드 아래, 인생 기록 위다 — 그림이 결정 카드를 밀어내지 않는다', () => {
    let dec: GameState | null = null;
    for (let seed = 1; seed <= 80 && dec === null; seed++) {
      const s = advanceUntilDecision(startLife(seed, SIM_PROFILES[0] ? 'alpha' : 'alpha')).state;
      if (s.phase === 'life' && s.pending !== null && s.age >= 3) dec = s;
    }
    expect(dec).not.toBeNull();
    const out = screen(dec!, { autoMode: true });
    const d = out.indexOf('decision--inline');
    const sc = out.indexOf('data-testid="family-scene"');
    const lg = out.indexOf('data-testid="log"');
    expect(d).toBeGreaterThan(0);
    expect(sc).toBeGreaterThan(d);
    expect(lg).toBeGreaterThan(sc);
  });
  it('설정 sceneFold가 true이면 그림이 접힌 채 그려진다', () => {
    expect(screen(life(12, 'alpha', 4), { sceneFold: true })).toContain('data-fold="true"');
    expect(screen(life(12, 'alpha', 4))).toContain('data-fold="false"');
  });
  it('SPEC-016 H4: 시대의 창(#scene-era)은 인생 화면에 한 번만 있고 집과 가족 그림 카드 안이 아니라 오른쪽 열 맨 위(식구 카드 앞)에 있다 — 접어도 같다', () => {
    for (const sceneFold of [false, true]) {
      const out = screen(life(12, 'alpha', 4), { sceneFold });
      expect((out.match(/id="scene-era"/g) ?? []).length, `sceneFold=${sceneFold}`).toBe(1);
      const house = out.slice(out.indexOf('data-testid="family-scene"'), out.indexOf('data-testid="log"'));
      expect(house).not.toContain('scene-era');
      const right = out.slice(out.indexOf('col col--right'));
      const era = right.indexOf('data-testid="era-card"');
      expect(era).toBeGreaterThan(-1);
      expect(era).toBeLessThan(right.indexOf('data-testid="family-card"'));
    }
  });
});

describe('CSS 규칙 (family-scene.md 5-1절, SPEC-016 H4 개정 — 집 그림 전폭·비율 640/256·25vh · 시대의 창 따로 카드(PC 5:4 큰 그림 · 휴대폰 80px 띠) · 접기 · 움직임 줄이기)', () => {
  async function readText(relative: string): Promise<string> {
    const spec = 'node:fs';
    const fs = (await import(/* @vite-ignore */ spec)) as { readFileSync(path: URL, encoding: 'utf-8'): string };
    return fs.readFileSync(new URL(relative, import.meta.url), 'utf-8');
  }
  it('family.css: 집 그림은 카드 전폭 1열(시대의 창이 나갔다) · 비율 640/256 그대로 · 높이 상한 25vh(상한에 걸리면 폭이 줄고 양옆은 하늘·땅 배경) / 시대의 창 카드는 PC 5:4 그림 + 캡션 줄 두 줄 높이 예약, 휴대폰(< 960px)은 띠 80px(그림 100×80) + 집 그림 카드 바로 아래(order -1)', async () => {
    const css = await readText('../src/styles/family.css');
    expect(css).toContain('.scene { display: grid; grid-template-columns: minmax(0, 1fr); align-items: stretch;');
    expect(css).toMatch(/\.scene__svg \{[^}]*width: min\(100%, calc\(25vh \* 2\.5\)\);[^}]*aspect-ratio: 640 \/ 256;/); // 25vh 상한은 폭 식에 들어 있다(비율 고정)
    expect(css).toMatch(/\.scene__house \{[^}]*linear-gradient\(to bottom, var\(--c-scene-sky\) 78%, var\(--c-scene-ground\) 78%\)/); // 양옆 남는 자리 = .scene__ph와 같은 색
    expect(css).toMatch(/\.scene__ph \{ background: linear-gradient\(to bottom, var\(--c-scene-sky\) 78%, var\(--c-scene-ground\) 78%\); \}/);
    // 시대의 창 따로 카드 (PC)
    expect(css).toContain('.era-card .era__pic { aspect-ratio: 5 / 4; height: auto; }');
    expect(css).toContain('grid-template-rows: auto minmax(var(--era-cap-min), auto);'); // 캡션이 없는 해에도 칸 크기가 같다
    const q = css.slice(css.indexOf('@media (max-width: 959px) {\n  .era-card'));
    expect(q).toContain('.era-card { order: -1;');
    expect(q).toContain('.era-card .era { margin: 0; height: max(80px, 3.9rem); grid-template-columns: 100px minmax(0, 1fr); grid-template-rows: auto minmax(0, 1fr); column-gap: var(--sp-2); background: var(--c-surface); }'); // R-553 ① A안: 띠 바탕 = 카드 바탕(--c-surface), SPEC-013 T3: 글자 크기의 식(3.9rem)이라 해가 바뀌어도 높이가 같다
    expect(q).toMatch(/\.era-card \.era__pic \{ grid-column: 1; grid-row: 1 \/ span 2; align-self: start; width: 100px; height: 80px; aspect-ratio: auto; \}/);
    // 접기(Q6)는 집 그림에만 걸린다 — 시대의 창 카드에는 접기 규칙이 없다
    expect(css).not.toMatch(/\.era-card\[data-fold/);
    expect(css).toContain(".scene-card[data-fold='true'] .scene { display: none; }");
    expect(css).toContain('.scene-card { padding-top: 0; overflow: hidden; container-type: inline-size; container-name: scene; }');
  });
  it('SPEC-016 H4 r2 높이 맞춤: PC(≥ 960px)에서만 시대의 창 카드가 `--era-card-h`(집 카드의 실제 높이)를 받고, 그림은 남는 높이에 맞춰 5:4 그대로 줄어 가운데에 선다 · 변수가 없으면(data-paired 없음) 자연 높이 그대로 · 휴대폰 80px 띠는 건드리지 않는다 · LifeScreen이 훅을 부른다', async () => {
    const css = await readText('../src/styles/family.css');
    const pcStart = css.indexOf('@media (min-width: 960px) {\n  /*');
    expect(pcStart).toBeGreaterThan(-1);
    const supportsAt = css.indexOf('  @supports (width: 1cqw) {\n', pcStart);
    expect(supportsAt, '컨테이너 단위(cqw)는 @supports (width: 1cqw) 안에만 있다(모르는 브라우저는 규칙 전체가 빠져 자연 높이 — e2e-prod smoke ⑤)').toBeGreaterThan(pcStart);
    const pc = css.slice(supportsAt, css.indexOf('\n  }', supportsAt) + 4);
    expect(pc).toBe(
      '  @supports (width: 1cqw) {\n' +
        "    .era-card[data-paired='true'] { display: flex; flex-direction: column; height: var(--era-card-h); }\n" +
        "    .era-card[data-paired='true'] > .era { flex: 1 1 0; min-height: 0; container-type: size; grid-template-rows: minmax(0, 1fr) minmax(var(--era-cap-min), auto); }\n" +
        "    .era-card[data-paired='true'] .era__pic { width: auto; height: min(100%, 80cqw); aspect-ratio: 5 / 4; justify-self: center; }\n" +
        '  }',
    ); // 캡션 두 줄 예약(--era-cap-min)은 그대로, 비율 5/4 고정(자르지 않는다), 변수가 없으면 이 규칙은 닿지 않는다
    expect(css.slice(css.indexOf('/* PC(≥ 960px)에서 시대의 창 카드의 높이'), supportsAt).replace(/\/\*[^]*?\*\//g, ''), '@supports 밖에는 선언이 없다').not.toMatch(/cqw|container-type|--era-card-h/);
    const phoneStart = css.indexOf('@media (max-width: 959px) {\n  .era-card');
    expect(phoneStart).toBeGreaterThan(-1);
    expect(css.slice(phoneStart, css.indexOf('\n}', phoneStart) + 2)).not.toContain('--era-card-h'); // 휴대폰 규칙은 높이 맞춤과 무관하다
    const hook = await readText('../src/ui/scene/usePairedEraHeight.ts');
    expect(hook).toContain("era.style.setProperty('--era-card-h'");
    expect(hook).toContain("scene.setAttribute('data-fold', 'false')"); // 접힌 채여도 펼친 때의 높이를 잰다(Q6)
    const life = await readText('../src/screens/LifeScreen.tsx');
    expect(life).toContain('usePairedEraHeight(dashRef);');
    expect(life).toContain('ref={dashRef}');
  });
  it('움직임 줄이기: 교차 페이드와 줄 강조 애니메이션이 media(prefers-reduced-motion)와 data-motion="reduce" 둘 다에서 꺼진다(강조 면만 남는다)', async () => {
    const css = await readText('../src/styles/family.css');
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\) \{[\s\S]*animation: none;/);
    expect(css).toContain(":root[data-motion='reduce'] .log__row--tl[data-tl='era'][data-flash='true']");
    expect(css).toContain(":root[data-motion='reduce'] .scene__svg--prev");
  });
  it('색은 토큰뿐이다: family.css에 #rrggbb 하드코딩 색이 없다 (강제 색상 시스템 색 제외)', async () => {
    const css = (await readText('../src/styles/family.css')).replace(/\/\*[\s\S]*?\*\//g, '');
    expect(css.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).toEqual([]);
  });
});

describe('시대의 창 칸 — 승인된 그림이 칸에 오른다 (FM5b · 시대의 창 r5 반영 94장 + SPEC-010 묶음 A 12장, FT1~FT6 — 2027년 이후 칩은 tests/eraChip.test.tsx)', () => {
  /** 달력 연도가 `calYear`가 되는 나이의 판 (세대·시드를 훑어 0~80세 안에 드는 것) */
  function lifeInYear(calYear: number): GameState {
    for (const gen of ['industrial', 'genx', 'alpha'] as const) {
      for (let seed = 1; seed <= 40; seed++) {
        const b = generateBirthFromSeed(seed, gen);
        const age = calYear - b.character.birthYear;
        if (age < 3 || age > 80) continue;
        const base = { ...createInitialState(seed), phase: 'life', generation: gen, character: b.character, birthReport: b.report, peerSeed: b.peerSeed, family: b.family } as GameState;
        return { ...base, age, assets: age >= 20 ? { net: 0, income: 0, debt: 0, incomeAdj: 0, dwelling: 'family' } : null } as GameState;
      }
    }
    throw new Error(`${calYear}년의 판을 못 찾았다`);
  }
  const era = (): SceneArt['era'] => mergeEraData([D1940, D1950, D1960, D1970, D1980, D1990, D2000, D2010, D2020]);

  it('1980년: 금남로 그림이 링크 하나로 오른다 — 톤 A 필터용 data-dec, 그림은 aria-hidden, 접근 이름은 「캡션. 문장」, 그림 안은 class 색·사람 심볼 참조(<use>)뿐(<style> 없음)', () => {
    const g = lifeInYear(1980);
    expect(sceneInputOf(g).state.calYear).toBe(1980);
    const out = html(g, { s: scene({ era: era() }) });
    expect(out).toContain('<a class="era" id="scene-era" href="#log-y1980"');
    expect(out).toContain('data-era="era-1980-may-geumnam-ro"');
    expect(out).toContain('data-dec="1980"');
    expect(out).toContain('title="5월 광주 시위. 5월, 광주에 민주화 시위가 있었습니다."');
    expect(out).toContain('<span class="era__cap" data-testid="era-caption" aria-hidden="true">5월 광주 시위</span>');
    expect(out).toContain('<span class="sr-only">5월 광주 시위. 5월, 광주에 민주화 시위가 있었습니다. 그해 기록으로</span>');
    const pic = out.slice(out.indexOf('<span class="era__pic"'), out.indexOf('</a>'));
    expect(pic).toContain('aria-hidden="true"');
    expect(pic).toMatch(/<pattern id="era-era-dots"/); // 반복 무늬는 이 10년 덩어리 defs에 한 번(인스턴스 접두어 era-)
    expect(pic).toMatch(/class="e-[a-z0-9]+"/);
    expect(pic).not.toMatch(/<style|<text|<image|style=/);
    expect((out.match(/<a /g) ?? []).length, '초점 정지점 1').toBe(1);
  });

  it('1997년: 외환위기 그림 + 캡션, 접근 이름에 첫 문장과 고른 구간의 둘째 문장이 이어진다 — 부모 재력 1·2는 일터, 3은 월급, 4·5는 달라진 게 없었다', () => {
    const g = lifeInYear(1997);
    const withWealth = (w: 1 | 2 | 3 | 4 | 5): GameState => ({ ...g, character: { ...g.character!, parentWealth: w } }) as GameState;
    const expected: Array<[1 | 2 | 3 | 4 | 5, string]> = [
      [1, '집에서는 다니던 일터가 문을 닫았습니다.'],
      [2, '집에서는 다니던 일터가 문을 닫았습니다.'],
      [3, '집에서는 월급이 줄어 씀씀이를 줄였습니다.'],
      [4, '집에서는 크게 달라진 게 없었습니다.'],
      [5, '집에서는 크게 달라진 게 없었습니다.'],
    ];
    for (const [w, second] of expected) {
      const out = html(withWealth(w), { s: scene({ era: era() }) });
      expect(out, `재력 ${w}`).toContain('data-era="era-1997-dawn-labor-market"'); // 같은 그림 — 수저는 둘째 문장만 가른다
      expect(out, `재력 ${w}`).toContain(`title="외환위기. 11월, 외환위기가 닥쳐 나라가 구제금융을 요청했습니다. ${second}"`);
    }
  });

  it('사건이 없는 해는 빈 종이틀이다 — 링크도 그림도 캡션도 없고 칸 안에 종이 한 장(era__sheet)뿐이다(1958·1992·2025 …) · 일상으로 내려가지 않는다', () => {
    for (const y of [1958, 1992, 2025]) {
      const out = html(lifeInYear(y), { s: scene({ era: era() }) });
      expect(out, `${y}`).toMatch(/<div class="era" id="scene-era" data-empty="true" data-hidden="false">/);
      expect(out, `${y}`).not.toContain('<a class="era"');
      expect(out, `${y}`).not.toContain('era__cap');
      expect(out, `${y}`).toContain('<i class="era__sheet"></i>');
      expect(out, `${y}`).not.toContain('data-kind="daily"');
    }
  });

  it('가리기를 켜면 1980년은 무거운 사건 대신 그림 없는 종이틀 + 캡션 「가려 둔 장면」이다(대체 사건 그림 없음) — 금남로 문장·캡션은 어디에도 없고, 1987년은 12월 투표 그림과 캡션이 대체한다', () => {
    const g = lifeInYear(1980);
    const off = html(g, { gentle: false, s: scene({ era: era() }) });
    const on = html(g, { gentle: true, s: scene({ era: era() }) });
    expect(off).toContain('data-era="era-1980-may-geumnam-ro"');
    expect(on).toContain('data-hidden="true"');
    expect(on).toContain('<span class="era__cap" data-testid="era-caption" aria-hidden="true">가려 둔 장면</span>');
    expect(on).toContain('<i class="era__sheet"></i>');
    expect(on).not.toContain('광주');
    expect(on).not.toContain('금남로');
    const g87 = lifeInYear(1987);
    expect(html(g87, { gentle: false, s: scene({ era: era() }) })).toContain('data-era="era-1987-june-street"');
    const on87 = html(g87, { gentle: true, s: scene({ era: era() }) });
    expect(on87).toContain('data-era="era-1987-polling-station-r3"');
    expect(on87).toContain('>12월 직선제 투표</span>');
    expect(on87).not.toContain('6월 거리 시위');
    expect(on87).not.toContain('시위');
  });

  it('그 10년 덩어리가 아직 오지 않은 해(1988 — 1980년대 덩어리 없이)는 빈 틀이다 — 링크도 그림도 없다. 덩어리가 오면 그 사건 그림이 오른다', () => {
    const g = lifeInYear(1988);
    const without = html(g, { s: scene({ era: mergeEraData([D1940, D1950, D1960, D1970]) }) });
    expect(without).toMatch(/<div class="era" id="scene-era" data-empty="true"/);
    expect(without).not.toContain('<a class="era"');
    const withIt = html(g, { s: scene({ era: era() }) });
    expect(withIt).toContain('data-era="era-1988-stadium-flame-r3"');
    expect(withIt).toContain('data-dec="1980"');
    expect(withIt).toContain('data-kind="event"');
  });

  it('2009년: 수저 구간과 무관하게 5월 광장의 조문 줄 하나다(옛 2009년 세 갈래는 폐지) — 줄 글은 승인 표기 그대로, 톤 필터용 data-dec는 2000, 가리기를 켜면 빈 종이틀', () => {
    const g = lifeInYear(2009);
    expect(sceneInputOf(g).state.calYear).toBe(2009);
    for (const w of [1, 2, 3, 4, 5] as const) {
      const out = html({ ...g, character: { ...g.character!, parentWealth: w } } as GameState, { s: scene({ era: era() }) });
      expect(out, `재력 ${w}`).toContain('data-era="era-2009-square-mourning-queue"');
      expect(out, `재력 ${w}`).toContain('title="5월 광장 조문 줄. 5월, 광장에 조문 줄이 길었습니다."');
      expect(out, `재력 ${w}`).toContain('data-dec="2000"');
    }
    const gentle = html(g, { gentle: true, s: scene({ era: era() }) });
    expect(gentle).toContain('data-hidden="true"');
    expect(gentle).not.toContain('조문');
  });

  it('같은 판·같은 해는 늘 같은 그림이다(같은 입력 → 같은 출력)', () => {
    const g = lifeInYear(1988);
    expect(html(g, { s: scene({ era: era() }) })).toBe(html(g, { s: scene({ era: era() }) }));
  });
});
