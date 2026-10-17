/**
 * 가용 높이보다 큰 포커스 대상의 위쪽 변을 보이게 한다 (SPEC-003 CM10 예외 ②, QM2-1).
 *
 * 하단에 고정 띠가 있는 화면에서 포커스를 받은 요소는 띠 위(가용 높이 = 화면 높이 − 위·아래 스크롤 여백, 아래 여백이 띠 높이를 담고 있다)에 들어와야 하는데, 요소 자체가 그보다 크면
 * (작은 화면의 통계 슬라이드 영역 등) 한 번에 못 들어간다. 브라우저의 기본 포커스 스크롤은 이때 요소의 아래쪽을 맞추고 위쪽 변·포커스 링을 화면 위로 보내므로
 * (키보드 사용자는 어디에 포커스가 있는지 잃는다), 키보드로 포커스를 받았을 때 위쪽 변을 화면 위(scroll-padding-top 아래)에 맞춘다. 나머지는 거기서 ↓·PageDown(문서 스크롤)으로 닿는다.
 *
 * - 마우스·터치로 눌러 생긴 포커스(`:focus-visible`이 아님)는 건드리지 않는다 — 눌렀는데 화면이 점프하면 안 된다.
 * - `ringExtra`는 포커스 링이 요소 밖으로 나오는 두께(outline-width + offset)다.
 * - `focused`는 포커스를 실제로 받은 요소, `el`은 크기를 재고 스크롤할 요소다. 둘이 다른 경우: 라디오 카드는 투명한 input이 포커스를 받고 사람이 보는 링·크기는 label(카드)이다.
 *   첫 화면은 이 함수를 화면 전체의 `focusin`에서 불러(TitleScreen) 큰 글자(200%)·낮은 화면에서 가용 높이보다 커지는 모든 포커스 대상(라디오 카드·여러 줄 링크·슬라이드 영역)이 같은 규칙을 받는다.
 * - 스크롤 여백은 `<html>`에 거는 `html.has-bottom-bar { scroll-padding-* }`(styles/title.css)에서 읽는다. 띠가 없는 화면에서는 여백이 0이라 화면 높이 전체가 가용 높이다.
 * - 이 파일의 화면 높이(`window.innerHeight`)는 **지금 이 순간 눈에 보이는 영역**이다(포커스가 그 안에 들어와야 하므로) — 하단 띠를 풀지 판정하는 높이(`ui/barRelease.ts`의 작은 뷰포트 높이,
 *   주소창이 접혀도 변하지 않아야 한다 — REV-003-M2-4 R-240)와 일부러 다르다.
 */
export function revealTopOfTallFocus(el: HTMLElement, ringExtra = 7, focused: HTMLElement = el): void {
  if (typeof window === 'undefined') return;
  try {
    if (!focused.matches(':focus-visible')) return;
  } catch {
    return; // :focus-visible을 모르는 환경은 건드리지 않는다
  }
  const style = window.getComputedStyle(document.documentElement);
  const px = (v: string): number => {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  };
  const available = window.innerHeight - px(style.scrollPaddingTop) - px(style.scrollPaddingBottom);
  if (el.getBoundingClientRect().height + ringExtra * 2 > available) el.scrollIntoView({ block: 'start', inline: 'nearest' });
}

/**
 * 풀린 하단 띠(문서 흐름의 맨 끝, QM2-12)에서 포커스를 받은 요소와 확인 단계 안내문의 첫 줄이 **함께** 화면 안에 오게 스크롤한다.
 * 고정된 띠는 늘 화면 아래에 있어 필요 없지만, 풀린 띠는 본문 끝에 있어 확인 단계를 열면(띠가 커지며 고정 → 해제로 바뀌는 경우 포함) 스크롤 아래에 남을 수 있다.
 * 가능하면 둘 다 보이게 하고(띠가 화면보다 크면 안내문 첫 줄을 우선한다 — 무엇을 묻는지 보여야 한다), 스크롤 여백(`html.bar-released`의 12px)과 포커스 링(최대 7px)을 지킨다.
 * `first`는 맨 위에 보여야 하는 요소(안내문), `focused`는 아래에 보여야 하는 요소(포커스를 받은 취소 버튼). 둘이 같거나 first가 없으면 focused만 맞춘다.
 */
export function revealWithinReleasedBar(first: Element | null, focused: Element | null, ringExtra = 7): void {
  if (typeof window === 'undefined' || focused === null) return;
  const style = window.getComputedStyle(document.documentElement);
  const px = (v: string): number => {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  };
  const top = px(style.scrollPaddingTop);
  const bottomEdge = window.innerHeight - px(style.scrollPaddingBottom);
  let delta = 0;
  const focusedBottom = focused.getBoundingClientRect().bottom + ringExtra;
  if (focusedBottom > bottomEdge) delta = focusedBottom - bottomEdge; // 아래로 내려 포커스 요소를 보인다
  const focusedTop = focused.getBoundingClientRect().top - ringExtra;
  if (focusedTop - delta < top) delta = focusedTop - top; // 위로 벗어난 경우(요소가 너무 위에 있음)
  if (first !== null && first !== focused) {
    const firstTop = first.getBoundingClientRect().top;
    if (firstTop - delta < top) delta = firstTop - top; // 안내문 첫 줄이 가려지면 거기까지 올린다(안내문이 우선)
  }
  if (Math.abs(delta) >= 0.5) window.scrollBy(0, delta);
}

/**
 * 카드(결정을 기다리는 중대 결정 카드 같은 큰 상자)를 가용 영역(화면 − 위 스크롤 여백(고정 헤더) − 아래 스크롤 여백(고정 띠)) 안에 둔다 (SPEC-003 CM10, M4).
 * 이미 안에 있으면 건드리지 않는다(데스크톱의 3열은 카드가 처음부터 보인다 — 불필요한 점프 없음). 위가 가려졌거나 아래가 띠에 가려지면 카드의 **위쪽**을 가용 영역의 위에 맞춘다 —
 * 카드가 가용 높이보다 커도 위쪽(제목)과 첫 선택지부터 보이고, 나머지는 문서 스크롤로 닿는다. 브라우저 기본 focus() 스크롤은 요소를 화면 가운데로 올려 카드 아래쪽이 띠 밑으로 밀릴 수 있어 대신 쓴다.
 */
export function revealCard(el: Element): void {
  if (typeof window === 'undefined') return;
  const style = window.getComputedStyle(document.documentElement);
  const px = (v: string): number => {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  };
  const top = px(style.scrollPaddingTop);
  const bottomEdge = window.innerHeight - px(style.scrollPaddingBottom);
  const r = el.getBoundingClientRect();
  if (r.top >= top - 0.5 && r.bottom <= bottomEdge + 0.5) return;
  window.scrollBy({ top: r.top - top, behavior: 'instant' });
}
