import { describe, expect, it } from 'vitest';
import { ASK_GAP, ASK_RING_EXTRA, BAR_FIXED_MEDIA, askFitDelta, askNeedsRoom, askSpan } from '../src/ui/exitAsk';
import { shouldReleaseHead } from '../src/ui/headRelease';
import exitAskSrc from '../src/ui/exitAsk.ts?raw';
import headReleaseSrc from '../src/ui/headRelease.ts?raw';
import useBottomBarSrc from '../src/ui/useBottomBar.ts?raw';
import lifeScreenSrc from '../src/screens/LifeScreen.tsx?raw';
import rouletteSrc from '../src/screens/RouletteScreen.tsx?raw';
import birthSrc from '../src/screens/BirthScreen.tsx?raw';

/**
 * 대시보드 「나가기」 확인 단계의 화면 맞춤 (QA-003-M4 O03, SPEC-003 QM2-12 (5)와 같은 규칙). 판정·계산은 순수 함수(src/ui/exitAsk.ts)로 두었고, 여기서는
 * (1) 실제로 잰 값(e2e 탐침: 글자 200%의 360×740·320×568·640×400)으로 「고정 요소를 풀어야 하는가」 판정이 맞는지 (2) 스크롤 양 계산이 어느 입력에서나 구간을 가장자리 안에 두는지(우선순위 포함)
 * (3) 화면이 이 맞춤을 실제로 걸었는지 본다. 실제 화면에서의 위치·포커스·전환은 e2e/m4-exit-ask.spec.ts가 잰다.
 */

const rect = (top: number, bottom: number) => ({ getBoundingClientRect: () => ({ top, bottom }) }) as unknown as Element;

describe('askSpan: 안내문 첫 줄 위끝 ~ 「돌아가기」 링 아래끝', () => {
  it('버튼 아래끝 + 링 두께 − 첫 줄 위끝이다. 두 요소가 같이 움직이므로 스크롤 위치와 상관없다', () => {
    expect(ASK_RING_EXTRA).toBe(7);
    expect(askSpan(rect(-343, -241), rect(149, 207))).toBe(207 + 7 + 343); // 320×568 글자 200% 실측: 557
    expect(askSpan(rect(5, 107), rect(497, 555))).toBe(557); // 스크롤한 뒤에도 같다
    expect(askSpan(rect(0, 10), rect(100, 120), 0)).toBe(120);
  });
});

describe('askNeedsRoom: 원래 규칙대로 고정될 요소와 구간이 한 화면에 못 들어가면 고정 요소를 푼다', () => {
  // [이름, 구간(링 포함), 헤더, 진행 줄, 작은 뷰포트 높이, 기대] — 구간·헤더·진행 줄은 e2e 탐침으로 잰 값(2026-10-17)
  const measured: Array<[string, number, number, number, number, boolean]> = [
    ['360×740 글자 100%', 212, 95, 112, 740, false],
    ['320×568 글자 100%', 212, 95, 112, 568, false],
    ['640×400 글자 100%', 137, 95, 112, 400, false],
    ['667×375 글자 100%', 137, 95, 112, 375, false],
    ['360×740 글자 200%: 헤더는 원래도 풀리고 진행 줄(216px)이 고정인 채 구간(513px)이 들어간다 — 풀 이유가 없다', 513, 182, 216, 740, false],
    ['320×568 글자 200%: 진행 줄 212px만 빼도 구간(557px)이 안 들어간다', 557, 182, 212, 568, true],
    ['640×400 글자 200%: 진행 줄 112px만 빼도 구간(334px)이 안 들어간다', 334, 134, 112, 400, true],
    ['667×375 글자 200%', 334, 134, 112, 375, true],
    ['320×256 글자 100%: 진행 줄 112px(44%)은 고정이지만 구간(212px)이 안 들어간다', 212, 95, 112, 256, true],
  ];

  it.each(measured)('모바일 폭 — %s', (_name, span, head, bar, vh, expected) => {
    expect(askNeedsRoom(span, head, bar, vh)).toBe(expected);
  });

  it('넓은 화면(진행 줄이 보통 행)은 진행 줄을 셈에 넣지 않는다: 1280×800은 풀 이유가 없고, 아주 낮은 창만 헤더를 푼다', () => {
    expect(askNeedsRoom(212, 95, 80, 800, false)).toBe(false);
    expect(askNeedsRoom(334, 134, 80, 800, false), '글자 200%여도 800px이면 넉넉').toBe(false);
    expect(askNeedsRoom(212, 95, 80, 300, false), '구간 + 헤더 = 307 > 300').toBe(true);
    expect(askNeedsRoom(212, 95, 80, 320, false)).toBe(false);
    // 진행 줄 높이는 넓은 화면에서 판정을 바꾸지 않는다
    for (const bar of [0, 80, 500]) expect(askNeedsRoom(212, 95, bar, 300, false)).toBe(true);
  });

  it('원래 규칙으로 이미 풀릴 요소는 자리를 차지하지 않는 것으로 센다 — 진행 줄은 절반을 넘으면, 헤더는 (헤더 + 고정될 진행 줄)이 절반을 넘으면', () => {
    // 진행 줄 300px / 568 = 53% → 원래 풀린다. 구간 250 + 헤더 95 = 345 ≤ 568 → 풀 이유 없음 (진행 줄을 더했다면 645 > 568로 오판)
    expect(askNeedsRoom(250, 95, 300, 568)).toBe(false);
    // 헤더 + 진행 줄이 절반을 넘으면 헤더가 원래 풀린다: 구간 400 + 진행 줄 112 = 512 ≤ 568 (헤더 182를 더했다면 694 > 568로 오판)
    expect(shouldReleaseHead(182, 112, 568)).toBe(true);
    expect(askNeedsRoom(400, 182, 112, 568)).toBe(false);
    // 같은 구간이 헤더가 고정인 크기에서는 못 들어간다: 헤더 95는 (95 + 112 = 207 ≤ 284)라 고정 → 400 + 95 + 112 = 607 > 568
    expect(askNeedsRoom(400, 95, 112, 568)).toBe(true);
  });

  it('문턱은 「넘으면」이다: 합이 정확히 뷰포트 높이면 풀지 않고, 1px라도 넘으면 푼다', () => {
    expect(askNeedsRoom(300, 95, 112, 507)).toBe(false); // 300 + 95 + 112 = 507
    expect(askNeedsRoom(300, 95, 112, 506)).toBe(true);
  });

  it('판정은 고정·해제 상태에 상관없이 같은 입력이면 같은 값이다 — 풀려서 자리가 생겨도 다시 고정으로 돌아가는 흔들림이 없다 (순수 함수, 입력은 높이뿐)', () => {
    for (const [, span, head, bar, vh] of measured) {
      const first = askNeedsRoom(span, head, bar, vh);
      for (let i = 0; i < 5; i++) expect(askNeedsRoom(span, head, bar, vh)).toBe(first);
    }
    expect(askNeedsRoom.length, '고정 상태를 인자로 받지 않는다(높이 4개 + 폭 종류 1개)').toBeLessThanOrEqual(5);
  });

  it('높이를 모르면(0·NaN·음수·무한) 풀지 않는다 — 측정 실패가 고정 요소를 풀어 버리지 않는다', () => {
    for (const args of [
      [0, 95, 112, 568],
      [557, Number.NaN, 112, 568],
      [557, 95, Number.NaN, 568],
      [557, 95, 112, 0],
      [-5, 95, 112, 568],
      [557, 95, 112, Number.POSITIVE_INFINITY],
    ] as const) {
      expect(askNeedsRoom(args[0], args[1], args[2], args[3]), args.join('/')).toBe(false);
    }
  });
});

describe('askFitDelta: 구간을 고정 요소에 가리지 않는 가장자리 안에 두는 스크롤 양 (+ 아래로, − 위로)', () => {
  const apply = (input: Parameters<typeof askFitDelta>[0]) => {
    const delta = askFitDelta(input);
    return { delta, firstTop: input.firstTop - delta, pairBottom: input.focusedBottom + (input.ringExtra ?? ASK_RING_EXTRA) - delta };
  };

  it('이미 안에 있으면 스크롤하지 않는다 (불필요한 점프 없음)', () => {
    expect(askFitDelta({ firstTop: 213, focusedBottom: 418, regionTop: 95 + 12, regionBottom: 740 - 112 })).toBe(0);
    expect(askFitDelta({ firstTop: 40, focusedBottom: 300, regionTop: 0, regionBottom: 700 })).toBe(0);
  });

  it('버튼이 아래로 밀려 있으면 아래로 내려 버튼을 보인다(링과 숨 쉴 틈 포함) — 안내문 첫 줄도 함께 안에 든다', () => {
    const r = apply({ firstTop: 500, focusedBottom: 760, regionTop: 0, regionBottom: 740 });
    expect(r.delta).toBeGreaterThan(0);
    expect(r.pairBottom).toBeLessThanOrEqual(740 - ASK_GAP + 0.5 + 0.0001);
    expect(r.firstTop).toBeGreaterThanOrEqual(ASK_GAP - 0.5);
  });

  it('안내문 첫 줄이 위로 벗어났으면 위로 올린다 (O03의 증상: 320×568 글자 200%에서 첫 줄이 −343px)', () => {
    const r = apply({ firstTop: -343, focusedBottom: 207, regionTop: 0, regionBottom: 568 });
    expect(r.delta).toBeLessThan(0);
    expect(r.firstTop).toBeGreaterThanOrEqual(0);
    expect(r.pairBottom).toBeLessThanOrEqual(568);
    // 구간(557px)이 가장자리(568px)보다 11px 작을 뿐이라 숨 쉴 틈은 5.5px씩만 둔다
    expect(r.firstTop).toBeCloseTo(5.5, 5);
    expect(r.pairBottom).toBeCloseTo(562.5, 5);
  });

  it('구간이 가용 높이보다 크면 포커스를 받은 「돌아가기」를 우선한다(CM10): 버튼 링 아래끝이 가장자리 아래에 닿고 안내문 위쪽이 잘린다 — 320×256 글자 200%의 실제 값(구간 557px, 화면 256px)', () => {
    const r = apply({ firstTop: 100, focusedBottom: 700, regionTop: 12, regionBottom: 400 });
    expect(r.pairBottom).toBeCloseTo(400, 5);
    expect(r.firstTop).toBeLessThan(12);
    // 실측: 맨 아래에서 열었을 때(버튼 아래끝 555px, 화면 256px) → 버튼이 화면 안으로 올라온다
    const real = apply({ firstTop: 5, focusedBottom: 555 - ASK_RING_EXTRA, regionTop: 0, regionBottom: 256 });
    expect(real.pairBottom).toBeCloseTo(256, 5);
    expect(real.delta).toBeGreaterThan(0);
    // 버튼이 이미 가장자리 위쪽에 떠 있으면(구간이 커서 첫 줄은 어차피 다 못 본다) 위로 되돌려 안내문이 더 보이게 한다
    const above = apply({ firstTop: -700, focusedBottom: 100, regionTop: 0, regionBottom: 256 });
    expect(above.pairBottom).toBeCloseTo(256, 5);
    expect(above.delta).toBeLessThan(0);
  });

  it('숨 쉴 틈은 여유가 있을 때만: 여유가 틈 두 개(24px)보다 작으면 줄이고, 여유가 없으면 0이다', () => {
    const span = 500;
    for (const [room, expectedMargin] of [
      [600, ASK_GAP],
      [524, 12],
      [520, 10],
      [512, 6],
      [500, 0],
    ] as const) {
      // 구간이 가장자리 아래로 밀려 있어(위끝 400) 아래로 내려야 하는 경우와, 위로 벗어난 경우(−300) 모두 위·아래 틈이 min(12, 여유/2) 이상이다
      for (const firstTop of [400, -300]) {
        const r = apply({ firstTop, focusedBottom: firstTop + span - ASK_RING_EXTRA, regionTop: 50, regionBottom: 50 + room });
        expect(r.firstTop - 50, `가장자리 ${room}px · 위끝 ${firstTop}: 위 틈`).toBeGreaterThanOrEqual(expectedMargin - 0.0001);
        expect(50 + room - r.pairBottom, `가장자리 ${room}px · 위끝 ${firstTop}: 아래 틈`).toBeGreaterThanOrEqual(expectedMargin - 0.0001);
      }
    }
    // 여유가 없는 경우(500px 안에 500px)는 틈 없이 꼭 맞는다
    const tight = apply({ firstTop: 400, focusedBottom: 400 + span - ASK_RING_EXTRA, regionTop: 50, regionBottom: 550 });
    expect(tight.firstTop).toBeCloseTo(50, 5);
    expect(tight.pairBottom).toBeCloseTo(550, 5);
  });

  it('고정 헤더 아래·고정 진행 줄 위가 가장자리다: 위끝 107px(헤더 95 + 틈 12)·아래끝 628px(진행 줄 위) 안으로 들어온다', () => {
    const r = apply({ firstTop: 700, focusedBottom: 900, regionTop: 95, regionBottom: 628 });
    expect(r.firstTop).toBeGreaterThanOrEqual(95 + ASK_GAP - 0.0001);
    expect(r.pairBottom).toBeLessThanOrEqual(628 - ASK_GAP + 0.0001);
  });

  it('무작위 20000건: 구간이 가장자리 안에 들어갈 수 있으면 스크롤 뒤 안에 들어오고(위 ≥ 가장자리 위, 아래 ≤ 가장자리 아래), 못 들어가면 포커스 버튼이 가장자리 아래에 닿는다. 이미 안에 있으면 0', () => {
    let seed = 20261017;
    const rnd = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 2 ** 32;
    };
    let fits = 0;
    let overs = 0;
    let stays = 0;
    for (let i = 0; i < 20000; i++) {
      const regionTop = Math.floor(rnd() * 200);
      const room = 150 + Math.floor(rnd() * 800);
      const span = 80 + Math.floor(rnd() * 900);
      const firstTop = Math.floor(rnd() * 2400) - 1200;
      const input = { firstTop, focusedBottom: firstTop + span - ASK_RING_EXTRA, regionTop, regionBottom: regionTop + room };
      const r = apply(input);
      if (span <= room) {
        fits++;
        expect(r.firstTop, JSON.stringify(input)).toBeGreaterThanOrEqual(regionTop - 0.5);
        expect(r.pairBottom, JSON.stringify(input)).toBeLessThanOrEqual(regionTop + room + 0.5);
        if (firstTop >= regionTop + ASK_GAP && firstTop + span <= regionTop + room - ASK_GAP) {
          stays++;
          expect(r.delta, '숨 쉴 틈까지 안에 있으면 그대로').toBe(0);
        }
      } else {
        overs++;
        expect(r.pairBottom, JSON.stringify(input)).toBeCloseTo(regionTop + room, 5); // 못 들어가면 포커스 버튼이 가장자리 아래에 닿는다
        expect(r.firstTop, JSON.stringify(input)).toBeLessThan(regionTop);
      }
    }
    expect(fits, '공허 통과 방지').toBeGreaterThan(5000);
    expect(overs).toBeGreaterThan(2000);
    expect(stays).toBeGreaterThan(200);
  });

  it('입력이 유한하지 않으면(NaN·무한) 스크롤하지 않는다. 0.5px 미만의 어긋남은 무시한다', () => {
    expect(askFitDelta({ firstTop: Number.NaN, focusedBottom: 100, regionTop: 0, regionBottom: 500 })).toBe(0);
    expect(askFitDelta({ firstTop: 10, focusedBottom: Number.POSITIVE_INFINITY, regionTop: 0, regionBottom: 500 })).toBe(0);
    expect(askFitDelta({ firstTop: 10, focusedBottom: 100, regionTop: Number.NaN, regionBottom: 500 })).toBe(0);
    expect(askFitDelta({ firstTop: 11.7, focusedBottom: 200, regionTop: 0, regionBottom: 500, gap: 12 })).toBe(0);
  });
});

describe('화면이 이 맞춤을 실제로 걸었다', () => {
  it('LifeScreen: 두 감시자에 같은 판정 ref를 넘기고, 훅은 그 뒤에 부르며, 열 때 기본 포커스 스크롤을 막는다(안내문을 밀어내지 않게)', () => {
    expect(lifeScreenSrc).toContain('const forceRelease = useForceReleaseRef();');
    expect(lifeScreenSrc).toContain('useBottomBar(controlsRef, forceRelease)');
    expect(lifeScreenSrc).toContain('useStickyHead(headRef, controlsRef, forceRelease)');
    expect(lifeScreenSrc).toMatch(/useExitAskFit\(forceRelease, exitOpen, \{[^}]*titleRef: exitTitleRef[^}]*cancelRef: exitCancelRef[^}]*\}, \[bottomBar, stickyHead\]\)/);
    const hooks = ['useForceReleaseRef()', 'useBottomBar(controlsRef, forceRelease)', 'useStickyHead(headRef, controlsRef, forceRelease)', 'useExitAskFit('].map((s) => lifeScreenSrc.indexOf(s));
    expect(hooks.every((i) => i >= 0)).toBe(true);
    expect([...hooks].sort((a, b) => a - b), '판정 ref → 감시자 둘 → 맞춤 훅 순서').toEqual(hooks);
    expect(lifeScreenSrc).toContain('exitCancelRef.current?.focus({ preventScroll: true });');
    expect(lifeScreenSrc).not.toMatch(/exitCancelRef\.current\?\.focus\(\)/);
    // 안내문 첫 줄(제목 문단)에 ref와 테스트 id
    expect(lifeScreenSrc).toMatch(/<p className="exit-ask__title"[^>]*data-testid="exit-ask-title" ref=\{exitTitleRef\}>/);
    expect(lifeScreenSrc).toMatch(/<div className="exit-ask"[^>]*ref=\{exitBoxRef\}>/);
  });

  it('룰렛·출생신고 띠는 판정 ref를 넘기지 않는다 (동작이 그대로 — 절반 규칙뿐)', () => {
    expect(rouletteSrc).toContain('useBottomBar(barRef);');
    expect(birthSrc).toContain('useBottomBar(barRef);');
  });

  it('감시자 둘이 forceRelease와 refresh를 받는다: 절반 규칙 OR 사정, 판정 함수는 작은 뷰포트 높이를 받는다', () => {
    expect(headReleaseSrc).toContain('shouldReleaseHead(headHeight, barHeight, view) || (options.forceRelease?.(view) ?? false)');
    expect(headReleaseSrc).toContain('refresh: apply');
    expect(useBottomBarSrc).toContain('forceRelease: (vh) => forceRelease?.current?.(vh) ?? false');
    expect(useBottomBarSrc).toContain('return useMemo(() => ({ refresh: () => watchRef.current?.refresh() }), []);');
  });

  it('맞춤 훅: 열 때 layout effect에서 다시 재고(첫 그림 전) 맞추며, 창 크기는 폭·작은 뷰포트 높이가 바뀔 때만 따라간다(주소창 접힘 무시) — 닫으면 관찰을 걷는다', () => {
    expect(exitAskSrc).toContain('useIsoLayoutEffect(() => {');
    expect(exitAskSrc).toContain('new ResizeObserver(settleLater)');
    expect(exitAskSrc).toContain('if (width === lastWidth && view === lastView) return;');
    expect(exitAskSrc).toContain('createSmallViewport()');
    expect(exitAskSrc).toContain('observer?.disconnect();');
    expect(exitAskSrc).toContain("window.removeEventListener('resize', onResize);");
    // 포커스는 옮기지 않는다 (이미 「돌아가기」에 있다 — 포커스 유지)
    expect(exitAskSrc.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1')).not.toMatch(/\.focus\(/);
  });

  it('BAR_FIXED_MEDIA는 dash.css에서 진행 줄을 화면 아래에 고정하는 미디어 쿼리와 같다', async () => {
    const spec = 'node:fs';
    const fs = (await import(/* @vite-ignore */ spec)) as { readFileSync(path: URL, encoding: 'utf-8'): string };
    const css = fs.readFileSync(new URL('../src/styles/dash.css', import.meta.url), 'utf-8');
    expect(BAR_FIXED_MEDIA).toBe('(max-width: 959px)');
    // 진행 줄 고정(.controls-fixed { position: fixed })이 같은 미디어 쿼리 블록 안에 있다
    const block = css.slice(css.indexOf(`@media ${BAR_FIXED_MEDIA} {`));
    expect(block.length).toBeGreaterThan(0);
    expect(block.slice(0, block.indexOf('@media (max-width: 359px)'))).toContain('.controls-fixed { position: fixed;');
  });
});
