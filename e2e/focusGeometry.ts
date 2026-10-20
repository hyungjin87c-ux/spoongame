/**
 * 「고정 요소가 키보드 포커스를 가리지 않는다」(SPEC-003 CM10, QM2-1)의 판정 규칙 — 순수 계산이라 Playwright 없이 단위 테스트한다(tests/focusGeometry.test.ts).
 * 측정(브라우저 안)은 e2e/focusObscured.ts가 하고, 이 파일은 측정값(FocusSample)을 받아 위반을 가려낸다.
 *
 * 규칙 (QM2-1 규칙 2·3):
 *  - 포커스를 받은 요소의 **포커스 링(outline + offset)까지 포함한 상자**가 어떤 고정 요소 상자와도 겹치는 면적이 0이어야 하고, 화면 안(위끝 ≥ 0, 아래끝 ≤ 뷰포트 높이)에 있어야 한다.
 *  - 예외 ① 고정 요소 자신과 그 안의 요소(띠의 「태어나기」 같은 버튼).
 *  - 예외 ② 링 상자가 가용 높이(뷰포트 높이 − 위·아래 고정 띠 높이)보다 커서 한 번에 못 들어가는 요소(키보드 스크롤 영역인 슬라이드 영역 등):
 *    위쪽 변과 링이 가용 영역 안에 보이면 통과(나머지는 그 안에서 ↓·PageDown으로 닿는다).
 *  - 보이는 부분의 한가운데 점에서 `elementFromPoint`가 포커스 요소(또는 그 안·조상)여야 한다(다른 것이 덮고 있지 않다).
 */

export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface FixedBox {
  /** 사람이 읽을 이름(data-testid 또는 태그.클래스) */
  id: string;
  box: Box;
  /** 계산된 position */
  position: 'fixed' | 'sticky';
  /** 포커스된 요소가 이 고정 요소 자신이거나 그 안에 있다(예외 ①) */
  containsFocus: boolean;
}

/** 브라우저 안에서 잰, 포커스된 요소 하나의 측정값 */
export interface FocusSample {
  /** 포커스된 요소의 이름(data-testid 또는 태그[글자]) */
  id: string;
  /** 포커스가 body(또는 문서)에 있다 — 포커스를 받은 요소가 없다 */
  isBody: boolean;
  /** 포커스 링을 그리는 요소의 border box (라디오 카드처럼 링이 부모에 그려지면 그 부모, 링을 그리는 요소가 여럿이면 각자의 링까지 포함한 합집합 — `pickRing`) */
  box: Box;
  /** 링이 상자 밖으로 나오는 두께 = outline-width + outline-offset (링이 없으면 0). 링을 그리는 요소가 여럿이면 합집합 상자가 이미 링을 포함하므로 0 */
  ring: number;
  /** 링을 그리는 것으로 본 요소들의 이름 (디버깅·검증용) */
  owners?: string[];
  viewport: { width: number; height: number };
  fixed: FixedBox[];
  /** 보이는 부분 한가운데 점의 elementFromPoint가 포커스 요소(또는 그 안·조상)인가. null = 가용 영역 안에 보이는 부분이 없다 */
  centerHit: boolean | null;
}

export interface FocusJudgement {
  /** 위반 설명(빈 배열이면 통과) */
  violations: string[];
  /** 예외 ②(가용 높이보다 큰 요소)로 판정했다 */
  tooTall: boolean;
  /** 링 상자와 겹친 고정 요소 이름 */
  obscuredBy: string[];
}

const EPS = 0.5;

/**
 * 문서의 스크롤 위치는 정수 픽셀이라, 브라우저가 요소를 스크롤 여백 쪽에 붙여도(요소가 가용 영역보다 거의 꽉 찰 때) 소수 위치에서 가장 가까운 정수 칸으로 반올림되어 최대 0.5px 어긋난다 —
 * 그 어긋남으로 생긴 0.5px 미만의 겹침은 가림이 아니다(사람 눈에 안 보이고, 스크롤로 없앨 수도 없다). 겹침을 잴 때만 링 상자를 이만큼 줄여서 본다.
 * (SPEC-005 QI6: 첫 화면 설정 줄에 「무거운 장면 가리기」 스위치가 더해지며 360×740 「이어하기」 상태의 슬라이드 영역이 이 경계에 걸렸다 — 링 아래끝 620.37 대 띠 위끝 620. 0.5px 이상 겹치면 여전히 위반이다 — 기존 시험의 1px 겹침도 그대로 잡힌다.)
 */
export const SCROLL_ROUNDING = 0.5;

export const widthOf = (b: Box): number => b.right - b.left;
export const heightOf = (b: Box): number => b.bottom - b.top;

/** 포커스 링을 그릴 수 있는 후보 하나: 활성 요소 또는 그 조상의 측정값 */
export interface RingCandidate {
  id: string;
  /** border box */
  box: Box;
  outlineStyle: string;
  outlineWidth: number;
  outlineOffset: number;
  /** 눈에 보이지 않는다: display none·visibility hidden·불투명도 0(조상 포함)·clip·폭 또는 높이 ≤ 1px — 이런 요소의 외곽선은 그려져도 사람 눈에 보이는 링이 아니다 */
  invisible: boolean;
}

/**
 * 활성 요소와 조상의 후보들에서 **눈에 보이는 링**의 상자를 고른다 (REV-003-M2-3 R-232).
 * 라디오 카드는 숨은 input(opacity 0, label 안쪽을 채운다)이 `:focus-visible`로 외곽선을 가지고 있지만 사람이 보는 링은 label의 `:focus-within` 외곽선이다 —
 * 「링을 가진 첫 요소」를 고르면 투명한 input(label의 padding box)에서 멈춰 실제 링보다 border 두께만큼(선택된 카드는 3px) 작은 상자를 쟀다.
 * 그래서 보이지 않는 후보는 건너뛰고, 보이는 후보가 여럿이면 각자의 링을 포함한 상자의 합집합으로 잰다(하나라도 가려지면 가림). 보이는 링이 없으면 활성 요소 자신(링 0)이다.
 */
export function pickRing(chain: readonly RingCandidate[]): { box: Box; ring: number; owners: string[] } {
  const ringOf = (c: RingCandidate): number => Math.max(0, c.outlineWidth + c.outlineOffset);
  const owners = chain.filter((c) => c.outlineStyle !== 'none' && c.outlineWidth > 0 && !c.invisible);
  if (owners.length === 0) return { box: chain[0].box, ring: 0, owners: [chain[0].id] };
  if (owners.length === 1) return { box: owners[0].box, ring: ringOf(owners[0]), owners: [owners[0].id] };
  const grown = owners.map((c) => grow(c.box, ringOf(c)));
  const union: Box = {
    left: Math.min(...grown.map((b) => b.left)),
    top: Math.min(...grown.map((b) => b.top)),
    right: Math.max(...grown.map((b) => b.right)),
    bottom: Math.max(...grown.map((b) => b.bottom)),
  };
  return { box: union, ring: 0, owners: owners.map((c) => c.id) };
}

export function overlapArea(a: Box, b: Box): number {
  const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
  const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  return w > 0 && h > 0 ? w * h : 0;
}

/** 모든 방향으로 by만큼 키운 상자(음수면 줄인다) */
export function grow(b: Box, by: number): Box {
  return { left: b.left - by, top: b.top - by, right: b.right + by, bottom: b.bottom + by };
}

/**
 * 화면 위·아래 가장자리에 붙은 「띠」가 차지하는 높이: 포커스를 품은 것은 빼고, 폭이 화면의 절반 이상인 고정 요소만 띠로 본다
 * (오른쪽 열에만 붙어 있는 따라다니는 카드 같은 것은 가용 높이를 줄이지 않는다). 위끝이 0에 붙으면 위 띠, 아래끝이 뷰포트 바닥에 붙으면 아래 띠.
 */
export function edgeInsets(s: Pick<FocusSample, 'viewport' | 'fixed'>): { top: number; bottom: number } {
  let top = 0;
  let bottom = 0;
  for (const f of s.fixed) {
    if (f.containsFocus) continue;
    if (widthOf(f.box) < s.viewport.width / 2) continue;
    if (f.box.top <= EPS) top = Math.max(top, f.box.bottom);
    if (f.box.bottom >= s.viewport.height - EPS) bottom = Math.max(bottom, s.viewport.height - f.box.top);
  }
  return { top, bottom };
}

export function judgeFocus(s: FocusSample): FocusJudgement {
  const violations: string[] = [];
  if (s.isBody) {
    return { violations: ['포커스를 받은 요소가 없다(body)'], tooTall: false, obscuredBy: [] };
  }
  const ringBox = grow(s.box, s.ring);
  const insets = edgeInsets(s);
  const available = s.viewport.height - insets.top - insets.bottom;
  const tooTall = heightOf(ringBox) > available + EPS;
  const others = s.fixed.filter((f) => !f.containsFocus);
  const obscuredBy: string[] = [];
  const fmt = (b: Box) => `${Math.round(b.top)}~${Math.round(b.bottom)}`;

  if (!tooTall) {
    for (const f of others) {
      const area = overlapArea(grow(ringBox, -SCROLL_ROUNDING), f.box); // 정수 스크롤로 생기는 0.5px 미만의 겹침은 가림으로 세지 않는다
      if (area > 0) {
        obscuredBy.push(f.id);
        violations.push(`${s.id}: 포커스 링 ${fmt(ringBox)}이(가) 고정 요소 ${f.id}(${fmt(f.box)})에 가려진다 (겹침 ${Math.round(area)}px²)`);
      }
    }
    if (ringBox.top < -EPS) violations.push(`${s.id}: 포커스 링 위끝 ${Math.round(ringBox.top)}이(가) 화면 위로 나갔다`);
    if (ringBox.bottom > s.viewport.height + EPS) violations.push(`${s.id}: 포커스 링 아래끝 ${Math.round(ringBox.bottom)}이(가) 화면(${s.viewport.height}) 아래로 나갔다`);
  } else {
    // 예외 ②: 위쪽 변과 링이 가용 영역 안에서 시작해야 한다(아래는 안에서 스크롤)
    if (ringBox.top < insets.top - EPS) violations.push(`${s.id}(가용 높이보다 큼): 위쪽 링 ${Math.round(ringBox.top)}이(가) 위 고정 요소(${Math.round(insets.top)}) 밑으로 들어갔다`);
    if (ringBox.top > s.viewport.height - insets.bottom - EPS) violations.push(`${s.id}(가용 높이보다 큼): 위쪽 링 ${Math.round(ringBox.top)}이(가) 아래 고정 요소(${Math.round(s.viewport.height - insets.bottom)}) 밑에 있다`);
    // 위쪽 변이 보이더라도 거의 안 보이는 것은 의미가 없다 — 가용 영역에 최소 24px은 들어와야 한다
    const visibleTop = Math.min(ringBox.bottom, s.viewport.height - insets.bottom) - Math.max(ringBox.top, insets.top);
    if (visibleTop < Math.min(24, available) - EPS) violations.push(`${s.id}(가용 높이보다 큼): 가용 영역 안에 보이는 부분이 ${Math.round(visibleTop)}px뿐이다`);
  }

  if (s.centerHit === null) violations.push(`${s.id}: 가용 영역 안에 보이는 부분이 없다`);
  else if (!s.centerHit) violations.push(`${s.id}: 보이는 부분 한가운데에서 다른 요소가 포커스 요소를 덮고 있다(elementFromPoint)`);

  return { violations, tooTall, obscuredBy };
}
