import { type Page } from '@playwright/test';
import { edgeInsets, judgeFocus, pickRing, type FocusJudgement, type FocusSample, type RingCandidate } from './focusGeometry';

/**
 * 「고정 요소가 키보드 포커스를 가리지 않는다」(SPEC-003 CM10, QM2-1) 공통 e2e 헬퍼.
 * 화면 하나를 열어 둔 `page`에서 `auditFocus(page)`를 부르면:
 *  1) 화면의 모든 `position: fixed`·`sticky` 요소를 **자동으로** 모은다(이름·클래스를 손으로 나열하지 않는다 → 앞으로 생기는 고정 요소도 자동 포함, 높이도 고정값으로 가정하지 않는다).
 *  2) Tab으로 처음부터 끝까지, 이어서 Shift+Tab으로 처음까지 한 바퀴씩 돌며 **포커스가 바뀔 때마다** 측정한다.
 *  3) 모든 조작 요소에 프로그램 `focus()`를 걸어(화면 전환 뒤 제목·확인 단계 열기/닫기 같은 경로와 같다) 또 측정한다. **라디오 묶음은 Tab 정지점(선택된 하나)만이 아니라 활성 가능한 모든 라디오**에 건다.
 *  3-1) 라디오 묶음마다 **방향키(↓)로 묶음의 모든 라디오를 한 바퀴** 돌며 측정한다(SPEC CM10 규칙 2: Tab·Shift+Tab·방향키·프로그램 focus() — REV-003-M2-3 R-234).
 *  4) 화면의 조작 요소 집합과 순회로 닿은 집합이 같은지 본다(순회가 짧게 끊겨 공허하게 통과하는 일이 없게).
 * 포커스 링의 상자는 **눈에 보이는 링을 그리는 요소**로 잰다(`pickRing`, REV-003-M2-3 R-232): 라디오 카드의 투명한 input(opacity 0)이 아니라 label의 외곽선 — 「링 = label border box + 외곽선 두께 + 간격」.
 * 판정 규칙은 e2e/focusGeometry.ts. 새 화면(룰렛·출생신고·대시보드·카드)의 e2e도 이 헬퍼와 e2e/viewports.ts의 `STANDARD_VIEWPORTS`를 그대로 쓴다.
 */

export interface FocusStop {
  /** 포커스 요소 이름 */
  id: string;
  scrollY: number;
  sample: FocusSample;
  judgement: FocusJudgement;
}

export interface FocusAudit {
  forward: FocusStop[];
  backward: FocusStop[];
  /** 라디오 묶음을 방향키로 돈 경로 (묶음마다 활성 라디오 수만큼) */
  arrow: FocusStop[];
  programmatic: FocusStop[];
  /** 활성 가능한 라디오 전부(DOM 순서) */
  radios: string[];
  /** 화면의 조작 요소(DOM 순서, 라디오 묶음은 하나) */
  tabbables: string[];
  /** 고정/붙은 요소 이름(첫 측정 기준) */
  fixedIds: string[];
  /** 위반 전부(어느 경로의 몇 번째에서 무엇이 가렸는지) */
  violations: string[];
}

interface RawMeasure {
  id: string;
  isBody: boolean;
  /** 활성 요소(chain[0])와 조상 — 링 후보 */
  chain: RingCandidate[];
  viewport: { width: number; height: number };
  fixed: FocusSample['fixed'];
}

/** 브라우저 안에서 지금 포커스를 잰다 (1단계: 링 후보 상자·고정 요소) */
async function measure(page: Page): Promise<RawMeasure> {
  return page.evaluate(() => {
    const label = (el: Element): string => {
      const t = el.getAttribute('data-testid');
      if (t) return t;
      const text = (el.getAttribute('aria-label') ?? el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 24);
      const cls = typeof (el as HTMLElement).className === 'string' && (el as HTMLElement).className ? `.${(el as HTMLElement).className.split(/\s+/)[0]}` : '';
      return `${el.tagName}${cls}${text ? `[${text}]` : ''}`;
    };
    const px = (v: string): number => {
      const n = parseFloat(v);
      return Number.isFinite(n) ? n : 0;
    };
    const active = document.activeElement;
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    const fixed: Array<{ id: string; box: { left: number; top: number; right: number; bottom: number }; position: 'fixed' | 'sticky'; containsFocus: boolean }> = [];
    for (const el of Array.from(document.body.querySelectorAll('*'))) {
      const cs = getComputedStyle(el);
      if (cs.position !== 'fixed' && cs.position !== 'sticky') continue;
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) continue;
      fixed.push({ id: label(el), box: { left: r.left, top: r.top, right: r.right, bottom: r.bottom }, position: cs.position, containsFocus: active !== null && (el === active || el.contains(active)) });
    }
    if (active === null || active === document.body || active === document.documentElement) {
      return { id: '(body)', isBody: true, chain: [], viewport, fixed };
    }
    // 포커스 링을 그릴 수 있는 후보: 활성 요소와 그 조상(body 전까지). 어느 것이 **눈에 보이는** 링을 그리는지는 Node 쪽 pickRing이 고른다
    // (라디오 카드: 투명한 input에도 :focus-visible 외곽선이 있지만 사람이 보는 링은 label의 :focus-within 외곽선이다 — R-232)
    const chain: Array<{ id: string; box: { left: number; top: number; right: number; bottom: number }; outlineStyle: string; outlineWidth: number; outlineOffset: number; invisible: boolean }> = [];
    const opacities: number[] = [];
    for (let el: Element | null = active; el !== null && el !== document.body; el = el.parentElement) opacities.push(Number(getComputedStyle(el).opacity));
    for (let el: Element | null = active, i = 0; el !== null && el !== document.body; el = el.parentElement, i++) {
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      // 눈에 보이는 정도: 자신과 조상의 불투명도 곱(조상이 투명하면 자식도 안 보인다)
      const effectiveOpacity = opacities.slice(i).reduce((a, b) => a * b, 1);
      const clipHidden = (cs.clip !== 'auto' && /rect\(\s*0(px)?[ ,]+0(px)?[ ,]+0(px)?[ ,]+0(px)?\s*\)/.test(cs.clip)) || /inset\(\s*(50|100)%/.test(cs.clipPath);
      const invisible = cs.display === 'none' || cs.visibility === 'hidden' || effectiveOpacity === 0 || clipHidden || r.width <= 1 || r.height <= 1;
      chain.push({ id: label(el), box: { left: r.left, top: r.top, right: r.right, bottom: r.bottom }, outlineStyle: cs.outlineStyle, outlineWidth: px(cs.outlineWidth), outlineOffset: px(cs.outlineOffset), invisible });
    }
    return { id: label(active), isBody: false, chain, viewport, fixed };
  });
}

/** 보이는 부분(화면 ∩ 가용 영역) 한가운데 점에서 elementFromPoint가 포커스 요소(또는 그 안·조상)인가. 보이는 부분이 없으면 null */
async function centerHit(page: Page, s: Omit<FocusSample, 'centerHit'>): Promise<boolean | null> {
  if (s.isBody) return null;
  const insets = edgeInsets(s);
  const left = Math.max(s.box.left, 0);
  const right = Math.min(s.box.right, s.viewport.width);
  const top = Math.max(s.box.top, insets.top);
  const bottom = Math.min(s.box.bottom, s.viewport.height - insets.bottom);
  if (right - left <= 0 || bottom - top <= 0) return null;
  return page.evaluate(
    ([x, y]) => {
      const active = document.activeElement;
      const hit = document.elementFromPoint(x, y);
      return active !== null && hit !== null && (active.contains(hit) || hit.contains(active));
    },
    [(left + right) / 2, (top + bottom) / 2] as const,
  );
}

/** 지금 포커스를 잰다 */
export async function sampleFocus(page: Page): Promise<FocusStop> {
  const raw = await measure(page);
  // 눈에 보이는 링을 그리는 요소로 상자를 잰다(R-232): 보이지 않는 요소(opacity 0·visibility hidden·clip)는 건너뛰고, 보이는 후보가 여럿이면 각자의 링을 포함한 합집합
  const pick = raw.isBody ? { box: { left: 0, top: 0, right: 0, bottom: 0 }, ring: 0, owners: [] as string[] } : pickRing(raw.chain);
  const base: Omit<FocusSample, 'centerHit'> = { id: raw.id, isBody: raw.isBody, box: pick.box, ring: pick.ring, owners: pick.owners, viewport: raw.viewport, fixed: raw.fixed };
  const sample: FocusSample = { ...base, centerHit: await centerHit(page, base) };
  const scrollY = await page.evaluate(() => Math.round(window.scrollY));
  return { id: sample.id, scrollY, sample, judgement: judgeFocus(sample) };
}

/** 화면의 조작 요소(Tab으로 닿는 것 — 접이식 <summary> 포함, M4 대시보드의 「상태 네 가지의 뜻 보기」)의 이름을 DOM 순서로. 라디오는 묶음마다 선택된 하나(없으면 첫째). 비활성·숨김·tabindex<0은 뺀다. */
export async function listTabbables(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const label = (el: Element): string => {
      const t = el.getAttribute('data-testid');
      if (t) return t;
      const text = (el.getAttribute('aria-label') ?? el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 24);
      const cls = typeof (el as HTMLElement).className === 'string' && (el as HTMLElement).className ? `.${(el as HTMLElement).className.split(/\s+/)[0]}` : '';
      return `${el.tagName}${cls}${text ? `[${text}]` : ''}`;
    };
    const all = Array.from(document.body.querySelectorAll<HTMLElement>('a[href], button, input, select, textarea, summary, [tabindex]'));
    const out: string[] = [];
    const seenGroups = new Set<string>();
    const radios = all.filter((e) => e instanceof HTMLInputElement && e.type === 'radio');
    for (const el of all) {
      if (el.tabIndex < 0) continue;
      if ((el as HTMLButtonElement).disabled) continue;
      if (el.closest('[inert]') !== null) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none') continue;
      if (el.getClientRects().length === 0) continue;
      if (el instanceof HTMLInputElement && el.type === 'radio') {
        const groupKey = el.name;
        if (seenGroups.has(groupKey)) continue;
        const group = radios.filter((r) => r instanceof HTMLInputElement && r.name === groupKey && !r.disabled);
        const stop = group.find((r) => (r as HTMLInputElement).checked) ?? group[0];
        if (stop !== el) continue; // 이 묶음의 Tab 정지점은 선택된(없으면 첫) 라디오 하나
        seenGroups.add(groupKey);
      }
      out.push(label(el));
    }
    return out;
  });
}

/** 활성 가능한(disabled 아닌) 라디오들을 묶음(name)별로. 각 묶음의 이름·DOM 순서의 라디오 이름·선택된 라디오의 순서 */
export interface RadioGroup {
  name: string;
  ids: string[];
  selected: number;
}

export async function listRadioGroups(page: Page): Promise<RadioGroup[]> {
  return page.evaluate(() => {
    const label = (el: Element): string => {
      const t = el.getAttribute('data-testid');
      if (t) return t;
      const text = (el.getAttribute('aria-label') ?? el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 24);
      const cls = typeof (el as HTMLElement).className === 'string' && (el as HTMLElement).className ? `.${(el as HTMLElement).className.split(/\s+/)[0]}` : '';
      return `${el.tagName}${cls}${text ? `[${text}]` : ''}`;
    };
    const groups = new Map<string, HTMLInputElement[]>();
    for (const el of Array.from(document.body.querySelectorAll<HTMLInputElement>('input[type="radio"]'))) {
      if (el.disabled || el.closest('[inert]') !== null) continue;
      const cs = getComputedStyle(el.closest('label') ?? el);
      if (cs.visibility === 'hidden' || cs.display === 'none') continue;
      if (!groups.has(el.name)) groups.set(el.name, []);
      groups.get(el.name)!.push(el);
    }
    return [...groups.entries()].map(([name, list]) => ({ name, ids: list.map(label), selected: Math.max(0, list.findIndex((r) => r.checked)) }));
  });
}

/** 라디오 묶음(name)의 index번째 활성 라디오에 프로그램 focus()를 건다 */
async function focusRadio(page: Page, name: string, index: number): Promise<void> {
  await page.evaluate(
    ([n, i]) => {
      const list = Array.from(document.body.querySelectorAll<HTMLInputElement>('input[type="radio"]')).filter((r) => r.name === n && !r.disabled);
      list[i]?.focus();
    },
    [name, index] as const,
  );
}

/** 순회 전에 포커스를 비우고 맨 위로 */
async function resetFocus(page: Page): Promise<void> {
  await page.evaluate(() => {
    (document.activeElement as HTMLElement | null)?.blur?.();
    window.scrollTo(0, 0);
    // 순차 포커스의 출발점을 문서 맨 앞으로: blur()만으로는 출발점이 방금 있던 요소에 남아 있다(마지막 요소였다면 첫 Tab이 문서 밖으로 나간다)
    const selection = window.getSelection();
    selection?.removeAllRanges();
    const range = document.createRange();
    range.setStart(document.body, 0);
    range.collapse(true);
    selection?.addRange(range);
    // M4: 화면이 뜰 때 문서 뒤쪽의 요소(대시보드의 선택지 제목 등)에 프로그램 포커스가 가 있었다면 blur() 뒤에도 순차 포커스의 출발점이 거기에 남아 첫 Tab이 문서 중간에서 시작한다.
    // 문서 맨 앞에 임시 요소를 끼워 포커스를 주었다가 지우면 출발점이 문서 맨 앞으로 돌아온다(Chrome은 출발점 요소가 사라지면 그 자리에서 이어간다).
    const sentinel = document.createElement('span');
    sentinel.tabIndex = -1;
    document.body.insertBefore(sentinel, document.body.firstChild);
    sentinel.focus({ preventScroll: true });
    sentinel.remove();
  });
}

/**
 * Tab(또는 Shift+Tab)으로 한 칸씩 가며 포커스가 바뀔 때마다 측정한다. 이미 거친 요소로 돌아오거나 포커스가 body로 빠지면(한 바퀴) 멈춘다.
 * 출발점은 부르는 쪽이 정한다: 앞으로 순회는 문서 맨 위(resetFocus)에서, 뒤로 순회는 마지막 조작 요소에 프로그램 focus()를 건 자리(auditFocus)에서 시작한다.
 */
async function walk(page: Page, direction: 'forward' | 'backward', max: number): Promise<FocusStop[]> {
  const stops: FocusStop[] = [];
  const key = direction === 'forward' ? 'Tab' : 'Shift+Tab';
  for (let i = 0; i < max; i++) {
    await page.keyboard.press(key);
    const stop = await sampleFocus(page);
    // 출발점이 마지막 요소였으면 첫 Tab이 문서 밖(body)으로 나갔다 오므로, 아직 하나도 못 거쳤을 때의 body는 한 번 더 누른다
    if (stop.sample.isBody && stops.length === 0 && i === 0) continue;
    if (stop.sample.isBody) break;
    if (stops.some((s) => s.id === stop.id)) break;
    stops.push(stop);
  }
  return stops;
}

/** DOM 순서 index번째 조작 요소에 프로그램 focus()를 건다 (listTabbables와 같은 규칙으로 고른다) */
async function focusTabbable(page: Page, index: number): Promise<void> {
  await page.evaluate((i) => {
    const all = Array.from(document.body.querySelectorAll<HTMLElement>('a[href], button, input, select, textarea, summary, [tabindex]'));
    const list: HTMLElement[] = [];
    const seenGroups = new Set<string>();
    const radios = all.filter((e) => e instanceof HTMLInputElement && e.type === 'radio');
    for (const el of all) {
      if (el.tabIndex < 0 || (el as HTMLButtonElement).disabled || el.closest('[inert]') !== null) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none' || el.getClientRects().length === 0) continue;
      if (el instanceof HTMLInputElement && el.type === 'radio') {
        if (seenGroups.has(el.name)) continue;
        const group = radios.filter((r) => r instanceof HTMLInputElement && r.name === el.name && !r.disabled);
        const stop = group.find((r) => (r as HTMLInputElement).checked) ?? group[0];
        if (stop !== el) continue;
        seenGroups.add(el.name);
      }
      list.push(el);
    }
    list[i]?.focus();
  }, index);
}

export interface AuditOptions {
  /** 한 방향 순회의 최대 칸 수 (무한 반복 방지) */
  maxStops?: number;
  /** 프로그램 focus()로 건드릴 제목 선택자 (화면 전환 뒤 포커스가 가는 곳). 기본: 첫 화면 제목 */
  headingTestId?: string | null;
}

/** 화면 하나(이미 열려 있는 상태)의 포커스 가림을 전부 점검한다. 위반은 report.violations에 모은다. */
export async function auditFocus(page: Page, label: string, options: AuditOptions = {}): Promise<FocusAudit> {
  const maxStops = options.maxStops ?? 60;
  const headingTestId = options.headingTestId === undefined ? 'title-heading' : options.headingTestId;
  const violations: string[] = [];
  const note = (path: string, stops: FocusStop[]) => {
    stops.forEach((s, n) => {
      for (const v of s.judgement.violations) violations.push(`[${label}] ${path} ${n + 1}번째(scrollY ${s.scrollY}): ${v}`);
    });
  };

  const tabbables = await listTabbables(page);
  // 키보드 사용 중이라는 신호(:focus-visible)를 먼저 준다
  await page.keyboard.press('Shift');
  await resetFocus(page);
  const forward = await walk(page, 'forward', maxStops);
  note('Tab', forward);

  // 순회로 닿은 집합 = 화면의 조작 요소 집합 (공허 통과 방지)
  const reached = new Set(forward.map((s) => s.id));
  const expected = new Set(tabbables);
  const missed = [...expected].filter((id) => !reached.has(id));
  const extra = [...reached].filter((id) => !expected.has(id));
  if (missed.length > 0) violations.push(`[${label}] Tab 순회가 닿지 못한 조작 요소: ${missed.join(', ')}`);
  if (extra.length > 0) violations.push(`[${label}] Tab 순회가 닿았지만 조작 요소 목록에 없는 요소: ${extra.join(', ')}`);

  // 뒤로: 마지막 조작 요소에서 시작해 Shift+Tab으로 처음까지
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await focusTabbable(page, tabbables.length - 1);
  const last = await sampleFocus(page);
  const backward: FocusStop[] = [last];
  backward.push(...(await walk(page, 'backward', maxStops)));
  note('Shift+Tab', backward);
  const reachedBack = new Set(backward.map((s) => s.id));
  const missedBack = [...expected].filter((id) => !reachedBack.has(id));
  if (missedBack.length > 0) violations.push(`[${label}] Shift+Tab 순회가 닿지 못한 조작 요소: ${missedBack.join(', ')}`);

  // 방향키: 라디오 묶음마다 선택된 라디오에서 시작해 ↓로 묶음의 활성 라디오를 한 바퀴 돈다(끝에서 처음으로 되돌아온다). 묶음의 모든 라디오를 쟀는지 대조한다 — Tab은 묶음당 하나만 멈춘다(R-234).
  // (선택이 방향키로 따라 바뀌지만 한 바퀴 뒤 처음 선택으로 돌아온다. 입력 가드가 막으면 선택은 그대로이고 포커스만 움직인다 — 어느 쪽이든 포커스 위치를 잰다.)
  const groups = await listRadioGroups(page);
  const radios = groups.flatMap((g) => g.ids);
  const arrow: FocusStop[] = [];
  for (const g of groups) {
    await page.evaluate(() => window.scrollTo(0, 0));
    await focusRadio(page, g.name, g.selected);
    const first = await sampleFocus(page);
    const stops: FocusStop[] = [first];
    for (let k = 0; k < g.ids.length - 1; k++) {
      await page.keyboard.press('ArrowDown');
      stops.push(await sampleFocus(page));
    }
    if (g.ids.length > 1) await page.keyboard.press('ArrowDown'); // 한 바퀴 — 처음 선택으로 돌아온다
    const reached = new Set(stops.map((s) => s.id));
    const missedRadios = g.ids.filter((id) => !reached.has(id));
    if (missedRadios.length > 0) violations.push(`[${label}] 방향키 순회가 닿지 못한 라디오(${g.name} 묶음): ${missedRadios.join(', ')}`);
    arrow.push(...stops);
  }
  note('방향키', arrow);

  // 프로그램 포커스: 모든 조작 요소에 focus()를 걸고, 걸기 전에 문서를 위·아래 끝으로 번갈아 보내 브라우저가 스크롤해야만 닿게 한다
  const programmatic: FocusStop[] = [];
  for (let i = 0; i < tabbables.length; i++) {
    await page.evaluate((toBottom) => window.scrollTo(0, toBottom ? document.documentElement.scrollHeight : 0), i % 2 === 0);
    await focusTabbable(page, i);
    programmatic.push(await sampleFocus(page));
  }
  // Tab 정지점이 아닌 나머지 라디오도(활성 가능한 모든 라디오) 같은 방식으로 — 묶음의 선택되지 않은 카드는 Tab으로는 안 닿지만 방향키·프로그램 포커스로 닿는다
  let radioTurn = 0;
  for (const g of groups) {
    for (let k = 0; k < g.ids.length; k++) {
      if (k === g.selected) continue;
      await page.evaluate((toBottom) => window.scrollTo(0, toBottom ? document.documentElement.scrollHeight : 0), radioTurn++ % 2 === 0);
      await focusRadio(page, g.name, k);
      programmatic.push(await sampleFocus(page));
    }
  }
  if (headingTestId !== null) {
    const heading = page.getByTestId(headingTestId);
    if ((await heading.count()) > 0) {
      // 화면 전환 직후의 제목 포커스: 새 화면은 맨 위에서 시작한다(제목은 문서 맨 앞)
      await page.evaluate(() => window.scrollTo(0, 0));
      await heading.evaluate((el) => (el as HTMLElement).focus());
      programmatic.push(await sampleFocus(page));
    }
  }
  note('focus()', programmatic);

  const fixedIds = [...new Set([...forward, ...backward, ...arrow, ...programmatic].flatMap((s) => s.sample.fixed.map((f) => f.id)))];
  return { forward, backward, arrow, programmatic, radios, tabbables, fixedIds, violations };
}

/** 사람이 읽는 한 줄 요약 (실패 메시지·ai-log용) */
export function summarize(audit: FocusAudit): string {
  const all = [...audit.forward, ...audit.backward, ...audit.arrow, ...audit.programmatic];
  const tall = all.filter((s) => s.judgement.tooTall).map((s) => s.id);
  return `조작 요소 ${audit.tabbables.length}개(라디오 ${audit.radios.length}개) · Tab ${audit.forward.length}칸 · Shift+Tab ${audit.backward.length}칸 · 방향키 ${audit.arrow.length}칸 · focus() ${audit.programmatic.length}칸 · 고정/붙은 요소 ${audit.fixedIds.join(', ')} · 가용 높이보다 큰 요소 ${[...new Set(tall)].join(', ') || '없음'} · 가려진 포커스 ${audit.violations.length}`;
}
