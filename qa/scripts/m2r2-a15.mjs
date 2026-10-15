// QA-003 M2 2회차: M2-A15 변형 반복(QM2-2 (b)) · 다른 재개 경로(c) · 사유 겹침(d) · 터치(f)
// 시간은 모두 실시간(가짜 시계 없음). 마우스 이동은 실제 입력 이벤트(page.mouse)다.
import { launch, mkctx, runCase, shot, sleep, openTitle, waitGuard, VP, TOUCH, PROD } from './m2r2-lib.mjs';

const browser = await launch();
const only = process.argv[2];
const want = (id) => !only || only.split(',').includes(id);

const stateOf = (p) =>
  p.evaluate(() => ({
    auto: document.querySelector('[data-testid=carousel]').dataset.autoplay,
    count: document.querySelector('[data-testid=carousel-count]').innerText.trim(),
    note: document.querySelector('[data-testid=carousel-auto-note]').innerText.trim(),
    pause: document.querySelector('[data-testid=carousel-pause]')?.getAttribute('aria-label') ?? null,
  }));

/** 표시 셋(안내 문구·data-autoplay·버튼 이름)이 서로 맞는가 (I2) */
function displayConsistent(s) {
  const on = s.auto === 'on';
  const noteOn = /7초마다/.test(s.note);
  const pauseOn = s.pause === null ? !on : /일시정지/.test(s.pause);
  return on === noteOn && (s.pause === null || on === pauseOn);
}

async function openDesktop(vp = VP.d1280) {
  const ctx = await mkctx(browser, { viewport: vp });
  const p = await ctx.newPage();
  await openTitle(p);
  await waitGuard(p);
  await p.mouse.move(2, 2);
  return { ctx, p };
}

/** 카드 밖의 목표 좌표(방향별). 카드 안이면 null */
async function outsidePoint(p, dir) {
  return p.evaluate((d) => {
    const card = document.querySelector('[data-testid=carousel]').getBoundingClientRect();
    const btn = document.querySelector('[data-testid=carousel-pause]').getBoundingClientRect();
    const cx = btn.left + btn.width / 2;
    const cy = btn.top + btn.height / 2;
    let x, y;
    if (d === 'up') [x, y] = [cx, Math.max(1, card.top - 14)];
    else if (d === 'down') [x, y] = [cx, Math.min(innerHeight - 90, card.bottom + 14)];
    else if (d === 'left') [x, y] = [Math.max(1, card.left - 20), cy];
    else [x, y] = [Math.min(innerWidth - 2, card.right + 20), cy];
    const hit = document.elementFromPoint(x, y);
    if (!hit || hit.closest('[data-testid=carousel]')) return null;
    return { x, y };
  }, dir);
}

/** 한 번의 시도: 일시정지 → 카드 밖 → 다시 시작 클릭 → delay → 이탈 → 8.6초 안에 다음 슬라이드로 넘어가는가 */
async function trial(vp, steps, dir, delay) {
  const { ctx, p } = await openDesktop(vp);
  try {
    await p.getByTestId('carousel-pause').click(); // 일시정지(포인터가 버튼 위로 들어가 클릭 — 좁은 폭에서는 화면이 스크롤된다)
    await p.mouse.move(5, 400);
    await sleep(120);
    const paused = await stateOf(p);
    await p.getByTestId('carousel-pause').click(); // 다시 시작(아이콘이 바뀜)
    const pt = await outsidePoint(p, dir); // 스크롤이 끝난 뒤 카드 밖 좌표를 잰다
    if (!pt) {
      await ctx.close();
      return { skipped: true };
    }
    if (delay) await sleep(delay);
    await p.mouse.move(pt.x, pt.y, { steps });
    await sleep(250);
    const right = await stateOf(p);
    await sleep(8300);
    const later = await stateOf(p);
    await ctx.close();
    const advanced = later.count !== paused.count;
    return { stuck: !advanced || later.auto !== 'on', advanced, paused, right, later, consistentRight: displayConsistent(right), consistentLater: displayConsistent(later) };
  } catch (e) {
    await ctx.close().catch(() => {});
    return { error: String(e.message).slice(0, 120) };
  }
}

async function runBatches(jobs, parallel) {
  const results = [];
  for (let i = 0; i < jobs.length; i += parallel) {
    const part = jobs.slice(i, i + parallel);
    const r = await Promise.all(part.map((j) => trial(j.vp, j.steps, j.dir, j.delay).then((x) => ({ ...j, ...x }))));
    results.push(...r);
    process.stdout.write(`  ${Math.min(i + parallel, jobs.length)}/${jobs.length}\r`);
  }
  return results;
}

if (want('A15b'))
  await runCase(
    { id: 'M2-A15b', cat: '공격', title: '「다시 시작」 직후 카드 밖으로 이탈 — 변형 반복(이탈 방식 steps 1·12 × 방향 4 × 지연 0·50·500ms × 20회) (QM2-2 (b))', steps: '1280x800 마우스, 실시간: 일시정지(클릭) → 카드 밖 → 「다시 시작」 클릭 → 지연 → 마우스를 카드 밖으로 이동(이벤트 1개 또는 12개) → 8.6초 뒤 슬라이드가 넘어갔는지·data-autoplay·표시 일치를 본다. 각 시도는 새 컨텍스트. 12개씩 병렬', expected: '멈춘 채 남는 횟수 0, 이탈 직후와 8.6초 뒤 표시 셋(안내 문구·data-autoplay·버튼 이름) 일치 100%' },
    async () => {
      const jobs = [];
      for (const steps of [1, 12]) for (const dir of ['up', 'down', 'left', 'right']) for (const delay of [0, 50, 500]) for (let k = 0; k < 20; k++) jobs.push({ vp: VP.d1280, steps, dir, delay, k });
      const res = await runBatches(jobs, 12);
      const stuck = res.filter((r) => r.stuck);
      const errs = res.filter((r) => r.error);
      const skipped = res.filter((r) => r.skipped);
      const inconsistent = res.filter((r) => !r.error && !r.skipped && (!r.consistentRight || !r.consistentLater));
      const done = res.filter((r) => !r.error && !r.skipped);
      const by = {};
      for (const r of done) {
        const k = `steps${r.steps}/${r.dir}/${r.delay}ms`;
        by[k] = by[k] || { n: 0, stuck: 0 };
        by[k].n++;
        if (r.stuck) by[k].stuck++;
      }
      const stuckSummary = Object.entries(by).filter(([, v]) => v.stuck).map(([k, v]) => `${k} ${v.stuck}/${v.n}`);
      const problems = [];
      if (stuck.length) problems.push(`멈춘 채 남음 ${stuck.length}/${done.length}: ${stuckSummary.join(', ')}`);
      if (inconsistent.length) problems.push(`표시와 동작 불일치 ${inconsistent.length}건 예 ${JSON.stringify(inconsistent[0].right)} → ${JSON.stringify(inconsistent[0].later)}`);
      if (errs.length > done.length * 0.05) problems.push(`스크립트 오류 ${errs.length}건 ${errs[0]?.error}`);
      return {
        verdict: problems.length ? 'FAIL' : 'PASS',
        severity: problems.length ? '낮음' : undefined,
        actual: problems.length ? problems.join(' / ') : `시도 ${done.length}회(조합 ${Object.keys(by).length}개 × 20) 중 멈춘 채 남음 0, 표시 불일치 0${skipped.length ? `, 카드 안이라 건너뜀 ${skipped.length}` : ''}${errs.length ? `, 스크립트 오류로 제외 ${errs.length}` : ''}. 조합별 성공: steps1 전 방향·전 지연, steps12 전 방향·전 지연`,
        shots: [],
      };
    }
  );

if (want('A15c'))
  await runCase(
    { id: 'M2-A15c', cat: '공격', title: '자동 전환 다른 재개 경로 — 1024·800 폭, 키보드, 포인터만, 사유 겹침, 터치 (QM2-2 (c)(d)(e)(f))', steps: '(1) 1024x768·800x900에서 변형(steps 1, 4방향) 5회씩 (2) 키보드: Space로 멈춤 → Tab으로 카드 밖 (3) 포인터만 올렸다 한 번에 뺌 (4) 사유 겹침: 포커스 유지+포인터 이탈 → 9초 불변, 블러 후 재개 (5) 360x740 터치 탭·스와이프 뒤 8.6초 안 전환', expected: '모든 경로에서 사유가 모두 풀린 뒤 8.6초 안에 전환, 사유가 남아 있으면 9초 불변, 표시 일치' },
    async () => {
      const problems = [];
      const facts = [];
      const shots = [];
      // (1) 다른 폭
      for (const [name, vp] of [['1024x768', VP.d1024], ['800x900', { width: 800, height: 900 }]]) {
        const jobs = [];
        for (const dir of ['up', 'down', 'left', 'right']) for (let k = 0; k < 5; k++) jobs.push({ vp, steps: 1, dir, delay: 0, k });
        const res = await runBatches(jobs, 10);
        const done = res.filter((r) => !r.error && !r.skipped);
        const st = res.filter((r) => r.stuck);
        facts.push(`${name}: ${done.length}회 중 멈춤 ${st.length}`);
        if (st.length) problems.push(`${name}: 멈춘 채 남음 ${st.length}/${done.length}`);
      }
      // (2) 키보드 Space 멈춤 → Tab으로 카드 밖
      {
        const { ctx, p } = await openDesktop();
        await p.getByTestId('carousel-pause').focus();
        await p.keyboard.press('Tab'); // 카드 안에서 한 칸 이동(포커스 유지)
        await p.getByTestId('carousel-pause').focus();
        await p.keyboard.press('Space'); // 멈춤
        await sleep(200);
        const paused = await stateOf(p);
        await p.keyboard.press('Space'); // 다시 시작(포커스는 카드 안에 있음 → 아직 멈춤 유지여야 함)
        await sleep(200);
        const afterResume = await stateOf(p);
        await sleep(9000);
        const stillFocus = await stateOf(p);
        // Tab으로 카드 밖(출처 링크 → 태어나기)
        for (let i = 0; i < 4; i++) {
          await p.keyboard.press('Tab');
          const out = await p.evaluate(() => !document.activeElement.closest('[data-testid=carousel]'));
          if (out) break;
        }
        await sleep(250);
        const outState = await stateOf(p);
        await sleep(8300);
        const later = await stateOf(p);
        shots.push(await shot(p, 'A15c', 'keyboard-resumed'));
        await ctx.close();
        const ok1 = paused.auto === 'off' && /다시 시작/.test(paused.pause ?? '');
        const ok2 = stillFocus.count === afterResume.count; // 포커스가 카드 안에 남아 있는 동안은 불변
        const ok3 = later.count !== stillFocus.count && later.auto === 'on';
        facts.push(`키보드: 멈춤 ${paused.auto}/${paused.pause} → Space 재개 후 포커스가 카드 안(${afterResume.auto}, 9초 ${afterResume.count}→${stillFocus.count}) → Tab으로 카드 밖(${outState.auto}) → 8.3초 뒤 ${later.count}/${later.auto}`);
        if (!ok1) problems.push(`키보드 멈춤 표시 이상 ${JSON.stringify(paused)}`);
        if (!ok2) problems.push(`포커스가 카드 안인데 9초 사이 슬라이드가 바뀜 ${afterResume.count}→${stillFocus.count}`);
        if (!ok3) problems.push(`Tab으로 카드 밖으로 나간 뒤 재개 안 됨 ${JSON.stringify(later)}`);
      }
      // (3) 포인터만 올렸다가 한 번에 뺌
      {
        const { ctx, p } = await openDesktop();
        const box = await p.getByTestId('carousel-viewport').boundingBox();
        await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 6 });
        await sleep(300);
        const hover = await stateOf(p);
        await sleep(8800);
        const hover2 = await stateOf(p);
        await p.mouse.move(40, 700); // 한 번에
        await sleep(250);
        const left = await stateOf(p);
        await sleep(8300);
        const later = await stateOf(p);
        await ctx.close();
        facts.push(`포인터만: 올림 ${hover.auto}(${hover.count}→9초 ${hover2.count}) → 한 번에 뺌 ${left.auto} → 8.5초 뒤 ${later.count}/${later.auto}`);
        if (hover.auto !== 'off' || hover.count !== hover2.count) problems.push(`포인터가 카드 위인데 안 멈춤 ${JSON.stringify(hover)}→${hover2.count}`);
        if (later.count === hover2.count || later.auto !== 'on') problems.push(`포인터를 한 번에 뺀 뒤 재개 안 됨 ${JSON.stringify(later)}`);
      }
      // (4) 사유 겹침: 키보드 포커스 + 포인터 → 포인터만 풀고 포커스 남음 → 9초 불변 → 블러 후 재개
      {
        const { ctx, p } = await openDesktop();
        await p.getByTestId('carousel-prev').focus();
        await p.keyboard.press('Shift+Tab');
        await p.keyboard.press('Tab'); // :focus-visible 보장
        const box = await p.getByTestId('carousel-viewport').boundingBox();
        await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 6 });
        await sleep(300);
        const both = await stateOf(p);
        await p.mouse.move(40, 700); // 포인터만 풀림
        await sleep(300);
        const c0 = await stateOf(p);
        await sleep(9000);
        const c1 = await stateOf(p);
        await p.evaluate(() => document.activeElement.blur());
        await sleep(250);
        const unblurred = await stateOf(p);
        await sleep(8300);
        const c2 = await stateOf(p);
        await ctx.close();
        facts.push(`사유 겹침: 둘 다 ${both.auto} → 포인터만 풀림 ${c0.auto}, 9초 ${c0.count}→${c1.count} → 블러 ${unblurred.auto} → 8.5초 뒤 ${c2.count}/${c2.auto}`);
        if (c0.auto !== 'off' || c0.count !== c1.count) problems.push(`포커스가 남았는데 포인터만 풀리자 재개/전환 ${JSON.stringify(c0)}→${c1.count}`);
        if (c2.count === c1.count || c2.auto !== 'on') problems.push(`마지막 사유(포커스)가 풀린 뒤 재개 안 됨 ${JSON.stringify(c2)}`);
      }
      // (5) 터치: 탭·스와이프 뒤 8.6초 안 전환
      {
        const ctx = await mkctx(browser, { viewport: VP.m360, ...TOUCH });
        const p = await ctx.newPage();
        await openTitle(p);
        await waitGuard(p);
        await p.getByTestId('carousel').scrollIntoViewIfNeeded();
        const vb = await p.getByTestId('carousel-viewport').boundingBox();
        const s0 = await stateOf(p);
        await p.touchscreen.tap(vb.x + vb.width / 2, vb.y + Math.min(vb.height / 2, 120));
        await sleep(300);
        const afterTap = await stateOf(p);
        // 스와이프(왼쪽)
        const sx = vb.x + vb.width * 0.8;
        const ex = vb.x + vb.width * 0.2;
        const sy = vb.y + Math.min(vb.height / 2, 120);
        const cdp = await ctx.newCDPSession(p);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: sx, y: sy }] });
        for (let i = 1; i <= 8; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: sx + ((ex - sx) * i) / 8, y: sy }] });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await sleep(400);
        const afterSwipe = await stateOf(p);
        await sleep(8600);
        const later = await stateOf(p);
        shots.push(await shot(p, 'A15c', 'touch-after'));
        await ctx.close();
        facts.push(`터치 360x740: 시작 ${s0.count}/${s0.auto} → 탭 ${afterTap.auto} → 스와이프 ${afterSwipe.count}/${afterSwipe.auto} → 8.6초 뒤 ${later.count}/${later.auto}`);
        if (afterTap.auto !== 'on' || afterSwipe.auto !== 'on') problems.push(`터치 탭/스와이프가 자동 전환을 멈춤 ${afterTap.auto}/${afterSwipe.auto}`);
        if (later.count === afterSwipe.count) problems.push(`터치 뒤 8.6초 안 전환 없음 ${afterSwipe.count}→${later.count}`);
      }
      return { verdict: problems.length ? 'FAIL' : 'PASS', severity: problems.length ? '낮음' : undefined, actual: problems.length ? problems.join(' / ') + ' || ' + facts.join(' ; ') : facts.join(' ; '), shots };
    }
  );

await browser.close();
