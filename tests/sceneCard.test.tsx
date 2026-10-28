import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SIM_PROFILES, startLife } from '../scripts/simulateLib';
import { DEFAULT_SETTINGS, advanceUntilDecision, stepYear, type GameState, type Settings } from '../src/core';
import type { EraWindow } from '../src/core/eraWindow';
import { petPhrases, sceneInputOf, sceneLineOf, sceneOf, scenePetsText, sceneRowsOf } from '../src/core/scene';
import { LifeScreen } from '../src/screens/LifeScreen';
import { familyArtIfLoaded, loadFamilyArt } from '../src/data/familyArtLoader';
import type { FamilyArt } from '../src/data/sceneTables';
import { SCENE_TEXT } from '../src/data/sceneText';
import type { LifeGame } from '../src/ui/dash/Cards';
import { SceneCard } from '../src/ui/scene/SceneCard';
import type { SceneArt } from '../src/ui/scene/useFamilyArt';
import type { YearClock } from '../src/ui/useYearClock';

/**
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
const html = (g: GameState, o: { fold?: boolean; gentle?: boolean; s?: SceneArt } = {}): string =>
  renderToStaticMarkup(<SceneCard game={g} gentle={o.gentle ?? false} fold={o.fold ?? false} onFold={noop} scene={o.s ?? scene()} animate={false} />);
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
    for (const r of rows) expect(text(out)).toContain(`${r.label} · ${r.age}세`);
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
    expect(out).toContain('aria-hidden="true"'); // 빈 틀은 장식
    expect(text(out)).not.toContain('시대의 창');
  });

  const approved = (id: string, years: [number, number], over: Partial<EraWindow> = {}): EraWindow => ({ id, years, kind: 'event', topic: '시험', line: `${id} 한 줄입니다.`, heavy: false, approved: true, draw: id, ...over });
  const MARKUP = '<rect x="0" y="0" width="40" height="32" fill="var(--c-scene-sky,#dfe6ed)"/>';
  const year = sceneInputOf(g).state.calYear;

  it('승인된 그림이 있으면 칸 전체가 그해 줄로 가는 링크 하나다: href="#log-y<연도>" · title = 시대의 창 · 문장 · 접근 이름(sr-only) · 그림은 aria-hidden', () => {
    const w = approved('시험장면', [year, year]);
    const out = html(g, { s: scene({ era: { windows: [w], art: { 시험장면: MARKUP } } }) });
    expect(out).toContain(`<a class="era" id="scene-era" href="#log-y${year}"`);
    expect(out).toContain('data-era="시험장면"');
    expect(out).toContain('title="시대의 창 · 시험장면 한 줄입니다."');
    expect(out).toContain('<span class="sr-only">시대의 창 · 시험장면 한 줄입니다. 그해 기록으로</span>');
    expect(out).toMatch(/<span class="era__pic" aria-hidden="true">[\s\S]*<svg viewBox="0 0 40 32"/);
    expect((out.match(/<a /g) ?? []).length, '이 카드의 링크는 시대의 창 하나뿐(초점 정지점 1 — 펼침·접기는 버튼)').toBe(1);
  });

  it('무거운 장면 가리기: 꺼짐이면 사건 그림 그대로, 켜면 그해 일상 그림으로 — 일상이 없으면 그림 없이 틀만(가려 둔 장면)', () => {
    const heavy = approved('큰사건', [year, year], { heavy: true, line: '큰 사건입니다.' });
    const daily = approved('일상', [year - 5, year + 5], { kind: 'daily', line: '평범한 하루였습니다.' });
    const data = { windows: [heavy, daily], art: { 큰사건: MARKUP, 일상: MARKUP } };
    const off = html(g, { gentle: false, s: scene({ era: data }) });
    expect(off).toContain('data-era="큰사건"');
    expect(off).toContain('title="시대의 창 · 큰 사건입니다."');
    const on = html(g, { gentle: true, s: scene({ era: data }) });
    expect(on).toContain('data-era="일상"');
    expect(on).toContain('title="시대의 창 · 평범한 하루였습니다."');
    expect(on).not.toContain('큰 사건입니다.');
    const veiled = html(g, { gentle: true, s: scene({ era: { windows: [heavy], art: { 큰사건: MARKUP } } }) });
    expect(veiled).toContain('data-hidden="true"');
    expect(veiled).toContain('title="시대의 창 · 가려 둔 장면"');
    expect(veiled).toContain('시대의 창 · 가려 둔 장면 그해 기록으로');
    expect(veiled).not.toContain('큰 사건입니다.');
    expect(veiled).not.toMatch(/<svg viewBox="0 0 40 32"/);
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
  it('안 그린 조각은 대신 그림으로 그려지고(data-via), 그릴 것이 없는 조각은 그리지 않는다 — 어느 쪽이든 칸이 비지 않는다', () => {
    let seen = 0;
    for (let seed = 1; seed <= 25 && seen === 0; seed++) {
      const gg = life(seed, 'genx', 6);
      if ((html(gg).match(/data-via="/g) ?? []).length > 0) seen++;
    }
    expect(seen, '25판 안에 대신 그림이 한 번은 나와야 한다').toBeGreaterThan(0);
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
});

describe('CSS 규칙 (family-scene.md 5-1절 — PC 2:1 · 휴대폰 80px 띠 · 25vh · 접기 · 움직임 줄이기)', () => {
  async function readText(relative: string): Promise<string> {
    const spec = 'node:fs';
    const fs = (await import(/* @vite-ignore */ spec)) as { readFileSync(path: URL, encoding: 'utf-8'): string };
    return fs.readFileSync(new URL(relative, import.meta.url), 'utf-8');
  }
  it('family.css: 집 : 창 = 2fr : 1fr, 8px 사이, 그림 높이 폭÷2.5 · 최대 25vh, 휴대폰(카드 480px 이하)은 1열 + 창 띠 80px(그림 100×80)', async () => {
    const css = await readText('../src/styles/family.css');
    expect(css).toContain('.scene { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); gap: var(--sp-2);');
    expect(css).toMatch(/\.scene__svg \{[^}]*aspect-ratio: 640 \/ 256; max-height: 25vh;/);
    const q = css.slice(css.indexOf('@container scene (max-width: 480px)'));
    expect(q).toContain('.scene { grid-template-columns: minmax(0, 1fr); }');
    expect(q).toContain('.era { height: 80px; }');
    expect(q).toMatch(/\.era__pic \{ width: 100px; height: 80px;/);
    expect(css).toContain(".scene-card[data-fold='true'] .scene { display: none; }");
    expect(css).toContain('.scene-card { padding-top: 0; overflow: hidden; container-type: inline-size; container-name: scene; }');
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
