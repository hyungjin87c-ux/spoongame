import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  advanceUntilDecision,
  createSession,
  calendarYear,
  cardReadNeedMs,
  citationFor,
  decisionFor,
  holdMsFor,
  possibleAgesOf,
  previewChoice,
  resolveChoiceStep,
  resolveDelegated,
  sessionReducer,
  type Era,
  type GameState,
  type TickInfo,
} from '../src/core';
import { EVENT_POOL } from '../src/data/events';
import {
  CHILD_CHIP_TEXT,
  CHILD_FLOW_TEXT,
  FIRST_PARENT_HINT,
  PARENT_CHIP_TEXT,
  PARENT_DECIDED_TEXT,
  DECIDER_ICON,
  PARENT_DECISION_TABLE,
  decidedByText,
  deciderIconOf,
  delegatedSummaryText,
} from '../src/data/parentDecisionTable';
import { LifeScreen } from '../src/screens/LifeScreen';
import endingScreenSrc from '../src/screens/EndingScreen.tsx?raw';
import { SPRITE_SVG } from '../src/ui/brandAssets';
import logListSrc from '../src/ui/dash/LogList.tsx?raw';
import parentCardSrc from '../src/ui/dash/ParentCard.tsx?raw';
import type { LifeGame } from '../src/ui/dash/Cards';
import { ParentCard, parentCardModel } from '../src/ui/dash/ParentCard';
import type { YearClock } from '../src/ui/useYearClock';
import { startLife } from '../scripts/simulateLib';
import { forcedPending } from './helpers/forcedPending';

/**
 * T6 문구·기록 + 부모님이 정한·흘러간 카드의 화면 (SPEC-005 PD5·PD6·PD8·PD11, 설계 문서 3·5절 T6): 서버 렌더로 DOM을 본다 — 비모달(버튼·시트·낭독 영역 없음), 구성 순서, 줄 형식 세 가지가 한 상수에서 나옴,
 * `parentLabel`이 있는 선택지만 부모일 때 바뀜, 새 문자열 lint(3-3절), **카드 필요량 불변식**(느린 독자가 카드 + 결과 문장 + 3초를 대기 안에 읽음 — 풀의 모든 부모·흘러감 카드·선택지 전수, 첫 부모 카드의 안내 한 줄까지 최악 조합).
 * 브라우저 동작(포커스 이동 없음 · 일시정지 · 배속 · 새로고침)은 e2e/parent-card.spec.ts가 본다.
 */

const CLOCK: YearClock = { get: () => 0, subscribe: () => () => undefined };
const noop = () => undefined;
const asLife = (g: GameState): LifeGame => ({ ...g, character: g.character!, era: g.era!, birthReport: g.birthReport!, peerSeed: g.peerSeed! });

function renderScreen(game: GameState, tick: TickInfo | null): string {
  return renderToStaticMarkup(
    <LifeScreen
      game={asLife(game)}
      tick={tick}
      settings={{ ...DEFAULT_SETTINGS, speed: 1, autoMode: false }}
      clock={CLOCK}
      exitOpen={false}
      onExitOpen={noop}
      folded={false}
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

/**
 * 이벤트 하나를 정해진 나이·세상·선택지로 「부모님이 정한 / 흘러간 해」로 만든다: 대기 상태를 직접 만들고(forcedPending) 보이는 선택지를 그 하나로 줄여 `resolveDelegated`가 그 길을 고르게 한다
 * (확률은 이 시험의 관심이 아니다 — 카드·기록·필요량이 *어떤 길이든* 맞는지가 관심이다).
 */
function delegatedYear(eventId: string, era: Era, age: number, choiceId: string, opts: { priorParent?: boolean } = {}): { before: GameState; game: GameState; tick: TickInfo } {
  const base = forcedPending(eventId, era, { age });
  const who = decisionFor(eventId, age);
  if (who === 'self') throw new Error(`${eventId}@${age}: 본인 카드다`);
  const priorLine = { age: Math.max(0, age - 2), kind: 'choice' as const, text: '앞선 부모 결정입니다.', choice: '길', eventId: 'infant-care', by: 'parent' as const };
  const before: GameState = {
    ...base,
    pending: { ...base.pending!, choiceIds: [choiceId] },
    ...(opts.priorParent === true ? { history: [...base.history, priorLine] } : {}),
  };
  const r = resolveDelegated(before, who);
  return { before, game: r.state, tick: r.tick };
}

const body = (html: string, testid: string): string => {
  const at = html.indexOf(`data-testid="${testid}"`);
  if (at < 0) return '';
  const start = html.indexOf('>', at) + 1;
  // 같은 태그 이름의 닫힘까지(중첩 span 없는 요소만 쓴다)
  const tag = /<(\w+)/.exec(html.slice(html.lastIndexOf('<', at)))![1];
  const end = html.indexOf(`</${tag}>`, start);
  return html.slice(start, end).replace(/<[^>]*>/g, '');
};
const plain = (s: string): string => s.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

function cardHtml(game: GameState, tick: TickInfo): string {
  const model = parentCardModel(asLife(game), tick, EVENT_POOL);
  expect(model, '카드 모델이 만들어진다').not.toBeNull();
  return renderToStaticMarkup(<ParentCard model={model!} />);
}

/** 카드에서 사람이 읽는 글자 수: 칩 + 제목 + 상황 + 고른 길 + 도장 + 영향 줄(항목 이름 + 기호, 낭독 전용 글 제외) + (첫 부모 카드의) 안내 한 줄 — 머리의 「연도 · 나이」와 인용 박스는 세지 않는다 */
function renderedChars(html: string): number {
  // 영향 줄의 보이는 글(aria-hidden 영역): 항목 이름 + 기호 — 낭독 전용 글(.sr-only)은 화면에 읽히지 않는다. 공백도 한 글자로 센다(수식 `글자 수 ÷ 500자/분`과 같다)
  const impact = (html.match(/<span class="impact__show"[^>]*>.*?<\/span><\/span>(?=<span class="sr-only")/g) ?? []).map((m) => m.replace(/<[^>]*>/g, ''));
  return [body(html, 'parent-chip'), body(html, 'parent-title'), body(html, 'parent-text'), body(html, 'parent-label'), body(html, 'parent-stamp'), impact.join(''), body(html, 'parent-hint')].reduce((n, t) => n + t.length, 0);
}

// ---------------------------------------------------------------------------------------------------------------------

describe('부모님이 정한 카드: 비모달·구성·문구 (PD5·PD8, 설계 문서 3-2절)', () => {
  const parent = delegatedYear('infant-fever', 'present', 1, 'dismiss');
  const html = cardHtml(parent.game, parent.tick);

  it('칩의 아이콘은 결정자 전용 글리프 i-by-parent(집 한 채)다 — 관계 상태 아이콘 i-people을 재사용하지 않는다 (R-455)', () => {
    const chip = html.slice(html.indexOf('data-testid="parent-chip"'), html.indexOf('data-testid="parent-when"'));
    expect(chip).toContain('href="#i-by-parent"');
    expect(chip).not.toMatch(/#i-people|#i-smile|#i-by-child/);
    expect(body(html, 'parent-chip')).toBe('부모님의 결정'); // 글자는 그대로 — 아이콘만 바뀌었다
  });

  it('카드가 그려진다: data-by="parent", 칩 「부모님의 결정」, 도장 「부모님이 이렇게 정했습니다」, 고른 길 라벨 한 개', () => {
    expect(html).toContain('data-testid="parent-card"');
    expect(html).toContain('data-by="parent"');
    expect(body(html, 'parent-chip')).toBe('부모님의 결정');
    expect(body(html, 'parent-stamp')).toBe('부모님이 이렇게 정했습니다');
    expect(PARENT_DECIDED_TEXT).toBe('부모님이 이렇게 정했습니다'); // 마스터 확정 문구
    const label = EVENT_POOL.byId.get('infant-fever')!.choices!.find((c) => c.id === 'dismiss')!.label;
    expect(body(html, 'parent-label')).toBe(label);
    expect((html.match(/data-testid="parent-label"/g) ?? []).length).toBe(1);
  });

  it('비모달: 버튼·입력·링크·시트(role=dialog·aria-modal)·낭독 영역(aria-live·role=status/alert)이 없다 — 선택지 버튼·「잠시 덮어 두기」·자동 선택 안내도 없다', () => {
    expect(html).not.toMatch(/<button|<input|<a |<form|<select|<textarea/);
    expect(html).not.toMatch(/role="(dialog|alertdialog|status|alert|log)"/);
    expect(html).not.toContain('aria-modal');
    expect(html).not.toContain('aria-live');
    expect(html).not.toContain('tabindex');
    // r4: 옛 이름 「접기」는 새 이름 「덮어 두기」로 바뀌었으니 둘 다 막는다. 질문 줄(UX10)·자동 고르기 묶음(UX12)·풀이 줄(UX14, M23)도 이 카드에는 없다
    expect(plain(html)).not.toMatch(/접기|덮어 두기|자동 선택|자동으로 고르|직접 고르기|어떻게 하겠|풀이|선택하세요|고를 수/);
    expect(html).not.toMatch(/data-testid="(choice-ask|auto-set|auto-on-btn|auto-off-btn|cite-insight|auto-status)"/);
  });

  it('집안 사정 한 줄(「이 집에서는 고를 수 없었던 길」 류)이 없다 (M6) — 수저 단계 이름·형편 단정도 카드에 없다', () => {
    const text = plain(html);
    expect(text).not.toMatch(/집안 사정|고를 수 없었|형편 때문|가난|부유하|수저|흙|다이아/);
  });

  it('구성 순서: 칩 → (머리의 연도·나이) → 제목 → 상황 → 고른 길 → 도장 → 영향 줄 → 안내 한 줄(첫 부모 카드)', () => {
    const order = ['parent-chip', 'parent-when', 'parent-title', 'parent-text', 'parent-label', 'parent-stamp', 'data-testid="impact"', 'parent-hint'].map((k) => html.indexOf(k.includes('=') ? k : `data-testid="${k}"`));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('영향 줄은 고른 길 하나의 실제 효과다 (EC5 표기 = 실제 효과): 틱의 impact가 해결 직전 상태의 previewChoice와 같고 카드에 그 항목이 모두 보인다', () => {
    const ev = EVENT_POOL.byId.get('infant-fever')!;
    const choice = ev.choices!.find((c) => c.id === 'dismiss')!;
    expect(parent.tick.impact).toEqual(previewChoice(parent.before, choice).items);
    const shown = (html.match(/class="impact__item"/g) ?? []).length;
    expect(shown).toBe(parent.tick.impact!.length);
  });

  it('머리의 「연도 · 나이」는 결정이 일어난 해다: 나이 1세, 출생 연도 + 1', () => {
    const at = html.indexOf('data-testid="parent-when"');
    const when = plain(html.slice(at, html.indexOf('</div>', at)));
    expect(when).toContain(`${calendarYear(parent.before.character!.birthYear, 1)}년`);
    expect(when).toContain('1세');
  });

  it('첫 부모 카드에만 안내 한 줄이 붙는다 (Q6): 앞선 부모 결정이 있으면 붙지 않는다', () => {
    expect(parent.tick.firstParent).toBe(true);
    expect(body(html, 'parent-hint')).toBe(FIRST_PARENT_HINT);
    const second = delegatedYear('infant-fever', 'present', 1, 'dismiss', { priorParent: true });
    expect(second.tick.firstParent).toBeUndefined();
    expect(cardHtml(second.game, second.tick)).not.toContain('parent-hint');
  });

  it('안내 한 줄의 「열세 살」은 규칙의 경계(SELF_FROM_AGE 13)와 같다 — 본인 영역 이름(공부·친구·취미)도 같다', () => {
    expect(FIRST_PARENT_HINT).toContain('열세 살부터는 공부·친구·취미를 직접 고릅니다');
    // 결정 주체 낱말은 칩·도장·엔딩과 같은 「부모님」이다 (designer 확정, copy.md 11-1 ②)
    expect(FIRST_PARENT_HINT).toContain('어린 시절의 큰 결정은 부모님이 내립니다');
    expect(FIRST_PARENT_HINT).not.toContain('어른들');
    expect(decisionFor('school-club', 12)).toBe('parent');
    expect(decisionFor('school-club', 13)).toBe('self');
  });
});

describe('아이의 일로 흘러간 카드: 칩 「아이의 일」, 도장 「이렇게 흘러갔습니다」 (PD8, 형진 님 답 M2)', () => {
  const child = delegatedYear('infant-new-sibling', 'present', 3, 'sulk');
  const html = cardHtml(child.game, child.tick);

  it('data-by="child", 칩·도장 문구, 안내 한 줄 없음(흘러감은 첫 부모 카드가 아니다)', () => {
    expect(html).toContain('data-by="child"');
    expect(body(html, 'parent-chip')).toBe('아이의 일');
    expect(body(html, 'parent-stamp')).toBe('이렇게 흘러갔습니다');
    expect(CHILD_FLOW_TEXT).toBe('이렇게 흘러갔습니다');
    expect(html).not.toContain('parent-hint');
    expect(child.tick.firstParent).toBeUndefined();
  });

  it('칩의 아이콘은 결정자 전용 글리프 i-by-child(물결 둘)다 — 행복 상태 아이콘 i-smile(웃는 얼굴)을 재사용하지 않는다 (R-455)', () => {
    const chip = html.slice(html.indexOf('data-testid="parent-chip"'), html.indexOf('data-testid="parent-when"'));
    expect(chip).toContain('href="#i-by-child"');
    expect(chip).not.toMatch(/#i-people|#i-smile|#i-by-parent/);
  });

  it('비모달·정적: 부모 카드와 같다(버튼·시트·낭독 영역 없음, 집안 사정 줄 없음)', () => {
    expect(html).not.toMatch(/<button|role="(dialog|status|alert|log)"|aria-modal|aria-live/);
    expect(plain(html)).not.toMatch(/집안 사정|고를 수 없었/);
  });

  it('고른 길 라벨은 부모일 때만 바뀌는 문구(parentLabel)가 아니라 선택지 라벨 그대로다', () => {
    const ev = EVENT_POOL.byId.get('infant-new-sibling')!;
    expect(body(html, 'parent-label')).toBe(ev.choices!.find((c) => c.id === 'sulk')!.label);
  });
});

describe('언제 그려지는가: 틱에서 파생된다 (PD7-5)', () => {
  const parent = delegatedYear('infant-fever', 'present', 1, 'dismiss');

  it('LifeScreen 안에서 인생 기록 바로 위에 그려진다 (결정 카드 자리 → 부모 카드 → 인생 기록)', () => {
    const html = renderScreen(parent.game, parent.tick);
    const card = html.indexOf('data-testid="parent-card"');
    const log = html.indexOf('data-testid="log"');
    expect(card).toBeGreaterThan(-1);
    expect(log).toBeGreaterThan(card);
  });

  it('새로고침 직후(tick 없음)에는 카드가 없고 기록 줄만 남는다', () => {
    const html = renderScreen(parent.game, null);
    expect(html).not.toContain('data-testid="parent-card"');
    expect(html).toContain('data-testid="log"');
  });

  it('사람이 고른 해의 틱(by 없음)과 서술 해의 틱에는 카드가 없다', () => {
    const base = forcedPending('school-club', 'present', { age: 14 });
    const manual = resolveChoiceStep(base, base.pending!.key, base.pending!.choiceIds[0]);
    expect(manual.tick.kind).toBe('resolved');
    expect(manual.tick.by).toBeUndefined();
    expect(renderScreen(manual.state, manual.tick)).not.toContain('data-testid="parent-card"');
  });

  it('나이가 이미 지난 틱(해가 넘어간 뒤)에는 카드가 사라진다: 나이 ≠ fromAge + 1이면 모델이 없다', () => {
    expect(parentCardModel(asLife(parent.game), parent.tick, EVENT_POOL)).not.toBeNull();
    expect(parentCardModel(asLife({ ...parent.game, age: parent.game.age + 1 }), parent.tick, EVENT_POOL)).toBeNull();
    expect(parentCardModel(asLife({ ...parent.game, age: parent.game.age - 1 }), parent.tick, EVENT_POOL)).toBeNull();
  });

  it('사망한 해에는 카드를 그리지 않는다 (연출 대기가 없다) — 틱 종류가 death면 모델이 없다', () => {
    expect(parentCardModel(asLife(parent.game), { ...parent.tick, kind: 'death' }, EVENT_POOL)).toBeNull();
  });
});

describe('줄 형식 세 가지는 한 상수에서 나온다 (PD6, 설계 문서 3-1절)', () => {
  it('decidedByText: parent → 「부모님이 이렇게 정했습니다」, child → 「이렇게 흘러갔습니다」 — 카드 도장과 같은 상수다', () => {
    expect(decidedByText('parent')).toBe(PARENT_DECIDED_TEXT);
    expect(decidedByText('child')).toBe(CHILD_FLOW_TEXT);
  });

  it('parentLabel/parentResult가 있는 선택지만 부모일 때 바뀐다: school-puppy의 세 길, school-academy-night의 friends, school-scholarship의 pass(R-452) — 본인이 고르면 label/result 그대로', () => {
    const cases: Array<[string, string, number]> = [
      ['school-puppy', 'keep', 9],
      ['school-puppy', 'feed', 9],
      ['school-puppy', 'pass', 9],
      ['school-academy-night', 'friends', 10],
      ['school-scholarship', 'pass', 15],
    ];
    for (const [eventId, choiceId, age] of cases) {
      const ev = EVENT_POOL.byId.get(eventId)!;
      const choice = ev.choices!.find((c) => c.id === choiceId)!;
      const d = delegatedYear(eventId, 'present', age, choiceId);
      const line = d.game.history.filter((h) => h.eventId === eventId).pop()!;
      expect(line.by, `${eventId}/${choiceId}`).toBe('parent');
      expect(line.choice, `${eventId}/${choiceId}`).toBe(choice.parentLabel ?? choice.label);
      expect(line.text, `${eventId}/${choiceId}`).toBe(choice.parentResult ?? choice.result);
      expect(line.choice).not.toBe(choice.label);
      // 카드의 고른 길도 같은 라벨
      expect(body(cardHtml(d.game, d.tick), 'parent-label')).toBe(choice.parentLabel);
      // 본인이 같은 길을 고르면 그대로
      const base = forcedPending(eventId, 'present', { age });
      const manual = resolveChoiceStep(base, base.pending!.key, choiceId).state.history.filter((h) => h.eventId === eventId).pop()!;
      expect(manual.by).toBeUndefined();
      expect(manual.choice).toBe(choice.label);
      expect(manual.text).toBe(choice.result);
    }
  });

  it('parentLabel/parentResult가 없는 선택지는 부모일 때도 label/result 그대로다 (다른 부모 카드 전수에서 문구가 달라지지 않는다)', () => {
    let checked = 0;
    for (const [eventId] of Object.entries(PARENT_DECISION_TABLE)) {
      const ev = EVENT_POOL.byId.get(eventId)!;
      const ages = possibleAgesOf(ev).filter((a) => decisionFor(eventId, a) === 'parent');
      if (ages.length === 0) continue;
      const eras = (ev.eras ?? (['past', 'present', 'future'] as Era[]))[0];
      for (const choice of ev.choices!.filter((c) => c.parentLabel === undefined && c.parentResult === undefined)) {
        const d = delegatedYear(eventId, eras, ages[0], choice.id);
        const line = d.game.history.filter((h) => h.eventId === eventId).pop()!;
        expect(line.choice, `${eventId}/${choice.id}`).toBe(choice.label);
        expect(line.text, `${eventId}/${choice.id}`).toBe(choice.result);
        checked++;
      }
    }
    expect(checked, '대조한 선택지 수').toBeGreaterThan(60);
  });
});

describe('인생 기록 줄: 세 가지 표지가 글자 + 아이콘으로 구분된다 (PD6, 설계 문서 3-1절)', () => {
  const logHtml = (game: GameState): string => {
    const html = renderScreen(game, null);
    const at = html.indexOf('data-testid="log"');
    return html.slice(at);
  };
  const rowOf = (html: string, eventTitle: string): string => {
    const at = html.indexOf(eventTitle);
    expect(at, eventTitle).toBeGreaterThan(-1);
    return html.slice(html.lastIndexOf('<li', at), html.indexOf('</li>', at));
  };

  it('부모님이 정한 줄: 「{결과 문장} (부모님이 이렇게 정했습니다: {고른 길 라벨})」 — 표지(data-testid="log-by")에 집 글리프가 붙고 문구는 한 상수에서 나온다', () => {
    const d = delegatedYear('infant-fever', 'present', 1, 'dismiss');
    const ev = EVENT_POOL.byId.get('infant-fever')!;
    const choice = ev.choices!.find((c) => c.id === 'dismiss')!;
    const row = rowOf(logHtml(d.game), choice.result);
    expect(row).toContain('data-testid="log-by"');
    expect(row).toContain('data-by="parent"');
    expect(row).toContain('<svg'); // 아이콘 (색에만 의존하지 않는다)
    expect(row, '결정자 전용 글리프 (R-455)').toContain('href="#i-by-parent"');
    expect(row).not.toMatch(/#i-people|#i-smile/);
    expect(plain(row)).toContain(`${choice.result} (${PARENT_DECIDED_TEXT}: ${choice.label})`);
  });

  it('흘러간 줄: 「(이렇게 흘러갔습니다: {고른 길 라벨})」', () => {
    const d = delegatedYear('infant-new-sibling', 'present', 3, 'sulk');
    const ev = EVENT_POOL.byId.get('infant-new-sibling')!;
    const choice = ev.choices!.find((c) => c.id === 'sulk')!;
    const row = rowOf(logHtml(d.game), choice.result);
    expect(row).toContain('data-by="child"');
    expect(row).toContain('<svg');
    expect(row, '결정자 전용 글리프 (R-455)').toContain('href="#i-by-child"');
    expect(row).not.toMatch(/#i-people|#i-smile/);
    expect(plain(row)).toContain(`${choice.result} (${CHILD_FLOW_TEXT}: ${choice.label})`);
  });

  it('본인이 고른 줄은 지금 그대로 「(선택: …)」이고 표지(log-by)가 없다', () => {
    const base = forcedPending('school-club', 'present', { age: 14 });
    const manual = resolveChoiceStep(base, base.pending!.key, base.pending!.choiceIds[0]).state;
    const ev = EVENT_POOL.byId.get('school-club')!;
    const choice = ev.choices!.find((c) => c.id === base.pending!.choiceIds[0])!;
    const row = rowOf(logHtml(manual), choice.result);
    expect(row).not.toContain('log-by');
    expect(plain(row)).toContain(`${choice.result} (선택: ${choice.label})`);
  });
});

describe('새 문자열 lint (설계 문서 3-3절): 칩·도장·안내·엔딩 둘째 줄·parentLabel·parentResult', () => {
  const NEW_STRINGS: Array<[string, string]> = [
    ['PARENT_CHIP_TEXT', PARENT_CHIP_TEXT],
    ['CHILD_CHIP_TEXT', CHILD_CHIP_TEXT],
    ['PARENT_DECIDED_TEXT', PARENT_DECIDED_TEXT],
    ['CHILD_FLOW_TEXT', CHILD_FLOW_TEXT],
    ['FIRST_PARENT_HINT', FIRST_PARENT_HINT],
    ['엔딩 둘째 줄(부모+흘러감)', delegatedSummaryText(4, 2)!],
    ['엔딩 둘째 줄(부모만)', delegatedSummaryText(4, 0)!],
    ['엔딩 둘째 줄(흘러감만)', delegatedSummaryText(0, 2)!],
  ];
  for (const ev of EVENT_POOL.events) for (const c of ev.choices ?? []) for (const k of ['parentLabel', 'parentResult'] as const) if (c[k] !== undefined) NEW_STRINGS.push([`${ev.id}/${c.id}.${k}`, c[k]!]);

  const EVALUATIVE = /좋은|나쁜|잘못|탓|덕분|다행|안타깝/;
  const CAUSE = /(형편|가난|부유|수저)[^.]*(해서|때문에)/;
  const PREACH = /야 합니다|말아야/; // 「~해야 합니다」「~하지 말아야」류의 설교 어미(해/하 앞 글자와 무관하게 「야 합니다」「말아야」)
  const EMOJI_OR_MARK = /[!?！？\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
  const TIER_NAMES = /흙수저|동수저|은수저|금수저|다이아수저|다이아 수저/;

  it('lint 대상이 17개다 (칩 2 + 도장 2 + 안내 1 + 엔딩 3 + parentLabel 5 + parentResult 4 — R-452가 school-scholarship pass의 둘을 더했다; 공허 통과 방지)', () => {
    expect(NEW_STRINGS.length).toBe(17);
  });

  for (const [name, value] of NEW_STRINGS) {
    it(`${name}: 평가어·원인 단정·설교·느낌표·물음표·이모지·수저 단계 이름이 없다`, () => {
      expect(value, name).not.toMatch(EVALUATIVE);
      expect(value, name).not.toMatch(CAUSE);
      expect(value, name).not.toMatch(PREACH);
      expect(value, name).not.toMatch(EMOJI_OR_MARK);
      expect(value, name).not.toMatch(TIER_NAMES);
    });
  }

  it('문장은 합쇼체로 끝난다: 도장·안내·엔딩 둘째 줄·parentResult는 「~ㅂ니다.」 종결 (칩은 명사구, parentLabel은 행동 서술 라벨이라 제외)', () => {
    const sentences = NEW_STRINGS.filter(([n]) => n === 'PARENT_DECIDED_TEXT' || n === 'CHILD_FLOW_TEXT' || n === 'FIRST_PARENT_HINT' || n.startsWith('엔딩') || n.endsWith('.parentResult'));
    expect(sentences.length).toBeGreaterThanOrEqual(8);
    for (const [name, value] of sentences) {
      if (name === 'PARENT_DECIDED_TEXT' || name === 'CHILD_FLOW_TEXT') {
        expect(value, name).toMatch(/(습니다|했습니다|갔습니다)$/); // 도장은 마침표 없는 짧은 문구
      } else {
        for (const sentence of value.split(/(?<=\.)\s+/)) expect(sentence, `${name}: ${sentence}`).toMatch(/니다\.$/);
      }
    }
  });

  it('변이 점검: 평가어가 든 문구는 이 lint가 잡는다 (공허 통과 방지)', () => {
    expect('부모님 덕분에 다행입니다.').toMatch(EVALUATIVE);
    expect('형편 때문에 포기했습니다.').toMatch(CAUSE);
    expect('더 아껴야 합니다.').toMatch(PREACH);
    expect('돌보지 말아야 했습니다.').toMatch(PREACH);
    expect('이렇게 정했습니다!').toMatch(EMOJI_OR_MARK);
  });
});

describe('카드 필요량 불변식 (PD5-d, 설계 문서 4-3절): 연출 대기 ≥ 느린 독자(500자/분)가 카드의 모든 글 + 그 해 결과 문장을 읽는 시간 + 여유 3초 (+ 인용 박스 13초)', () => {
  it('풀의 모든 부모·흘러감 카드 × 선택지 × 세상 × 나이(최소·최대): 틱의 readNeedMs가 화면에 그려진 글자 수로 센 값과 같고(덜 세지 않는다), 모드의 연출 대기가 그보다 짧지 않다 — 첫 부모 카드의 안내 한 줄까지 최악 조합', () => {
    let checked = 0;
    let worst = { ms: 0, where: '' };
    let cited = 0;
    for (const [eventId] of Object.entries(PARENT_DECISION_TABLE)) {
      const ev = EVENT_POOL.byId.get(eventId)!;
      const eras: Era[] = ev.eras ?? ['past', 'present', 'future'];
      const delegatedAges = possibleAgesOf(ev).filter((a) => decisionFor(eventId, a) !== 'self');
      if (delegatedAges.length === 0) continue;
      const ages = [...new Set([delegatedAges[0], delegatedAges[delegatedAges.length - 1]])];
      for (const era of eras) {
        for (const age of ages) {
          for (const choice of ev.choices!) {
            let d: ReturnType<typeof delegatedYear>;
            try {
              d = delegatedYear(eventId, era, age, choice.id);
            } catch {
              continue; // 그 세상·나이에 보이는 선택지가 2개 이상인 시작 상태가 없다
            }
            if (d.tick.kind !== 'resolved') continue; // 사망한 해는 카드를 그리지 않는다
            const html = cardHtml(d.game, d.tick);
            const result = d.game.history.filter((h) => h.eventId === eventId).pop()!.text;
            const hasCite = citationFor(ev, era, calendarYear(d.before.character!.birthYear, age)) !== null;
            if (hasCite) cited++;
            const need = cardReadNeedMs(renderedChars(html) + result.length, hasCite);
            const where = `${eventId}/${choice.id} ${era} ${age}세`;
            // 틱의 필요량은 화면에 그려진 글자 수(공백 포함)로 센 값과 정확히 같다 — 덜 세면 느린 독자가 다 읽기 전에 카드가 넘어간다
            expect(d.tick.readNeedMs!, where).toBe(need);
            for (const mode of ['short30', 'long60'] as const) {
              const hold = holdMsFor('resolved', { mode, lines: d.tick.lines, readNeedMs: d.tick.readNeedMs });
              expect(hold!, `${where} ${mode}`).toBeGreaterThanOrEqual(d.tick.readNeedMs!);
              expect(hold!, `${where} ${mode}`).toBeGreaterThanOrEqual(holdMsFor('resolved', { mode, lines: d.tick.lines })!);
            }
            if (d.tick.readNeedMs! > worst.ms) worst = { ms: d.tick.readNeedMs!, where };
            checked++;
          }
        }
      }
    }
    expect(checked, '대조한 (카드 × 선택지 × 세상 × 나이) 수').toBeGreaterThan(150);
    expect(cited, '인용 박스가 붙는 조합도 대조했다').toBeGreaterThan(0);
    // 최악 조합도 한 장에 1분을 넘지 않는다(인용 13초 + 글 ≤ 40초 이내) — 늘어짐 방지의 거친 상한
    expect(worst.ms, worst.where).toBeLessThanOrEqual(60_000);
  });

  it('연출 대기가 필요량에 묶인다: 같은 카드를 필요량이 큰 쪽으로 만들면 대기가 따라 늘고, 필요량이 작으면 기본 대기(결과 해 13초 × 계수)다', () => {
    const base = holdMsFor('resolved', { mode: 'short30', lines: 2 })!;
    expect(holdMsFor('resolved', { mode: 'short30', lines: 2, readNeedMs: base + 10_000 })).toBe(base + 10_000);
    expect(holdMsFor('resolved', { mode: 'short30', lines: 2, readNeedMs: 1_000 })).toBe(base);
  });

  it('변이 점검: 안내 한 줄을 세지 않으면 필요량이 줄어 불변식이 깨진다 (첫 부모 카드는 안내 한 줄만큼 더 오래 대기해야 한다)', () => {
    const first = delegatedYear('infant-fever', 'present', 1, 'dismiss');
    const later = delegatedYear('infant-fever', 'present', 1, 'dismiss', { priorParent: true });
    expect(first.tick.readNeedMs!).toBeGreaterThan(later.tick.readNeedMs!);
    const hintMs = cardReadNeedMs(FIRST_PARENT_HINT.length, false) - cardReadNeedMs(0, false);
    expect(first.tick.readNeedMs! - later.tick.readNeedMs!).toBe(hintMs);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// R-451: 「다음 결정으로」가 기록 카드 앞에서 멈출 때

describe('「다음 결정으로」가 기록 카드 앞에서 멈추면 부모·흘러감 카드는 뜨지 않는다 (R-451, SPEC-005 PD7-3)', () => {
  // 0세에서 skip → 5세 첫머리의 기록 카드(note-infant-memory, asap)에서 멈춘다. 0~12세는 모두 부모·흘러감이라 사람이 고르는 카드가 없고, 멈추는 곳은 언제나 이 기록 카드다.
  // 그때 `advanceUntilDecision`이 돌려주는 마지막 걸음은 4세 해의 것이다 — 그 해가 위임 해(`by`)면 나이가 `fromAge + 1`이라 카드가 기록 시트 뒤에 뜨던 것이 R-451이다.
  const manual = { speed: 1 as const, autoMode: false, noteCards: true };

  function stopped(seed: number, era: Era) {
    const game = startLife(seed, era);
    const raw = advanceUntilDecision(game, EVENT_POOL, 'stop'); // 멈춘 자리의 core 기대값 (reducer와 같은 호출)
    return { game, raw, after: sessionReducer(createSession(game, manual), { type: 'skip' }) };
  }

  it('noteCards 켬(수동): 4세가 위임 해인 시드에서 멈춘 세션의 틱은 null이고 카드 모델이 없다 — 고치기 전 틱(r.last)으로는 카드가 만들어진다(공허 통과 방지)', () => {
    let delegated = 0;
    for (const era of ['past', 'present', 'future'] as const) {
      for (let seed = 1; seed <= 60; seed++) {
        const { raw, after } = stopped(seed, era);
        if (raw.stoppedForNote === undefined || raw.last.by === undefined) continue;
        delegated++;
        const where = `${era} 시드 ${seed}`;
        // 5세 첫머리, 기록 카드 앞, 선택지 대기 없음
        expect(after.game.age, where).toBe(5);
        expect(raw.last.fromAge, where).toBe(4);
        expect(after.game.pending, where).toBeNull();
        expect(after.game, `${where}: 상태는 core 기대값과 같다`).toEqual(raw.state);
        // 고치기 전 동작: 직전 해의 틱을 남기면 카드 모델이 만들어진다
        expect(parentCardModel(asLife(after.game), raw.last, EVENT_POOL), `${where}: r.last를 남기면 카드가 뜬다`).not.toBeNull();
        // 고친 뒤: 틱이 없다 → 카드가 없다 (기록 줄은 그대로)
        expect(after.tick, where).toBeNull();
        expect(parentCardModel(asLife(after.game), after.tick, EVENT_POOL), where).toBeNull();
        expect(after.game.history.filter((h) => h.by !== undefined).length, `${where}: 위임 해의 기록 줄은 남는다`).toBeGreaterThan(0);
        // 시트를 닫고(마음속에 담고 살기) 진행해도 카드는 뜨지 않는다
        const closed = sessionReducer(after, { type: 'dismissNote', cardId: raw.stoppedForNote.id });
        expect(parentCardModel(asLife(closed.game), closed.tick, EVENT_POOL), `${where}: 시트를 닫은 뒤`).toBeNull();
      }
    }
    expect(delegated, '4세가 위임 해인 시드 (공허 통과 방지)').toBeGreaterThanOrEqual(10);
  });

  it('위임이 아닌 해에서 멈추면 직전 해의 걸음을 그대로 남긴다 (연출 대기 계산은 지금과 같다)', () => {
    let kept = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const { raw, after } = stopped(seed, 'present');
      if (raw.stoppedForNote === undefined || raw.last.by !== undefined) continue;
      kept++;
      expect(after.tick, `시드 ${seed}`).toEqual(raw.last);
      expect(parentCardModel(asLife(after.game), after.tick, EVENT_POOL), `시드 ${seed}`).toBeNull(); // 위임이 아닌 해는 원래 카드가 없다
    }
    expect(kept, '위임이 아닌 해에서 멈춘 시드').toBeGreaterThanOrEqual(3);
  });

  it('기록 카드를 끄면(소비) 멈추지 않아 걸음을 그대로 남긴다: 끝까지 간 마지막 걸음 = core 기대값(consume)', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const game = startLife(seed, 'present');
      const raw = advanceUntilDecision(game, EVENT_POOL, 'consume');
      const after = sessionReducer(createSession(game, { ...manual, noteCards: false }), { type: 'skip' });
      expect(raw.stoppedForNote, `시드 ${seed}`).toBeUndefined();
      expect(after.tick, `시드 ${seed}`).toEqual(raw.last);
    }
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// R-455: 결정자 글리프

describe('결정자 글리프 둘 (R-455, design-system 13-3절·13-5 D5-35·D5-36)', () => {
  it('스프라이트에 i-by-parent·i-by-child가 들어 있고 결정자 상수가 그 id를 가리킨다 (아이콘 id 한 곳)', () => {
    expect(SPRITE_SVG).toContain('id="i-by-parent"');
    expect(SPRITE_SVG).toContain('id="i-by-child"');
    expect(DECIDER_ICON).toEqual({ parent: 'i-by-parent', child: 'i-by-child' });
    expect(deciderIconOf('parent')).toBe('i-by-parent');
    expect(deciderIconOf('child')).toBe('i-by-child');
    // 상태 미터의 아이콘은 그대로 있다 (관계 i-people · 행복 i-smile) — 두 뜻이 한 그림을 나누지 않는다
    expect(SPRITE_SVG).toContain('id="i-people"');
    expect(SPRITE_SVG).toContain('id="i-smile"');
  });

  it('세 곳(카드 칩·인생 기록 줄·엔딩 연표)은 같은 함수로 아이콘을 고르고 상태 아이콘을 쓰지 않는다 (소스 대조)', () => {
    for (const [name, src] of [['ParentCard.tsx', parentCardSrc], ['LogList.tsx', logListSrc], ['EndingScreen.tsx', endingScreenSrc]] as const) {
      expect(src, name).toContain('deciderIconOf(');
      expect(src, `${name}: 결정자 표지에 상태 아이콘을 재사용하지 않는다`).not.toMatch(/'i-people' : 'i-smile'|'i-smile' : 'i-people'/);
    }
  });
});
