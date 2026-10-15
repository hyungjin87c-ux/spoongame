import { describe, expect, it } from 'vitest';
import { edgeInsets, grow, judgeFocus, overlapArea, pickRing, type FixedBox, type FocusSample, type RingCandidate } from '../e2e/focusGeometry';
import { STANDARD_VIEWPORTS } from '../e2e/viewports';

/**
 * 「고정 요소가 키보드 포커스를 가리지 않는다」(SPEC-003 CM10, QM2-1)의 판정 규칙을 검사한다 — e2e/focusGeometry.ts의 순수 계산.
 * 브라우저에서 잰 값은 e2e/focus-not-obscured.spec.ts가 이 규칙에 넣는다. 여기서는 규칙 자체가 (1) QA가 잡은 실패 숫자를 실패로 보고
 * (2) 예외 둘을 인정하고 (3) 공허 통과하지 않는지를 직접 만든 측정값으로 본다 — 판정기가 아무것도 못 잡으면 e2e 전체가 의미가 없다.
 */

const bar = (top: number, height: number, _viewportHeight: number, over: Partial<FixedBox> = {}): FixedBox => ({
  id: 'bottom-bar',
  position: 'fixed',
  containsFocus: false,
  box: { left: 0, right: 360, top, bottom: top + height },
  ...over,
});

const sample = (over: Partial<FocusSample> = {}): FocusSample => ({
  id: 'era-present',
  isBody: false,
  box: { left: 16, right: 344, top: 200, bottom: 280 },
  ring: 5,
  viewport: { width: 360, height: 740 },
  fixed: [bar(672, 68, 740)],
  centerHit: true,
  ...over,
});

describe('overlapArea·grow', () => {
  it('겹친 면적을 잰다: 안 겹치면 0, 닿기만 하면 0, 겹치면 가로×세로', () => {
    const a = { left: 0, top: 0, right: 10, bottom: 10 };
    expect(overlapArea(a, { left: 20, top: 0, right: 30, bottom: 10 })).toBe(0);
    expect(overlapArea(a, { left: 10, top: 0, right: 20, bottom: 10 })).toBe(0); // 변만 닿음
    expect(overlapArea(a, { left: 5, top: 7, right: 15, bottom: 20 })).toBe(5 * 3);
  });
  it('grow는 네 방향으로 같은 만큼 키운다', () => {
    expect(grow({ left: 10, top: 20, right: 30, bottom: 40 }, 5)).toEqual({ left: 5, top: 15, right: 35, bottom: 45 });
  });
});

describe('judgeFocus: 가려진 포커스를 실패로 본다 (QM2-1 규칙 2)', () => {
  it('띠 위에 완전히 보이면 통과', () => {
    const j = judgeFocus(sample());
    expect(j.violations).toEqual([]);
    expect(j.tooTall).toBe(false);
  });

  it('QA 실측 실패 1 — 360×740 첫 Tab: 「지금 세상」 카드 667~743이 띠 위끝 672에 가려진다 (M2-N14)', () => {
    const j = judgeFocus(sample({ box: { left: 16, right: 344, top: 667, bottom: 743 }, ring: 0 }));
    expect(j.violations.join('\n')).toContain('가려진다');
    expect(j.obscuredBy).toEqual(['bottom-bar']);
    expect(j.violations.join('\n')).toContain('아래로 나갔다'); // 743 > 740
  });

  it('QA 실측 실패 2·3 — 320×568 「약 30분」 486~561 vs 띠 500, 1280×800 716~792 vs 732', () => {
    const small = judgeFocus(sample({ viewport: { width: 320, height: 568 }, box: { left: 16, right: 304, top: 486, bottom: 561 }, fixed: [bar(500, 68, 568, { box: { left: 0, right: 320, top: 500, bottom: 568 } })] }));
    expect(small.obscuredBy).toEqual(['bottom-bar']);
    const wide = judgeFocus(sample({ viewport: { width: 1280, height: 800 }, box: { left: 100, right: 700, top: 716, bottom: 792 }, fixed: [bar(732, 68, 800, { box: { left: 0, right: 1280, top: 732, bottom: 800 } })] }));
    expect(wide.obscuredBy).toEqual(['bottom-bar']);
  });

  it('포커스 링(outline + offset)까지 포함해 판정한다: 요소는 띠 위지만 링이 띠에 1px 닿으면 실패', () => {
    // 요소 아래끝 668 + 링 5 = 673 > 띠 위끝 672
    expect(judgeFocus(sample({ box: { left: 16, right: 344, top: 600, bottom: 668 }, ring: 5 })).obscuredBy).toEqual(['bottom-bar']);
    expect(judgeFocus(sample({ box: { left: 16, right: 344, top: 600, bottom: 667 }, ring: 5 })).violations).toEqual([]); // 672에서 딱 맞게 끝나면 통과(닿기만)
  });

  it('위쪽 링이 화면 위로 삐져나가도 실패 (Shift+Tab으로 올라올 때)', () => {
    const j = judgeFocus(sample({ box: { left: 16, right: 344, top: 0, bottom: 80 }, ring: 5 }));
    expect(j.violations.join('\n')).toContain('위로 나갔다');
  });

  it('보이는 부분 한가운데에서 다른 요소가 덮고 있으면 실패, 보이는 부분이 없으면 실패', () => {
    expect(judgeFocus(sample({ centerHit: false })).violations.join('\n')).toContain('elementFromPoint');
    expect(judgeFocus(sample({ centerHit: null })).violations.join('\n')).toContain('보이는 부분이 없다');
  });

  it('포커스가 body에 있으면 실패 (포커스를 받은 요소가 없다)', () => {
    expect(judgeFocus(sample({ isBody: true })).violations.join('\n')).toContain('body');
  });

  it('고정 요소를 하나도 모으지 못해도 판정은 돈다 — 겹침이 없으니 통과하지만, e2e가 「고정 요소가 모였다」를 따로 단언한다', () => {
    expect(judgeFocus(sample({ fixed: [] })).violations).toEqual([]);
  });
});

describe('judgeFocus: 예외 둘 (QM2-1 규칙 3)', () => {
  it('예외 ① 고정 요소 자신과 그 안의 요소는 가려진 것이 아니다 (띠의 「태어나기」 버튼)', () => {
    const j = judgeFocus(sample({ id: 'start-birth', box: { left: 16, right: 344, top: 678, bottom: 730 }, fixed: [bar(672, 68, 740, { containsFocus: true })] }));
    expect(j.violations).toEqual([]);
  });

  it('예외 ① 은 다른 고정 요소에는 적용되지 않는다: 띠 안의 버튼이어도 겹친 다른 고정 요소가 있으면 실패', () => {
    const toast: FixedBox = { id: 'toast', position: 'fixed', containsFocus: false, box: { left: 0, right: 360, top: 700, bottom: 740 } };
    const j = judgeFocus(sample({ box: { left: 16, right: 344, top: 678, bottom: 730 }, fixed: [bar(672, 68, 740, { containsFocus: true }), toast] }));
    expect(j.obscuredBy).toEqual(['toast']);
  });

  it('예외 ② 가용 높이(화면 − 띠)보다 큰 요소는 위쪽 변과 링이 가용 영역 안에서 시작하면 통과 — 아래 부분이 띠 밑으로 이어져도 된다 (↓·PageDown으로 닿는다)', () => {
    // 360×568, 띠 68 → 가용 500. 슬라이드 영역 563 + 링
    const base = { id: 'carousel-viewport', viewport: { width: 360, height: 568 }, ring: 7, fixed: [bar(500, 68, 568)] };
    const ok = judgeFocus(sample({ ...base, box: { left: 16, right: 344, top: 12, bottom: 575 } }));
    expect(ok.tooTall).toBe(true);
    expect(ok.violations).toEqual([]);
  });

  it('예외 ② 라도 위쪽 변이 화면 위로 나가 있으면 실패 (QA 확인 전 구현: 위쪽 링 −94)', () => {
    const j = judgeFocus(sample({ id: 'carousel-viewport', viewport: { width: 360, height: 568 }, ring: 7, fixed: [bar(500, 68, 568)], box: { left: 16, right: 344, top: -87, bottom: 476 } }));
    expect(j.tooTall).toBe(true);
    expect(j.violations.join('\n')).toContain('위 고정 요소');
  });

  it('예외 ② 라도 위쪽 변이 띠 밑에 있으면 실패 (가용 영역에 보이는 부분이 없다)', () => {
    const j = judgeFocus(sample({ id: 'carousel-viewport', viewport: { width: 360, height: 568 }, ring: 7, fixed: [bar(500, 68, 568)], box: { left: 16, right: 344, top: 520, bottom: 1083 } }));
    expect(j.violations.length).toBeGreaterThan(0);
  });
});

describe('edgeInsets: 가용 높이를 줄이는 「띠」만 센다', () => {
  const viewport = { width: 1280, height: 800 };
  it('폭이 화면의 절반 이상이고 가장자리에 붙은 고정 요소만: 아래 띠 68, 위 띠 0', () => {
    expect(edgeInsets({ viewport, fixed: [bar(732, 68, 800, { box: { left: 0, right: 1280, top: 732, bottom: 800 } })] })).toEqual({ top: 0, bottom: 68 });
  });
  it('오른쪽 열에만 있는 따라다니는 카드(sticky)는 띠가 아니다', () => {
    const aside: FixedBox = { id: 'ASIDE.title__side', position: 'sticky', containsFocus: false, box: { left: 756, right: 1184, top: 18, bottom: 600 } };
    expect(edgeInsets({ viewport, fixed: [aside] })).toEqual({ top: 0, bottom: 0 });
  });
  it('위에 붙은 전체 폭 고정 헤더는 위 가용 높이를 줄인다 (앞으로 M4 대시보드)', () => {
    const header: FixedBox = { id: 'dash-header', position: 'fixed', containsFocus: false, box: { left: 0, right: 1280, top: 0, bottom: 64 } };
    expect(edgeInsets({ viewport, fixed: [header] })).toEqual({ top: 64, bottom: 0 });
    // 위 헤더에 가려진 포커스(Shift+Tab 때)도 잡는다
    const j = judgeFocus({ id: 'x', isBody: false, box: { left: 10, right: 200, top: 20, bottom: 60 }, ring: 5, viewport, fixed: [header], centerHit: true });
    expect(j.obscuredBy).toEqual(['dash-header']);
  });
});

describe('공통 뷰포트 목록 STANDARD_VIEWPORTS (QM2-1 완료 기준 a)', () => {
  it('11종이고 이름이 겹치지 않는다', () => {
    expect(STANDARD_VIEWPORTS).toHaveLength(11);
    expect(new Set(STANDARD_VIEWPORTS.map((v) => v.name)).size).toBe(11);
  });
  it('명세의 크기 그대로: 320×568, 360×568, 360×740(터치), 375×812, 667×375, 768×1024, 1024×768, 1280×620, 1280×800 + 확대 상당 640×400, 320×256', () => {
    const sizes = STANDARD_VIEWPORTS.map((v) => `${v.width}x${v.height}`);
    expect(sizes).toEqual(['320x568', '360x568', '360x740', '375x812', '667x375', '768x1024', '1024x768', '1280x620', '1280x800', '640x400', '320x256']);
    expect(STANDARD_VIEWPORTS.filter((v) => v.touch).map((v) => `${v.width}x${v.height}`)).toEqual(['360x740']);
    expect(STANDARD_VIEWPORTS.filter((v) => v.zoom).map((v) => `${v.width}x${v.height}`)).toEqual(['640x400', '320x256']);
  });
});

describe('pickRing: 눈에 보이는 링을 그리는 요소로 상자를 잰다 (REV-003-M2-3 R-232)', () => {
  /** 라디오 카드: label(보이는 링, 3px + 2px)과 그 안을 채우는 투명한 input(opacity 0, 같은 :focus-visible 링 — label의 padding box) */
  const label: RingCandidate = { id: 'label', box: { left: 16, top: 200, right: 344, bottom: 280 }, outlineStyle: 'solid', outlineWidth: 3, outlineOffset: 2, invisible: false };
  const input = (over: Partial<RingCandidate> = {}): RingCandidate => ({
    id: 'era-present',
    box: { left: 19, top: 203, right: 341, bottom: 277 }, // 선택된 카드의 border 3px 안쪽
    outlineStyle: 'solid',
    outlineWidth: 3,
    outlineOffset: 2,
    invisible: true, // opacity 0
    ...over,
  });

  it('라디오 카드: 투명한 input을 건너뛰고 label의 border box + 5(외곽선 3 + 간격 2)를 링으로 잰다 — 첫 외곽선 요소에서 멈추면 label보다 3px 작은 상자였다', () => {
    const pick = pickRing([input(), label]);
    expect(pick.owners).toEqual(['label']);
    expect(grow(pick.box, pick.ring)).toEqual(grow(label.box, 5));
    // 이전 방식(활성 요소에서 가장 가까운 외곽선 요소 = 투명 input): 링 상자가 label 링보다 3px씩 작다
    const old = grow(input().box, 5);
    const want = grow(label.box, 5);
    expect([want.left - old.left, want.top - old.top, want.right - old.right, want.bottom - old.bottom]).toEqual([-3, -3, 3, 3]);
  });

  it('보이는 외곽선 후보가 여럿이면 각자의 링을 포함한 상자의 합집합이다 (하나라도 가려지면 가림)', () => {
    const inner: RingCandidate = { id: 'inner', box: { left: 30, top: 210, right: 100, bottom: 250 }, outlineStyle: 'solid', outlineWidth: 2, outlineOffset: 1, invisible: false };
    const pick = pickRing([inner, label]);
    expect(pick.owners).toEqual(['inner', 'label']);
    expect(pick.ring, '합집합 상자가 이미 링을 포함한다').toBe(0);
    expect(pick.box).toEqual({ left: 11, top: 195, right: 349, bottom: 285 });
  });

  it('보이는 링이 없으면(외곽선 후보가 없거나 모두 보이지 않는다 — 브라우저 안에서 opacity 0·visibility hidden·clip·폭 1px 이하를 invisible로 표시한다) 활성 요소 자신(링 0)이다', () => {
    const plain: RingCandidate = { id: 'a', box: { left: 10, top: 10, right: 50, bottom: 40 }, outlineStyle: 'none', outlineWidth: 0, outlineOffset: 0, invisible: false };
    for (const hidden of [{ invisible: true }]) {
      const pick = pickRing([{ ...plain, outlineStyle: 'solid', outlineWidth: 3, outlineOffset: 2, ...hidden }]);
      expect(pick, '보이지 않는 링만 있으면').toEqual({ box: plain.box, ring: 0, owners: ['a'] });
    }
    expect(pickRing([plain])).toEqual({ box: plain.box, ring: 0, owners: ['a'] });
  });

  it('링이 하나뿐이면 그 요소의 border box와 두께(외곽선 + 간격)를 그대로 돌려준다 (일반 버튼·링크)', () => {
    const button: RingCandidate = { id: 'start-birth', box: { left: 16, top: 676, right: 344, bottom: 728 }, outlineStyle: 'solid', outlineWidth: 3, outlineOffset: 2, invisible: false };
    expect(pickRing([button, { ...button, id: 'bottom-bar', outlineStyle: 'none' }])).toEqual({ box: button.box, ring: 5, owners: ['start-birth'] });
    // 간격이 음수인 안쪽 외곽선은 0 아래로 내려가지 않는다
    expect(pickRing([{ ...button, outlineOffset: -4 }]).ring).toBe(0);
  });
});
