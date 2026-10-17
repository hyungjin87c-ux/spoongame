import type { Page } from '@playwright/test';
import { measureTextResize, textResizeViolations, type TextResizeMeasure } from './textResize';

/**
 * 대시보드의 고정 요소 측정 (SPEC-003 CM10·CM11, design-system.md 11절). 두 고정 요소가 있다:
 *  - 헤더(`dash-head`): 위에 붙는 sticky. 높이 + (화면 아래에 고정된 진행 줄 높이)가 작은 뷰포트 높이의 절반을 넘으면 `html.head-released`로 풀려 `position: static`이 된다.
 *  - 진행 줄(`controls`): 모바일(폭 < 960)에서 화면 아래에 fixed. 높이가 절반을 넘으면 `html.bar-released`로 풀려 본문 끝에 놓인다. 데스크톱은 처음부터 static(위쪽 도구 줄 옆).
 * 규칙은 구현(ui/headRelease.ts·ui/barRelease.ts)의 함수를 부르지 않고 여기서 다시 쓴 독립 기준이다 — 작은 뷰포트 높이는 헤드리스에서 `innerHeight`와 같다.
 * 나가기 확인 단계(`exit-ask`)가 열려 있으면 풀리는 이유가 하나 더 있다(QA-003-M4 O03, ui/exitAsk.ts): 안내문 첫 줄부터 「돌아가기」 링 끝까지의 구간 + (원래 규칙대로 고정될) 헤더 + (모바일이면 고정될) 진행 줄 > 뷰포트 높이면
 * 두 고정 요소가 함께 풀린다 — 구간이 고정 요소에 가려 안 보이는 것을 막으려는 해제다. 이 기준도 여기서 따로 다시 썼다(`askNeedsRoom`; 포커스 링 두께는 아래 evaluate 안의 7px).
 */

export interface DashButton {
  id: string;
  height: number;
  width: number;
  /** 한가운데에서 맞는 요소가 그 버튼(또는 안쪽)인가 */
  hit: boolean;
  inViewport: boolean;
}

export interface DashMeasure {
  vw: number;
  vh: number;
  head: { height: number; position: string; releasedClass: boolean } | null;
  bar: { height: number; ratio: number; position: string; releasedClass: boolean } | null;
  /** 나가기 확인 단계가 열려 있으면 안내문 첫 줄 위끝부터 「돌아가기」 링 아래끝까지의 높이(px), 닫혀 있으면 null */
  ask: { span: number } | null;
  /** 진행 줄 버튼(pause·speed-N·skip·auto)과 도구 줄 버튼(tool-*) — 누를 수 있는 크기·눌리는 자리·화면 안 */
  buttons: DashButton[];
  generic: TextResizeMeasure;
}

/** 글자 확대·창 크기를 바꾼 직후에는 높이 변수와 해제 판정이 정착할 때까지 기다린다 */
export async function settleDash(page: Page): Promise<void> {
  await page
    .waitForFunction(
      () => {
        const head = document.querySelector('[data-testid="dash-head"]') as HTMLElement | null;
        const bar = document.querySelector('[data-testid="controls"]') as HTMLElement | null;
        if (head === null || bar === null) return true;
        const root = document.documentElement;
        const barFixed = ['fixed', 'sticky'].includes(getComputedStyle(bar).position);
        const view = window.innerHeight;
        const mobile = window.innerWidth < 960; // 진행 줄이 하단 고정 대상인 폭
        // 나가기 확인 단계가 열려 있으면 구간(안내문 첫 줄 ~ 「돌아가기」 링 끝) + 헤더 + (모바일이면) 진행 줄이 화면에 못 들어갈 때도 풀린다(O03)
        const title = document.querySelector('[data-testid="exit-ask-title"]');
        const cancel = document.querySelector('[data-testid="exit-no"]');
        // 원래 규칙으로 이미 풀릴 요소는 자리를 차지하지 않는 것으로 센다: 진행 줄은 절반을 넘으면, 헤더는 (헤더 + 고정될 진행 줄)이 절반을 넘으면
        const barDefaultFixed = mobile && bar.offsetHeight <= view * 0.5 ? bar.offsetHeight : 0;
        const headDefaultSticky = head.offsetHeight + barDefaultFixed <= view * 0.5 ? head.offsetHeight : 0;
        const askRoom = title !== null && cancel !== null && cancel.getBoundingClientRect().bottom + 7 - title.getBoundingClientRect().top + headDefaultSticky + barDefaultFixed > view;
        const wantBarReleased = bar.offsetHeight > view * 0.5 || askRoom;
        const wantHeadReleased = head.offsetHeight + (barFixed ? bar.offsetHeight : 0) > view * 0.5 || askRoom;
        const barOk = !mobile || root.classList.contains('bar-released') === wantBarReleased;
        return root.style.getPropertyValue('--head-h') === `${head.offsetHeight}px` && root.classList.contains('head-released') === wantHeadReleased && barOk;
      },
      undefined,
      { timeout: 5_000 },
    )
    .catch(() => undefined); // 정착하지 않으면 그 상태를 그대로 재서 규칙 위반으로 알린다
}

export async function measureDash(page: Page): Promise<DashMeasure> {
  await settleDash(page);
  const generic = await measureTextResize(page);
  const dash = await page.evaluate(() => {
    const root = document.documentElement;
    const vh = window.innerHeight;
    const headEl = document.querySelector('[data-testid="dash-head"]') as HTMLElement | null;
    const barEl = document.querySelector('[data-testid="controls"]') as HTMLElement | null;
    const askTitle = document.querySelector('[data-testid="exit-ask-title"]');
    const askCancel = document.querySelector('[data-testid="exit-no"]');
    const ask = askTitle !== null && askCancel !== null ? { span: askCancel.getBoundingClientRect().bottom + 7 - askTitle.getBoundingClientRect().top } : null;
    const barPosition = barEl === null ? 'none' : getComputedStyle(barEl).position;
    const barFixed = ['fixed', 'sticky'].includes(barPosition);
    const buttons = [...document.querySelectorAll<HTMLElement>('[data-testid="controls"] button, [data-testid="tools"] button, [data-testid="tools"] a')].map((b) => {
      // 고정이 아닌 줄(풀렸거나 데스크톱)은 버튼마다 화면 안으로 스크롤한 뒤 잰다
      if (!(barFixed && barEl!.contains(b))) b.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      const r = b.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return { id: b.getAttribute('data-testid') ?? (b.getAttribute('data-speed') ? `speed-${b.getAttribute('data-speed')}` : b.tagName), height: r.height, width: r.width, hit: hit !== null && (b === hit || b.contains(hit)), inViewport: r.top >= -0.5 && r.bottom <= vh + 0.5 };
    });
    window.scrollTo(0, 0);
    return {
      vw: root.clientWidth,
      vh,
      head: headEl === null ? null : { height: headEl.getBoundingClientRect().height, position: getComputedStyle(headEl).position, releasedClass: root.classList.contains('head-released') },
      bar: barEl === null ? null : { height: barEl.getBoundingClientRect().height, ratio: barEl.getBoundingClientRect().height / vh, position: barPosition, releasedClass: root.classList.contains('bar-released') },
      ask,
      buttons,
    };
  });
  return { ...dash, generic };
}

/** 측정 결과를 규칙에 맞춰 위반 목록으로 (비어 있으면 통과) */
export function dashViolations(m: DashMeasure, label: string): string[] {
  const out = textResizeViolations(m.generic, label);
  if (m.head === null || m.bar === null) return [...out, `${label}: 헤더나 진행 줄이 없다`];
  const barFixed = ['fixed', 'sticky'].includes(m.bar.position);
  const barHeightCounted = barFixed ? m.bar.height : 0;
  // 나가기 확인 단계: 구간 + 헤더 + (모바일이면) 진행 줄이 화면에 못 들어가면 두 고정 요소를 함께 푼다(O03). 확인 단계가 닫혀 있으면 이 이유는 없다.
  const barDefaultFixed = m.vw < 960 && m.bar.height <= m.vh * 0.5 ? m.bar.height : 0; // 원래 규칙으로 이미 풀릴 요소는 자리를 차지하지 않는 것으로 센다
  const headDefaultSticky = m.head.height + barDefaultFixed <= m.vh * 0.5 ? m.head.height : 0;
  const askRoom = m.ask !== null && m.ask.span + headDefaultSticky + barDefaultFixed > m.vh;
  // 진행 줄: 고정이면 ≤ 절반(이고 확인 단계가 자리를 요구하지 않음), 절반을 넘거나 확인 단계가 자리를 요구하면 풀림(QM2-12·O03). 모바일에서만 고정 대상이다 — 데스크톱(static)은 해제 판정과 무관하다.
  if (m.vw < 960) {
    if (barFixed && m.bar.ratio > 0.5 + 1e-6) out.push(`${label}: 고정된 진행 줄 ${Math.round(m.bar.height)}px가 화면 높이(${m.vh})의 ${(m.bar.ratio * 100).toFixed(0)}% — 절반을 넘는데 풀리지 않았다`);
    if (barFixed && askRoom) out.push(`${label}: 나가기 확인 단계 구간 ${Math.round(m.ask!.span)}px + 헤더 ${Math.round(m.head.height)}px + 진행 줄 ${Math.round(m.bar.height)}px가 화면 높이(${m.vh})를 넘는데 진행 줄이 고정이다`);
    if (!barFixed && m.bar.ratio <= 0.5 + 1e-6 && !askRoom) out.push(`${label}: 진행 줄 ${Math.round(m.bar.height)}px가 화면 높이의 ${(m.bar.ratio * 100).toFixed(0)}%로 절반 이하인데 고정이 풀렸다`);
    if (barFixed === m.bar.releasedClass) out.push(`${label}: 진행 줄 position(${m.bar.position})과 bar-released 클래스(${m.bar.releasedClass})가 어긋난다`);
  }
  // 헤더: 헤더 + 고정된 진행 줄이 절반을 넘으면 풀림
  const wantHeadReleased = m.head.height + barHeightCounted > m.vh * 0.5 || askRoom;
  const headStatic = !['fixed', 'sticky'].includes(m.head.position);
  if (wantHeadReleased !== headStatic) out.push(`${label}: 헤더 ${Math.round(m.head.height)}px + 고정 진행 줄 ${Math.round(barHeightCounted)}px = ${Math.round(m.head.height + barHeightCounted)}px (화면 ${m.vh}px의 절반 ${m.vh / 2}px) — ${wantHeadReleased ? '풀려야 하는데 고정이다' : '고정이어야 하는데 풀렸다'}`);
  if (m.head.releasedClass !== headStatic) out.push(`${label}: 헤더 position(${m.head.position})과 head-released 클래스(${m.head.releasedClass})가 어긋난다`);
  // 버튼: 누를 수 있는 크기와 자리
  if (m.buttons.length < 12) out.push(`${label}: 진행 줄·도구 줄 버튼이 ${m.buttons.length}개뿐이다(12개여야 한다)`);
  for (const b of m.buttons) {
    if (b.height < 44 - 0.5) out.push(`${label}: ${b.id} 높이 ${Math.round(b.height)}px < 44px`);
    if (!b.hit) out.push(`${label}: ${b.id} 한가운데에서 다른 요소가 눌린다`);
    if (!b.inViewport) out.push(`${label}: ${b.id}가 화면 밖에 있다`);
  }
  return out;
}
