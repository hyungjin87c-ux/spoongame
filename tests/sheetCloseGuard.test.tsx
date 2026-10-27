import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startLife } from '../scripts/simulateLib';
import { DEFAULT_SETTINGS, NOTE_LIMITS, advanceUntilDecision, noteResponse, type GameState, type Settings } from '../src/core';
import { NOTE_CARDS } from '../src/data/noteCards';
import { LifeScreen, controlsGuardKey, type NoteSheetState } from '../src/screens/LifeScreen';
import { decisionGuardKey } from '../src/ui/dash/DecisionCard';
import { FOLD_INITIAL, foldCard, reopenCard } from '../src/ui/decisionFold';
import { INPUT_GUARD_MS, isButtonInert, openGuard, reconcileGuard, type GuardKey, type GuardState } from '../src/ui/GuardedButton';
import type { LifeGame } from '../src/ui/dash/Cards';
import type { YearClock } from '../src/ui/useYearClock';
import appSrc from '../src/App.tsx?raw';
import noteSheetSrc from '../src/ui/dash/NoteSheet.tsx?raw';
import lifeScreenSrc from '../src/screens/LifeScreen.tsx?raw';

/**
 * 시트가 닫힌 직후의 입력 가드 (SPEC-003 CM5, content-M7c 11-1 F-1·G1~G9): 사용자 동작으로 모달 시트(기록·결정)가 사라지는 **같은 렌더**에 가드 세대를 올려
 * 인생 화면의 모든 가드 버튼이 400ms 동안 눌리지 않는다. 이 파일은 DOM 환경이 없어 (1) 가드 판단 함수(`reconcileGuard`·`openGuard`)를 가짜 시계로 렌더·효과 순서대로 돌리고
 * (2) 서버 렌더로 화면의 모든 가드 버튼이 세대 값을 키에 담는지 보고 (3) `App`의 핸들러가 시트를 닫는 그 자리에서 세대를 올리는지(효과로 올리지 않는지) 원본을 읽어 본다.
 * 실제 더블탭·간격 스윕·다음 렌더 전 관찰은 브라우저가 필요해 e2e/m7c-sheet-close-guard.spec.ts가 본다.
 */

// 화면의 가드 키를 바깥에서 볼 수 있게 GuardedButton이 받은 guardKey를 data 속성으로 드러내고, FeedbackLink(훅을 직접 쓰는 <a>)의 키는 기록해 둔다
const seen = vi.hoisted(() => ({ hookKeys: [] as string[] }));
vi.mock('../src/ui/GuardedButton', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/ui/GuardedButton')>();
  const React = await import('react');
  const Recorded = React.forwardRef<HTMLButtonElement, import('../src/ui/GuardedButton').GuardedButtonProps>(function Recorded(props, ref) {
    return React.createElement(actual.GuardedButton, { ...props, ref, 'data-guard-key': String(props.guardKey) } as never);
  });
  return {
    ...actual,
    GuardedButton: Recorded,
    useInputGuard: (key: GuardKey, ms?: number) => {
      seen.hookKeys.push(String(key));
      return actual.useInputGuard(key, ms);
    },
  };
});

const CLOCK: YearClock = { get: () => 0, subscribe: () => () => undefined };
const noop = () => undefined;
const asLife = (g: GameState): LifeGame => ({ ...g, character: g.character!, generation: g.generation!, birthReport: g.birthReport!, peerSeed: g.peerSeed! });
const settingsOf = (o: Partial<Settings> = {}): Settings => ({ ...DEFAULT_SETTINGS, speed: 1, autoMode: false, ...o });

let cached: GameState | null = null;
function pendingState(): GameState {
  if (cached !== null) return cached;
  for (let seed = 1; seed <= 200; seed++) {
    const s = advanceUntilDecision(startLife(seed, 'alpha')).state;
    if (s.phase === 'life' && s.pending !== null) return (cached = s);
  }
  throw new Error('결정 대기 상태를 찾지 못했다');
}

interface Rendered {
  /** GuardedButton들이 받은 키, 화면 순서대로 */
  buttons: string[];
  /** 훅을 직접 쓰는 FeedbackLink의 키 */
  feedback: string[];
}
function render(game: GameState, o: { epoch: number; auto?: boolean; folded?: boolean; exitOpen?: boolean; noteSheet?: NoteSheetState | null }): Rendered {
  seen.hookKeys.length = 0;
  const html = renderToStaticMarkup(
    <LifeScreen
      game={asLife(game)}
      settings={settingsOf({ autoMode: o.auto ?? false })}
      clock={CLOCK}
      exitOpen={o.exitOpen ?? false}
      onExitOpen={noop}
      folded={o.folded ?? false}
      guardEpoch={o.epoch}
      onFold={noop}
      onReopen={noop}
      noteSheet={o.noteSheet ?? null}
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
  const buttons = [...html.matchAll(/data-guard-key="([^"]*)"/g)].map((m) => m[1]);
  // FeedbackLink 하나만 훅을 직접 쓴다(GuardedButton 안의 훅은 원본 함수를 직접 부르므로 기록되지 않는다)
  return { buttons, feedback: [...seen.hookKeys] };
}

describe('G3 — 인생 화면의 모든 가드 버튼이 같은 세대 값을 키에 담는다 (서버 렌더)', () => {
  it('모달 시트(자동 모드 꺼짐): 진행 줄 7개 + 도구 줄 4개 + 의견 보내기 링크는 life-controls:세대, 결정 카드의 선택지와 「잠시 덮어 두기」·자동 고르기 버튼은 선택지키#세대', () => {
    const game = pendingState();
    const pending = game.pending!;
    const r = render(game, { epoch: 3 });
    const controls = r.buttons.filter((k) => k === controlsGuardKey(3));
    expect(controls, '진행 줄 7개(일시정지·배속 4·다음 결정으로·자동 모드) + 도구 줄 버튼 4개(BGM·생각 남기기·다크 모드·나가기)').toHaveLength(7 + 4);
    expect(r.feedback, '의견 보내기 링크(<a>)도 같은 키').toEqual([controlsGuardKey(3)]);
    const decision = r.buttons.filter((k) => k === decisionGuardKey(pending, 3));
    expect(decision, '선택지마다 하나 + 「잠시 덮어 두기」 + 「이후 결정을 자동으로 고르게 하기」(r4 UX12)').toHaveLength(pending.choiceIds.length + 2);
    expect(r.buttons.length, '다른 가드 키의 버튼이 없다(나가기 확인이 닫힌 채)').toBe(controls.length + decision.length);
  });

  it('세대가 오르면 위의 키가 전부 바뀐다 — 한 값으로 한꺼번에 따라온다 (나가기 확인의 두 버튼만 자기 키를 유지)', () => {
    const game = pendingState();
    for (const mode of [{ auto: false }, { auto: true }, { auto: false, folded: true }]) {
      const a = render(game, { epoch: 4, ...mode });
      const b = render(game, { epoch: 5, ...mode });
      expect(b.buttons.length, JSON.stringify(mode)).toBe(a.buttons.length);
      expect(b.buttons.length, JSON.stringify(mode)).toBeGreaterThanOrEqual(12);
      for (const k of b.buttons) expect(a.buttons, `${JSON.stringify(mode)} ${k}`).not.toContain(k);
      for (const k of b.feedback) expect(a.feedback).not.toContain(k);
    }
    const exitA = render(game, { epoch: 4, exitOpen: true });
    const exitB = render(game, { epoch: 5, exitOpen: true });
    expect(exitA.buttons.filter((k) => k === 'life-exit')).toHaveLength(2);
    expect(exitB.buttons.filter((k) => k === 'life-exit')).toHaveLength(2);
  });

  it('인라인 카드(자동 모드 켜짐)의 선택지·「잠시 덮어 두기」·「이후 결정을 직접 고르기」와 접힌 띠의 「결정 다시 열기」도 같은 세대 값을 쓴다', () => {
    const game = pendingState();
    const pending = game.pending!;
    const inline = render(game, { epoch: 7, auto: true });
    expect(inline.buttons.filter((k) => k === decisionGuardKey(pending, 7))).toHaveLength(pending.choiceIds.length + 2); // 선택지 + 「잠시 덮어 두기」 + 끄는 버튼(r4 UX12)
    const strip = render(game, { epoch: 7, folded: true });
    expect(strip.buttons.filter((k) => k === decisionGuardKey(pending, 7)), '접힌 띠에는 「결정 다시 열기」 하나').toHaveLength(1);
    expect(strip.buttons.filter((k) => k === controlsGuardKey(7))).toHaveLength(11);
  });

  it('LifeScreen은 세대 값 하나(guardEpoch)에서 진행 줄·도구 줄·결정 카드·접힌 띠의 키를 모두 만든다 (원본: 두 컨트롤 묶음과 카드 셋이 같은 값을 받는다)', () => {
    expect(lifeScreenSrc).toContain('const controlsGuard = controlsGuardKey(guardEpoch);');
    expect(lifeScreenSrc.match(/guardKey=\{controlsGuard\}/g) ?? []).toHaveLength(2); // LifeControls, LifeTools
    expect(lifeScreenSrc.match(/epoch=\{guardEpoch\}/g) ?? []).toHaveLength(3); // DecisionFold, 인라인 DecisionCard, 모달 DecisionCard
    expect(lifeScreenSrc).not.toContain('foldEpoch'); // 옛 이름(접기 전용)이 남아 있지 않다
  });

  it('기록 시트의 버튼은 세대가 아니라 시트마다 새로 마운트되는 자기 키를 쓴다 — 세대가 올라도 같은 시트의 키는 그대로고, 다른 카드의 시트는 키가 다르다', () => {
    const game = { ...pendingState(), pending: null };
    const sheet = (i: number): NoteSheetState => ({ via: 'auto', card: NOTE_CARDS[i], token: 0 });
    const noteKeys = (r: Rendered) => r.buttons.filter((k) => k.startsWith('note:'));
    const a1 = noteKeys(render(game, { epoch: 1, noteSheet: sheet(0) }));
    const a2 = noteKeys(render(game, { epoch: 2, noteSheet: sheet(0) }));
    const b1 = noteKeys(render(game, { epoch: 1, noteSheet: sheet(1) }));
    expect(a1.length, '1번·2번 (자동 카드 시트)').toBeGreaterThanOrEqual(2);
    expect(a2).toEqual(a1);
    for (const k of b1) expect(a1).not.toContain(k);
    // 수동 시트는 열 때마다 새 토큰 — 같은 자리에 다시 열려도 새 가드
    const m1 = noteKeys(render(game, { epoch: 1, noteSheet: { via: 'manual', card: null, token: 1 } }));
    const m2 = noteKeys(render(game, { epoch: 1, noteSheet: { via: 'manual', card: null, token: 2 } }));
    for (const k of m2) expect(m1).not.toContain(k);
    // 확인 단계 버튼은 시트 키에 #confirm을 붙인 자기 키 (돌아가기 뒤 다시 만들어지는 1번·2번은 마운트 가드 — K03)
    expect(noteSheetSrc).toContain('guardKey={`${guardKey}#confirm`}');
  });
});

describe('G1 — 닫힌 그 렌더에서 가드가 이미 닫혀 있고, 400ms 뒤에 열린다 (렌더 → 효과 순서를 가짜 시계로 돌린다)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  /** `useInputGuard`가 하는 일 그대로: 렌더 중 reconcileGuard로 키가 바뀐 그 렌더에서 닫고, 키가 바뀐 효과가 INPUT_GUARD_MS 뒤 openGuard를 부른다 */
  function makeGuard() {
    let state: GuardState = { key: null, ready: false };
    let effectKey: GuardKey | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const render = (key: GuardKey): boolean => {
      const current = reconcileGuard(state, key);
      if (current !== state) state = current;
      const ready = state.ready; // 이 렌더의 버튼이 눌리는가 — 효과(타이머)는 렌더가 그려진 뒤에 돈다
      if (!Object.is(effectKey, key)) {
        effectKey = key;
        if (timer !== undefined) clearTimeout(timer);
        timer = setTimeout(() => {
          state = openGuard(state, key);
        }, INPUT_GUARD_MS);
      }
      return ready;
    };
    return { render, press: render }; // 눌림은 지금 렌더의 상태로 판정된다(GuardedButton.handleClick의 isButtonInert)
  }

  const FAMILIES: Array<[string, (epoch: number) => string]> = [
    ['진행 줄·도구 줄(controlsGuardKey)', controlsGuardKey],
    ['결정 카드 선택지·접힌 띠(decisionGuardKey)', (e) => decisionGuardKey(pendingState().pending!, e)],
  ];

  it.each(FAMILIES)('%s: 세대가 오른 첫 렌더에서 이미 가드 중이다 (효과가 돌기 전 — 한 프레임도 열려 있지 않다) → 399ms 닫힘, 400ms 열림', (_name, keyOf) => {
    const g = makeGuard();
    g.render(keyOf(0));
    vi.advanceTimersByTime(INPUT_GUARD_MS);
    expect(g.render(keyOf(0)), '화면에 들어온 지 400ms 뒤에는 눌린다').toBe(true);
    // 시트가 닫히며 세대가 오른다 — 같은 렌더(효과 전)에서 곧바로 닫혀 있어야 한다
    expect(g.render(keyOf(1)), '세대가 오른 첫 렌더').toBe(false);
    vi.advanceTimersByTime(INPUT_GUARD_MS - 1);
    expect(g.press(keyOf(1)), '399ms').toBe(false);
    vi.advanceTimersByTime(1);
    expect(g.press(keyOf(1)), '400ms').toBe(true);
  });

  it('가드 중 눌림은 버려질 뿐이다 — 대기열에 쌓지 않고, 가드 시간을 연장하지 않는다 (G5)', () => {
    const g = makeGuard();
    g.render(controlsGuardKey(0));
    vi.advanceTimersByTime(INPUT_GUARD_MS);
    g.render(controlsGuardKey(1));
    vi.advanceTimersByTime(150);
    for (let i = 0; i < 5; i++) expect(g.press(controlsGuardKey(1)), `연타 ${i + 1}`).toBe(false); // 같은 키라 다시 닫히지도 않는다
    vi.advanceTimersByTime(INPUT_GUARD_MS - 150);
    expect(g.press(controlsGuardKey(1)), '처음 올린 때로부터 400ms').toBe(true);
    expect(isButtonInert(false, undefined), '가드 중이면 클릭은 취소된다').toBe(true);
    expect(isButtonInert(true, undefined)).toBe(false);
  });

  it('세대가 같으면 평소 플레이(배속 연타·나이가 오를 때·자동 모드 전환)에서 다시 닫히지 않는다 (G9) — 세대는 시트를 닫을 때만 오른다', () => {
    const g = makeGuard();
    g.render(controlsGuardKey(2));
    vi.advanceTimersByTime(INPUT_GUARD_MS);
    for (let i = 0; i < 20; i++) {
      vi.advanceTimersByTime(100);
      expect(g.press(controlsGuardKey(2)), `평소 눌림 ${i + 1}`).toBe(true);
    }
  });

  it('세대가 연달아 오르면(결정 → 같은 렌더에 다음 해 기록 카드 → 닫힘) 마지막으로 올린 때부터 400ms다', () => {
    const g = makeGuard();
    g.render(controlsGuardKey(0));
    vi.advanceTimersByTime(INPUT_GUARD_MS);
    g.render(controlsGuardKey(1));
    vi.advanceTimersByTime(300);
    expect(g.render(controlsGuardKey(2)), '다시 올라간 첫 렌더').toBe(false);
    vi.advanceTimersByTime(399);
    expect(g.press(controlsGuardKey(2))).toBe(false);
    vi.advanceTimersByTime(1);
    expect(g.press(controlsGuardKey(2))).toBe(true);
  });

  it('접기·다시 열기의 epoch와 합쳐도 한 방향으로만 오른다 (fold.epoch + inputEpoch는 단조 증가라 이전 값으로 돌아가지 않는다)', () => {
    let fold = FOLD_INITIAL;
    let input = 0;
    const seenSums = new Set<number>();
    const sum = () => fold.epoch + input;
    seenSums.add(sum());
    for (const step of ['fold', 'input', 'reopen', 'input', 'input', 'fold', 'reopen'] as const) {
      const before = sum();
      if (step === 'fold') fold = foldCard(fold, 'x@1');
      else if (step === 'reopen') fold = reopenCard(fold);
      else input += 1;
      expect(sum(), step).toBeGreaterThan(before);
      expect(seenSums.has(sum()), `값 ${sum()}가 이전에 쓰인 적 없다`).toBe(false);
      seenSums.add(sum());
    }
  });
});

describe('11-1-3 닫힘 사건 표 — App의 핸들러가 시트를 닫는 자리에서 같은 이벤트·같은 렌더로 세대를 올린다 (원본 읽기)', () => {
  /** `//` 줄 주석을 뺀 코드 (줄 안의 URL 문자열이 잘려도 이 시험이 보는 문장에는 영향이 없다) */
  const code = (s: string) => s.replace(/\/\/.*$/gm, '');
  /** `const <name> = useCallback(` 부터 의존성 배열의 `bumpGuard]`까지 — 핸들러 본문 */
  function callbackBody(name: string): string {
    const start = appSrc.indexOf(`const ${name} = useCallback(`);
    expect(start, `${name} 정의`).toBeGreaterThan(-1);
    const end = appSrc.indexOf('bumpGuard]', start);
    expect(end, `${name}의 의존성 배열에 bumpGuard`).toBeGreaterThan(start);
    return code(appSrc.slice(start, end));
  }

  it('겁니다 — 기록 시트 1번 저장 성공(자동·수동): saveNote가 dispatch·시트 닫기(setManualNote(null))와 같은 핸들러에서 bumpGuard()를 부른다', () => {
    const body = callbackBody('saveNote');
    expect(body).toContain("dispatch({ type: 'saveNote'");
    expect(body).toContain('setManualNote(null);');
    expect(body).toMatch(/\n\s{6}bumpGuard\(\);/); // 조건문 안이 아니라 핸들러 최상위 문장
    expect(noteSheetSrc, '1번(note-save)은 onKeep → doKeep → onSave').toContain('onSave(raw);');
  });

  it('겁니다 — 1번이 reducer에서 무시되었으나(이미 소비·기록 수 불일치) 시트는 닫힘: 세대는 dispatch 결과가 아니라 닫혔다는 사실로 오른다 (조건 없는 문장)', () => {
    const body = callbackBody('saveNote');
    const dispatchAt = body.indexOf('dispatch(');
    const bumpAt = body.indexOf('bumpGuard();');
    expect(bumpAt).toBeGreaterThan(dispatchAt);
    const between = body.slice(body.indexOf('setManualNote(null);'), bumpAt);
    expect(between, 'setManualNote(null)과 bumpGuard 사이에 분기가 없다').not.toMatch(/\bif\b|\?|&&|\|\|/);
  });

  it('겁니다 — 2번(글 없음) · 확인 단계 「글을 지우고 담아 두기」 · Esc(글 없음) · 40개 안내의 「닫기」·Esc: 모두 onDismiss → dismissNote가 bumpGuard()를 부른다', () => {
    const body = callbackBody('dismissNote');
    expect(body).toContain("dispatch({ type: 'dismissNote'");
    expect(body).toContain('setManualNote(null);');
    expect(body).toMatch(/\n\s{4}bumpGuard\(\);/);
    // 닫는 길은 모두 onDismiss 하나로 모인다: 2번·Esc는 pressSkip → decideSkip 'dismiss', 확인 단계 버튼, 40개 안내 닫기
    expect(noteSheetSrc).toContain("if (decideSkip(rawValue(), full, limit) === 'dismiss') return onDismiss();");
    expect(noteSheetSrc).toMatch(/data-testid="note-confirm-discard" onClick=\{onDismiss\}/);
    expect(noteSheetSrc).toMatch(/data-testid="note-limit-close" onClick=\{onDismiss\}/);
    expect(noteSheetSrc, 'Esc는 새 닫기 길이 아니라 pressSkip을 지난다').toContain('keyRef.current.pressSkip();');
    // 시트를 닫는 prop 호출은 이 두 곳(onSave, onDismiss)뿐이다 — 다른 길로 닫히면 이 표를 고쳐야 한다
    const sheetCode = code(noteSheetSrc);
    expect(sheetCode.match(/\bonSave\(/g) ?? []).toHaveLength(1);
    expect(sheetCode.match(/\bonDismiss\(\)|=\{onDismiss\}/g) ?? []).toHaveLength(3);
  });

  it('겁니다 — 결정 시트(모달)에서 선택지를 골라 닫힘 · 자동 모드 인라인 카드에서 사용자가 선택지를 눌러 사라짐: onChoose가 choose dispatch와 같은 핸들러에서 올린다', () => {
    const start = appSrc.indexOf('onChoose={(key, choiceId) => {');
    expect(start).toBeGreaterThan(-1);
    const body = code(appSrc.slice(start, appSrc.indexOf('}}', start)));
    expect(body).toContain("dispatch({ type: 'choose', key, choiceId });");
    expect(body).toMatch(/\n\s+bumpGuard\(\);/);
  });

  it('겁니다 — 결정 시트의 「잠시 덮어 두기」·Esc·접힌 띠의 「결정 다시 열기」: 이미 있던 fold.epoch가 같은 세대 값에 합쳐진다', () => {
    expect(appSrc).toContain('guardEpoch={fold.epoch + inputEpoch}');
    const folded = foldCard(FOLD_INITIAL, 'a@1');
    expect(folded.epoch).toBe(FOLD_INITIAL.epoch + 1);
    expect(reopenCard(folded).epoch).toBe(folded.epoch + 1);
  });

  it('겁니다 — 「자동 기록 카드 끄기/켜기」 자체에는 안 겁니다(닫힘이 아니다), 그 뒤 위 닫힘 중 하나가 일어날 때 겁니다: setNoteCards는 세대를 건드리지 않는다', () => {
    const start = appSrc.indexOf('const setNoteCards = useCallback(');
    expect(start).toBeGreaterThan(-1);
    const line = appSrc.slice(start, appSrc.indexOf('\n', start));
    expect(line).toContain("dispatch({ type: 'setNoteCards', on })");
    expect(line).not.toContain('bumpGuard');
  });

  it('안 겁니다 — 자동 선택(autoChoose 타이머)으로 카드가 사라짐: 타이머 효과는 dispatch만 하고 세대를 올리지 않는다 (G8)', () => {
    const start = appSrc.indexOf("dispatch({ type: 'autoChoose', key })");
    expect(start).toBeGreaterThan(-1);
    const line = appSrc.slice(appSrc.lastIndexOf('\n', start), appSrc.indexOf('\n', start));
    expect(line).not.toContain('bumpGuard');
    expect(line).not.toContain('setInputEpoch');
  });

  it('안 겁니다 — 자동 모드·카드 끔·기록 40개로 기록 카드가 시트 없이 소비됨: noteResponse가 consume이면 시트가 뜨지 않아 닫는 사용자 동작도 없다 (화면과 reducer가 같은 함수를 쓴다)', () => {
    const rows = (n: number) => Array.from({ length: n }, (_, i) => ({ age: i, kind: 'note', title: 't', text: 'x', eventId: 'note-manual' })) as unknown as GameState['history'];
    expect(noteResponse({ autoMode: true, noteCards: true }, { history: [] })).toBe('consume');
    expect(noteResponse({ autoMode: false, noteCards: false }, { history: [] })).toBe('consume');
    expect(noteResponse({ autoMode: false, noteCards: true }, { history: rows(NOTE_LIMITS.total) })).toBe('consume');
    expect(noteResponse({ autoMode: false, noteCards: true }, { history: rows(NOTE_LIMITS.total - 1) })).toBe('stop');
    // App은 같은 함수로 시트가 뜰지(autoNote)를 정한다 — consume이면 autoNote가 null이라 닫을 시트가 없다
    expect(appSrc).toContain("noteResponse(settings, game) === 'stop'");
  });

  it('안 겁니다 — 세대는 사용자 핸들러 여섯 곳(saveNote·dismissNote·onChoose + 가린 카드의 openVeil·autoPick + 카드 맨 끝 자동 고르기 버튼의 autoFromCard)에서만 오른다: bumpGuard 호출은 6곳이고 어떤 useEffect도 올리지 않는다 (효과로 다음 렌더에 올리지 않는다)', () => {
    // SPEC-005 QI6: 가린 결정 카드의 「펼쳐서 읽기」(openVeil)·「이번에는 자동으로 고르기」(autoPick)도 사용자가 누른 순간 카드가 바뀌어 같은 자리에 다른 컨트롤이 드러나므로 같은 규칙(같은 렌더에서 가드)을 따른다 — 3곳이던 호출이 5곳이 됐다
    // SPEC-005 r4 UX12(QI12): 결정 카드 맨 끝의 「이후 결정을 자동으로 고르게 하기」·「이후 결정을 직접 고르기」(autoFromCard)도 사용자가 누른 순간 시트가 사라지거나(켬 — 바깥 inert가 풀려 컨트롤이 드러난다) 생겨서(끔) 같은 자리의 컨트롤이 바뀐다 — 같은 규칙을 따라 5곳이던 호출이 6곳이 됐다
    const src = code(appSrc);
    expect(src.match(/\bbumpGuard\(\)/g) ?? [], 'saveNote, dismissNote, onChoose, openVeil, autoPick, autoFromCard').toHaveLength(6);
    expect(src.match(/\bsetInputEpoch\(/g) ?? [], '정의 한 곳').toHaveLength(1);
    const effects = src.split('useEffect(').slice(1);
    expect(effects.length).toBeGreaterThan(5);
    for (const e of effects) {
      const body = e.slice(0, e.indexOf('\n  }, ['));
      expect(body, '효과 안에서 세대를 올리지 않는다').not.toMatch(/bumpGuard|setInputEpoch/);
    }
  });

  it('G9 — 화면에 닿는 값은 fold.epoch + inputEpoch뿐이다: 진행 시계·나이·자동 모드 전환 같은 게임 상태는 가드 키에 들어가지 않는다', () => {
    expect(code(appSrc).match(/guardEpoch=\{[^}]*\}/g)).toEqual(['guardEpoch={fold.epoch + inputEpoch}']);
  });
});
