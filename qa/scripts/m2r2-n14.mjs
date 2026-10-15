// QA-003 M2 2회차: M2-N14b — 공통 뷰포트 11종 × 첫 화면 3상태(새 판·이어하기·확인 단계) Tab·Shift+Tab 전체 순회에서 가려진 포커스 0 (SPEC CM10·QM2-1)
// 개발자 e2e와 별개로 QA가 독립 구현한 측정: 고정/sticky 요소를 화면에서 자동 수집, 포커스 링(outline+offset) 상자와의 겹침 면적, 화면 안, elementFromPoint, 조작 요소 집합 대조.
import { launch, mkctx, runCase, shot, sleep, TOUCH, ensureFixture, seedContext, openState, STATES, STD_VIEWPORTS } from './m2r2-lib.mjs';

const browser = await launch();
const fx = await ensureFixture(browser);
const only = process.argv[2]; // 예: 360x740-touch
const onlyState = process.argv[3];
const FULL_SHOT = new Set(['360x740-touch', '320x568', '1280x800', '1280x620']);

/** 페이지 안에서 현재 포커스 요소를 재는 함수(문자열로 주입) */
const MEASURE = () => {
  const a = document.activeElement;
  if (!a || a === document.body || a === document.documentElement) return { body: true };
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const keyOf = (e) => (e.type === 'radio' ? `radio:${e.name}` : e.getAttribute('data-testid') || e.getAttribute('aria-label') || `${e.tagName}:${(e.innerText || '').slice(0, 14)}`);
  // 링을 그리는 요소 찾기
  const ringOf = (e) => {
    const hasRing = (x) => {
      const cs = getComputedStyle(x);
      return cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0 ? parseFloat(cs.outlineWidth) + Math.max(0, parseFloat(cs.outlineOffset) || 0) : 0;
    };
    let x = e;
    for (let i = 0; i < 4 && x && x !== document.body; i++, x = x.parentElement) {
      const r = hasRing(x);
      if (r && (x === e || x.matches(':focus-within'))) return { el: x, grow: r };
    }
    return { el: e, grow: 5 }; // 링을 못 찾으면 보수적으로 5px(3px + 2px)
  };
  const { el: rEl, grow } = ringOf(a);
  const b = rEl.getBoundingClientRect();
  const ring = { top: b.top - grow, bottom: b.bottom + grow, left: b.left - grow, right: b.right + grow };
  // 고정·붙은 요소 자동 수집
  const fixed = [];
  for (const e of document.querySelectorAll('*')) {
    const cs = getComputedStyle(e);
    if (cs.position !== 'fixed' && cs.position !== 'sticky') continue;
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const r = e.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    fixed.push({ el: e, name: e.getAttribute('data-testid') || e.className || e.tagName, pos: cs.position, top: r.top, bottom: r.bottom, left: r.left, right: r.right });
  }
  const overlapsAll = [];
  let topInset = 0;
  let bottomInset = 0;
  for (const f of fixed) {
    if (f.el.contains(a)) continue; // 예외 ①: 고정 요소 안의 요소
    if (f.pos === 'fixed' && f.bottom >= vh - 2) bottomInset = Math.max(bottomInset, vh - f.top);
    if (f.pos === 'fixed' && f.top <= 2) topInset = Math.max(topInset, f.bottom);
    const w = Math.min(ring.right, f.right) - Math.max(ring.left, f.left);
    const h = Math.min(ring.bottom, f.bottom) - Math.max(ring.top, f.top);
    if (w > 0.5 && h > 0.5) overlapsAll.push({ name: String(f.name).slice(0, 30), pos: f.pos, area: Math.round(w * h), ringTop: Math.round(ring.top), ringBottom: Math.round(ring.bottom), fTop: Math.round(f.top), fBottom: Math.round(f.bottom) });
  }
  const availH = vh - topInset - bottomInset;
  const tall = b.height + 2 * grow > availH;
  // 예외 ②: 가용 높이보다 큰 요소는 겹침 면적 대신 「위쪽 변과 링이 가용 영역 안에 보이는가」(위쪽 40px 이상이 띠 위)로 판정
  const overlaps = tall ? overlapsAll.filter((o) => !(ring.top >= topInset - 0.5 && b.top + 40 <= vh - bottomInset)).map((o) => ({ ...o, tallTopHidden: true })) : overlapsAll;
  const inView = tall ? ring.top >= -0.5 && ring.top < vh - bottomInset : ring.top >= -0.5 && ring.bottom <= vh + 0.5;
  const inViewX = ring.left >= -0.5 && ring.right <= vw + 0.5;
  // 보이는 부분 한가운데 점
  const vx = Math.max(0, Math.min(vw, b.left)) + (Math.min(vw, b.right) - Math.max(0, b.left)) / 2;
  const vyTop = Math.max(0, b.top);
  const vyBot = Math.min(vh - bottomInset, b.bottom);
  const vy = vyTop + Math.max(1, Math.min(vyBot - vyTop, 24)) / 2;
  const hit = document.elementFromPoint(vx, vy);
  const hitOk = !!hit && (rEl.contains(hit) || a.contains(hit) || hit.contains(a) || hit.closest('label') === rEl.closest('label') && !!hit.closest('label'));
  // 스크롤 컨테이너에 링이 잘리는가(조상 중 overflow가 visible이 아닌 것)
  let clipped = null;
  for (let x = rEl.parentElement; x && x !== document.body && x !== document.documentElement; x = x.parentElement) {
    const cs = getComputedStyle(x);
    if (cs.overflowY === 'visible' && cs.overflowX === 'visible') continue;
    const r = x.getBoundingClientRect();
    if (!tall && (ring.top < r.top - 1.5 || ring.bottom > r.bottom + 1.5)) {
      clipped = `${(x.getAttribute('data-testid') || x.className || x.tagName).toString().slice(0, 24)} ${Math.round(r.top)}~${Math.round(r.bottom)} vs 링 ${Math.round(ring.top)}~${Math.round(ring.bottom)}`;
      break;
    }
  }
  return {
    key: keyOf(a),
    top: Math.round(b.top),
    bottom: Math.round(b.bottom),
    ringTop: Math.round(ring.top),
    ringBottom: Math.round(ring.bottom),
    overlaps,
    inView,
    inViewX,
    tall,
    tallVisible: Math.round(Math.min(b.bottom, vh - bottomInset) - Math.max(b.top, topInset)),
    hitOk,
    clipped,
    barTop: Math.round(Math.min(...fixed.filter((f) => f.pos === 'fixed' && f.bottom >= vh - 2).map((f) => f.top), vh)),
    scrollY: Math.round(window.scrollY),
    fixedNames: fixed.map((f) => `${String(f.name).slice(0, 18)}(${f.pos})`),
  };
};

/** 화면에서 조작 가능한 요소의 키 집합 (라디오는 묶음 하나) */
const INTERACTIVE = () => {
  const keys = new Set();
  const vis = (e) => {
    const r = e.getBoundingClientRect();
    const cs = getComputedStyle(e);
    return cs.display !== 'none' && cs.visibility !== 'hidden' && (r.width > 0 || r.height > 0 || e.type === 'radio');
  };
  for (const e of document.querySelectorAll('a[href], button, input, select, textarea, [tabindex]')) {
    if (e.disabled) continue;
    if (e.getAttribute('tabindex') === '-1') continue;
    if (e.matches('[tabindex]') && !e.matches('a,button,input,select,textarea') && e.getAttribute('tabindex') !== '0') continue;
    if (!vis(e) && e.type !== 'radio') continue;
    if (e.type === 'radio') {
      if (e.disabled) continue;
      keys.add(`radio:${e.name}`);
      continue;
    }
    // 숨긴(접근성 전용) 표 안의 요소는 제외
    if (e.closest('table')) continue;
    keys.add(e.getAttribute('data-testid') || e.getAttribute('aria-label') || `${e.tagName}:${(e.innerText || '').slice(0, 14)}`);
  }
  return [...keys];
};

async function settle(p) {
  let last = -1;
  for (let i = 0; i < 12; i++) {
    const y = await p.evaluate(() => window.scrollY);
    if (y === last) break;
    last = y;
    await sleep(60);
  }
}

async function traverse(p, dir, maxSteps, visited, label, stepsOut, shotsOut, vname, state) {
  let bodies = 0;
  for (let i = 0; i < maxSteps; i++) {
    await p.keyboard.press(dir === 'fwd' ? 'Tab' : 'Shift+Tab');
    await sleep(60);
    await settle(p);
    const m = await p.evaluate(MEASURE);
    if (m.body) {
      stepsOut.push({ dir, i, body: true });
      if (++bodies >= 2) return 'body';
      continue; // 문서 끝을 넘어갔다 — 한 번 더 누르면 처음으로 돌아온다
    }
    const dup = visited.has(m.key);
    visited.add(m.key);
    stepsOut.push({ dir, i, ...m });
    const bad = m.overlaps.length > 0 || !m.inView || !m.inViewX || !m.hitOk || m.clipped;
    if (bad && shotsOut.length < 4) shotsOut.push(await shot(p, 'N14b', `${vname}-${state}-FAIL-${dir}${i + 1}-${m.key.replace(/[^\w-]/g, '')}`));
    if (dir === 'fwd' && i === 0 && FULL_SHOT.has(vname)) shotsOut.push(await shot(p, 'N14b', `${vname}-${state}-tab1`));
    if (dup && i > 0) return 'wrap';
  }
  return 'max';
}

await runCase(
  { id: process.env.QA_MUTATE ? 'M2-N14b-변이점검' : 'M2-N14b', cat: '정상', title: '키보드 포커스가 고정 요소에 가려지지 않는가 — 공통 뷰포트 11종 × 새 판·이어하기·확인 단계 × Tab·Shift+Tab 전체 순회 (CM10·QM2-1)', steps: '뷰포트마다 상태 3종(새 판=prod, 이어하기·확인 단계=개발 서버 ?__exit)을 열고 Tab으로 한 바퀴, 이어서 Shift+Tab으로 처음까지. 포커스가 바뀔 때마다 포커스 링 상자와 모든 고정/sticky 요소의 겹침, 화면 안, 한가운데 점의 elementFromPoint, 스크롤 컨테이너에 링 잘림을 잰다. 화면의 조작 요소 집합 = 순회로 닿은 집합. 확인 단계 열기·닫기(Esc)의 프로그램 포커스도 측정', expected: '모든 조합에서 가려진 포커스 0·화면 밖 0·조작 요소 미도달 0' },
  async () => {
    const problems = [];
    const summary = [];
    const summaryReach = [];
    const shots = [];
    let totalSteps = 0;
    for (const vp of STD_VIEWPORTS) {
      if (only && only !== vp.name) continue;
      for (const state of STATES) {
        if (onlyState && onlyState !== state) continue;
        const ctx = await mkctx(browser, { viewport: { width: vp.width, height: vp.height }, ...(vp.touch ? TOUCH : {}) });
        if (state !== 'new') await seedContext(ctx, fx);
        const p = await ctx.newPage();
        const tag = `${vp.name}/${state}`;
        try {
          await openState(p, state);
          if (process.env.QA_MUTATE) await p.addStyleTag({ content: 'html, html.has-bottom-bar { scroll-padding: 0 !important }' }); // 측정기 점검용: 스크롤 여백을 지운 옛 모양에서 실패가 잡히는가
          await p.mouse.move(2, 2);
          const steps = [];
          const visited = new Set();
          const myShots = [];
          // 확인 단계: 열렸을 때의 프로그램 포커스 측정
          if (state === 'confirm') {
            const m0 = await p.evaluate(MEASURE);
            steps.push({ dir: 'open', i: 0, ...m0 });
            if (!m0.body) visited.add(m0.key);
            if (FULL_SHOT.has(vp.name)) myShots.push(await shot(p, 'N14b', vp.name + '-confirm-open'));
            if (m0.body) problems.push(`${tag}: 확인 단계가 열렸는데 포커스가 본문(body)에 있음`);
            else if (m0.overlaps.length || !m0.inView || !m0.hitOk) {
              problems.push(`${tag}: 확인 단계 열림 직후 포커스 ${m0.key} 가림/화면 밖 ${JSON.stringify(m0.overlaps)} inView=${m0.inView} hit=${m0.hitOk}`);
              myShots.push(await shot(p, 'N14b', `${vp.name}-confirm-open-FAIL`));
            }
          }
          const end1 = await traverse(p, 'fwd', 40, visited, 'fwd', steps, myShots, vp.name, state);
          const fwdKeys = new Set([...visited]);
          // Shift+Tab: 처음까지(같은 요소가 두 번 나오면 한 바퀴)
          const back = [];
          const visitedBack = new Set();
          let bodiesB = 0;
          for (let i = 0; i < 40; i++) {
            await p.keyboard.press('Shift+Tab');
            await sleep(60);
            await settle(p);
            const m = await p.evaluate(MEASURE);
            if (m.body) {
              back.push({ dir: 'back', i, body: true });
              if (++bodiesB >= 2) break;
              continue;
            }
            if (visitedBack.has(m.key)) break;
            visitedBack.add(m.key);
            back.push({ dir: 'back', i, ...m });
            const bad = m.overlaps.length > 0 || !m.inView || !m.inViewX || !m.hitOk || m.clipped;
            if (bad && myShots.length < 4) myShots.push(await shot(p, 'N14b', `${vp.name}-${state}-FAIL-back${i + 1}-${m.key.replace(/[^\w-]/g, '')}`));
          }
          const interactive = await p.evaluate(INTERACTIVE); // Esc로 닫기 전 화면 기준
          // 예외 ②의 「나머지는 ↓·PageDown으로 닿을 수 있다」: 슬라이드 영역 포커스 → PageDown 반복 → 슬라이드 맨 아래 글자가 띠 위로 오는가
          {
            await p.getByTestId('carousel-viewport').focus();
            await p.keyboard.press('Tab');
            await p.keyboard.press('Shift+Tab');
            const onVp = await p.evaluate(() => document.activeElement?.getAttribute('data-testid'));
            let last = -1;
            for (let i = 0; i < 14; i++) {
              await p.keyboard.press('PageDown');
              await sleep(110);
            }
            await settle(p);
            const reach = await p.evaluate(() => {
              const a = document.querySelector('.slide.is-active');
              let bottom = 0;
              for (const e of a.querySelectorAll('*')) {
                const cs = getComputedStyle(e);
                if (cs.display === 'none' || cs.visibility === 'hidden') continue;
                const r = e.getBoundingClientRect();
                if (r.width < 2 || r.height < 2 || e.closest('table')) continue;
                bottom = Math.max(bottom, r.bottom);
              }
              const bar = document.querySelector('[data-testid=bottom-bar]').getBoundingClientRect();
              return { bottom: Math.round(bottom), barTop: Math.round(bar.top), vh: innerHeight };
            });
            if (onVp !== 'carousel-viewport') problems.push(`${tag}: 슬라이드 영역에 키보드 포커스가 안 감(${onVp})`);
            else if (reach.bottom > reach.barTop + 1) problems.push(`${tag}: 슬라이드 영역에서 PageDown을 14번 눌러도 슬라이드 맨 아래(${reach.bottom})가 띠 위끝(${reach.barTop})보다 아래`);
            summaryReach.push(`${tag} 맨 아래 ${reach.bottom}≤띠 ${reach.barTop}`);
          }
          // 프로그램 포커스: 확인 단계 Esc 닫기 → begin-new 포커스 → 다시 열기
          if (state === 'confirm') {
            await p.keyboard.press('Escape');
            await sleep(300);
            await settle(p);
            const mc = await p.evaluate(MEASURE);
            steps.push({ dir: 'esc-close', i: 0, ...mc });
            if (mc.body || mc.key !== 'begin-new') problems.push(`${tag}: Esc 뒤 포커스 ${mc.key ?? 'body'} (새로 태어나기 기대)`);
            else if (mc.overlaps.length || !mc.inView || !mc.hitOk) problems.push(`${tag}: Esc 뒤 begin-new 포커스 가림 ${JSON.stringify(mc.overlaps)} inView=${mc.inView}`);
          }
          const all = [...steps, ...back];
          totalSteps += all.filter((s) => !s.body).length;
          for (const s of all) {
            if (s.body) continue;
            const w = `${tag} ${s.dir}${s.i + 1} ${s.key}`;
            if (s.overlaps.length) problems.push(`${w}: 링 ${s.ringTop}~${s.ringBottom}이 ${s.overlaps.map((o) => `${o.name}(${o.fTop}~${o.fBottom}) ${o.area}px²`).join(',')}에 가려짐`);
            if (!s.inView) problems.push(`${w}: 화면 밖 링 ${s.ringTop}~${s.ringBottom} (뷰포트 높이 ${vp.height}${s.tall ? ', 큰 요소' : ''})`);
            if (!s.inViewX) problems.push(`${w}: 가로로 화면 밖`);
            if (!s.hitOk) problems.push(`${w}: 한가운데 점이 다른 요소 위(가려짐)`);
            if (s.clipped) problems.push(`${w}: 스크롤 컨테이너에 링이 잘림 ${s.clipped}`);
          }
          // 조작 요소 집합 = 순회로 닿은 집합
          const reached = new Set([...fwdKeys, ...visitedBack]);
          const missed = interactive.filter((k) => !reached.has(k));
          if (missed.length) problems.push(`${tag}: 순회로 못 닿은 조작 요소 ${missed.join(',')}`);
          const fixedNames = [...new Set(all.flatMap((s) => s.fixedNames || []))];
          summary.push(`${tag}: 앞 ${steps.filter((s) => s.dir === 'fwd' && !s.body).length}·뒤 ${back.filter((s) => !s.body).length}칸(${end1}) 조작 ${interactive.length}개 모두 도달=${missed.length === 0} 고정요소[${fixedNames.join(' ')}]`);
          shots.push(...myShots);
        } catch (e) {
          problems.push(`${tag}: 스크립트 오류 ${String(e.message).slice(0, 160)}`);
        }
        await ctx.close();
      }
    }
    return {
      verdict: problems.length ? 'FAIL' : 'PASS',
      severity: problems.length ? '중간(접근성)' : undefined,
      actual: (problems.length ? `가려진/이상 ${problems.length}건: ${problems.slice(0, 14).join(' // ')}${problems.length > 14 ? ` …외 ${problems.length - 14}건` : ''} || ` : `가려진 포커스 0 (측정한 포커스 ${totalSteps}회) || `) + summary.join(' ; ') + ' || 슬라이드 맨 아래 도달(PageDown): ' + summaryReach.join(' ; '),
      shots: shots.slice(0, 40),
    };
  }
);

await browser.close();
