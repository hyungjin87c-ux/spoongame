import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  autoChoiceDelayMs,
  autoResolveStep,
  eventPool,
  holdDelayMs,
  pendingLeadOf,
  resolveChoiceStep,
  stepYear,
  tickReadNeedMs,
  type GameState,
  type ProfileId,
  type Settings,
  type TickInfo,
} from '../src/core';
import { DASH_TEXT } from '../src/data/dashText';
import { AUTO_CHOICE_MS } from '../src/data/timingTable';
import { LifeScreen } from '../src/screens/LifeScreen';
import type { LifeGame } from '../src/ui/dash/Cards';
import { LEAD_SHEET_DESCRIBED_BY, ParentCard, leadCardModel, parentCardModel } from '../src/ui/dash/ParentCard';
import type { YearClock } from '../src/ui/useYearClock';
import { startLife } from '../scripts/simulateLib';
import { readRepoText } from './helpers/repoFiles';

/**
 * 같은 해 원서 카드(SPEC-018 G2 「같은 해에 함께」 화면 — 결정 후속 255·262 (1)~(4)·263 ③④, 시안 docs/design/mockups/g2-together/)의 화면 단위 시험: 서버 렌더로 DOM을 본다.
 * 모델(`leadCardModel` — 틱에서만 파생, 새로고침하면 없음) · 세 변형(지금 부모 카드 무변경 / 전체형 / 시트 안 요약형) · 인생 화면의 자리(시트 안 맨 위 · 자동 모드 인라인 위 · 접힌 띠 위 · 부모 카드 두 장)
 * · 시트 설명(`aria-describedby`) · 연출 대기와 자동 선택 지연의 필요량. 브라우저 동작(펼침·포커스·Esc·자동 선택 시간·새로고침·「다음 결정으로」)은 e2e/gate-together.spec.ts가 본다.
 */

const CLOCK: YearClock = { get: () => 0, subscribe: () => () => undefined };
const noop = () => undefined;
const asLife = (g: GameState): LifeGame => ({ ...g, character: g.character!, generation: g.generation!, birthReport: g.birthReport!, peerSeed: g.peerSeed! });
const pool = eventPool();
const G2 = 'school-high-pick';
const dashCss = readRepoText('src/styles/dash.css') ?? '';

/** 15세 동반 해를 찾는다: `self` = 그 해 카드가 본인 카드(틱 `choice + lead`), `delegated` = 그 해 카드도 부모·흘러감(틱 `resolved + by + lead`) */
function findLeadYear(kind: 'self' | 'delegated', gen: ProfileId = 'alpha', opts: { cite?: boolean } = {}): { before: GameState; state: GameState; tick: TickInfo } {
  for (let seed = 1; seed < 3000; seed++) {
    let s: GameState = startLife(seed * 7919 + 13, gen);
    for (let guard = 0; guard < 40 && s.phase === 'life' && s.age <= 15; guard++) {
      if (s.pending !== null) {
        s = autoResolveStep(s, s.pending.key, pool).state;
        continue;
      }
      const r = stepYear(s, pool);
      const t = r.tick;
      if (t.lead !== undefined && r.state.phase === 'life') {
        const hit = kind === 'self' ? t.kind === 'choice' : t.kind === 'resolved' && t.by !== undefined;
        if (hit) return { before: s, state: r.state, tick: t };
      }
      s = r.state;
    }
  }
  throw new Error(`${kind}: 15세 동반 해를 찾지 못했다${opts.cite ? ' (인용)' : ''}`);
}

function renderScreen(game: GameState, tick: TickInfo | null, settings: Partial<Settings> = {}, folded = false): string {
  return renderToStaticMarkup(
    <LifeScreen
      game={asLife(game)}
      tick={tick}
      settings={{ ...DEFAULT_SETTINGS, speed: 1, autoMode: false, ...settings }}
      clock={CLOCK}
      exitOpen={false}
      onExitOpen={noop}
      folded={folded}
      guardEpoch={0}
      onFold={noop}
      onReopen={noop}
      onChoose={noop}
      onSkip={noop}
      onSpeed={noop}
      onAuto={noop}
      onPause={noop}
      onBgm={noop}
      onTheme={noop}
      onExit={noop}
      minute={29_846_880}
      repoUrl="https://github.com/hyungjin87c-ux/spoongame"
      buildLabel="v0.1.0 (abc1234)"
    />,
  );
}

const count = (html: string, needle: string): number => html.split(needle).length - 1;
const at = (html: string, needle: string): number => {
  const i = html.indexOf(needle);
  expect(i, needle).toBeGreaterThanOrEqual(0);
  return i;
};

const SELF = findLeadYear('self');
const DELEGATED = findLeadYear('delegated');

describe('모델: 같은 해 원서 카드는 틱에서만 파생된다 (계획 3-7절 · PD7-5)', () => {
  it('본인 동반 해: 그 해 결정 카드가 대기 중인 동안 G2 카드 모델이 있다 — 부모님이 정한 길·해결 전 영향 줄·15세', () => {
    const { state, tick } = SELF;
    expect(tick.kind).toBe('choice');
    expect(state.pending?.key).toBe(`${tick.eventId}@${tick.fromAge}`);
    expect(tick.fromAge).toBe(15);
    const m = leadCardModel(asLife(state), tick, pool)!;
    expect(m).not.toBeNull();
    expect(m.ev.id).toBe(G2);
    expect(m.by).toBe('parent');
    expect(m.age).toBe(15);
    expect(m.impact).toEqual(tick.lead!.impact);
    const choice = m.ev.choices!.find((c) => c.id === tick.lead!.choiceId)!;
    expect(m.label).toBe(choice.parentLabel ?? choice.label);
    // 부모 카드 모델(그 해 카드 X용)은 이 틱에서 null — 본인 카드는 결정 카드가 그린다
    expect(parentCardModel(asLife(state), tick, pool)).toBeNull();
    expect(pendingLeadOf(state, tick)).toBe(tick.lead);
  });

  it('고르고 나면(결과 틱에 lead 없음) · 새로고침(틱 없음) · 대기가 다른 카드로 바뀌면 원서 카드는 없다', () => {
    const { state, tick } = SELF;
    const after = resolveChoiceStep(state, state.pending!.key, state.pending!.choiceIds[0], pool);
    expect(after.tick.lead).toBeUndefined();
    expect(leadCardModel(asLife(after.state), after.tick, pool)).toBeNull();
    expect(leadCardModel(asLife(state), null, pool)).toBeNull();
    expect(leadCardModel(asLife({ ...state, pending: { ...state.pending!, key: 'other@15' } }), tick, pool)).toBeNull();
    expect(leadCardModel(asLife({ ...state, phase: 'ending' }), tick, pool)).toBeNull();
  });

  it('위임 동반 해: 결과 연출 동안(나이 +1) 원서 카드와 그 해 부모·흘러감 카드가 둘 다 모델을 낸다 — 위 카드는 G2', () => {
    const { state, tick } = DELEGATED;
    expect(state.age).toBe(tick.fromAge + 1);
    const lead = leadCardModel(asLife(state), tick, pool)!;
    const main = parentCardModel(asLife(state), tick, pool)!;
    expect(lead.ev.id).toBe(G2);
    expect(main.ev.id).toBe(tick.eventId);
    expect(main.ev.id).not.toBe(G2);
    // 판의 첫 부모 카드 안내는 위 카드(G2)에만 붙을 수 있다(G2를 먼저 해결 — 계획 3-7절 2)
    expect(lead.firstParent && main.firstParent).toBe(false);
    // 해가 넘어가면(나이가 또 오르면) 사라진다
    expect(leadCardModel(asLife({ ...state, age: state.age + 1 }), tick, pool)).toBeNull();
  });

  it('사망 틱에는 카드가 없다(기록 줄만 — 계획 3-8절 5)', () => {
    const { state, tick } = DELEGATED;
    expect(leadCardModel(asLife(state), { ...tick, kind: 'death' }, pool)).toBeNull();
  });
});

describe('부품: 지금 부모 카드는 그대로, 원서 카드는 lc-·lead- 접두 (시안 8절)', () => {
  const model = leadCardModel(asLife(SELF.state), SELF.tick, pool)!;

  it('지금 부모 카드(main)의 id·testid는 v0.6.0 그대로이고 원서 카드의 접두가 섞이지 않는다', () => {
    const html = renderToStaticMarkup(<ParentCard model={model} />);
    expect(html).toContain('data-testid="parent-card"');
    expect(html).toContain('id="pc-title"');
    expect(html).toContain('data-testid="parent-when"');
    expect(html).not.toMatch(/lead-|lc-/);
    expect(html).not.toContain(' hidden');
  });

  it('전체형(lead): 지금 부모 카드 모양 그대로(연도·나이 머리, 숨긴 것 없음, 펼침 단추 없음) — 갈고리만 lead-card·lc-title', () => {
    const html = renderToStaticMarkup(<ParentCard model={model} variant="lead" />);
    expect(html).toMatch(/^<section class="card decision decision--parent lead-card" aria-labelledby="lc-title" data-testid="lead-card" data-by="parent" data-key="school-high-pick@15"/);
    expect(html).toContain('data-testid="lead-when"');
    expect(html).toContain('id="lc-title"');
    expect(html).not.toContain('lead-card--compact');
    expect(html).not.toContain('data-testid="lead-more"');
    expect(html).not.toContain(' hidden');
    expect(html).not.toMatch(/data-testid="(parent-card|parent-title|impact|cite)"/);
    // 제목 글자 크기 상한 변수는 전체형에 그대로 있다
    expect(html).toMatch(/<h2 id="lc-title" class="decision__title" style="--title-chars:\d+" data-testid="lead-title">/);
  });

  it('요약형(lead-compact, 후속 263 ③④): 칩 · 「자세히 보기」 · 제목 · 고른 길 · 영향 줄만 보이고 상황 문장·도장·인용은 hidden, 연도·나이 머리는 없다', () => {
    const html = renderToStaticMarkup(<ParentCard model={model} variant="lead-compact" guardKey="k#0" />);
    expect(html).toContain('class="card decision decision--parent lead-card lead-card--compact"');
    expect(html).not.toContain('lead-when');
    expect(html).toContain('id="lc-chip"');
    expect(html).toContain('id="lc-label"');
    // 펼침 단추: 이름은 「자세히 보기」, ▾는 aria-hidden, 접힌 상태
    const more = /<button[^>]*data-testid="lead-more"[^>]*>(.*?)<\/button>/.exec(html)!;
    expect(more, '「자세히 보기」 단추').not.toBeNull();
    expect(more[0]).toContain('aria-expanded="false"');
    const controls = /aria-controls="([^"]*)"/.exec(more[0])![1].split(' ');
    expect(controls.slice(0, 2)).toEqual(['lc-text', 'lc-stamp']);
    expect(controls.includes('lc-cite')).toBe(model.cite !== null);
    expect(controls.includes('lc-hint')).toBe(model.firstParent);
    expect(more[1]).toContain(DASH_TEXT.leadMore);
    expect(more[1]).toContain(`<span class="lead-card__mark" aria-hidden="true">${DASH_TEXT.foldMark}</span>`);
    expect(DASH_TEXT.leadMore).toBe('자세히 보기');
    // 숨김: 상황 문장·도장(·인용)은 hidden이고 DOM 순서는 전체형과 같다(제목 → 상황 → 고른 길 → 도장 → 영향 줄 → 인용)
    expect(html).toMatch(/<p class="decision__text" data-testid="lead-text" id="lc-text" hidden="">/);
    expect(html).toMatch(/<p class="parent-pick__stamp" data-testid="lead-stamp" id="lc-stamp" hidden="">/);
    if (model.cite !== null) expect(html).toMatch(/<div class="cite" data-testid="lead-cite" data-citation="[^"]+" id="lc-cite" hidden="">/);
    const order = ['lead-title', 'lead-text', 'lead-label', 'lead-stamp', 'lead-impact'].map((id) => html.indexOf(`data-testid="${id}"`));
    expect(order.every((x) => x >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    // 보이는 것: 제목·고른 길에는 hidden이 없다
    expect(html).toMatch(/<h2 id="lc-title" class="decision__title" data-testid="lead-title">/);
    expect(html).toMatch(/<p class="parent-pick__label" data-testid="lead-label" id="lc-label">/);
  });

  it('CSS: 요약형 규칙은 시안 블록과 같은 값이고 강제 색상에서 「자세히 보기」 테두리가 CanvasText다 (새 토큰 0)', () => {
    expect(dashCss).toContain('.sheet > .lead-card { margin: var(--sp-3) var(--sp-4) 0; }');
    expect(dashCss).toContain('.lead-card--compact .decision__title { font-size: var(--fs-md); }');
    expect(dashCss).toContain('.lead-card [hidden] { display: none; }');
    expect(dashCss).toContain(".lead-card__more[aria-expanded='true'] .lead-card__mark { display: inline-block; transform: rotate(180deg); }");
    expect(dashCss).toMatch(/@media \(forced-colors: active\) \{[\s\S]*\.lead-card__more \{ border-color: CanvasText; \}/);
  });
});

describe('인생 화면의 자리 (후속 262 (1)~(3) · SPEC-005 LR5 (b)·PD8 (a) 예외)', () => {
  it('수동(시트): 원서 요약 카드가 시트 안 맨 위(결정 카드 머리 앞)에 한 장 — 시트 이름·첫 포커스는 결정 카드, 설명은 칩·제목·고른 길', () => {
    const html = renderScreen(SELF.state, SELF.tick);
    expect(count(html, 'data-testid="lead-card"')).toBe(1);
    const sheet = at(html, 'role="dialog"');
    const lead = at(html, 'data-testid="lead-card"');
    expect(lead).toBeGreaterThan(sheet);
    expect(lead).toBeLessThan(at(html, 'data-testid="decision-when"'));
    expect(lead).toBeLessThan(at(html, 'id="dc-title"'));
    expect(html).toContain('lead-card--compact');
    expect(LEAD_SHEET_DESCRIBED_BY).toBe('lc-chip lc-title lc-label');
    expect(html).toMatch(/role="dialog" aria-modal="true" aria-labelledby="dc-title" aria-describedby="lc-chip lc-title lc-label"/);
    for (const id of LEAD_SHEET_DESCRIBED_BY.split(' ')) expect(count(html, `id="${id}"`), id).toBe(1);
    // 시트 밖 가운데 열에는 그리지 않는다(한 곳에만)
    expect(html.slice(0, sheet)).not.toContain('lead-card');
    expect(html).not.toContain('data-testid="parent-card"');
  });

  it('원서 카드가 없는 시트는 지금과 같다 — aria-describedby 없음', () => {
    const plain = { ...SELF.tick, lead: undefined };
    const html = renderScreen(SELF.state, plain);
    expect(html).not.toContain('lead-card');
    expect(html).not.toContain('aria-describedby="lc-');
    expect(html).toMatch(/role="dialog" aria-modal="true" aria-labelledby="dc-title" data-testid="choice-panel"/);
  });

  it('자동 모드: 가운데 열 맨 위에 [원서 전체형 → 인라인 결정 카드] (후속 262 (4) — 시안 C)', () => {
    const html = renderScreen(SELF.state, SELF.tick, { autoMode: true });
    expect(count(html, 'data-testid="lead-card"')).toBe(1);
    expect(html).not.toContain('lead-card--compact');
    expect(html).not.toContain('role="dialog"');
    expect(at(html, 'data-testid="lead-card"')).toBeLessThan(at(html, 'data-mode="inline"'));
    expect(html).toContain('data-testid="lead-when"');
  });

  it('접힘(「잠시 덮어 두기」 뒤): 가운데 열에 [원서 전체형 → 접힌 띠] — 시트 안 요약형은 없다', () => {
    const html = renderScreen(SELF.state, SELF.tick, {}, true);
    expect(count(html, 'data-testid="lead-card"')).toBe(1);
    expect(html).not.toContain('lead-card--compact');
    expect(at(html, 'data-testid="lead-card"')).toBeLessThan(at(html, 'data-testid="decision-fold"'));
  });

  it('위임 동반 해: 부모 카드 두 장을 쌓는다 [원서 카드 → 그 해 카드] — id가 겹치지 않는다 (후속 262 (2) — 시안 B)', () => {
    const html = renderScreen(DELEGATED.state, DELEGATED.tick);
    expect(count(html, 'data-testid="lead-card"')).toBe(1);
    expect(count(html, 'data-testid="parent-card"')).toBe(1);
    expect(at(html, 'data-testid="lead-card"')).toBeLessThan(at(html, 'data-testid="parent-card"'));
    expect(count(html, 'id="pc-title"')).toBe(1);
    expect(count(html, 'id="lc-title"')).toBe(1);
    expect(html).not.toContain('role="dialog"');
  });

  it('새로고침 직후(틱 없음): 원서 카드는 다시 뜨지 않는다 — 연표에는 G2 줄이 남아 있다', () => {
    const html = renderScreen(SELF.state, null);
    expect(html).not.toContain('lead-card');
    expect(SELF.state.history.some((h) => h.eventId === G2 && h.age === 15)).toBe(true);
  });
});

describe('시간: 연출 대기 · 자동 선택 지연에 원서 카드 읽기 필요량 (후속 262 (4) — App.tsx가 같은 함수를 부른다)', () => {
  it('위임 동반 해의 연출 대기 = max(결과 기본 대기, 두 카드 필요량 합)', () => {
    const t = DELEGATED.tick;
    const need = tickReadNeedMs(t)!;
    expect(need).toBe(t.readNeedMs! + t.lead!.readNeedMs);
    const base = holdDelayMs('resolved', 1, 1, { lines: t.lines })!;
    expect(holdDelayMs('resolved', 1, 1, { lines: t.lines, readNeedMs: need })).toBe(Math.max(base, need));
  });

  it('본인 동반 해의 자동 선택 지연 = max(3초, 원서 카드 필요량) ÷ 배속 — 원서 카드가 없으면 3초 그대로', () => {
    const need = pendingLeadOf(SELF.state, SELF.tick)!.readNeedMs;
    expect(need).toBeGreaterThan(AUTO_CHOICE_MS);
    for (const speed of [1, 2, 4, 8] as const) expect(autoChoiceDelayMs(speed, 1, need)).toBe(need / speed);
    expect(autoChoiceDelayMs(1, 1, pendingLeadOf(SELF.state, null)?.readNeedMs ?? 0)).toBe(AUTO_CHOICE_MS);
  });
});
