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
      if (t) {
        // 같은 data-testid가 문서에 여럿이면(SPEC-010 「근거 보기」 단추 `why-btn`은 시대 줄마다 하나) 정지점 이름을 구분한다: aria-controls가 그 중 하나뿐이면 그것으로, 아니면 DOM 순서로.
        // 이름이 같으면 순회 대조(닿은 집합 = 조작 요소 집합)가 여러 요소를 하나로 뭉친다. 이름 계산은 measure·listTabbables·listRadioGroups가 똑같이 쓴다.
        const same = Array.from(document.querySelectorAll(`[data-testid="${CSS.escape(t)}"]`));
        if (same.length <= 1) return t;
        const controls = el.getAttribute('aria-controls');
        if (controls !== null && same.filter((e) => e.getAttribute('aria-controls') === controls).length === 1) return `${t}[${controls}]`;
        return `${t}#${same.indexOf(el) + 1}`;
      }
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
      // 모달 시트(M7b)가 떠 있는 동안 바깥은 `inert`이고 스크림 뒤에 있다 — 포커스를 가리는 고정 요소가 아니다(diff-003.md D-59)
      if (el.closest('[inert]') !== null) continue;
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

/**
 * 스크롤이 멈출 때까지 기다린다: 문서와 안쪽 스크롤 칸(세대 목록 `.gen-list`처럼 `scroll-behavior: smooth`인 것)의 스크롤 위치가 30ms 간격 세 번 연속 같으면 멈춘 것이다(최대 2.5초).
 * 부드러운 스크롤이 도는 중에 재면 포커스 링이 아직 도착하지 않은 자리를 가림·잘림으로 잘못 판정한다.
 */
async function settleScroll(page: Page): Promise<void> {
  // 기다림은 Node 쪽에서 센다(page.waitForTimeout): 룰렛 회전 중처럼 시간을 붙든 페이지(startPageHidden)는 안의 타이머·프레임이 돌지 않아 페이지 안에서 세면 영영 끝나지 않는다
  const key = (): Promise<string> =>
    page.evaluate(() => {
      const scrollers = Array.from(document.querySelectorAll<HTMLElement>('*')).filter((e) => e.scrollHeight > e.clientHeight + 1 && ['auto', 'scroll'].includes(getComputedStyle(e).overflowY));
      return [window.scrollY, ...scrollers.map((e) => e.scrollTop)].join(',');
    });
  let last = await key();
  let stable = 0;
  const t0 = Date.now();
  while (stable < 3 && Date.now() - t0 < 2500) {
    await page.waitForTimeout(30);
    const k = await key();
    if (k === last) stable++;
    else {
      stable = 0;
      last = k;
    }
  }
}

/** 지금 포커스를 잰다 */
export async function sampleFocus(page: Page): Promise<FocusStop> {
  await settleScroll(page);
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
      if (t) {
        // 같은 data-testid가 여럿이면 이름을 구분한다 — 규칙은 measure()의 label과 같다
        const same = Array.from(document.querySelectorAll(`[data-testid="${CSS.escape(t)}"]`));
        if (same.length <= 1) return t;
        const controls = el.getAttribute('aria-controls');
        if (controls !== null && same.filter((e) => e.getAttribute('aria-controls') === controls).length === 1) return `${t}[${controls}]`;
        return `${t}#${same.indexOf(el) + 1}`;
      }
      const text = (el.getAttribute('aria-label') ?? el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 24);
      const cls = typeof (el as HTMLElement).className === 'string' && (el as HTMLElement).className ? `.${(el as HTMLElement).className.split(/\s+/)[0]}` : '';
      return `${el.tagName}${cls}${text ? `[${text}]` : ''}`;
    };
    const all = Array.from(document.body.querySelectorAll<HTMLElement>('a[href], button, input, select, textarea, summary, [tabindex]'));
    const out: string[] = [];
    const els: HTMLElement[] = [];
    const seenGroups = new Set<string>();
    const radios = all.filter((e) => e instanceof HTMLInputElement && e.type === 'radio');
    for (const el of all) {
      if (el.tabIndex < 0) continue;
      if ((el as HTMLButtonElement).disabled) continue;
      if (el.closest('[inert]') !== null) continue;
      // 닫힌 <details> 안(자기 <summary> 말고)은 Tab으로 닿지 않는다
      let closedAncestor = false;
      for (let d = el.parentElement?.closest('details') ?? null; d !== null; d = d.parentElement?.closest('details') ?? null) {
        if (!d.open && !(el.tagName === 'SUMMARY' && el.parentElement === d)) closedAncestor = true;
      }
      if (closedAncestor) continue;
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
      els.push(el);
    }
    // 프로그램 focus()는 이 목록의 요소 **자체**에 건다(focusTabbable): 색인으로 다시 찾으면 순회 도중 화면이 바뀔 때 엉뚱한 요소에 걸린다
    (window as unknown as { __auditTabbables: HTMLElement[] }).__auditTabbables = els;
    return out;
  });
}

/** 아직 응답을 못 받았고 실패하지도 않은(= 날아가는 중인) 요청 수 */
async function pendingRequests(page: Page): Promise<number> {
  try {
    return (await page.requests()).filter((r) => r.existingResponse() === null && r.failure() === null).length;
  } catch {
    return 0;
  }
}

/**
 * 조작 요소 목록이 **자리 잡을 때까지** 기다렸다가 그 목록을 돌려준다. 시대의 창 10년 덩어리(SPEC-009 FM5 · SPEC-010)는 동적 `import()`로 **하나씩 차례로** 늦게 도착해 줄(「근거 보기」 단추·시대의 창 링크)을 한꺼번에 끼워 넣는다 —
 * 차가운 개발 서버나 부하가 걸린 실행에서 목록을 뜬 뒤에 덩어리가 오면 순회가 「목록에 없는 요소에 닿았다」고 어긋난다(QA-009-FM6-010 3절의 흔들림이 아닌 F1 뒤 남은 어긋남).
 * 날아가는 요청이 없고 목록이 100ms 간격 네 번 연속 같으면 자리 잡은 것이다(최대 15초). 마지막 listTabbables 호출이 요소 참조(focusTabbable이 쓰는)를 남긴다.
 */
async function listStableTabbables(page: Page): Promise<string[]> {
  let list = await listTabbables(page);
  let stable = 0;
  const t0 = Date.now();
  while (stable < 4 && Date.now() - t0 < 15_000) {
    await page.waitForTimeout(100);
    const next = await listTabbables(page);
    const pending = await pendingRequests(page);
    if (pending === 0 && next.length === list.length && next.every((id, k) => id === list[k])) stable++;
    else stable = 0;
    list = next;
  }
  return list;
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
      if (t) {
        // 같은 data-testid가 여럿이면 이름을 구분한다 — 규칙은 measure()의 label과 같다
        const same = Array.from(document.querySelectorAll(`[data-testid="${CSS.escape(t)}"]`));
        if (same.length <= 1) return t;
        const controls = el.getAttribute('aria-controls');
        if (controls !== null && same.filter((e) => e.getAttribute('aria-controls') === controls).length === 1) return `${t}[${controls}]`;
        return `${t}#${same.indexOf(el) + 1}`;
      }
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
 * 「이미 거친 요소」는 이름이 아니라 **요소 자체**로 가른다(브라우저 안의 WeakSet): 같은 이름의 요소가 여럿이어도(SPEC-010 「근거 보기」 단추처럼 줄마다 같은 data-testid) 순회가 도중에 끊기지 않는다.
 * 출발점은 부르는 쪽이 정한다: 앞으로 순회는 문서 맨 위(resetFocus)에서, 뒤로 순회는 마지막 조작 요소에 프로그램 focus()를 건 자리(auditFocus)에서 시작한다.
 */
async function walk(page: Page, direction: 'forward' | 'backward', max: number): Promise<FocusStop[]> {
  const stops: FocusStop[] = [];
  const key = direction === 'forward' ? 'Tab' : 'Shift+Tab';
  await page.evaluate(() => {
    (window as unknown as { __walkSeen: WeakSet<Element> }).__walkSeen = new WeakSet<Element>();
  });
  for (let i = 0; i < max; i++) {
    await page.keyboard.press(key);
    const stop = await sampleFocus(page);
    // 출발점이 마지막 요소였으면 첫 Tab이 문서 밖(body)으로 나갔다 오므로, 아직 하나도 못 거쳤을 때의 body는 한 번 더 누른다
    if (stop.sample.isBody && stops.length === 0 && i === 0) continue;
    if (stop.sample.isBody) break;
    const again = await page.evaluate(() => {
      const seen = (window as unknown as { __walkSeen: WeakSet<Element> }).__walkSeen;
      const active = document.activeElement;
      if (active === null) return false;
      if (seen.has(active)) return true;
      seen.add(active);
      return false;
    });
    if (again) break;
    stops.push(stop);
  }
  return stops;
}

/**
 * 가장 최근 listTabbables가 모은 index번째 조작 요소 **자체**에 프로그램 focus()를 건다.
 * 'gone' = 그 요소가 문서에서 사라졌다(앱이 스스로 없앴다) · 'missed' = focus()를 걸었는데 포커스가 그 요소에 가지 않았다 · 'ok'.
 */
async function focusTabbable(page: Page, index: number): Promise<'ok' | 'gone' | 'missed'> {
  return page.evaluate((i) => {
    const el = (window as unknown as { __auditTabbables?: HTMLElement[] }).__auditTabbables?.[i];
    if (el === undefined || !el.isConnected) return 'gone';
    el.focus();
    return document.activeElement === el ? 'ok' : 'missed';
  }, index);
}

/** 가장 최근 listTabbables가 모은 index번째 조작 요소가 지금 문서에 없는가 */
async function isDetached(page: Page, index: number): Promise<boolean> {
  return page.evaluate((i) => {
    const el = (window as unknown as { __auditTabbables?: HTMLElement[] }).__auditTabbables?.[i];
    return el === undefined || !el.isConnected;
  }, index);
}

export interface AuditOptions {
  /** 한 방향 순회의 최대 칸 수 (무한 반복 방지). 기본: 조작 요소 수 + 5 (최소 60) */
  maxStops?: number;
  /** 프로그램 focus()로 건드릴 제목 선택자 (화면 전환 뒤 포커스가 가는 곳). 기본: 첫 화면 제목 */
  headingTestId?: string | null;
  /**
   * 순회 도중 앱이 **스스로 없애는** 조작 요소의 이름(예: 「새 기록 N개 · 맨 위로」 알약 `log-jump`는 인생 기록이 맨 위에 닿으면 사라진다 — logOrder.isAtLogTop).
   * 이 이름의 요소는 순회가 닿지 못해도 **순회가 끝났을 때 문서에서 실제로 사라졌으면** 위반으로 세지 않는다(사라지지 않았는데 못 닿았으면 위반이다).
   */
  mayVanish?: string[];
  /**
   * 화면을 처음 잰 상태로 되돌리는 함수. 주면 Shift+Tab 순회와 프로그램 focus() 순회 **직전마다** 부르고 그 순회의 조작 요소 목록을 새로 만들어 대조한다(Tab 순회는 처음 상태 그대로 돈다).
   * 순회가 화면을 바꾸는 화면(`mayVanish`가 있는 화면)이 순회마다 같은 상태에서 시작하게 한다. 방향키(라디오) 순회에는 쓰지 않는다.
   */
  restore?: () => Promise<void>;
}

/** 화면 하나(이미 열려 있는 상태)의 포커스 가림을 전부 점검한다. 위반은 report.violations에 모은다. */
export async function auditFocus(page: Page, label: string, options: AuditOptions = {}): Promise<FocusAudit> {
  const headingTestId = options.headingTestId === undefined ? 'title-heading' : options.headingTestId;
  const mayVanish = new Set(options.mayVanish ?? []);
  const violations: string[] = [];
  const note = (path: string, stops: FocusStop[]) => {
    stops.forEach((s, n) => {
      for (const v of s.judgement.violations) violations.push(`[${label}] ${path} ${n + 1}번째(scrollY ${s.scrollY}): ${v}`);
    });
  };
  /** 순회가 닿지 못한 조작 요소. `mayVanish`에 든 요소는 지금 문서에서 실제로 사라졌을 때만 뺀다 */
  const unreachedOf = async (list: string[], reached: Set<string>): Promise<string[]> => {
    const out: string[] = [];
    for (const id of [...new Set(list)]) {
      if (reached.has(id)) continue;
      if (mayVanish.has(id) && (await isDetached(page, list.indexOf(id)))) continue;
      out.push(id);
    }
    return out;
  };
  /** 순회 직전에 화면을 되돌리고(restore가 있으면) 그 순회의 조작 요소 목록을 새로 만든다. 없으면 처음 목록 그대로 */
  const startPass = async (): Promise<string[]> => {
    if (options.restore === undefined) return tabbables;
    await options.restore();
    await page.keyboard.press('Shift'); // 키보드 사용 중이라는 신호(:focus-visible)를 다시
    return listStableTabbables(page);
  };

  const tabbables = await listStableTabbables(page);
  // 한 방향 순회의 상한: 기본은 조작 요소 수 + 여유 5(SPEC-010 이후 50세 판은 「근거 보기」 단추만 38개라 고정 60칸으로는 모자란다). 상한은 무한 반복 방지용일 뿐 — 넘치면 forward 수가 조작 요소 수와 달라 단언이 깨진다.
  const maxStopsOf = (list: string[]): number => options.maxStops ?? Math.max(60, list.length + 5);
  // 키보드 사용 중이라는 신호(:focus-visible)를 먼저 준다
  await page.keyboard.press('Shift');
  await resetFocus(page);
  const forward = await walk(page, 'forward', maxStopsOf(tabbables));
  note('Tab', forward);

  // 순회로 닿은 집합 = 화면의 조작 요소 집합 (공허 통과 방지)
  const reached = new Set(forward.map((s) => s.id));
  const expected = new Set(tabbables);
  const missed = await unreachedOf(tabbables, reached);
  const extra = [...reached].filter((id) => !expected.has(id));
  if (missed.length > 0) violations.push(`[${label}] Tab 순회가 닿지 못한 조작 요소: ${missed.join(', ')}`);
  if (extra.length > 0) violations.push(`[${label}] Tab 순회가 닿았지만 조작 요소 목록에 없는 요소: ${extra.join(', ')}`);

  // 뒤로: 마지막 조작 요소에서 시작해 Shift+Tab으로 처음까지
  const backList = await startPass();
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const startResult = await focusTabbable(page, backList.length - 1);
  if (startResult !== 'ok') violations.push(`[${label}] Shift+Tab 출발: 마지막 조작 요소(${backList[backList.length - 1]})에 focus()가 가지 않았다(${startResult})`);
  const last = await sampleFocus(page);
  const backward: FocusStop[] = [last];
  backward.push(...(await walk(page, 'backward', maxStopsOf(backList))));
  note('Shift+Tab', backward);
  const reachedBack = new Set(backward.map((s) => s.id));
  const missedBack = await unreachedOf(backList, reachedBack);
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
  const focusList = await startPass();
  const focusGroups = options.restore === undefined ? groups : await listRadioGroups(page);
  const programmatic: FocusStop[] = [];
  for (let i = 0; i < focusList.length; i++) {
    await page.evaluate((toBottom) => window.scrollTo(0, toBottom ? document.documentElement.scrollHeight : 0), i % 2 === 0);
    const result = await focusTabbable(page, i);
    if (result === 'gone') {
      // 앞서 건 focus()가 앱 쪽 변화를 일으켜 이 요소를 없앴다 — 허용 목록에 없으면 위반(조용히 건너뛰지 않는다)
      if (!mayVanish.has(focusList[i])) violations.push(`[${label}] focus() ${i + 1}번째: ${focusList[i]}이(가) 문서에서 사라져 focus()를 걸 수 없다`);
      continue;
    }
    if (result === 'missed') violations.push(`[${label}] focus() ${i + 1}번째: ${focusList[i]}에 focus()를 걸었는데 포커스가 그 요소에 가지 않았다`);
    programmatic.push(await sampleFocus(page));
  }
  // Tab 정지점이 아닌 나머지 라디오도(활성 가능한 모든 라디오) 같은 방식으로 — 묶음의 선택되지 않은 카드는 Tab으로는 안 닿지만 방향키·프로그램 포커스로 닿는다
  let radioTurn = 0;
  for (const g of focusGroups) {
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
