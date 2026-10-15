// QA-003 M2 2회차: M2-V04(글자 200% 첫 화면) 재실행 + 글자 100~200% × 320·360 × 상태 3종 × 라이트·다크, 브라우저 확대 상당(640x400·512x384·320x256), 캐러셀 14장, 줄바꿈
import { launch, mkctx, runCase, shot, sleep, openTitle, waitGuard, VP, TOUCH, PROD, ensureFixture, seedContext, openState, STATES } from './m2r2-lib.mjs';
import { OVERFLOW_AUDIT, LINE_AUDIT, setRootFont } from './m2r2-textlib.mjs';

const browser = await launch();
const fx = await ensureFixture(browser);
const only = process.argv[2];
const want = (id) => !only || only.split(',').includes(id);
const FONTS = [100, 125, 150, 175, 200];

async function newPage(vp, state, scheme = 'light', touch = true) {
  const ctx = await mkctx(browser, { viewport: vp, colorScheme: scheme, ...(touch && vp.width <= 500 ? TOUCH : {}) });
  if (state !== 'new') await seedContext(ctx, fx);
  const p = await ctx.newPage();
  await openState(p, state);
  return { ctx, p };
}

function judge(tag, a, problems, opts = {}) {
  if (a.docOverflowPx > 0) problems.push(`${tag}: 문서 가로 넘침 ${a.docOverflowPx}px (${a.scrollW}>${a.clientW}) ${a.offenders.slice(0, 4).join(', ')}`);
  else if (a.offenders.length) problems.push(`${tag}: 화면 오른쪽 밖 요소 ${a.offenders.slice(0, 4).join(', ')}`);
  if (a.clipped.length) problems.push(`${tag}: 글자/상자 잘림 ${a.clipped.slice(0, 3).join(', ')}`);
  if (a.labelOverlap.length) problems.push(`${tag}: 수저 이름표 ${a.labelOverlap.slice(0, 3).join(', ')}`);
  if (a.bar && a.bar.ratio > 0.5 && !opts.noBarLimit) problems.push(`${tag}: 하단 띠 ${a.bar.h}px = 화면의 ${Math.round(a.bar.ratio * 100)}%`);
  if (a.startBtn && (a.startBtn.h < 44 || !a.startBtn.clickable)) problems.push(`${tag}: 기본 버튼 ${a.startBtn.id} 높이 ${a.startBtn.h}px 누를 수 있음=${a.startBtn.clickable}`);
}

// ---------- 1) 1회차와 같은 절차 ----------
if (want('V04'))
  await runCase(
    { id: 'M2-V04', cat: '공격', title: '아주 좁은 화면(280px 폴더블)·루트 글자 200% 첫 화면 (CM4) — 1회차와 같은 절차', steps: '280x653에서 가로 넘침·버튼, 360x740에서 html 글자 크기를 100·125·150·175·200%로 키워 넘침·하단 띠 높이·태어나기 조작 확인(새 판)', expected: '가로 넘침 0, 태어나기를 누를 수 있음, 하단 띠가 화면의 절반을 넘지 않음' },
    async () => {
      const problems = [];
      const facts = [];
      const shots = [];
      {
        const { ctx, p } = await newPage({ width: 280, height: 653 }, 'new');
        const a = await p.evaluate(OVERFLOW_AUDIT);
        judge('280x653', a, problems);
        facts.push(`280x653: 넘침 ${a.docOverflowPx}px(${a.scrollW}>${a.clientW}), 띠 ${a.bar?.h}px, 버튼 ${a.startBtn?.h}px`);
        shots.push(await shot(p, 'V04', '280'));
        await ctx.close();
      }
      {
        const { ctx, p } = await newPage(VP.m360, 'new');
        for (const f of FONTS) {
          await setRootFont(p, f);
          await sleep(300);
          const a = await p.evaluate(OVERFLOW_AUDIT);
          judge(`360x740 ${f}%`, a, problems);
          facts.push(`${f}%: 넘침 ${a.docOverflowPx}px, 띠 ${a.bar?.h}/${a.bar?.vh}px, 버튼 ${a.startBtn?.h}px`);
          if (f === 200) {
            shots.push(await shot(p, 'V04', 'bigtext'));
            shots.push(await shot(p, 'V04', 'bigtext-full', { full: true }));
          }
        }
        await ctx.close();
      }
      return { verdict: problems.length ? 'FAIL' : 'PASS', severity: problems.length ? '낮음' : undefined, actual: (problems.length ? problems.join(' / ') + ' || ' : '') + facts.join(' ; '), shots };
    }
  );

// ---------- 2) 글자 100~200% × 320·360 × 상태 3종 × 라이트·다크 ----------
if (want('V04b'))
  await runCase(
    { id: 'M2-V04b', cat: '공격', title: '글자 크기 100~200% × 폭 320·360 × 첫 화면 3상태(새 판·이어하기·확인 단계) × 라이트·다크 (CM11·QM2-3 (a))', steps: 'html 글자 크기 100/125/150/175/200%로 키우며 가로 넘침(문서 + 화면에 보이는 모든 요소), 글자 잘림, 수저 이름표 겹침·줄 밖, 하단 띠 ≤ 50%, 기본 버튼 높이 ≥ 44px·누름 가능을 잰다', expected: '모든 조합에서 가로 넘침 0px, 잘림 0, 이름표 겹침 0, 띠 ≤ 50%, 버튼 ≥ 44px' },
    async () => {
      const problems = [];
      const rows = [];
      const shots = [];
      let n = 0;
      for (const vp of [VP.m320, VP.m360]) {
        for (const state of STATES) {
          for (const scheme of ['light', 'dark']) {
            const { ctx, p } = await newPage(vp, state, scheme);
            const cells = [];
            for (const f of FONTS) {
              await setRootFont(p, f);
              await sleep(350);
              const a = await p.evaluate(OVERFLOW_AUDIT);
              n++;
              judge(`${vp.width}x${vp.height}/${state}/${scheme}/${f}%`, a, problems);
              cells.push(`${f}%:${a.docOverflowPx}px·띠${a.bar?.h}`);
              if (f === 200 && scheme === 'light') shots.push(await shot(p, 'V04b', `${vp.width}x${vp.height}-${state}-200`));
              if (f === 200 && scheme === 'dark' && vp.width === 360) shots.push(await shot(p, 'V04b', `${vp.width}x${vp.height}-${state}-200-dark`));
            }
            rows.push(`${vp.width}/${state}/${scheme[0]}: ${cells.join(' ')}`);
            await ctx.close();
          }
        }
      }
      return { verdict: problems.length ? 'FAIL' : 'PASS', severity: problems.length ? '낮음' : undefined, actual: (problems.length ? `이상 ${problems.length}건: ${problems.slice(0, 8).join(' // ')} || ` : `${n}개 조합 모두 가로 넘침 0px·잘림 0·이름표 겹침 0·띠 ≤ 50%·버튼 ≥ 44px || `) + rows.join(' ; '), shots: shots.slice(0, 14) };
    }
  );

// ---------- 3) 브라우저 확대 상당 (A14 유지) ----------
if (want('V04c'))
  await runCase(
    { id: 'M2-V04c', cat: '공격', title: '브라우저 확대 상당 뷰포트 640x400·512x384·320x256·180x370(참고) × 상태 3종 (CM11 (나)·M2-A14 유지)', steps: '뷰포트를 CSS 크기로 줄여(확대 200·400% 상당) 상태 3종의 가로 넘침·이름표·띠·버튼 확인', expected: '320 CSS px 이상에서 가로 넘침 0, 이름표 겹침·잘림 0, 기본 버튼 높이 ≥ 44px·누름 가능(하단 띠 비율은 (가) 조건의 기준이라 여기서는 기록만)' },
    async () => {
      const problems = [];
      const rows = [];
      const shots = [];
      for (const vp of [{ width: 640, height: 400 }, { width: 512, height: 384 }, { width: 320, height: 256 }]) {
        for (const state of STATES) {
          const { ctx, p } = await newPage(vp, state, 'light', false);
          const a = await p.evaluate(OVERFLOW_AUDIT);
          judge(`${vp.width}x${vp.height}/${state}`, a, problems, { noBarLimit: true }); // (나) 조건의 완료 기준은 가로 넘침 0(QM2-3 (c)) — 띠 ≤ 50%는 (가) 조건 기준이라 기록만 한다
          rows.push(`${vp.width}x${vp.height}/${state}: 넘침 ${a.docOverflowPx}px 띠 ${a.bar?.h}/${a.bar?.vh}(${Math.round((a.bar?.ratio ?? 0) * 100)}%) 버튼 ${a.startBtn?.h}px${a.bar && a.bar.ratio > 0.5 ? ' ←띠가 화면의 절반 넘음(기록)' : ''}`);
          shots.push(await shot(p, 'V04c', `${vp.width}x${vp.height}-${state}`));
          await ctx.close();
        }
      }
      // 참고: 180px(360폰의 200% 확대) — 320 CSS px 미만이라 WCAG 리플로 기준 밖, 기록만
      {
        const { ctx, p } = await newPage({ width: 180, height: 370 }, 'new', 'light', false);
        const a = await p.evaluate(OVERFLOW_AUDIT);
        rows.push(`(참고, 판정 제외) 180x370: 넘침 ${a.docOverflowPx}px ${a.offenders.slice(0, 2).join(',')}`);
        shots.push(await shot(p, 'V04c', '180x370-ref'));
        await ctx.close();
      }
      return { verdict: problems.length ? 'FAIL' : 'PASS', severity: problems.length ? '낮음' : undefined, actual: (problems.length ? problems.slice(0, 8).join(' // ') + ' || ' : '') + rows.join(' ; '), shots };
    }
  );

await browser.close();
