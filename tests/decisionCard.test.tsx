import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { startLife } from '../scripts/simulateLib';
import { DEFAULT_SETTINGS, advanceUntilDecision, calendarYear, deciderOf, possibleAgesOf, resolveChoice, type GameState, type Settings } from '../src/core';
import { PARENT_DECISION_TABLE } from '../src/data/parentDecisionTable';
import { forcedPending } from './helpers/forcedPending';
import { DASH_TEXT, titleCharsFor } from '../src/data/dashText';
import { EVENT_POOL } from '../src/data/events';
import { LifeScreen } from '../src/screens/LifeScreen';
import { CitationBox } from '../src/ui/dash/CitationBox';
import type { LifeGame } from '../src/ui/dash/Cards';
import type { YearClock } from '../src/ui/useYearClock';

/**
 * 중대 결정 카드 서버 렌더 시험 (SPEC-003 MD1·MD2, M7b — docs/design/copy.md 6절 DOM): 두 틀(모달 시트 / 비모달 인라인) · 접힌 띠 · 요소와 순서 · 접근성 속성 · 자동 모드 안내 한 문장 · 인용 박스 유무.
 * 접기·다시 열기의 동작(타이머·포커스·가드)은 tests/decisionCollapse.test.tsx(판단)와 e2e/m7b-decision.spec.ts(브라우저)가 본다.
 * 문구의 기대값은 copy.md 6-1절을 사람이 옮겨 적은 글자다(구현 상수를 다시 쓰지 않는다).
 */

const CLOCK: YearClock = { get: () => 0, subscribe: () => () => undefined };
const noop = () => undefined;
const asLife = (g: GameState): LifeGame => ({ ...g, character: g.character!, generation: g.generation!, birthReport: g.birthReport!, peerSeed: g.peerSeed! });
const settingsOf = (o: Partial<Settings> = {}): Settings => ({ ...DEFAULT_SETTINGS, speed: 1, autoMode: false, ...o });

function render(game: GameState, o: { auto?: boolean; folded?: boolean; epoch?: number } = {}): string {
  return renderToStaticMarkup(
    <LifeScreen
      game={asLife(game)}
      settings={settingsOf({ autoMode: o.auto ?? false })}
      clock={CLOCK}
      exitOpen={false}
      onExitOpen={noop}
      folded={o.folded ?? false}
      guardEpoch={o.epoch ?? 0}
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

/**
 * 카드 eventId가 대기 중인 상태 (앞선 결정은 첫 선택지로 넘긴다). SPEC-005부터 어린 시절의 큰 결정 중 부모님이 정하거나 아이의 일로 흘러가는 카드는 진행 중 `pending`이 되지 않으므로
 * 그런 카드(`school-tutoring`·`infant-fever`·`infant-new-sibling`)는 대기 상태를 직접 만든다(tests/helpers/forcedPending.ts) — 이 묶음은 시트의 **보이는 모양**을 보고, 모양은 누가 정하느냐와 무관하다.
 */
/** 카드 화면은 인용 박스의 시대 구간(지난·지금·다가올)을 게임 속 연도로 정한다 — 시대 구간을 고정해 보려고 출생 연도를 그 구간의 대표 연도(지난 1985 · 지금 2025 · 다가올 2040)에 맞춘다(화면 시험이라 세대 범위 검증은 거치지 않는다) */
const LEGACY_YEAR = { past: 1985, present: 2025, future: 2040 } as const;
function stateAt(eventId: string, era: 'past' | 'present' | 'future' = 'present'): GameState {
  const s = stateAtRaw(eventId, era);
  return { ...s, character: { ...s.character!, birthYear: Math.min(2020, Math.max(1940, LEGACY_YEAR[era] - s.age)) } };
}
function stateAtRaw(eventId: string, era: 'past' | 'present' | 'future'): GameState {
  if (PARENT_DECISION_TABLE[eventId] !== undefined && possibleAgesOf(EVENT_POOL.byId.get(eventId)!).some((a) => deciderOf(eventId, a) !== 'self')) return forcedPending(eventId, era);
  for (let seed = 1; seed <= 4000; seed++) {
    let s = startLife(seed, era === 'past' ? 'genx' : era === 'present' ? 'alpha' : 'genz');
    for (let guard = 0; guard < 80 && s.phase === 'life'; guard++) {
      s = advanceUntilDecision(s).state;
      if (s.phase !== 'life' || s.pending === null) break;
      if (s.pending.eventId === eventId) return s;
      s = resolveChoice(s, s.pending.key, s.pending.choiceIds[0]);
    }
  }
  throw new Error(`${eventId}: 카드 상태를 찾지 못했다`);
}

const text = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
/** 인용 박스의 보이는 글자 — 문단 경계는 공백, Glue가 감싼 span(.nowrap·.keep-phrase)은 글자를 쪼개지 않으므로 공백 없이 */
const citeText = (html: string) => html.replace(/<\/?span[^>]*>/g, '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const tagAt = (html: string, needle: string) => {
  const at = html.indexOf(needle);
  expect(at, needle).toBeGreaterThan(-1);
  return html.slice(html.lastIndexOf('<', at), html.indexOf('>', at) + 1);
};

const withCite = stateAt('school-tutoring');
const withoutCite = stateAt('infant-fever');
const research = stateAt('infant-new-sibling');

describe('모달 시트 (자동 모드 꺼짐)', () => {
  const html = render(withCite);

  it('대화상자: role=dialog · aria-modal · 이름은 카드 제목(aria-labelledby=dc-title), 스크림(.overlay)이 감싼다', () => {
    const dialog = tagAt(html, 'data-testid="choice-panel"');
    expect(dialog).toContain('role="dialog"');
    expect(dialog).toContain('aria-modal="true"');
    expect(dialog).toContain('aria-labelledby="dc-title"');
    expect(dialog).toContain('data-mode="sheet"');
    expect(dialog).toContain('class="sheet decision decision--sheet"');
    expect(html.indexOf('class="overlay"')).toBeLessThan(html.indexOf('role="dialog"'));
    expect(html.match(/role="dialog"/g)).toHaveLength(1);
  });

  it('바깥 전부 inert: 헤더·도구 줄·main·본문 끝 여백. 시트 자신과 접힌 띠는 아니다', () => {
    for (const needle of ['data-testid="dash-head"', 'class="toolbar"', 'class="dash"', 'class="page-end-space"']) expect(tagAt(html, needle), needle).toContain('inert=""');
    expect(tagAt(html, 'role="dialog"')).not.toContain('inert');
    // 시트는 inert인 형제들 뒤, 화면 맨 끝이다
    expect(html.indexOf('role="dialog"')).toBeGreaterThan(html.indexOf('class="page-end-space"'));
  });

  it('머리: 종류 「중대 결정」 · 「{연도}년 · {나이}세」 · 「잠시 덮어 두기 ▾」(▾는 aria-hidden이라 접근 가능한 이름은 「잠시 덮어 두기」 — r4 UX11, 옛 이름을 바꿨다)', () => {
    const head = html.slice(html.indexOf('class="decision__head"'), html.indexOf('class="decision__body"'));
    expect(text(head)).toContain('중대 결정');
    const year = calendarYear(withCite.character!.birthYear, withCite.age);
    expect(text(head.slice(head.indexOf('decision__when')))).toContain(`${year}년 · ${withCite.age}세`);
    expect(head).toContain('data-testid="decision-fold-btn"');
    // K11: 보이는 모양은 「{연도}년 · {나이}세」지만 가운뎃점은 접근성 트리에서 숨긴다 — 낭독은 「{연도}년 {나이}세」, 양옆 공백은 밖에 있어 붙지 않는다
    const whenAt = head.indexOf('>', head.indexOf('decision__when')) + 1;
    const when = head.slice(whenAt, head.indexOf('</span></span>', whenAt) + 14);
    expect(when).toContain('<span aria-hidden="true">·</span>');
    expect(when.replace(/<span aria-hidden="true">[^<]*<\/span>/g, '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()).toBe(`${year}년 ${withCite.age}세`);
    expect(when).toMatch(/년<\/?[^>]*> ?<span aria-hidden="true">·<\/span> ?<?/);
    expect(head).toMatch(/잠시 덮어 두기 <span aria-hidden="true">▾<\/span>/);
  });

  it('몸의 순서: 제목(h2·tabindex=-1·제목 칸 수 변수) → 상황 → 인용 박스 → 선택지 묶음(첫 자식 = 질문 줄) → 영향 안내 → 자동 모드 안내', () => {
    const body = html.slice(html.indexOf('class="decision__body"'));
    const ev = EVENT_POOL.byId.get(withCite.pending!.eventId)!;
    const h2 = tagAt(body, 'id="dc-title"');
    expect(h2).toContain('<h2');
    expect(h2).toContain('tabindex="-1"');
    expect(h2).toContain(`--title-chars:${titleCharsFor(ev.title)}`);
    const order = ['id="dc-title"', 'data-testid="choice-text"', 'data-testid="cite"', 'role="group"', 'data-testid="choice-ask"', 'class="choice"', 'data-testid="choice-hint"', 'data-testid="auto-note"'].map((n) => body.indexOf(n));
    for (const i of order) expect(i).toBeGreaterThan(-1);
    for (let i = 1; i < order.length; i++) expect(order[i], `${i}번째`).toBeGreaterThan(order[i - 1]);
  });

  // r4 UX10(QI10): 공통 질문 한 줄 — 선택지 묶음의 첫 자식이고 묶음의 이름이다(aria-labelledby). 글자는 copy.md 15-1 「어떻게 하겠습니까?」(사람이 옮겨 적은 값)
  it('질문 줄: 묶음 .choices-list[role=group]의 첫 자식 <p id="dc-ask">이고 묶음은 aria-labelledby="dc-ask"로 질문을 이름으로 가진다 — 글자는 「어떻게 하겠습니까?」, 카드에 하나', () => {
    const group = tagAt(html, 'aria-labelledby="dc-ask"');
    expect(group).toContain('role="group"');
    expect(group).toContain('class="choices-list"');
    expect(group, '옛 이름 aria-label="선택지"는 없다').not.toContain('aria-label=');
    const after = html.slice(html.indexOf(group) + group.length);
    expect(after.startsWith('<p class="decision__ask" id="dc-ask" data-testid="choice-ask">어떻게 하겠습니까?</p>'), '묶음 바로 안의 첫 자식').toBe(true);
    expect(html.match(/data-testid="choice-ask"/g)).toHaveLength(1);
    expect(html.match(/id="dc-ask"/g)).toHaveLength(1);
    // 합쇼체 의문문, 해요체 어미 0
    expect(DASH_TEXT.choiceAsk).toBe('어떻게 하겠습니까?');
    expect(DASH_TEXT.choiceAsk).toMatch(/습니까\?$/);
    expect(DASH_TEXT.choiceAsk).not.toMatch(/(까요|세요|어요|아요|해요)\?*$/);
    // 질문은 첫 선택지보다 앞이고 상황·인용보다 뒤다
    expect(html.indexOf('data-testid="choice-ask"')).toBeGreaterThan(html.indexOf('data-testid="cite"'));
    expect(html.indexOf('data-testid="choice-ask"')).toBeLessThan(html.indexOf('class="choice"'));
  });

  // r4 UX12(QI12): 카드 맨 끝의 자동 고르기 묶음 — 안내 문장 → 버튼 → 보조 한 줄 (copy.md 15-3). 시트(자동 모드 꺼짐)에는 켜는 버튼
  it('자동 고르기 묶음(시트): .decision__autoset = 안내 문장 → 버튼 「이후 결정을 자동으로 고르게 하기」(aria-describedby=dc-autosub) → 보조 한 줄, 영향 안내 뒤 카드 맨 끝', () => {
    const at = html.indexOf('<div class="decision__autoset"');
    expect(at).toBeGreaterThan(-1);
    const set = html.slice(at, html.indexOf('</div>', at) + 6);
    expect(set).toContain('data-testid="auto-set"');
    expect(citeText(set)).toBe('자동 모드가 꺼져 있습니다. 직접 고를 때까지 시간은 멈춥니다. 이후 결정을 자동으로 고르게 하기 이 결정부터 성향에 따라 고릅니다. 설정으로 남아 다음 판에도 이어지며, 카드 아래나 도구 줄에서 끌 수 있습니다.');
    const button = tagAt(set, 'data-testid="auto-on-btn"');
    expect(button).toContain('class="btn btn--ghost btn--sm decision__autobtn"');
    expect(button).toContain('aria-describedby="dc-autosub"');
    expect(button).toContain('type="button"');
    expect(set.indexOf('data-testid="auto-note"')).toBeLessThan(set.indexOf('data-testid="auto-on-btn"'));
    expect(set.indexOf('data-testid="auto-on-btn"')).toBeLessThan(set.indexOf('id="dc-autosub"'));
    expect(html.indexOf('data-testid="auto-set"')).toBeGreaterThan(html.indexOf('data-testid="choice-hint"'));
    expect(html.match(/data-testid="auto-(on|off)-btn"/g)).toHaveLength(1);
    expect(html).not.toContain('auto-off-btn');
    // 낭독 영역(전환 문장)은 카드 밖 LifeScreen 한 곳에 늘 있고 처음엔 비어 있다
    expect(html).toMatch(/<p class="sr-only" role="status" data-testid="auto-status"><\/p>/);
  });

  it('자동 모드 안내는 상태에 맞는 한 문장뿐이다: 꺼짐 「자동 모드가 꺼져 있습니다. 직접 고를 때까지 시간은 멈춥니다.」 — 콜론 라벨형·켜짐 문장·role=status 없음', () => {
    const note = html.slice(html.lastIndexOf('<p', html.indexOf('data-testid="auto-note"')), html.indexOf('</p>', html.indexOf('data-testid="auto-note"')) + 4);
    expect(text(note)).toBe('자동 모드가 꺼져 있습니다. 직접 고를 때까지 시간은 멈춥니다.');
    expect(note).not.toContain('role=');
    expect(html).not.toContain('자동 모드가 켜져 있습니다. 잠시 뒤 성향에 따라 고릅니다.');
    expect(html).not.toContain('자동 모드:');
    expect(html.match(/data-testid="auto-note"/g)).toHaveLength(1);
  });

  it('선택지 버튼: 번호 원은 aria-hidden, 시트에서는 위쪽 변 맞춤(onFocus)을 걸지 않는다 — 버튼 수 = 보이는 선택지 수', () => {
    const buttons = [...html.matchAll(/<button\b[^>]*class="choice"[\s\S]*?<\/button>/g)].map((m) => m[0]);
    expect(buttons).toHaveLength(withCite.pending!.choiceIds.length);
    for (const b of buttons) expect(b).toContain('<span class="choice__no" aria-hidden="true">');
  });
});

describe('비모달 인라인 카드 (자동 모드 켜짐)', () => {
  const html = render(withCite, { auto: true });

  it('section(aria-labelledby=dc-title)이고 대화상자·스크림·inert가 없다 — 가운데 열 안, 인생 기록보다 앞이다', () => {
    const frame = tagAt(html, 'data-testid="choice-panel"');
    expect(frame.startsWith('<section')).toBe(true);
    expect(frame).toContain('class="card decision decision--inline"');
    expect(frame).toContain('aria-labelledby="dc-title"');
    expect(frame).toContain('data-mode="inline"');
    expect(frame).not.toContain('role="dialog"');
    expect(html).not.toContain('class="overlay"');
    expect(html).not.toContain('inert');
    expect(html.indexOf('data-testid="choice-panel"')).toBeLessThan(html.indexOf('data-testid="log"'));
    expect(html.indexOf('data-testid="choice-panel"')).toBeGreaterThan(html.indexOf('class="dash"'));
  });

  it('안쪽 DOM은 시트와 같다 (머리·제목·상황·인용·선택지) — 자동 모드 안내만 켜짐 문장이다', () => {
    const sheet = render(withCite);
    const inner = (h: string) => h.slice(h.indexOf('class="decision__head"'), h.indexOf('data-testid="auto-note"')).replace(/data-key="[^"]*"/g, '');
    expect(inner(html)).toBe(inner(sheet));
    expect(/<p class="decision__auto" data-testid="auto-note">([^<]*)<\/p>/.exec(html)![1]).toBe('자동 모드가 켜져 있습니다. 잠시 뒤 성향에 따라 고릅니다.');
    expect(html).not.toContain('자동 모드가 꺼져 있습니다.');
  });

  it('인라인 카드에도 「잠시 덮어 두기」가 있다 (자동 모드에서 접기 허용 — U3(a))', () => {
    expect(html).toContain('data-testid="decision-fold-btn"');
  });

  // r4 UX12-5: 인라인 카드(자동 모드 켜짐)에는 끄는 버튼 「이후 결정을 직접 고르기」 — 켜는 버튼과 짝. 누르면 같은 카드가 시트로 바뀐다(App의 기존 `autoTurnedOff` 경로)
  it('자동 고르기 묶음(인라인): 끄는 버튼 「이후 결정을 직접 고르기」와 보조 한 줄 — 켜는 버튼은 없다. 질문 줄은 시트와 같다', () => {
    const at = html.indexOf('<div class="decision__autoset"');
    expect(at).toBeGreaterThan(-1);
    const set = html.slice(at, html.indexOf('</div>', at) + 6);
    expect(citeText(set)).toBe('자동 모드가 켜져 있습니다. 잠시 뒤 성향에 따라 고릅니다. 이후 결정을 직접 고르기 이 결정부터 직접 고릅니다. 도구 줄의 「자동 모드」도 함께 꺼집니다.');
    const button = tagAt(set, 'data-testid="auto-off-btn"');
    expect(button).toContain('class="btn btn--ghost btn--sm decision__autobtn"');
    expect(button).toContain('aria-describedby="dc-autosub"');
    expect(html).not.toContain('auto-on-btn');
    expect(html).toContain('<p class="decision__ask" id="dc-ask" data-testid="choice-ask">어떻게 하겠습니까?</p>');
  });
});

describe('접힌 띠', () => {
  for (const auto of [false, true]) {
    it(`카드 자리의 한 줄: 「중대 결정」 · 제목 · 「다시 열 때까지 시간은 멈춥니다.」 · 「결정 다시 열기」 — 자동 모드 ${auto ? '켜짐' : '꺼짐'}에서도 같다 (카드·시트·선택지 버튼 없음)`, () => {
      const html = render(withCite, { auto, folded: true });
      const ev = EVENT_POOL.byId.get(withCite.pending!.eventId)!;
      const strip = html.slice(html.indexOf('<section class="card fold"'), html.indexOf('</section>', html.indexOf('<section class="card fold"')) + 10);
      expect(strip).toContain('aria-labelledby="dc-fold-title"');
      expect(text(strip)).toBe(`중대 결정 ${ev.title} 다시 열 때까지 시간은 멈춥니다. 결정 다시 열기`);
      const button = tagAt(strip, 'data-testid="decision-reopen"');
      expect(button).toContain('id="dc-fold-open"');
      expect(button).toContain('aria-labelledby="dc-fold-open dc-fold-title"');
      expect(strip).toContain('id="dc-fold-title"');
      expect(html).not.toContain('role="dialog"');
      expect(html).not.toContain('data-testid="choice-panel"');
      expect(html).not.toContain('class="choice"');
      expect(html).not.toContain('inert');
      expect(html.indexOf('class="card fold"')).toBeLessThan(html.indexOf('data-testid="log"'));
    });
  }

  it('선택지가 없으면 접힘 표시를 줘도 아무것도 그리지 않는다 (접힘은 대기 중인 결정에만 뜻이 있다)', () => {
    const quiet = startLife(11, 'alpha');
    expect(quiet.pending).toBeNull();
    const html = render(quiet, { folded: true });
    expect(html).not.toContain('class="card fold"');
    expect(html).not.toContain('inert');
  });
});

describe('인용 박스 유무와 모양', () => {
  it('인용이 있는 카드에만 .cite가 있다: 종류 라벨 → 요약 → 출처 줄, 링크·DOI·URL 0', () => {
    const html = render(withCite);
    const box = html.slice(html.indexOf('<div class="cite"'), html.indexOf('</div>', html.indexOf('<div class="cite"')) + 6);
    expect(box).toContain('data-citation="c-006"');
    expect(citeText(box)).toBe('통계 2025년 초·중·고 학생의 75.7%가 사교육을 받았고, 학생 1인당 월평균 사교육비는 45만 8천 원이었습니다. 국가데이터처(2026), 2025년 초중고사교육비조사 결과');
    expect(box).not.toMatch(/<a\b|href=|https?:|doi|pmid/i);
    expect(box.indexOf('cite__kind')).toBeLessThan(box.indexOf('cite__text'));
    expect(box.indexOf('cite__text')).toBeLessThan(box.indexOf('cite__src'));
    expect(box).toContain('<span class="keep-phrase">국가데이터처(2026),</span>');
  });

  it('인용이 없는 카드에는 .cite 요소 자체가 없다 (빈 박스 0)', () => {
    expect(withoutCite.pending!.eventId).toBe('infant-fever');
    const html = render(withoutCite);
    expect(html).not.toContain('class="cite"');
    expect(html).not.toContain('data-testid="cite"');
  });

  it('연구 인용: 「연구」 라벨, 저자 성만의 출처 줄 「Teti 외(1996),」 + 원제', () => {
    const html = render(research);
    const box = html.slice(html.indexOf('<div class="cite"'), html.indexOf('</div>', html.indexOf('<div class="cite"')) + 6);
    expect(citeText(box).startsWith('연구 194가구 표본에서')).toBe(true);
    // K11: 라틴 문자 저자 성(「Teti」)과 영문 원제는 lang="en", 한글 「외」와 연도는 아니다
    expect(box).toContain('<span class="keep-phrase"><span lang="en">Teti</span> 외(1996),</span>');
    expect(box).toMatch(/<span lang="en">[^]*And baby makes four/);
    expect(citeText(box)).toContain('And baby makes four');
  });

  it('CitationBox 단독: 라벨은 kind에서(통계/연구), 시대 머리말이 든 표시 문자열을 그대로 그린다 (같은 글자·같은 색 — 따로 꾸미는 요소 없음)', () => {
    const html = renderToStaticMarkup(<CitationBox view={{ id: 'c-033', kind: 'research', text: '지금의 연구로는 요약입니다.', sourceWho: 'Teti 외(1996),', sourceTitle: 'And baby makes four', sourceLine: 'Teti 외(1996), And baby makes four' }} />);
    expect(html).toContain('<p class="cite__kind">연구</p>');
    expect(html).toContain('<p class="cite__text" data-testid="cite-text">지금의 연구로는 요약입니다.</p>');
    expect(html).not.toMatch(/<(em|strong|b|mark|span class="cite__prefix")/);
    expect(DASH_TEXT.citeKindLabel).toEqual({ stat: '통계', research: '연구' });
  });
});

describe('문구 상수 (copy.md 6-1절 그대로)', () => {
  it('접기·다시 열기·정지 표시·안내·머리말', () => {
    expect(DASH_TEXT.choiceKind).toBe('중대 결정');
    expect(DASH_TEXT.foldCard).toBe('잠시 덮어 두기'); // r4 UX11 — 옛 이름을 새로 지은 이름으로 바꿨다(R-124 예외가 아니다)
    expect(DASH_TEXT.choiceAsk).toBe('어떻게 하겠습니까?'); // r4 UX10
    expect(DASH_TEXT.foldMark).toBe('▾');
    expect(DASH_TEXT.reopenDecision).toBe('결정 다시 열기');
    expect(DASH_TEXT.foldNote).toBe('다시 열 때까지 시간은 멈춥니다.');
    expect(DASH_TEXT.autoNoteOn).toBe('자동 모드가 켜져 있습니다. 잠시 뒤 성향에 따라 고릅니다.');
    expect(DASH_TEXT.autoNoteOff).toBe('자동 모드가 꺼져 있습니다. 직접 고를 때까지 시간은 멈춥니다.');
    expect(DASH_TEXT.eraPrefixFuture).toBe('지금 기준으로는');
    expect('autoNote' in DASH_TEXT, '콜론 라벨형 「자동 모드: …」은 폐기했다').toBe(false);
  });

  it('안내 문장은 합쇼체이고 초(숫자)를 적지 않는다 — 접었다 다시 열면 다시 세므로 숫자가 거짓이 된다', () => {
    for (const t of [DASH_TEXT.autoNoteOn, DASH_TEXT.autoNoteOff, DASH_TEXT.foldNote]) {
      expect(t).toMatch(/니다\.$/);
      expect(t).not.toMatch(/\d/);
    }
  });
});
