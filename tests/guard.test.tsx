import { Children, isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import birthSrc from '../src/core/birth.ts?raw';
import endingSrc from '../src/core/ending.ts?raw';
import lifeSrc from '../src/core/life.ts?raw';
import sessionSrc from '../src/core/session.ts?raw';
import rngSrc from '../src/core/rng.ts?raw';
import stateSrc from '../src/core/state.ts?raw';
import storageSrc from '../src/core/storage.ts?raw';
import typesSrc from '../src/core/types.ts?raw';
import { startLife } from '../scripts/simulateLib';
import { LifeControls, LifeScreen, CONTROLS_GUARD_KEY, SKIP_REASON_ID, isSkipBlocked, skipBlockedReason } from '../src/screens/LifeScreen';
import { GuardedButton, INPUT_GUARD_MS, isButtonInert, openGuard, reconcileGuard, type GuardState } from '../src/ui/GuardedButton';
import { DEFAULT_SETTINGS, advanceUntilDecision, type GameState } from '../src/core';
import type { LifeGame } from '../src/ui/dash/Cards';
import type { YearClock } from '../src/ui/useYearClock';

/** 서버 렌더용 가짜 올해 시계(진행률 0) — 화면이 시계를 읽기만 한다 */
const CLOCK: YearClock = { get: () => 0, subscribe: () => () => undefined };
const noop = () => undefined;
/** startLife가 만든 인생 단계 상태는 출생 결과(시대·출생신고·또래 시드)를 모두 갖고 있다 — 대시보드 화면이 받는 모양으로 좁힌다 */
const asLifeGame = (g: GameState): LifeGame => ({ ...g, character: g.character!, era: g.era!, birthReport: g.birthReport!, peerSeed: g.peerSeed! });
/** 대시보드(LifeScreen)를 서버 렌더한다. 설정은 기본값에 배속·자동 모드만 덮는다. */
const renderLife = (g: GameState, autoMode = false) =>
  renderToString(
    <LifeScreen
      game={asLifeGame(g)}
      settings={{ ...DEFAULT_SETTINGS, speed: 1, autoMode }}
      clock={CLOCK}
      exitOpen={false}
      onExitOpen={noop}
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

/**
 * R-014 화면 전환 직후 입력 가드. 실제 클릭 무시·시간 경과는 DOM이 필요해 e2e(e2e/birth.spec.ts)가 검증하고,
 * 여기서는 서버 렌더(effect가 돌기 전 = 화면이 막 뜬 순간)의 상태와 상수, 계층 분리를 본다.
 */
describe('GuardedButton (R-014)', () => {
  it('화면이 막 뜬 첫 렌더에는 가드가 걸려 있다(aria-disabled=true)', () => {
    const html = renderToString(<GuardedButton data-testid="x">확인</GuardedButton>);
    expect(html).toContain('aria-disabled="true"');
    expect(html).toContain('type="button"');
    expect(html).toContain('data-testid="x"');
    expect(html).toContain('확인');
  });

  it('guardMs=0이면 가드가 없다(aria-disabled 없음)', () => {
    const html = renderToString(<GuardedButton guardMs={0}>확인</GuardedButton>);
    expect(html).not.toContain('aria-disabled');
  });

  it('guardKey가 달라도 첫 렌더는 가드가 걸려 있다 (화면마다 새로 걸린다)', () => {
    for (const key of ['title', 'era', 'birth', 'life', 'school-friend@10', 1, null]) {
      expect(renderToString(<GuardedButton guardKey={key}>확인</GuardedButton>)).toContain('aria-disabled="true"');
    }
  });

  it('className 등 호출자가 넘긴 속성이 그대로 전달되고 disabled 속성은 쓰지 않는다(포커스 유지)', () => {
    const html = renderToString(
      <GuardedButton className="era-card on" aria-pressed={true}>
        카드
      </GuardedButton>,
    );
    expect(html).toContain('class="era-card on"');
    expect(html).toContain('aria-pressed="true"');
    expect(html).not.toMatch(/\sdisabled(=|\s|>)/);
  });

  it('가드 시간은 사람의 더블클릭 간격(약 100~300ms, OS 기본 최대 500ms) 안쪽을 덮되 눈에 띄는 지연은 아니다', () => {
    expect(INPUT_GUARD_MS).toBeGreaterThanOrEqual(300);
    expect(INPUT_GUARD_MS).toBeLessThanOrEqual(500);
  });
});

/**
 * R-337 (REV-003-M4-1, design-system.md 2절 「비활성 컨트롤의 대비」): 호출자가 넘긴 **지속 비활성**(자동 모드 내내인 「다음 결정으로」·준비 중인 「생각 남기기」)은 `data-unavailable="true"`를 함께 달아
 * CSS가 불투명도 흐림이 아니라 옅은 글자 + 점선 테두리로 그리게 한다(렌더 대비 4.5:1). 0.4초 입력 가드의 흐림(과도 상태)은 그대로 `aria-disabled`만 달린다.
 */
describe('GuardedButton: 지속 비활성 표식 data-unavailable (R-337)', () => {
  it('호출자가 aria-disabled를 true / "true"로 넘기면 data-unavailable="true"가 붙고, 입력 가드만 닫힌 버튼에는 붙지 않는다', () => {
    expect(renderToString(<GuardedButton aria-disabled={true}>a</GuardedButton>)).toContain('data-unavailable="true"');
    expect(renderToString(<GuardedButton aria-disabled="true">a</GuardedButton>)).toContain('data-unavailable="true"');
    const guardOnly = renderToString(<GuardedButton>a</GuardedButton>); // 첫 렌더는 가드가 닫혀 있다
    expect(guardOnly).toContain('aria-disabled="true"');
    expect(guardOnly).not.toContain('data-unavailable');
  });

  it('호출자의 비활성이 아니면(false·"false"·없음) 표식이 없다. 가드가 풀린 뒤에도 호출자의 비활성은 표식과 함께 유지된다 (guardMs=0)', () => {
    for (const v of [false, 'false', undefined] as const) expect(renderToString(<GuardedButton guardMs={0} aria-disabled={v}>a</GuardedButton>), String(v)).not.toContain('data-unavailable');
    const stillUnavailable = renderToString(
      <GuardedButton guardMs={0} aria-disabled={true}>
        a
      </GuardedButton>,
    );
    expect(stillUnavailable).toContain('aria-disabled="true"');
    expect(stillUnavailable).toContain('data-unavailable="true"');
  });

  it('isButtonInert의 판정은 그대로다 (가드 닫힘 또는 호출자 비활성) — 표식이 판정을 바꾸지 않는다', () => {
    expect(isButtonInert(true, undefined)).toBe(false);
    expect(isButtonInert(false, undefined)).toBe(true);
    expect(isButtonInert(true, true)).toBe(true);
    expect(isButtonInert(true, 'true')).toBe(true);
    expect(isButtonInert(true, false)).toBe(false);
  });

  it('대시보드: 자동 모드에서는 「다음 결정으로」가, 선택지 대기 중에도 그렇다(「생각 남기기」는 M7c부터 보통 버튼이라 표식이 없다). 켜진 자동 모드·속도·일시정지 같은 버튼에는 없다', () => {
    const life = startLife(5, 'present');
    const auto = renderLife(life, true);
    const tag = (html: string, id: string) => {
      const at = html.indexOf(`data-testid="${id}"`);
      return html.slice(html.lastIndexOf('<', at), html.indexOf('>', at) + 1);
    };
    expect(tag(auto, 'skip')).toContain('data-unavailable="true"');
    for (const id of ['pause', 'auto', 'tool-bgm', 'tool-note', 'tool-dark', 'tool-exit']) expect(tag(auto, id), id).not.toContain('data-unavailable'); // 「생각 남기기」는 M7c부터 보통 버튼이다(지속 비활성 아님)
    const manual = renderLife(life, false);
    expect(tag(manual, 'skip'), '수동·선택지 없음: 「다음 결정으로」는 누를 수 있다').not.toContain('data-unavailable');
    const pending = advanceUntilDecision(startLife(5, 'present')).state;
    if (pending.phase === 'life' && pending.pending !== null) expect(tag(renderLife(pending, false), 'skip'), '선택지 대기 중').toContain('data-unavailable="true"');
  });

  it('CSS(title.css): 지속 비활성 규칙은 불투명도를 1로 되돌리고 옅은 글자(--c-text-3) + 점선 테두리(--c-border-strong)이며 강제 색상에서는 GrayText 점선이다. 0.4초 가드의 흐림 규칙은 그대로 있다', async () => {
    const spec = 'node:fs';
    const fs = (await import(/* @vite-ignore */ spec)) as { readFileSync(path: URL, encoding: 'utf-8'): string };
    const css = fs.readFileSync(new URL('../src/styles/title.css', import.meta.url), 'utf-8').replace(/\/\*[^]*?\*\//g, '');
    const rule = /\.btn\[data-unavailable='true'\] \{([^}]*)\}/.exec(css)![1];
    expect(rule).toMatch(/opacity:\s*1\b/);
    expect(rule).toMatch(/color:\s*var\(--c-text-3\)/);
    expect(rule).toMatch(/border-style:\s*dashed/);
    expect(rule).toMatch(/border-color:\s*var\(--c-border-strong\)/);
    // 같은 특이도(0,2,0)의 가드 규칙보다 뒤에 있어야 불투명도 0.55를 되돌린다
    expect(css.indexOf(".btn[data-unavailable='true'] {")).toBeGreaterThan(css.indexOf(".btn[aria-disabled='true'], .btn:disabled { opacity: 0.55; cursor: default; }"));
    expect(css).toContain(".btn[aria-disabled='true'], .btn:disabled { opacity: 0.55; cursor: default; }");
    expect(css).toMatch(/@media \(forced-colors: active\) \{[^]*\.btn\[data-unavailable='true'\] \{ color: GrayText; border-color: GrayText; \}/);
    // 새 토큰·고정 색을 쓰지 않는다
    expect(rule).not.toMatch(/#[0-9a-f]{3,8}\b|rgb\(/i);
  });
});

/**
 * R-029: "같은 버튼에서 guardKey만 바뀌는" 경우(인생 화면에서 다음 선택지가 같은 자리에 뜨는 M3의 주 경로).
 * 실제 DOM 동작(키가 바뀐 직후 클릭 무시, ms 뒤 허용)은 e2e/guard.spec.ts가 하니스(harness/guard.html)로 검증한다 —
 * 이 프로젝트는 jsdom 같은 DOM 라이브러리를 의존성으로 두지 않으므로(새 의존성 금지) 진짜 브라우저(Playwright)를 쓴다.
 * 여기서는 그 동작을 정하는 순수 상태 전이를 검증한다.
 */
describe('가드 상태 전이 (R-029)', () => {
  const ready = (key: GuardState['key']): GuardState => ({ key, ready: true });
  const closed = (key: GuardState['key']): GuardState => ({ key, ready: false });

  it('키가 같으면 상태를 그대로 둔다(같은 객체)', () => {
    const s = ready('a@1');
    expect(reconcileGuard(s, 'a@1')).toBe(s);
    expect(reconcileGuard(closed(3), 3)).toEqual(closed(3));
  });

  it('키가 바뀌면 (열려 있었더라도) 그 자리에서 곧바로 닫히고 새 키를 기억한다 — 문자열 → 문자열, 문자열 → 숫자, 숫자 → null', () => {
    expect(reconcileGuard(ready('choice-a@5'), 'choice-b@9')).toEqual(closed('choice-b@9'));
    expect(reconcileGuard(ready('choice-a@5'), 7)).toEqual(closed(7));
    expect(reconcileGuard(ready(7), null)).toEqual(closed(null));
    expect(reconcileGuard(ready(null), 'x')).toEqual(closed('x'));
  });

  it('대기 시간이 끝나면 그 키에 대해서만 열린다. 이미 열려 있으면 같은 객체', () => {
    expect(openGuard(closed('b'), 'b')).toEqual(ready('b'));
    const s = ready('b');
    expect(openGuard(s, 'b')).toBe(s);
  });

  it('늦게 울린 이전 키의 타이머는 새 키의 가드를 열지 못한다 (A 가드 대기 중 키가 B로 바뀌고 A의 타이머가 울려도 B는 닫힌 채)', () => {
    let state = ready('A');
    state = reconcileGuard(state, 'B'); // 같은 버튼 요소에서 키만 바뀜
    expect(state.ready).toBe(false);
    state = openGuard(state, 'A'); // 옛 타이머
    expect(state).toEqual(closed('B'));
    state = openGuard(state, 'B'); // 새 타이머
    expect(state).toEqual(ready('B'));
  });

  it('키가 연달아 두 번 바뀌어도(B → C) 마지막 키만 열린다', () => {
    let state = reconcileGuard(reconcileGuard(ready('A'), 'B'), 'C');
    expect(state).toEqual(closed('C'));
    expect(openGuard(state, 'B')).toEqual(closed('C'));
    state = openGuard(state, 'C');
    expect(state).toEqual(ready('C'));
  });

  it('guardKey 타입은 string | number | null이다: 인라인 객체를 넘기면 컴파일 오류 (렌더마다 달라지는 값은 갱신 반복을 부른다)', () => {
    // @ts-expect-error guardKey는 string | number | null만 허용한다 — 객체/배열/함수는 타입 오류여야 한다 (tsc가 이 줄을 검사한다)
    const bad = <GuardedButton guardKey={{ screen: 'x' }}>x</GuardedButton>;
    const good = [<GuardedButton guardKey="a@1">x</GuardedButton>, <GuardedButton guardKey={3}>x</GuardedButton>, <GuardedButton guardKey={null}>x</GuardedButton>];
    expect(renderToString(bad)).toContain('aria-disabled');
    for (const el of good) expect(renderToString(el)).toContain('aria-disabled="true"');
  });
});

describe('GuardedButton: 호출자가 넘긴 disabled는 가드와 별개로 통과한다 (R-035)', () => {
  it('disabled를 넘기면 disabled 속성이 붙고, 가드(aria-disabled)도 따로 걸린다', () => {
    const html = renderToString(<GuardedButton disabled>다음 결정으로</GuardedButton>);
    expect(html).toMatch(/\sdisabled(=|\s|>)/);
    expect(html).toContain('aria-disabled="true"');
  });
});

/**
 * R-036: 호출자가 "지금은 누를 수 없다"를 aria-disabled로 넘기면 가드와 합쳐진다 — 둘 중 하나라도 비활성이면 aria-disabled="true"이고 클릭/Enter/Space를 무시하며,
 * 가드가 풀려도 호출자의 비활성은 유지된다. (disabled 속성은 쓰지 않는다: Tab 순서에서 빠지지 않고 포커스를 받는다.)
 * 실제 클릭·키 입력을 무시하는지는 DOM이 필요해 e2e/guard.spec.ts(하니스)가 같은 진리표로 본다.
 */
describe('GuardedButton: 호출자 aria-disabled × 가드 진리표 (R-036)', () => {
  type Caller = boolean | 'true' | 'false' | undefined;
  const CALLERS: Caller[] = [undefined, false, 'false', true, 'true'];
  // 사람이 적은 표: [가드 열림?, 호출자 aria-disabled, 입력을 무시하는가(= aria-disabled="true"인가)]. 클릭이 반영되는 것은 그 반대.
  const TABLE: Array<[guardReady: boolean, caller: Caller, inert: boolean]> = [
    [false, undefined, true],
    [false, false, true],
    [false, 'false', true],
    [false, true, true],
    [false, 'true', true],
    [true, undefined, false],
    [true, false, false],
    [true, 'false', false],
    [true, true, true],
    [true, 'true', true],
  ];

  it("isButtonInert: 가드 닫힘 → 호출자와 무관하게 무시 / 가드 열림 → 호출자가 true·'true'일 때만 무시 (가드가 풀려도 호출자 비활성은 유지)", () => {
    expect(TABLE).toHaveLength(2 * CALLERS.length); // 모든 조합을 적었다
    for (const [guardReady, caller, inert] of TABLE) {
      expect(isButtonInert(guardReady, caller), `가드 ${guardReady ? '열림' : '닫힘'} / 호출자 ${String(caller)}`).toBe(inert);
    }
  });

  it('렌더: 가드가 풀린 버튼(guardMs=0)은 호출자 aria-disabled가 true일 때만 aria-disabled="true"', () => {
    for (const [, caller, inert] of TABLE.filter((row) => row[0])) {
      const html = renderToString(
        <GuardedButton guardMs={0} aria-disabled={caller}>
          확인
        </GuardedButton>,
      );
      expect(html.includes('aria-disabled="true"'), `가드 열림 / 호출자 ${String(caller)}: ${html}`).toBe(inert);
      expect(html).not.toMatch(/aria-disabled="false"/); // 비활성이 아닐 때는 속성 자체를 쓰지 않는다
      expect(html).not.toMatch(/\sdisabled(=|\s|>)/); // disabled 속성은 쓰지 않는다(Tab 순서·포커스 유지)
    }
  });

  it('렌더: 가드가 닫힌 버튼(막 뜬 첫 렌더)은 호출자가 뭐라고 넘기든 aria-disabled="true"', () => {
    for (const [, caller] of TABLE.filter((row) => !row[0])) {
      const html = renderToString(<GuardedButton aria-disabled={caller}>확인</GuardedButton>);
      expect(html, `가드 닫힘 / 호출자 ${String(caller)}`).toContain('aria-disabled="true"');
      expect(html).not.toMatch(/\sdisabled(=|\s|>)/);
    }
  });
});

/** React 요소 트리를 펼친다 (함수 컴포넌트를 부르지 않고 만들어진 요소만 본다) */
function flatten(node: ReactNode, out: ReactElement[] = []): ReactElement[] {
  Children.forEach(node, (child) => {
    if (isValidElement(child)) {
      out.push(child);
      flatten((child.props as { children?: ReactNode }).children, out);
    }
  });
  return out;
}

/**
 * R-035·R-036: 인생 화면(대시보드) 진행 줄(일시정지·속도 4개·다음 결정으로·자동 모드)과 도구 줄. (M4: 일시정지가 더해져 6개 → 7개, 도구 줄 다섯 개가 더해졌다)
 * 화면이 뜬 순간(첫 렌더)에는 모두 가드로 닫혀 있고, 가드 키는 상수라 가드가 풀린 뒤 다시 닫히지 않는다(실제 클릭 무시·재폐쇄 없음은 e2e/entry-guard.spec.ts).
 * "다음 결정으로"는 disabled가 아니라 aria-disabled로 막는다 — 선택지가 뜨든 사라지든 컨트롤 그룹의 Tab 순서가 변하지 않도록.
 */
describe('인생 화면 컨트롤 입력 가드 (R-035)', () => {
  const life = startLife(41, 'present');
  const game = { ...life, character: life.character! };
  const render = (g: GameState, autoMode = false) => renderLife(g, autoMode);
  /** 진행 줄(controls)만: 그 뒤에 이어지는 도구 줄(tools) 앞까지 */
  const controlsOf = (html: string) => html.slice(html.indexOf('data-testid="controls"'), html.indexOf('data-testid="tools"'));
  const toolsOf = (html: string) => html.slice(html.indexOf('data-testid="tools"'), html.indexOf('<main'));
  /** 해당 data-testid 버튼의 여는 태그 문자열 */
  const tagOf = (html: string, testId: string) => html.match(new RegExp(`<button[^>]*data-testid="${testId}"[^>]*>`))![0];
  const hasRealDisabled = (tag: string) => /\sdisabled(=|\s|>)/.test(tag);

  it('첫 렌더: 진행 줄 7개(일시정지·1/2/4/8배·다음 결정으로·자동 모드)가 모두 aria-disabled=true', () => {
    const controls = controlsOf(render(game));
    expect(controls.match(/<button/g)).toHaveLength(7);
    expect(controls.match(/aria-disabled="true"/g)).toHaveLength(7);
    for (const speed of [1, 2, 4, 8]) expect(controls).toMatch(new RegExp(`data-speed="${speed}"`));
    expect(controls).toContain('data-testid="auto"');
    expect(controls).toContain('data-testid="pause"');
  });

  it('첫 렌더: 도구 줄도 모두 가드로 닫혀 있다 — 버튼 넷(BGM·생각 남기기·다크 모드·나가기)과 의견 보내기 링크(aria-disabled)', () => {
    const tools = toolsOf(render(game));
    expect(tools.match(/<button/g)).toHaveLength(4);
    expect(tools.match(/<a /g), '의견 보내기는 진짜 링크다').toHaveLength(1);
    expect(tools.match(/aria-disabled="true"/g)).toHaveLength(5);
    for (const id of ['tool-bgm', 'tool-note', 'tool-dark', 'tool-feedback', 'tool-exit']) expect(tools).toContain(`data-testid="${id}"`);
    expect((tools.match(/<button[^>]*>/g) ?? []).filter(hasRealDisabled)).toHaveLength(0);
  });

  it('선택지가 떠 있는 첫 렌더: 선택지 버튼도 컨트롤도 모두 aria-disabled로 닫혀 있고, 어느 컨트롤도 disabled 속성을 쓰지 않는다 (R-036: Tab 순서 유지)', () => {
    const decision = advanceUntilDecision(life).state;
    expect(decision.pending).not.toBeNull();
    const html = render(decision);
    // 자동 모드 꺼짐 = 모달 시트: 화면 맨 끝(inert인 바깥 형제들 뒤)에 있고, 안의 버튼은 선택지와 「잠시 덮어 두기」다 (M7b)
    const choiceBlock = html.slice(html.indexOf('data-testid="choice-panel"'));
    expect(choiceBlock.match(/<button/g)!.length).toBeGreaterThanOrEqual(2);
    expect(choiceBlock.match(/<button/g)!.length).toBe(choiceBlock.match(/aria-disabled="true"/g)!.length);
    const controls = controlsOf(html);
    expect(controls.match(/aria-disabled="true"/g)).toHaveLength(7);
    expect((controls.match(/<button[^>]*>/g) ?? []).filter(hasRealDisabled)).toHaveLength(0);
  });

  it('자동 모드의 첫 렌더: 자동 모드 버튼은 켜진 상태로 보이고, "다음 결정으로"도 disabled 속성을 쓰지 않는다', () => {
    const controls = controlsOf(render(game, true));
    expect(tagOf(controls, 'auto')).toContain('aria-pressed="true"');
    expect(hasRealDisabled(tagOf(controls, 'skip'))).toBe(false);
  });

  const controlsTree = (over: Partial<Parameters<typeof LifeControls>[0]> = {}) =>
    flatten(LifeControls({ speed: 1, autoMode: false, paused: false, hasPending: false, onSpeed: () => {}, onSkip: () => {}, onAuto: () => {}, onPause: () => {}, ...over })).filter(
      (el) => el.type === GuardedButton,
    );
  const prop = (el: ReactElement, name: string) => (el.props as Record<string, unknown>)[name];

  it('컨트롤 7개는 모두 같은 상수 guardKey를 쓴다: 나이·선택지·배속·자동 모드·일시정지가 바뀌어도 키가 같아 가드가 다시 걸리지 않는다', () => {
    const variants = [{}, { speed: 8 as const }, { autoMode: true }, { hasPending: true }, { paused: true }, { speed: 4 as const, autoMode: true, hasPending: true, paused: true }];
    for (const v of variants) {
      const buttons = controlsTree(v);
      expect(buttons, JSON.stringify(v)).toHaveLength(7);
      for (const b of buttons) expect(prop(b, 'guardKey'), JSON.stringify(v)).toBe(CONTROLS_GUARD_KEY);
    }
    // 선택지 버튼의 키(이벤트 인스턴스 키)와 겹치지 않는 값이다 — 선택지 키는 "<이벤트>@<나이>" 모양
    expect(CONTROLS_GUARD_KEY).not.toMatch(/@/);
  });

  it('"다음 결정으로"는 선택지 대기 중이거나 자동 모드일 때 aria-disabled(disabled 아님), 그 밖에는 눌 수 있다. 속도·자동 모드 버튼은 어떤 때도 막지 않는다 (R-036)', () => {
    const cases: Array<[autoMode: boolean, hasPending: boolean, blocked: boolean]> = [
      [false, false, false],
      [false, true, true],
      [true, false, true],
      [true, true, true],
    ];
    for (const [autoMode, hasPending, blocked] of cases) {
      expect(isSkipBlocked(autoMode, hasPending), `자동 ${autoMode} / 선택지 ${hasPending}`).toBe(blocked);
      const buttons = controlsTree({ autoMode, hasPending });
      const skip = buttons.find((b) => prop(b, 'data-testid') === 'skip')!;
      expect(prop(skip, 'aria-disabled'), `자동 ${autoMode} / 선택지 ${hasPending}`).toBe(blocked);
      for (const b of buttons) {
        expect(prop(b, 'disabled'), '어떤 컨트롤도 disabled를 쓰지 않는다(Tab 순서가 변하지 않는다)').toBeUndefined();
        if (b !== skip) expect(prop(b, 'aria-disabled'), '일시정지·속도·자동 모드 버튼은 호출자 비활성이 없다').toBeUndefined();
      }
    }
  });
});

/**
 * R-056: 비활성 "다음 결정으로"는 왜 눌리지 않는지(선택지 대기 중 / 자동 모드)를 aria-describedby로 보조기기에 알린다.
 * 설명 요소는 hidden이고(R-090: .sr-only면 스크린리더 둘러보기 모드에서 한 번 더 읽힌다), 누를 수 있을 때는 아예 없다.
 * 실제 접근성 설명 계산은 e2e/polish.spec.ts(toHaveAccessibleDescription)가 본다 — hidden이어도 aria-describedby가 가리키면 설명으로 계산된다.
 */
describe('비활성 "다음 결정으로"의 사유 전달 (R-056)', () => {
  const life = startLife(41, 'present');
  const decision = advanceUntilDecision(life).state;
  const html = (autoMode: boolean, pending: boolean) => renderLife(pending ? decision : life, autoMode);
  const skipTag = (h: string) => h.match(/<button[^>]*data-testid="skip"[^>]*>/)![0];

  it('skipBlockedReason: 자동 모드·선택지 대기 중에는 사유 문장, 누를 수 있으면 null (자동 모드가 선택지 대기보다 먼저)', () => {
    expect(skipBlockedReason(false, false)).toBeNull();
    expect(skipBlockedReason(false, true)).toBe('선택지가 나와 있어 먼저 하나를 골라야 합니다.');
    expect(skipBlockedReason(true, false)).toBe('자동 모드에서는 선택지를 스스로 고르므로 누를 수 없습니다.');
    expect(skipBlockedReason(true, true)).toBe(skipBlockedReason(true, false));
    for (const auto of [false, true]) for (const pending of [false, true]) expect(skipBlockedReason(auto, pending) !== null).toBe(isSkipBlocked(auto, pending));
  });

  it('막혀 있으면 버튼이 사유 요소를 가리키고(aria-describedby), 그 요소에 사유 문장이 있다. 막혀 있지 않으면 둘 다 없다', () => {
    for (const [auto, pending] of [[false, false], [false, true], [true, false], [true, true]] as const) {
      const h = html(auto, pending);
      const reason = skipBlockedReason(auto, pending);
      if (reason === null) {
        expect(skipTag(h), `자동 ${auto} / 선택지 ${pending}`).not.toContain('aria-describedby');
        expect(h).not.toContain(` id="${SKIP_REASON_ID}"`);
      } else {
        expect(skipTag(h), `자동 ${auto} / 선택지 ${pending}`).toContain(`aria-describedby="${SKIP_REASON_ID}"`);
        expect(h).toMatch(new RegExp(`<span id="${SKIP_REASON_ID}" hidden=""[^>]*>${reason}</span>`));
        expect(h.match(new RegExp(`<span id="${SKIP_REASON_ID}"[^>]*>`))![0], 'R-090: .sr-only가 아니라 hidden').not.toContain('sr-only');
      }
    }
  });

  it('사유 요소는 하나뿐이고 id가 겹치지 않으며, 속도·자동 모드 버튼은 설명을 달지 않는다', () => {
    const h = html(false, true);
    expect(h.split(` id="${SKIP_REASON_ID}"`)).toHaveLength(2); // 앞에 공백이 붙은 id 속성이 정확히 하나 (data-testid와 구별)
    for (const testId of ['auto']) expect(h.match(new RegExp(`<button[^>]*data-testid="${testId}"[^>]*>`))![0]).not.toContain('aria-describedby');
    expect(h.match(/<button[^>]*data-speed="1"[^>]*>/)![0]).not.toContain('aria-describedby');
  });
});

describe('가드는 UI 계층에만 있다 (core 순수 함수는 건드리지 않는다)', () => {
  it('core 소스에 가드·타이머·React·DOM 참조가 없다', () => {
    for (const src of [birthSrc, rngSrc, stateSrc, storageSrc, typesSrc, lifeSrc, sessionSrc, endingSrc]) {
      expect(src).not.toMatch(/GuardedButton|useInputGuard|INPUT_GUARD_MS|setTimeout|from 'react'|document\./);
    }
  });
});
