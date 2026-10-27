import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  type ProfileId,
  autoResolveStep,
  buildCarousel,
  heavyKindOfEntry,
  heavyKindOfEvent,
  playToEnd,
  slideReadName,
  stepYear,
  noteQuestion,
  type EndingGame,
  type GameState,
  type HistoryEntry,
  type TickInfo,
} from '../src/core';
import { DASH_TEXT } from '../src/data/dashText';
import { EVENT_POOL } from '../src/data/events';
import { HEAVY_KIND_TEXT, HEAVY_SLIDE_TEXT, VEIL_TEXT, veilButtonLabel } from '../src/data/gentleText';
import { INHERIT_NOTE_TEXT } from '../src/data/lifeTable';
import { deathEntryText } from '../src/data/lifeText';
import { FIRST_PARENT_HINT, PARENT_DECIDED_TEXT, CHILD_FLOW_TEXT, PARENT_CHIP_TEXT, CHILD_CHIP_TEXT } from '../src/data/parentDecisionTable';
import { PARENT_STATE_LABEL } from '../src/data/familyText';
import { EndingScreen } from '../src/screens/EndingScreen';
import { LifeScreen, type NoteSheetState } from '../src/screens/LifeScreen';
import { TitleScreen } from '../src/screens/TitleScreen';
import { LogCard } from '../src/ui/dash/LogCard';
import { ParentCard, parentCardModel } from '../src/ui/dash/ParentCard';
import type { LifeGame } from '../src/ui/dash/Cards';
import { NOTE_CARDS } from '../src/data/noteCards';
import { StatsCarousel } from '../src/ui/StatsCarousel';
import type { YearClock } from '../src/ui/useYearClock';
import { startLife } from '../scripts/simulateLib';
import { forcedPending } from './helpers/forcedPending';
import { dropHidden, visibleText } from './helpers/visible';
import legacyV8 from './fixtures/saveV8Inherit.json';

/**
 * 무거운 장면 가리기의 화면 (SPEC-005 QI6 HV3·HV4·HV6·HV7·HV8, 완료 기준 11) — 서버 렌더로 DOM을 본다. 원문은 `hidden` 요소로 DOM에 있으므로 「새지 않는다」는 `hidden` 부분을 뺀 글자
 * (`tests/helpers/visible.ts`)로 단언한다. 브라우저 동작(펼침·키보드·포커스·live region·화면 규칙 (A)의 판 도중 토글)은 e2e/gentle.spec.ts가 본다.
 */

const MINUTE = 29_846_880;
/** React 서버 렌더가 글·속성에 쓰는 이스케이프 */
const esc = (t: string): string => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
const ev = (id: string) => EVENT_POOL.byId.get(id)!;
const CLOCK: YearClock = { get: () => 0, subscribe: () => () => undefined };
const noop = () => undefined;
const asLife = (g: GameState): LifeGame => ({ ...g, character: g.character!, generation: g.generation!, birthReport: g.birthReport!, peerSeed: g.peerSeed! });

/** 실제 이벤트 데이터로 만든 연표 줄 (서술 / 선택 결과 / 부모·흘러감) */
function narrative(id: string, age: number): HistoryEntry {
  return { age, kind: 'event', title: ev(id).title, text: ev(id).text, eventId: id };
}
function decided(id: string, choiceId: string, age: number, by?: 'parent' | 'child'): HistoryEntry {
  const c = ev(id).choices!.find((x) => x.id === choiceId)!;
  return {
    age,
    kind: 'choice',
    title: ev(id).title,
    text: by === 'parent' ? (c.parentResult ?? c.result) : c.result,
    choice: by === 'parent' ? (c.parentLabel ?? c.label) : c.label,
    eventId: id,
    ...(by === undefined ? {} : { by }),
  };
}

/** 가림 대상 줄과 대상이 아닌 줄이 섞인 인생 기록 (시간순) */
const HISTORY: HistoryEntry[] = [
  { age: 0, kind: 'stage', text: '2026년 1월, 경기도 화성시의 형편이 빠듯한 가정에서 3.3kg 여자아이로 태어났습니다. 첫째입니다.' },
  decided('infant-fever', 'dismiss', 1, 'parent'),
  decided('school-bully', ev('school-bully').choices![0].id, 10, 'child'),
  { age: 20, kind: 'stage', text: '스무 살이 되었습니다. 이제부터는 집안 형편이 아니라 내가 가진 것으로 살아갑니다.' },
  narrative('youth-job-rejections', 24),
  decided('middle-health-check', ev('middle-health-check').choices![0].id, 50),
  decided('middle-layoff', ev('middle-layoff').choices![0].id, 55),
  decided('middle-parents-farewell', ev('middle-parents-farewell').choices![0].id, 57),
  { age: 57, kind: 'event', text: INHERIT_NOTE_TEXT },
  { age: 62, kind: 'note', text: '내가 쓴 한 줄', title: '지난 일', eventId: 'note-manual' },
];
const HEAVY_ROWS = HISTORY.filter((h) => heavyKindOfEntry(h) !== null);

function renderLog(history: readonly HistoryEntry[], gentle: boolean | undefined): string {
  return renderToStaticMarkup(<LogCard history={history} live gentle={gentle} />);
}

describe('인생 기록: 가린 줄 (HV4 ①③, 화면 규칙 (A))', () => {
  const off = renderLog(HISTORY, false);
  const on = renderLog(HISTORY, true);

  it('끈 상태(기본)에서는 모든 줄이 원문이고 가림 부품이 없다 (gentle을 주지 않아도 같다)', () => {
    expect(off).not.toContain('data-veiled');
    expect(off).not.toContain('veil__');
    expect(renderLog(HISTORY, undefined)).toBe(off);
    for (const h of HEAVY_ROWS) expect(visibleText(off)).toContain(h.text);
  });

  it('켜면 지난 줄까지 모든 무거운 줄(서술·결정·부모·흘러감·상속 줄)이 가려진다 — 보이는 줄의 수 = 표지가 붙은 줄의 수', () => {
    // infant-fever · school-bully · youth-job-rejections · middle-layoff · middle-parents-farewell · 상속 줄 — 표지 없는 middle-health-check·단계·나의 기록 줄은 빠진다
    expect(HEAVY_ROWS).toHaveLength(6);
    expect(on.match(/data-veiled="true"/g)).toHaveLength(HEAVY_ROWS.length);
  });

  it('가린 줄의 보이는 글자는 「{나이}세 무거운 일이 있었습니다 · {분류}」 + [도장] + 「펼쳐 보기」뿐이고 원문(문장·고른 길 라벨)은 한 글자도 새지 않는다', () => {
    const shown = visibleText(on);
    for (const h of HEAVY_ROWS) {
      expect(shown, `${h.eventId ?? '상속 줄'}: 문장`).not.toContain(h.text);
      if (h.choice !== undefined) expect(shown, `${h.eventId}: 고른 길 라벨`).not.toContain(h.choice);
    }
    // 표지 없는 줄은 그대로 보인다: 단계·경계 이벤트(middle-health-check)·나의 기록
    for (const t of [HISTORY[0].text, HISTORY[3].text, HISTORY[5].text, HISTORY[9].text]) expect(shown).toContain(t);
    // 가린 줄의 글자 모양 (스크린리더가 읽는 글자 — 기호 「·」·「▾」는 aria-hidden)
    const rows = [...on.matchAll(/<li class="log__row[^"]*" data-kind="[a-z]+" data-veiled="true"[^>]*>([\s\S]*?)<\/li>/g)].map((m) => visibleText(m[0], { ariaHidden: true }));
    expect(rows).toContain(`57세 무거운 일이 있었습니다 ${HEAVY_KIND_TEXT.loss} 펼쳐 보기`); // 상속 줄 + 임종 줄 — 같은 모양
    expect(rows).toContain(`24세 무거운 일이 있었습니다 ${HEAVY_KIND_TEXT.work} 펼쳐 보기`);
    expect(rows).toContain(`1세 무거운 일이 있었습니다 ${HEAVY_KIND_TEXT.health} (${PARENT_DECIDED_TEXT}) 펼쳐 보기`); // 도장은 보인다(HV8)
    expect(rows).toContain(`10세 무거운 일이 있었습니다 ${HEAVY_KIND_TEXT.school} (${CHILD_FLOW_TEXT}) 펼쳐 보기`);
  });

  it('버튼: aria-expanded=false · aria-controls가 원문 요소(hidden)를 가리킨다 · 접근 가능한 이름은 「펼쳐 보기 {나이}세 {분류}」(보이는 글자가 앞머리)', () => {
    const buttons = [...on.matchAll(/<button type="button" class="btn btn--ghost btn--sm veil__btn" aria-expanded="false" aria-controls="([^"]+)" aria-label="([^"]+)" data-testid="veil-btn">/g)];
    expect(buttons.length).toBe(on.match(/data-veiled="true"/g)!.length);
    for (const [, controls, label] of buttons) {
      expect(on, `${controls}: 원문 요소가 hidden`).toMatch(new RegExp(`<span class="veil__body" id="${controls}" hidden="" data-testid="veil-body">`));
      expect(label.startsWith(VEIL_TEXT.open)).toBe(true);
    }
    expect(buttons.map((b) => b[2])).toContain(veilButtonLabel(false, 55, HEAVY_KIND_TEXT.work));
    // 같은 id가 두 줄에 없다 (한 문서 안에서 유일)
    const ids = buttons.map((b) => b[1]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('live region은 그대로다: aria-live=polite · aria-relevant=additions — 원문은 hidden이라 새 줄이 쌓일 때 읽히지 않는다 (HV4 접근성 (c))', () => {
    expect(on).toContain('aria-live="polite" aria-relevant="additions"');
    // 스크린리더가 읽는 글자(hidden·aria-hidden 제외)에 원문이 없다
    const spoken = visibleText(on, { ariaHidden: true });
    for (const h of HEAVY_ROWS) expect(spoken).not.toContain(h.text);
    // 원문 요소는 모두 hidden(펼치지 않은 상태)
    const bodies = [...on.matchAll(/<span class="veil__body"([^>]*)>/g)].map((m) => m[1]);
    expect(bodies.length).toBeGreaterThan(0);
    for (const attrs of bodies) expect(attrs).toContain('hidden=""');
  });

  it('원문(펼친 줄)은 설정을 끈 화면과 같은 마크업이다 — 결정 줄은 결과 문장 + 「(선택: 라벨)」, 부모·흘러감 줄은 도장 + 라벨', () => {
    const body = (id: string) => {
      const row = HISTORY.find((h) => h.eventId === id)!;
      return on.match(new RegExp(`<span class="veil__body" id="veil-${row.age}-${row.kind}-${id}-0" hidden="" data-testid="veil-body">([\\s\\S]*?)</span></span></li>`))?.[1] ?? '';
    };
    expect(visibleText(body('middle-layoff'))).toBe(`${HISTORY[6].text} (선택: ${HISTORY[6].choice})`);
    expect(visibleText(body('infant-fever'))).toContain(`(${PARENT_DECIDED_TEXT}: ${HISTORY[1].choice})`);
    expect(visibleText(body('school-bully'))).toContain(`(${CHILD_FLOW_TEXT}: ${HISTORY[2].choice})`);
  });

  it('옛 v8 저장 표본의 상속 줄(표지 필드 없음)도 켜면 같은 모양으로 가려진다 (M20) — v9는 v8 저장을 열지 않으므로(새 게임 + 안내, SPEC-004 MG1) 표본의 연표 줄을 그대로 그린다', () => {
    const history = (legacyV8.data as unknown as { history: HistoryEntry[] }).history;
    const game = { history };
    const html = renderLog(game.history, true);
    const inherit = game.history.filter((h) => h.text === INHERIT_NOTE_TEXT);
    expect(inherit).toHaveLength(1);
    expect(visibleText(html)).not.toContain(INHERIT_NOTE_TEXT);
    expect(visibleText(renderLog(game.history, false))).toContain(INHERIT_NOTE_TEXT);
    expect(visibleText(html, { ariaHidden: true })).toContain(`${inherit[0].age}세 무거운 일이 있었습니다 ${HEAVY_KIND_TEXT.loss} 펼쳐 보기`);
  });

  it('줄 키가 가림과 무관하다: 켜도 줄의 DOM 순서·개수는 그대로(최신순 유지)', () => {
    const count = (html: string) => (html.match(/data-testid="log-row"/g) ?? []).length;
    expect(count(on)).toBe(count(off));
    expect(count(on)).toBe(HISTORY.length);
  });
});

// ---------- 결정 카드 ----------

function renderLife(game: GameState, opts: { gentle?: boolean; autoMode?: boolean; folded?: boolean; veilOpened?: boolean; tick?: TickInfo | null; noteSheet?: NoteSheetState | null } = {}): string {
  return renderToStaticMarkup(
    <LifeScreen
      game={asLife(game)}
      tick={opts.tick ?? null}
      settings={{ ...DEFAULT_SETTINGS, speed: 1, autoMode: opts.autoMode ?? false, gentle: opts.gentle ?? false }}
      clock={CLOCK}
      exitOpen={false}
      onExitOpen={noop}
      folded={opts.folded ?? false}
      guardEpoch={0}
      onFold={noop}
      onReopen={noop}
      veilOpened={opts.veilOpened ?? false}
      onVeilOpen={noop}
      onAutoPick={noop}
      noteSheet={opts.noteSheet ?? null}
      onChoose={noop}
      onSkip={noop}
      onSpeed={noop}
      onAuto={noop}
      onPause={noop}
      onBgm={noop}
      onTheme={noop}
      onExit={noop}
      minute={MINUTE}
      repoUrl="https://github.com/hyungjin87c-ux/spoongame"
      buildLabel="v0.2.0 (abc1234)"
    />,
  );
}

describe('가린 결정 카드: 시트·인라인·접힌 띠 (HV4 ②⑤, 접근성 확인 사항 (a))', () => {
  const state = forcedPending('middle-layoff');
  const e = ev('middle-layoff');
  const leakParts = (): string[] => [e.title, e.text, ...e.choices!.map((c) => c.label)];

  it('켜면 제목 자리에 「무거운 주제 · {분류}」, 안내 한 줄, 버튼 둘만 보이고 상황·선택지·영향·인용은 그리지 않는다 (시트)', () => {
    const html = renderLife(state, { gentle: true });
    expect(html).toContain('data-veiled="true"');
    expect(html).toMatch(/<h2 id="dc-title"[^>]*data-testid="choice-title">/);
    const shown = visibleText(html);
    for (const t of leakParts()) expect(shown, t).not.toContain(t);
    const card = html.slice(html.indexOf('data-testid="choice-panel"'), html.indexOf('data-testid="auto-note"') + 40);
    expect(visibleText(card, { ariaHidden: true })).toContain(`무거운 주제 ${HEAVY_KIND_TEXT.work}`);
    // 가린 결정 카드도 「결정할 일이 있다」는 사실과 버튼 둘은 보인다
    expect(card).toContain(VEIL_TEXT.decisionNote);
    expect(card).toMatch(/<button[^>]*data-testid="veil-open"[^>]*>펼쳐서 읽기<\/button>/);
    expect(card).toMatch(/<button[^>]*data-testid="veil-auto"[^>]*>이번에는 자동으로 고르기<\/button>/);
    // 선택지 버튼·영향 줄·인용 박스·상황 문장은 DOM에도 없다
    for (const c of e.choices!) expect(card).not.toContain(`data-testid="choice-${c.id}"`);
    expect(card).not.toContain('data-testid="choice-text"');
    expect(card).not.toContain('data-testid="impact"');
    expect(card).not.toContain('data-testid="cite"');
    expect(card).not.toContain('class="choices-list"');
    // r4(SPEC-005 UX10·UX12·UX14, M22·M23): 질문 줄·풀이 줄·자동 고르기 묶음(버튼·보조 한 줄)도 가린 카드에는 없다 — 버튼은 둘뿐(펼치면 보인다)
    for (const id of ['choice-ask', 'cite-insight', 'auto-set', 'auto-on-btn', 'auto-off-btn', 'auto-sub']) expect(card, id).not.toContain(`data-testid="${id}"`);
    expect(card).not.toContain('id="dc-ask"');
    expect((card.match(/<button/g) ?? []).length, '머리의 덮어 두기 + 버튼 둘').toBe(3);
    expect(visibleText(card)).not.toContain(DASH_TEXT.autoOnBtn);
    // 머리(종류 표식·덮어 두기)와 자동 모드 안내는 틀이라 그대로
    expect(card).toContain('중대 결정');
    expect(card).toContain('data-testid="decision-fold-btn"');
    expect(card).toContain('data-testid="auto-note"');
    expect(html).toContain('role="dialog"');
  });

  it('대화상자 이름(aria-labelledby=dc-title)도 분류 문구라 이벤트 제목이 새지 않는다', () => {
    const html = renderLife(state, { gentle: true });
    expect(html).toContain('aria-labelledby="dc-title"');
    const title = html.match(/<h2 id="dc-title"[\s\S]*?<\/h2>/)![0];
    expect(visibleText(title, { ariaHidden: true })).toBe(`무거운 주제 ${HEAVY_KIND_TEXT.work}`);
  });

  it('인라인(자동 모드 켜짐)도 같은 두 버튼과 안내, 자동 모드 안내 문장은 상태에 맞는 그대로', () => {
    const html = renderLife(state, { gentle: true, autoMode: true });
    expect(html).toContain('data-mode="inline"');
    expect(html).toContain('data-veiled="true"');
    expect(html).toContain('data-testid="veil-open"');
    expect(html).toContain('data-testid="veil-auto"');
    expect(html).toContain('자동 모드가 켜져 있습니다. 잠시 뒤 성향에 따라 고릅니다.');
    for (const t of leakParts()) expect(visibleText(html), t).not.toContain(t);
  });

  it('접힌 띠의 제목도 분류 문구이고 버튼 이름은 「결정 다시 열기 무거운 주제 · {분류}」다 (aria-labelledby로 제목을 잇는다)', () => {
    const html = renderLife(state, { gentle: true, folded: true });
    const fold = html.slice(html.indexOf('data-testid="decision-fold"'), html.indexOf('data-testid="decision-reopen"') + 80);
    expect(fold).toContain('data-veiled="true"');
    // 제목은 카드와 같은 두 항목 쌍(ui/FitPair)이다 — 보이는 글자는 「무거운 주제 · {분류}」, 읽는 이름은 가운뎃점 없이 「무거운 주제 {분류}」
    expect(fold).toContain('class="fit-pair"');
    expect(visibleText(fold)).toContain(`무거운 주제 · ${HEAVY_KIND_TEXT.work}`);
    expect(visibleText(fold, { ariaHidden: true })).toContain(`무거운 주제 ${HEAVY_KIND_TEXT.work}`);
    expect(fold).toContain('aria-labelledby="dc-fold-open dc-fold-title"');
    expect(visibleText(html)).not.toContain(e.title);
  });

  it('펼친 카드(veilOpened)는 설정을 끈 카드와 같은 마크업이다 — 제목·상황·선택지·영향이 모두 보이고 가림 부품이 없다', () => {
    const opened = renderLife(state, { gentle: true, veilOpened: true });
    const off = renderLife(state, { gentle: false });
    expect(opened).toBe(off);
    expect(opened).not.toContain('data-veiled');
    expect(visibleText(opened)).toContain(e.title);
    expect(state.pending!.choiceIds.length).toBeGreaterThanOrEqual(2);
    for (const id of state.pending!.choiceIds) expect(opened).toContain(`data-testid="choice-${id}"`);
  });

  it('끈 카드(기본)에는 가림 부품이 없다', () => {
    const html = renderLife(state, { gentle: false });
    expect(html).not.toContain('veil__');
    expect(html).not.toContain('data-veiled');
    expect(visibleText(html)).toContain(e.title);
  });

  it('무거운 장면이 아닌 결정 카드는 설정을 켜도 그대로다 (middle-health-check — 경계, 가리지 않음)', () => {
    const plain = forcedPending('middle-health-check');
    expect(heavyKindOfEvent(ev('middle-health-check'))).toBeNull();
    const html = renderLife(plain, { gentle: true });
    expect(html).not.toContain('data-veiled');
    expect(visibleText(html)).toContain(ev('middle-health-check').title);
  });

  it('인용 박스가 붙은 무거운 카드(school-bully 13세 이상의 본인 결정 — c-050 「학교폭력 실태조사」)도 인용까지 가려진다 (HV4 ⑦)', () => {
    const bully = forcedPending('school-bully', 'alpha', { age: 14 });
    const open = renderLife(bully, { gentle: false });
    const cited = open.includes('data-testid="cite"');
    expect(cited, '이 시나리오에서 인용이 보이는 카드다(공허하지 않다)').toBe(true);
    const veiled = renderLife(bully, { gentle: true });
    expect(veiled).not.toContain('data-testid="cite"');
    expect(visibleText(veiled)).not.toContain('학교폭력');
  });
});

// ---------- 부모·흘러감 카드 ----------

/** 무거운 장면의 부모님이 정한·흘러간 해(카드가 뜨는 틱)를 찾는다 */
function heavyDelegatedYear(eventId: string, by: 'parent' | 'child', era: ProfileId = 'alpha'): { game: GameState; tick: TickInfo } {
  for (let seed = 1; seed <= 3000; seed++) {
    let s = startLife(seed, era);
    for (let guard = 0; guard < 80 && s.phase === 'life' && s.age <= 19; guard++) {
      if (s.pending !== null) {
        s = autoResolveStep(s, s.pending.key).state;
        continue;
      }
      const r = stepYear(s);
      if (r.tick.by === by && r.tick.kind === 'resolved' && r.tick.eventId === eventId && r.state.phase === 'life') return { game: r.state, tick: r.tick };
      s = r.state;
    }
  }
  throw new Error(`${eventId}: ${by} 해를 찾지 못했다 (${era})`);
}

describe('가린 부모·흘러감 카드 (HV4 ③ 「부모」 단위, HV8 — 칩·도장·첫 부모 카드 안내는 가리지 않는다)', () => {
  const cases: Array<{ id: string; by: 'parent' | 'child'; era?: ProfileId }> = [
    { id: 'infant-fever', by: 'parent' },
    { id: 'infant-hospital-stay', by: 'parent' },
    { id: 'school-bully', by: 'child' },
    { id: 'school-family-priority', by: 'child', era: 'industrial' }, // 옛 연도만 (2000년까지, 12~17세, 전 구간 흘러감)
    { id: 'school-early-work', by: 'parent', era: 'industrial' }, // 옛 연도만 (2000년까지, 13~16세)
  ];

  for (const { id, by, era } of cases) {
    it(`${id} (${by === 'parent' ? '부모님이 정함' : '아이의 일로 흘러감'}): 켜면 제목·상황·고른 길·영향·인용이 가려지고 칩·도장은 보인다`, () => {
      const { game, tick } = heavyDelegatedYear(id, by, era);
      const model = parentCardModel(asLife(game), tick, EVENT_POOL)!;
      expect(model).not.toBeNull();
      const kindName = HEAVY_KIND_TEXT[heavyKindOfEvent(ev(id))!];
      const veiled = renderToStaticMarkup(<ParentCard model={model} gentle />);
      const shown = visibleText(veiled);
      expect(veiled).toContain('data-veiled="true"');
      for (const t of [model.ev.title, model.ev.text, model.label]) expect(shown, t).not.toContain(t);
      expect(veiled).not.toContain('data-testid="impact"');
      expect(veiled).not.toContain('data-testid="cite"');
      expect(veiled).not.toContain('data-testid="parent-label"');
      expect(veiled).not.toContain('data-testid="parent-text"');
      // 칩 + 도장 + 제목 자리의 분류 문구 + 안내 한 줄 + 버튼 하나
      expect(shown).toContain(by === 'parent' ? PARENT_CHIP_TEXT : CHILD_CHIP_TEXT);
      expect(shown).toContain(by === 'parent' ? PARENT_DECIDED_TEXT : CHILD_FLOW_TEXT);
      const title = veiled.match(/<h2 id="pc-title"[\s\S]*?<\/h2>/)![0];
      expect(visibleText(title, { ariaHidden: true })).toBe(`무거운 주제 ${kindName}`);
      expect(shown).toContain(VEIL_TEXT.parentNote);
      expect(veiled.match(/data-testid="veil-open"/g)).toHaveLength(1);
      expect(veiled).not.toContain('data-testid="veil-auto"'); // 고를 것이 없는 카드 — 자동 고르기 버튼은 없다
      // 첫 부모 카드의 안내 한 줄은 가리지 않는다
      if (model.firstParent) expect(shown).toContain(FIRST_PARENT_HINT);
      // 끄면 원문
      const open = renderToStaticMarkup(<ParentCard model={model} gentle={false} />);
      expect(open).not.toContain('data-veiled');
      expect(visibleText(open)).toContain(model.ev.title);
      expect(visibleText(open)).toContain(model.label);
    });
  }

  it('무거운 장면이 아닌 부모 카드는 설정을 켜도 그대로다 (school-academy-night — 경계, 가리지 않음)', () => {
    const { game, tick } = heavyDelegatedYear('school-academy-night', 'parent');
    const model = parentCardModel(asLife(game), tick, EVENT_POOL)!;
    const html = renderToStaticMarkup(<ParentCard model={model} gentle />);
    expect(html).not.toContain('data-veiled');
    expect(visibleText(html)).toContain(model.ev.title);
  });
});

// ---------- 엔딩 ----------

/** 연표에 무거운 줄이 여럿(부모 결정 포함) 든 판의 엔딩 */
function endingWithHeavy(): EndingGame {
  for (let seed = 1; seed <= 400; seed++) {
    const end = playToEnd(startLife(seed, 'alpha'), (s) => s.pending!.choiceIds[0]).state as EndingGame;
    const heavy = end.history.filter((h) => heavyKindOfEntry(h) !== null);
    if (heavy.length >= 4 && heavy.some((h) => h.by !== undefined)) return end;
  }
  throw new Error('무거운 줄이 든 판을 찾지 못했다');
}

describe('엔딩: 연표의 가린 줄 + 맨 위 한 줄 (HV4 ④·HV6·HV8·R-470)', () => {
  const game = endingWithHeavy();
  const heavy = game.history.filter((h) => heavyKindOfEntry(h) !== null);
  const render = (g: EndingGame, gentle: boolean) => renderToStaticMarkup(<EndingScreen game={g} onRebirth={noop} gentle={gentle} />);

  it('연표도 설정값을 따른다: 켜면 무거운 줄이 모두 가려지고(지난 줄까지) 끄면 모두 원문 — 가린 줄의 수 = 표지가 붙은 줄의 수', () => {
    const on = render(game, true);
    const off = render(game, false);
    expect(on.match(/data-veiled="true"/g)).toHaveLength(heavy.length);
    expect(off).not.toContain('data-veiled');
    const shown = visibleText(on);
    for (const h of heavy) expect(shown, `${h.eventId ?? '상속 줄'}: 문장`).not.toContain(h.text);
    for (const h of heavy) expect(visibleText(off)).toContain(h.text);
    // 가린 연표 줄: 안내 + 펼쳐 보기, 펼치면 제목 → 고른 길 → 결과 문장 (hidden 요소 안에 있다)
    const body = [...on.matchAll(/<span class="veil__body" id="(veil-tl-[^"]+)" hidden="" data-testid="veil-body">([\s\S]*?)<\/span><\/span><\/li>/g)];
    expect(body.length).toBe(heavy.length);
    const first = heavy.find((h) => h.title !== undefined)!;
    expect(body.some((b) => b[2].includes(`<strong>${first.title}</strong>`) && b[2].includes(first.text))).toBe(true);
  });

  it('사망 줄과 엔딩 맨 위 사망 문장은 원인 낱말까지 그대로 보인다 (R-470) — 20세 미만 「갑작스러운 병」·「사고」 포함', () => {
    for (const [age, cause] of [[7, '사고'], [12, '갑작스러운 병'], [45, '사고']] as const) {
      const g: EndingGame = { ...game, death: { age, cause }, history: [...game.history.filter((h) => h.kind !== 'death'), { age, kind: 'death', text: deathEntryText(cause) }] };
      const on = render(g, true);
      const off = render(g, false);
      expect(visibleText(on)).toContain(deathEntryText(cause));
      expect(visibleText(on)).toContain(`${age}세에 세상을 떠났습니다`);
      const deathLine = (html: string) => html.match(/<p data-testid="ending-death">[\s\S]*?<\/p>/)![0];
      expect(deathLine(on)).toBe(deathLine(off));
      expect(on).toContain(`data-kind="death"`);
      expect(on).not.toMatch(/data-kind="death" data-veiled/);
    }
  });

  it('맨 위 한 줄 「이 판은 무거운 장면을 가린 채 살았습니다.」: 판의 기록 gentleUsed가 참일 때만 — 설정이 꺼져 있어도 보인다, 기록이 없으면 설정이 켜져 있어도 없다 (HV6)', () => {
    const used: EndingGame = { ...game, gentleUsed: true };
    expect(render(used, false)).toContain(`<p class="ending__gentle" data-testid="ending-gentle">${VEIL_TEXT.endingLine}</p>`);
    expect(render(used, true)).toContain('data-testid="ending-gentle"');
    expect(render(game, true)).not.toContain('ending-gentle');
    expect(render(game, false)).not.toContain('ending-gentle');
    // 공통 헤더 아래·머리 위에 있다
    const html = render(used, false);
    expect(html.indexOf('ending-gentle')).toBeGreaterThan(html.indexOf('ending-screen'));
    expect(html.indexOf('ending-gentle')).toBeLessThan(html.indexOf('ending__head'));
    // 의견 보내기 주소·플레이 시간에는 싣지 않는다 (엔딩에는 의견 보내기 링크도 없다)
    expect(html).not.toContain('issues/new');
    expect(VEIL_TEXT.endingLine).toBe('이 판은 무거운 장면을 가린 채 살았습니다.');
  });
});

// ---------- 첫 화면 자살률 슬라이드 (HV7) ----------

describe('첫 화면 자살률 슬라이드 (HV7, REV-005-HV-1 7절)', () => {
  const data = buildCarousel();
  const suicide = data.slides.find((s) => s.safety !== null)!;
  const render = (gentle: boolean) => renderToStaticMarkup(<StatsCarousel data={data} gentle={gentle} />);
  const articleOf = (html: string, id: string) => html.match(new RegExp(`<article[^>]*data-slide-id="${id}"[\\s\\S]*?</article>`))![0];

  it('자살률 슬라이드가 실제로 있고 상담전화가 데이터(helpLine)에서 온다 — 이 시험의 전제', () => {
    expect(suicide).toBeDefined();
    expect(suicide.id).toBe('suicide-rate');
    expect(suicide.safety!.name).toBe('자살예방 상담전화');
    expect(suicide.safety!.number).toBe('109');
  });

  it('끈 상태(기본)는 기존 모양 그대로다: 표제어·공식 통계명·읽기 이름이 원문이고 가림 부품이 없다', () => {
    const html = articleOf(render(false), suicide.id);
    expect(html).not.toContain('slide__veil-btn');
    expect(html).not.toContain('slide__veiled');
    expect(html).toContain(`aria-label="${data.slides.indexOf(suicide) + 1}/${data.slides.length} ${suicide.insight}, ${suicide.officialText}"`);
  });

  it('켜면: 표제어 「무거운 주제 · 마음 건강 통계」, 「펼쳐 보기」 하나(aria-expanded·aria-controls 두 묶음), 읽기 이름도 분류 문구', () => {
    const html = articleOf(render(true), suicide.id);
    const n = data.slides.indexOf(suicide) + 1;
    expect(html).toContain(`aria-label="${n}/${data.slides.length} ${HEAVY_SLIDE_TEXT.readName}"`);
    expect(html).toContain('slide--veiled');
    const h3 = html.match(/<h3 class="slide__insight">[\s\S]*?<\/h3>/)![0];
    expect(visibleText(h3)).toBe(HEAVY_SLIDE_TEXT.title);
    expect(visibleText(h3, { ariaHidden: true })).toBe('무거운 주제 마음 건강 통계');
    const btns = html.match(/<button[^>]*slide__veil-btn[^>]*>/g)!;
    expect(btns).toHaveLength(1);
    expect(btns[0]).toContain('aria-expanded="false"');
    expect(btns[0]).toContain(`aria-controls="veil-${suicide.id}-a veil-${suicide.id}-b"`);
    expect(html).toContain(`id="veil-${suicide.id}-a" hidden=""`);
    expect(html).toContain(`id="veil-${suicide.id}-b" hidden=""`);
  });

  it('가린 슬라이드의 보이는 글자에 표제어·공식 통계명·값·단위·기준·정의·출처가 없다 — 그래프·읽기 이름(chartLabel)도 hidden 묶음 안이다', () => {
    const html = articleOf(render(true), suicide.id);
    const shown = visibleText(html, { ariaHidden: true });
    for (const t of [suicide.insight, suicide.officialText, suicide.valueText ?? '', suicide.definition, suicide.sourceText, suicide.chartLabel, suicide.basisLine]) {
      if (t !== '') expect(shown, t).not.toContain(t);
    }
    expect(shown).not.toContain('자살률');
    // 그래프 svg와 그 읽기 이름은 hidden 묶음 안에 있다
    const top = html.match(new RegExp(`id="veil-${suicide.id}-a" hidden="" data-testid="slide-veiled-top">[\\s\\S]*?</div><aside`))![0];
    expect(top).toContain(esc(suicide.chartLabel));
    expect(dropHidden(html)).not.toContain(esc(suicide.chartLabel));
  });

  it('상담전화 묶음은 펼침 영역 밖에 늘 보이고 이름·번호·시간은 그대로다 (SC6 — 순화하지 않는다)', () => {
    const html = articleOf(render(true), suicide.id);
    const visible = dropHidden(html);
    expect(visible).toContain('data-testid="slide-help"');
    const help = visibleText(visible.match(/<aside[\s\S]*?<\/aside>/)![0]);
    expect(help).toContain('힘든 마음을 혼자 견디지 않아도 됩니다.');
    expect(help).toContain(`${suicide.safety!.name} ${suicide.safety!.number} (${suicide.safety!.hours})`);
    // 두 hidden 묶음 사이에 있다 (순서: 표제어 → 버튼 → 앞 묶음 → 상담전화 → 뒤 묶음)
    const order = ['slide__veil-btn', `id="veil-${suicide.id}-a"`, 'slide__help', `id="veil-${suicide.id}-b"`].map((m) => html.indexOf(m));
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(order.every((i) => i > -1)).toBe(true);
  });

  it('다른 슬라이드는 설정을 켜도 가리지 않는다 (조사망률·기대수명·고령 빈곤·1인 가구 — 인구 통계이지 장면이 아니다)', () => {
    const on = render(true);
    for (const s of data.slides) {
      if (s.safety !== null) continue;
      const html = articleOf(on, s.id);
      expect(html, s.id).not.toContain('slide__veil-btn');
      expect(html, s.id).not.toContain('slide__veiled');
      // 슬라이드의 이름은 「n/N 표제어, 공식 통계명」, 전망 슬라이드는 「n/N 전망, …」(slideReadName) — QI4 2단계에서 전망 5장이 더해졌다
      expect(html, s.id).toContain(`aria-label="${slideReadName(s, data.slides.indexOf(s), data.slides.length)}"`);
    }
  });

  it('점 버튼 이름: 가린 슬라이드는 insight 자리에 「무거운 주제, 마음 건강 통계」, 다른 슬라이드는 그대로 (점은 지표 5개 이하에서만 보인다 — 작은 묶음으로 확인)', () => {
    const other = data.slides.find((s) => s.safety === null)!;
    const small = { slides: [other, suicide], orgs: data.orgs };
    const on = renderToStaticMarkup(<StatsCarousel data={small} gentle />);
    expect(on).toContain(`aria-label="1/2 ${other.insight}"`);
    expect(on).toContain(`aria-label="2/2 ${HEAVY_SLIDE_TEXT.readName}"`);
    expect(on).not.toContain(`aria-label="2/2 ${suicide.insight}"`);
    const off = renderToStaticMarkup(<StatsCarousel data={small} gentle={false} />);
    expect(off).toContain(`aria-label="2/2 ${suicide.insight}"`);
  });
});

// ---------- 첫 화면 스위치 연결 ----------

describe('첫 화면: 스위치 연결 (HV3)', () => {
  const render = (gentle: { on: boolean; onToggle: () => void } | undefined) =>
    renderToStaticMarkup(<TitleScreen generation="random" lifeLength="short30" onSelectGeneration={noop} onSelectLifeLength={noop} onBegin={noop} gentle={gentle} />);

  it('스위치의 켜짐 상태가 aria-checked·글자(꺼짐/켜짐)에 반영되고 켜면 오른쪽 통계 카드의 자살률이 가려진다', () => {
    const off = render({ on: false, onToggle: noop });
    const on = render({ on: true, onToggle: noop });
    expect(off).toContain('role="switch" aria-checked="false"');
    expect(on).toContain('role="switch" aria-checked="true"');
    expect(off).not.toContain('slide--veiled');
    expect(on).toContain('slide--veiled');
    expect(visibleText(on)).not.toContain('삶을 스스로 마감하는 사람');
    expect(visibleText(off)).toContain('삶을 스스로 마감하는 사람');
    // 스위치 자체는 가림 상태와 무관하게 같은 자리에 있다
    for (const html of [off, on]) expect(html).toContain('data-testid="gentle-slot"');
  });
});

// ---------- HV8 가려지지 않는 것 ----------

describe('가려지지 않는 것 (HV8·R-471) — 설정을 켜도 보이는 것의 대조', () => {
  it('인생 화면: 식구 카드의 상태 문구·스탯 미터·자산/집안 살림 영역·기록 카드 ⑤⑥·결정자 표지가 켠 상태에서도 그대로다 (같은 판의 끈 화면과 대조)', () => {
    // 부모님이 병환 중(cared_parents)·세상을 떠남(parents_gone)인 중년 판 — 식구 카드가 상태 문구를 그린다
    const base = forcedPending('middle-layoff');
    for (const flag of ['cared_parents', 'parents_gone']) {
      const game: GameState = { ...base, flags: [...new Set([...base.flags, flag])].sort() };
      const on = renderLife(game, { gentle: true, veilOpened: true });
      const off = renderLife(game, { gentle: false });
      const familyOn = on.match(/<section[^>]*aria-labelledby="family-t"[\s\S]*?<\/section>/)?.[0] ?? '';
      const familyOff = off.match(/<section[^>]*aria-labelledby="family-t"[\s\S]*?<\/section>/)?.[0] ?? '';
      expect(familyOn.length, '식구 카드가 그려진다').toBeGreaterThan(100);
      expect(familyOn).toBe(familyOff);
      expect(visibleText(familyOn)).toContain(flag === 'cared_parents' ? PARENT_STATE_LABEL.ill : PARENT_STATE_LABEL.gone);
    }
    // 스탯·자산 미터는 가림과 무관하다
    const on = renderLife(base, { gentle: true });
    const off = renderLife(base, { gentle: false });
    expect(on.match(/role="meter"/g)).toHaveLength(off.match(/role="meter"/g)!.length);
    for (const key of ['health', 'happiness', 'education', 'relationships']) expect(on).toContain(`data-stat="${key}"`);

    // 기록 카드 ⑤ note-illness · ⑥ note-parents-aging (R-490): 기록 시트는 설정을 받지 않는다 — 켠 상태에서도 질문 글이 끈 상태와 같다(대화상자 이름 포함).
    // 결정 카드가 없는 판(pending 없음)으로 시트만 그린다 — 두 카드가 같이 뜨는 일은 실제로 없다. 가림 부품·분류 문구(「무거운 일이 있었습니다」「무거운 주제」)가 시트 안에 없다.
    const calm: GameState = { ...base, pending: null };
    const sheetOf = (html: string): string => html.slice(html.indexOf('data-testid="note-overlay"'));
    for (const id of ['note-illness', 'note-parents-aging']) {
      const card = NOTE_CARDS.find((c) => c.id === id)!;
      const noteSheet: NoteSheetState = { via: 'auto', card, token: 0 };
      const sheetOn = sheetOf(renderLife(calm, { gentle: true, noteSheet }));
      const sheetOff = sheetOf(renderLife(calm, { gentle: false, noteSheet }));
      const question = noteQuestion(card, asLife(calm));
      expect(question.length, `${id}: 질문이 있다`).toBeGreaterThan(10);
      expect(sheetOn.length, `${id}: 시트가 그려진다`).toBeGreaterThan(500);
      expect(sheetOn, `${id}: 켠 시트 = 끈 시트(마크업 전체)`).toBe(sheetOff);
      expect(visibleText(sheetOn), `${id}: 질문 글이 보인다`).toContain(question);
      expect(visibleText(sheetOn, { ariaHidden: true }), `${id}: 스크린리더도 질문을 읽는다`).toContain(question);
      expect(sheetOn).toMatch(/<h2 id="nc-title"[^>]*data-testid="note-title">/);
      expect(sheetOn, `${id}: 가림 부품이 없다`).not.toMatch(/veil|data-veiled/);
      expect(visibleText(sheetOn), `${id}: 분류 문구가 질문을 대신하지 않는다`).not.toMatch(/무거운 일이 있었습니다|무거운 주제/);
    }
  });

  it('인생 기록의 단계 줄·출생 줄·「나의 기록」 줄·사망 줄은 가려지지 않는다 — 가림은 heavy 표지(이벤트·상속 줄)에만 걸린다', () => {
    const on = renderLog(HISTORY, true);
    expect(on).toMatch(/data-kind="stage"[^>]*data-testid="log-row"/);
    expect(on).toMatch(/data-kind="note"[^>]*data-testid="log-row"/);
    for (const h of HISTORY) {
      if (h.kind === 'stage' || h.kind === 'note') expect(heavyKindOfEntry(h)).toBeNull();
    }
    expect(heavyKindOfEntry({ age: 80, kind: 'death', text: deathEntryText('사고') })).toBeNull();
  });
});
