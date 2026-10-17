// QA-003 M3 QM2-12: 룰렛·출생신고 하단 띠가 낮은 화면에서 절반을 넘으면 고정을 풀고, 다시 커지면 고정으로 돌아오며 포커스를 잃지 않는다.
// 사용: node qa/scripts/m3-bar.mjs
import { launch, mkctx, fixSeed, runCase, shot, openTitle, toRoulette, waitGuard, sleep, VP, TOUCH, setRootFont } from './m3r2-lib.mjs';
import { BAR_M3 } from './m3r2-a11ylib.mjs';

const browser = await launch();

async function barAt(p, w, h, font) {
  await p.setViewportSize({ width: w, height: h });
  await setRootFont(p, font);
  // 띠 상태가 가라앉을 때까지
  let last = '';
  for (let i = 0; i < 20; i++) {
    const k = await p.evaluate(() => {
      const b = document.querySelector('[data-testid=bottom-bar]');
      const r = b.getBoundingClientRect();
      return `${document.documentElement.classList.contains('bar-released')}|${Math.round(r.height)}|${getComputedStyle(b).position}|${window.innerHeight}`;
    });
    if (k === last) break;
    last = k;
    await sleep(80);
  }
  return p.evaluate(BAR_M3);
}

await runCase(
  { id: 'M3-B01', cat: '접근성', title: 'QM2-12 띠 고정 해제: 낮은 화면(글자 200%·창 높이 100~300px)에서 띠가 절반을 넘으면 풀리고, 풀린 띠는 본문 끝에 놓이며, 다시 커지면 고정으로 돌아온다 (룰렛 결과·출생신고)', steps: '320폭에서 높이 256→200→160→120→100→256으로 바꾸며(새로고침 없이) 글자 200%에서 띠 position·높이 비율·본문 끝 겹침·버튼 누름·포커스를 잰다. 룰렛 결과와 출생신고 각각', expected: '고정이면 띠 ≤ 화면 높이의 50%, 아니면 풀림(position static, bar-released)·띠 아래끝 = 문서 끝·마지막 줄과 겹침 0·scroll-padding-bottom ≤ 기본 간격, 전환 뒤에도 포커스 요소 유지, 버튼 높이 ≥ 44px' },
  async () => {
    const bad = [];
    const notes = [];
    const shots = [];
    for (const state of ['roulette-result', 'birth']) {
      const ctx = await mkctx(browser, { viewport: { width: 320, height: 568 }, ...TOUCH });
      await fixSeed(ctx, 229);
      const p = await ctx.newPage();
      await openTitle(p);
      await toRoulette(p, 'present');
      await waitGuard(p, 'skip-roulette');
      await p.getByTestId('skip-roulette').click();
      await p.waitForSelector('[data-testid="roulette-screen"][data-state="result"]');
      if (state === 'birth') {
        await waitGuard(p, 'to-birth');
        await p.getByTestId('to-birth').click();
        await p.waitForSelector('[data-testid="birth-screen"]');
      }
      await sleep(400);
      const btnId = state === 'birth' ? 'next-life' : 'to-birth';
      await p.getByTestId(btnId).focus();
      const seq = [[320, 568], [320, 256], [320, 200], [320, 160], [320, 120], [320, 100], [320, 256], [320, 568]];
      const trace = [];
      for (const [w, h] of seq) {
        const info = await barAt(p, w, h, 200);
        const tag = `${state}/${w}x${h}/200%`;
        const fixed = info.pos === 'fixed' || info.pos === 'sticky';
        trace.push(`${h}:${fixed ? '고정' : '해제'}(${Math.round(info.ratio * 100)}%)`);
        if (fixed && info.ratio > 0.5005) bad.push(`${tag}: 고정 띠 ${info.h}px = ${Math.round(info.ratio * 100)}% > 50%`);
        if (!fixed) {
          if (!info.released) bad.push(`${tag}: 풀렸는데 bar-released 클래스 없음`);
          if (Math.abs(info.barAbsBottom - info.docH) > 1.5) bad.push(`${tag}: 풀린 띠 아래끝 ${info.barAbsBottom} ≠ 문서 끝 ${info.docH}`);
          if (info.lastBottomAbs !== null && info.lastBottomAbs > info.barAbsTop + 1.5) bad.push(`${tag}: 풀린 띠가 마지막 줄과 겹침`);
          if (info.scrollPadBottom > info.sp3 + 0.5) bad.push(`${tag}: 풀린 뒤 scroll-padding-bottom ${info.scrollPadBottom}`);
          if (info.endSpace && info.endSpace.display !== 'none' && info.endSpace.h > 0) bad.push(`${tag}: 풀린 뒤에도 본문 끝 여백 ${info.endSpace.h}px`);
        }
        // 포커스 유지·버튼 누름 가능
        const foc = await p.evaluate(() => document.activeElement?.getAttribute('data-testid'));
        if (foc !== btnId) bad.push(`${tag}: 전환 뒤 포커스 ${foc} (${btnId} 유지 기대)`);
        const btn = await p.evaluate((id) => {
          const b = document.querySelector(`[data-testid="${id}"]`);
          b.scrollIntoView({ block: 'end' });
          const r = b.getBoundingClientRect();
          const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          return { h: Math.round(r.height), clickable: !!hit && (b === hit || b.contains(hit)), inView: r.top >= -0.5 && r.bottom <= innerHeight + 0.5 };
        }, btnId);
        if (btn.h < 44) bad.push(`${tag}: 버튼 높이 ${btn.h}px`);
        if (!btn.clickable) bad.push(`${tag}: 버튼을 누를 수 없음`);
        if (!btn.inView) bad.push(`${tag}: 버튼이 화면 안에 없음(스크롤해도)`);
        if (h === 160 || h === 100) shots.push(await shot(p, 'B01', `${state}-${h}`));
        await p.evaluate(() => window.scrollTo(0, 0));
        await p.getByTestId(btnId).focus();
      }
      notes.push(`${state}: ${trace.join(' → ')}`);
      // 풀린 상태에서 실제로 누른다
      await barAt(p, 320, 120, 200);
      await p.evaluate((id) => document.querySelector(`[data-testid="${id}"]`).scrollIntoView({ block: 'end' }), btnId);
      await sleep(200);
      await waitGuard(p, btnId);
      await p.getByTestId(btnId).click();
      await sleep(600);
      const scr = await p.evaluate(() => (document.querySelector('[data-testid="birth-screen"]') ? 'birth' : document.querySelector('[data-testid="life-screen"]') ? 'life' : 'other'));
      if ((state === 'roulette-result' && scr !== 'birth') || (state === 'birth' && scr !== 'life')) bad.push(`${state}: 풀린 띠의 버튼을 눌렀는데 ${scr}`);
      await ctx.close();
    }
    return { verdict: bad.length ? 'FAIL' : 'PASS', severity: '중간(접근성)', actual: bad.length ? bad.slice(0, 6).join(' / ') : notes.join(' | '), shots };
  },
);
await browser.close();
