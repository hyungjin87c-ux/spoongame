// QA-003 M2 3회차: M2-B01~B05 — 낮은 화면에서 하단 띠 고정 해제 (SPEC QM2-12, 기록 4·R-233)
//  B01 66조합(11뷰포트 × 글자 100·200% × 새 판·이어하기·확인 단계): 고정이면 ≤ 50%, 풀리면 본문 끝·겹침 0·여백 0·버튼 닿음
//  B02 확인 단계를 사용자처럼 열기(휠로 내려 클릭): 안내문 첫 줄 + 취소 버튼 화면 안, 포커스 취소 버튼, Esc 복귀
//  B03 같은 페이지에서 창 크기·회전·글자 크기를 바꾸는 전환: 포커스 유지, 스크롤 튐 없음
//  B04 경계 근처 진동·깜빡임: 1px 단위로 천천히 / 빠르게 번갈아 / 글자 크기 훑기 — 클래스 전환 횟수, 정착 뒤 전환 0
//  B05 같은 측정을 눈에 보이는 스크롤바(15px)가 있는 크롬에서
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { launch, mkctx, runCase, shot, sleep, TOUCH, ensureFixture, seedContext, openState, STATES, STD_VIEWPORTS, DEV, PROD, waitGuard, openTitle, OUT, SHOT_DIR } from './m2r3-lib.mjs';
import { setRootFont } from './m2r3-textlib.mjs';
import { BAR_INFO, settleBar, wheelToBottom, judgeBar } from './m2r3-barlib.mjs';

const only = process.argv[2];
const want = (id) => !only || only.split(',').includes(id);
const browser = await launch();
const fx = await ensureFixture(browser);

const vpOpts = (vp) => ({ viewport: { width: vp.width, height: vp.height }, ...(vp.touch ? TOUCH : {}) });

/** 상태를 연다. confirm은 사용자처럼: (글자 크기를 먼저 정한 뒤) 이어하기 화면에서 휠로 내려 「새로 태어나기」를 마우스로 누른다 */
async function openWithFont(page, state, font) {
  if (state === 'new') {
    await openState(page, 'new');
  } else {
    await openState(page, 'continue');
  }
  if (font !== 100) await setRootFont(page, font);
  await settleBar(page);
  if (state === 'confirm') {
    await openConfirmByUser(page);
  }
}
async function openConfirmByUser(page) {
  await wheelToBottom(page);
  const b = await page.getByTestId('begin-new').boundingBox();
  if (!b) throw new Error('begin-new 없음');
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForSelector('[data-testid="confirm-new-ask"]', { timeout: 3000 });
  await sleep(450);
  await settleBar(page);
}

// ---------- B01: 66조합 ----------
if (want('B01'))
  await runCase(
    { id: process.env.QA_MUTATE ? 'M2-B01-변이점검' : 'M2-B01', cat: '정상', title: '띠 고정 해제 66조합 (QM2-12 (a)·(b)·(d)) — 11뷰포트 × 글자 100·200% × 새 판·이어하기·확인 단계', steps: '조합마다 상태를 열고(확인 단계는 사용자처럼 휠로 내려 마우스로 「새로 태어나기」) 정착 뒤 띠의 계산된 position·높이·화면 대비 비율·html.bar-released·문서 끝 위치·푸터 겹침·scroll-padding-bottom·본문 끝 여백·우측 열 max-height를 잰다. 풀린 조합은 휠로 맨 아래까지 내려 버튼이 화면 안·눌림(elementFromPoint)·높이 ≥ 44px인지 확인', expected: '고정이면 ≤ 50%, 풀리면 문서 끝에 놓이고 겹침·빈 여백 0, 여백은 기본 간격 이하, 버튼 닿음. 320×256 확인 단계(글자 100%)가 풀린 조합에 있음' },
    async () => {
      const problems = [];
      const rows = [];
      const released = [];
      const shots = [];
      let maxFixedRatio = 0;
      let maxFixedTag = '';
      for (const vp of STD_VIEWPORTS) {
        if (process.env.QA_ONLY_VP && process.env.QA_ONLY_VP !== vp.name) continue;
        for (const font of [100, 200]) {
          for (const state of STATES) {
            const tag = `${vp.name}/${font}%/${state}`;
            const ctx = await mkctx(browser, vpOpts(vp));
            if (state !== 'new') await seedContext(ctx, fx);
            const p = await ctx.newPage();
            try {
              await openWithFont(p, state, font);
              if (process.env.QA_MUTATE === 'norelease') { await p.addStyleTag({ content: 'html.bar-released .bottom-bar{position:fixed !important}' }); await sleep(200); } // 측정기 점검: 고정 해제를 꺼 둔 구현
              const info = await p.evaluate(BAR_INFO);
              const fixedLike = info.pos === 'fixed' || info.pos === 'sticky';
              if (fixedLike && info.ratio > maxFixedRatio) {
                maxFixedRatio = info.ratio;
                maxFixedTag = tag;
              }
              const probs = judgeBar(info, tag);
              problems.push(...probs);
              rows.push(`${tag}: ${fixedLike ? '고정' : '해제'} ${info.h}px/${info.vh}=${Math.round(info.ratio * 100)}%`);
              if (!fixedLike) {
                released.push(tag);
                // 휠로 맨 아래까지 → 버튼 닿음
                await wheelToBottom(p);
                const info2 = await p.evaluate(BAR_INFO);
                const mainBtns = info2.btns.filter((b) => ['start-birth', 'resume', 'confirm-new-no', 'confirm-new-yes', 'begin-new'].includes(b.id));
                if (!mainBtns.length) problems.push(`${tag}: 띠 안 버튼이 없음`);
                for (const b of mainBtns) {
                  if (!b.inView) problems.push(`${tag}: 맨 아래까지 내렸는데 「${b.id}」가 화면 밖 ${b.top}~${b.bottom} (뷰포트 ${info2.vh})`);
                  if (!b.hitOk) problems.push(`${tag}: 「${b.id}」 가운데 점이 다른 요소 위(눌리지 않음)`);
                  if (['start-birth', 'resume', 'confirm-new-no'].includes(b.id) && b.h < 44 - 0.5) problems.push(`${tag}: 「${b.id}」 높이 ${b.h}px < 44`);
                }
                if (Math.abs(info2.barAbsBottom - info2.docH) > 1.5) problems.push(`${tag}: (맨 아래) 띠 아래끝 ${info2.barAbsBottom} ≠ 문서 끝 ${info2.docH}`);
                // 맨 아래에서 띠 아래끝이 화면 아래끝인가
                if (Math.abs(info2.bottom - info2.vh) > 1.5) problems.push(`${tag}: 맨 아래에서 띠 아래끝(${info2.bottom})이 화면 아래끝(${info2.vh})과 다름`);
                if (['320x256-zoom400', '640x400-zoom200', '667x375-landscape'].includes(vp.name) || (vp.name === '1280x620' && font === 200) || (vp.name === '320x568' && state === 'confirm' && font === 200)) {
                  shots.push(await shot(p, 'B01', `${vp.name}-${font}-${state}-bottom`));
                }
              } else if (['320x568', '360x740-touch', '1280x800'].includes(vp.name) && font === 100 && state === 'new') {
                shots.push(await shot(p, 'B01', `${vp.name}-${font}-${state}-fixed`));
              }
              // 확인 단계: 안내문 첫 줄·취소 버튼 화면 안, 포커스 취소 버튼
              if (state === 'confirm') {
                const i2 = await p.evaluate(BAR_INFO);
                const cancel = i2.btns.find((b) => b.id === 'confirm-new-no');
                if (!i2.ask || !cancel) problems.push(`${tag}: 확인 단계 요소 없음`);
                else {
                  if (i2.ask.top < -0.5) problems.push(`${tag}: 확인 단계 안내문 첫 줄이 화면 위로 나감(${i2.ask.top})`);
                  if (!cancel.inView) problems.push(`${tag}: 확인 단계 취소 버튼이 화면 밖 ${cancel.top}~${cancel.bottom} (뷰포트 ${i2.vh})`);
                  if (i2.active !== 'confirm-new-no') problems.push(`${tag}: 확인 단계에서 포커스가 취소 버튼이 아님(${i2.active})`);
                }
              }
            } catch (e) {
              problems.push(`${tag}: 스크립트 오류 ${String(e.message).slice(0, 140)}`);
            }
            await ctx.close();
          }
        }
      }
      fs.writeFileSync(path.join(OUT, 'bar-66.txt'), rows.join('\n') + '\n');
      const must = '320x256-zoom400/100%/confirm';
      if (!released.includes(must)) problems.push(`공허 통과: 해제 목록에 ${must}가 없다 (해제 ${released.length}개: ${released.join(', ')})`);
      const uniq = [...new Set(problems)];
      return {
        verdict: uniq.length ? 'FAIL' : 'PASS',
        severity: uniq.length ? '중간' : undefined,
        actual: (uniq.length ? `이상 ${uniq.length}건: ${uniq.slice(0, 8).join(' // ')}${uniq.length > 8 ? ` …외 ${uniq.length - 8}건` : ''} || ` : `66조합 모두 규칙 충족 || `) + `고정 조합 최대 비율 ${Math.round(maxFixedRatio * 100)}%(${maxFixedTag}) || 해제 ${released.length}개: ${released.join(', ')} (목록 전체는 qa/results/m2r3/bar-66.txt)`,
        shots: shots.slice(0, 30),
      };
    }
  );

// ---------- B02: 확인 단계 열기·닫기 — 해제 조합에서 닿는가 ----------
if (want('B02'))
  await runCase(
    { id: 'M2-B02', cat: '정상', title: '해제 조합에서 「태어나기」·취소 버튼에 닿고, 확인 단계를 열면 안내문 첫 줄과 취소 버튼이 화면 안인가 (QM2-12 규칙 3·5)', steps: '글자 100·200% × 11뷰포트에서 이어하기 화면 → 휠로 맨 아래 → 마우스로 「새로 태어나기」 → 열린 뒤 안내문 첫 줄·취소 버튼 위치·포커스 → Esc → 포커스가 「새로 태어나기」로 돌아와 화면 안인지. 새 판(prod) 화면에서는 해제 조합에서 휠로 내려 「태어나기」를 눌러 출생 화면으로 가는지', expected: '열린 직후(고정↔해제 전환 포함) 안내문 첫 줄 top ≥ 0, 취소 버튼 bottom ≤ 뷰포트, 포커스 = 취소, Esc 뒤 포커스 = 새로 태어나기·화면 안, 새 판에서 태어나기 눌림' },
    async () => {
      const problems = [];
      const lines = [];
      const shots = [];
      for (const vp of STD_VIEWPORTS) {
        for (const font of [100, 200]) {
          const tag = `${vp.name}/${font}%`;
          // 이어하기 → 확인 단계 열기 → Esc
          {
            const ctx = await mkctx(browser, vpOpts(vp));
            await seedContext(ctx, fx);
            const p = await ctx.newPage();
            try {
              await openState(p, 'continue');
              if (font !== 100) await setRootFont(p, font);
              await settleBar(p);
              const before = await p.evaluate(BAR_INFO);
              await openConfirmByUser(p);
              const after = await p.evaluate(BAR_INFO);
              const cancel = after.btns.find((b) => b.id === 'confirm-new-no');
              const trans = `${before.released ? '해제' : '고정'}→${after.released ? '해제' : '고정'}`;
              lines.push(`${tag} 이어하기→확인 ${trans} 띠 ${after.h}px/${after.vh} 안내문 ${after.ask?.top}~${after.ask?.bottom} 취소 ${cancel?.top}~${cancel?.bottom} 포커스 ${after.active}`);
              if (!after.ask || after.ask.top < -0.5) problems.push(`${tag}: 확인 단계 안내문 첫 줄이 화면 밖(top ${after.ask?.top})`);
              if (!cancel || !cancel.inView) problems.push(`${tag}: 확인 단계 취소 버튼이 화면 안이 아님(${cancel?.top}~${cancel?.bottom}, 뷰포트 ${after.vh})`);
              if (after.active !== 'confirm-new-no') problems.push(`${tag}: 확인 단계 열린 뒤 포커스 ${after.active} (취소 버튼 기대)`);
              const probs = judgeBar(after, `${tag}/확인열림`);
              problems.push(...probs);
              if (trans === '고정→해제' || (font === 200 && ['320x568', '667x375-landscape', '640x400-zoom200'].includes(vp.name))) shots.push(await shot(p, 'B02', `${vp.name}-${font}-confirm-open-${trans.replace('→', '-to-')}`));
              // Esc
              await p.keyboard.press('Escape');
              await sleep(400);
              await settleBar(p);
              const back = await p.evaluate(BAR_INFO);
              const bn = back.btns.find((b) => b.id === 'begin-new');
              if (back.active !== 'begin-new') problems.push(`${tag}: Esc 뒤 포커스 ${back.active} (새로 태어나기 기대)`);
              if (!bn || !bn.inView) problems.push(`${tag}: Esc 뒤 「새로 태어나기」가 화면 밖(${bn?.top}~${bn?.bottom}, 뷰포트 ${back.vh})`);
              problems.push(...judgeBar(back, `${tag}/Esc뒤`));
            } catch (e) {
              problems.push(`${tag}: 이어하기 경로 스크립트 오류 ${String(e.message).slice(0, 140)}`);
            }
            await ctx.close();
          }
          // 새 판: 풀린 조합이면 휠로 내려 「태어나기」를 눌러 출생 화면으로
          {
            const ctx = await mkctx(browser, vpOpts(vp));
            const p = await ctx.newPage();
            try {
              await openState(p, 'new');
              if (font !== 100) await setRootFont(p, font);
              await settleBar(p);
              const i0 = await p.evaluate(BAR_INFO);
              if (i0.released) {
                await wheelToBottom(p);
                const b = await p.getByTestId('start-birth').boundingBox();
                if (!b) throw new Error('start-birth 없음');
                await p.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
                await p.mouse.down();
                await p.mouse.up();
                await p.waitForSelector('[data-testid=birth-screen]', { timeout: 5000 });
                lines.push(`${tag} 새 판(해제) 태어나기 눌림 → 출생 화면`);
              }
            } catch (e) {
              problems.push(`${tag}: 새 판 해제 조합에서 태어나기가 안 눌림/스크립트 오류 ${String(e.message).slice(0, 140)}`);
            }
            await ctx.close();
          }
        }
      }
      const uniq = [...new Set(problems)];
      fs.writeFileSync(path.join(OUT, 'bar-confirm-open.txt'), lines.join('\n') + '\n');
      return { verdict: uniq.length ? 'FAIL' : 'PASS', severity: uniq.length ? '중간' : undefined, actual: (uniq.length ? `이상 ${uniq.length}건: ${uniq.slice(0, 8).join(' // ')} || ` : '모든 조합에서 안내문 첫 줄·취소 버튼이 화면 안, 포커스 취소→Esc 뒤 새로 태어나기, 해제 조합의 새 판 태어나기 눌림 || ') + `전환이 있었던 조합: ${lines.filter((l) => l.includes('고정→해제')).map((l) => l.split(' ')[0]).join(', ') || '없음'}`, shots: shots.slice(0, 20) };
    }
  );

// ---------- B03: 전환 (같은 페이지에서 창 크기·회전·글자 크기) ----------
if (want('B03'))
  await runCase(
    { id: 'M2-B03', cat: '공격', title: '고정↔해제 전환 — 같은 페이지에서 창 크기·회전·글자 크기를 바꾼다 (QM2-12 규칙 5·(c))', steps: '① 320×568 이어하기 → 확인 단계 열기(고정) → 뷰포트만 320×256(해제, 포커스·안내문·취소 화면 안) → Esc → 다시 열기(고정→해제로 열림) → 320×568(고정, 포커스 유지) ② 667×375 글자 100→200→100%(확인 단계 열고) ③ 회전 667×375↔375×667 글자 200% (본문이 튀는지는 M2-B04가 1px 훑기에서 잰다)', expected: '전환마다 포커스 유지, 안내문 첫 줄·취소 버튼 화면 안, 가로 넘침 0' },
    async () => {
      const problems = [];
      const log = [];
      const shots = [];
      const ctx = await mkctx(browser, { viewport: { width: 320, height: 568 } });
      await seedContext(ctx, fx);
      const p = await ctx.newPage();
      const step = async (name, fn) => {
        await fn();
        await sleep(350);
        await settleBar(p);
        const i = await p.evaluate(BAR_INFO);
        const cancel = i.btns.find((b) => b.id === 'confirm-new-no');
        log.push(`${name}: ${i.pos === 'fixed' ? '고정' : '해제'} ${i.h}px/${i.vh} 포커스=${i.active} 안내문 ${i.ask ? i.ask.top + '~' + i.ask.bottom : '-'} 취소 ${cancel ? cancel.top + '~' + cancel.bottom : '-'}`);
        problems.push(...judgeBar(i, name));
        return i;
      };
      await openState(p, 'continue');
      await step('이어하기 320x568', async () => {});
      await wheelToBottom(p);
      let i = await step('확인 열기(고정)', async () => {
        const b = await p.getByTestId('begin-new').boundingBox();
        await p.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
        await p.mouse.down();
        await p.mouse.up();
      });
      if (i.active !== 'confirm-new-no') problems.push(`확인 열기 뒤 포커스 ${i.active}`);
      i = await step('뷰포트 320x256(해제로 전환)', async () => p.setViewportSize({ width: 320, height: 256 }));
      if (i.pos === 'fixed') problems.push('320x256 확인 단계인데 고정이 안 풀림');
      if (i.active !== 'confirm-new-no') problems.push(`고정→해제 전환 뒤 포커스를 잃음: ${i.active}`);
      {
        const c = i.btns.find((b) => b.id === 'confirm-new-no');
        if (!i.ask || i.ask.top < -0.5) problems.push(`전환 뒤 안내문 첫 줄이 화면 밖 ${i.ask?.top}`);
        if (!c || !c.inView) problems.push(`전환 뒤 취소 버튼이 화면 밖 ${c?.top}~${c?.bottom}`);
      }
      shots.push(await shot(p, 'B03', '320x256-confirm-released'));
      i = await step('Esc(해제 상태에서 닫기)', async () => p.keyboard.press('Escape'));
      if (i.active !== 'begin-new') problems.push(`해제에서 Esc 뒤 포커스 ${i.active}`);
      {
        const c = i.btns.find((b) => b.id === 'begin-new');
        if (!c || !c.inView) problems.push(`해제에서 Esc 뒤 「새로 태어나기」가 화면 밖`);
      }
      i = await step('뷰포트 320x568로 복귀', async () => p.setViewportSize({ width: 320, height: 568 }));
      if (i.pos !== 'fixed') problems.push('320x568 이어하기인데 고정이 안 돌아옴');
      if (i.active !== 'begin-new') problems.push(`해제→고정 전환 뒤 포커스 ${i.active}`);
      // 다시 열기: 고정 상태에서 확인 단계를 열고 곧바로 작은 뷰포트로
      await step('다시 열기(Enter)', async () => p.keyboard.press('Enter'));
      i = await step('뷰포트 320x256', async () => p.setViewportSize({ width: 320, height: 256 }));
      if (i.active !== 'confirm-new-no') problems.push(`재전환 뒤 포커스 ${i.active}`);
      // 작은 화면에서 이어하기 상태로 닫고 다시 열기 (해제에서 열기)
      await step('Esc', async () => p.keyboard.press('Escape'));
      i = await step('해제 상태에서 다시 열기(Enter)', async () => p.keyboard.press('Enter'));
      {
        const c = i.btns.find((b) => b.id === 'confirm-new-no');
        if (i.active !== 'confirm-new-no') problems.push(`해제에서 열기 뒤 포커스 ${i.active}`);
        if (!i.ask || i.ask.top < -0.5) problems.push(`해제에서 열기: 안내문 첫 줄 화면 밖 ${i.ask?.top}`);
        if (!c || !c.inView) problems.push(`해제에서 열기: 취소 버튼 화면 밖 ${c?.top}~${c?.bottom}`);
      }
      i = await step('뷰포트 320x568로 복귀', async () => p.setViewportSize({ width: 320, height: 568 }));
      if (i.active !== 'confirm-new-no') problems.push(`해제→고정 전환(확인 단계) 뒤 포커스 ${i.active}`);
      await ctx.close();

      // ② 글자 크기 도중
      {
        const c2 = await mkctx(browser, { viewport: { width: 667, height: 375 } });
        await seedContext(c2, fx);
        const q = await c2.newPage();
        await openState(q, 'continue');
        await settleBar(q);
        const f = async (name, pct) => {
          await setRootFont(q, pct);
          await sleep(300);
          await settleBar(q);
          const j = await q.evaluate(BAR_INFO);
          log.push(`글자 ${pct}% (${name}): ${j.pos === 'fixed' ? '고정' : '해제'} ${j.h}px/${j.vh}=${Math.round(j.ratio * 100)}% 포커스=${j.active}`);
          problems.push(...judgeBar(j, `667x375 글자 ${pct}% ${name}`));
          return j;
        };
        await f('이어하기', 100);
        await q.getByTestId('begin-new').focus();
        await f('이어하기', 200);
        await openConfirmByUser(q);
        let j = await f('확인 열림', 200);
        if (j.active !== 'confirm-new-no') problems.push(`667x375 확인 단계 글자 200%에서 포커스 ${j.active}`);
        for (const pct of [150, 175, 130, 100, 200]) {
          j = await f('확인 열림', pct);
          if (j.active !== 'confirm-new-no') problems.push(`글자 ${pct}%로 바꾸는 중 포커스 ${j.active}`);
          const cancel = j.btns.find((b) => b.id === 'confirm-new-no');
          if (!j.ask || j.ask.top < -0.5 || !cancel || !cancel.inView) problems.push(`667x375 글자 ${pct}% 확인 단계: 안내문 ${j.ask?.top} 취소 ${cancel?.top}~${cancel?.bottom} 뷰포트 ${j.vh}`);
        }
        shots.push(await shot(q, 'B03', '667x375-confirm-200'));
        // ③ 회전
        for (const [w, h] of [[375, 667], [667, 375], [375, 667], [667, 375]]) {
          await q.setViewportSize({ width: w, height: h });
          await sleep(300);
          await settleBar(q);
          const k = await q.evaluate(BAR_INFO);
          const cancel = k.btns.find((b) => b.id === 'confirm-new-no');
          log.push(`회전 ${w}x${h} 글자 200%: ${k.pos === 'fixed' ? '고정' : '해제'} ${k.h}px/${k.vh} 포커스=${k.active}`);
          problems.push(...judgeBar(k, `회전 ${w}x${h}`));
          if (k.active !== 'confirm-new-no') problems.push(`회전 ${w}x${h}: 포커스 ${k.active}`);
          if (!k.ask || k.ask.top < -0.5 || !cancel || !cancel.inView) problems.push(`회전 ${w}x${h}: 안내문 ${k.ask?.top} 취소 ${cancel?.top}~${cancel?.bottom}`);
        }
        await c2.close();
      }

      fs.writeFileSync(path.join(OUT, 'bar-transitions.txt'), log.join('\n') + '\n');
      const uniq = [...new Set(problems)];
      return { verdict: uniq.length ? 'FAIL' : 'PASS', severity: uniq.length ? '중간' : undefined, actual: (uniq.length ? `이상 ${uniq.length}건: ${uniq.slice(0, 8).join(' // ')} || ` : '전환 모든 단계에서 포커스 유지·안내문 첫 줄/취소 버튼 화면 안·규칙 충족 || ') + log.slice(0, 6).join(' ; ') + ' … (전체: qa/results/m2r3/bar-transitions.txt)', shots };
    }
  );

await browser.close();
