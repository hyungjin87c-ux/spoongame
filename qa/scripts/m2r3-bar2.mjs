// QA-003 M2 3회차: M2-B04 · B05 — 띠 고정 해제 경계 근처의 깜빡임·반복 진동 (SPEC QM2-12 규칙 5)
//  B04a 창 높이를 경계 ±25px에서 1px씩 천천히 내렸다 올림(전환 1번씩만, 본문이 튀지 않음)
//  B04b 경계 양쪽을 0~30ms 간격으로 80번 번갈아(밀려드는 resize) — 마지막 자극 뒤 전환 0
//  B04c 글자 크기를 100→300→100%로 2%씩 훑고, 100↔300%로 빠르게 번갈아
//  B04d 이분 상태(bistability) 점검: 같은 폭에서 띠를 고정으로 둘 때와 풀어 둘 때의 높이가 다르면 경계에서 스스로 번갈아 바뀔 수 있다 — 폭 280~1300을 훑어 차이를 찾고, 차이가 있으면 그 구간을 실제로 열어 본다
//  B05 같은 측정을 눈에 보이는 스크롤바(15px)가 있는 크롬에서 + 프레임 샘플 + 영상 프레임
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { mkctx, runCase, shot, sleep, TOUCH, ensureFixture, seedContext, openState, DEV, PROD, OUT, SHOT_DIR, launch, con } from './m2r3-lib.mjs';
import { setRootFont } from './m2r3-textlib.mjs';
import { BAR_INFO, settleBar } from './m2r3-barlib.mjs';

const only = process.argv[2];
const want = (id) => !only || only.split(',').includes(id);
const withScrollbars = process.env.QA_SCROLLBARS === '1';
const browser = withScrollbars ? await chromium.launch({ headless: true, ignoreDefaultArgs: ['--hide-scrollbars'] }) : await launch();
const b0 = await launch();
const fx = await ensureFixture(b0);
await b0.close();
const SUF = withScrollbars ? '-sb' : '';

/** 표본 조합: [이름, 폭, 상태, 글자%] — 경계는 측정으로 찾는다 */
const COMBOS = [
  ['320 확인 100%', 320, 'confirm', 100],
  ['320 확인 200%', 320, 'confirm', 200],
  ['360 확인 100%', 360, 'confirm', 100],
  ['360 이어하기 200%', 360, 'continue', 200],
  ['667 확인 200%', 667, 'confirm', 200],
  ['1280 확인 200%', 1280, 'confirm', 200],
  ['320 새 판 200%', 320, 'new', 200],
];

async function openCombo(ctxOpts, state, font, w, h = 900) {
  const ctx = await mkctx(browser, { ...ctxOpts, viewport: { width: w, height: h } });
  if (state !== 'new') await seedContext(ctx, fx);
  const p = await ctx.newPage();
  await openState(p, state === 'new' ? 'new' : 'continue');
  if (font !== 100) await setRootFont(p, font);
  await settleBar(p);
  if (state === 'confirm') {
    await p.getByTestId('begin-new').click();
    await p.waitForSelector('[data-testid=confirm-new-ask]');
    await sleep(450);
    await settleBar(p);
  }
  return { ctx, p };
}

async function installMonitor(p) {
  await p.evaluate(() => {
    const root = document.documentElement;
    const bar = document.querySelector('[data-testid=bottom-bar]');
    const mon = (window.__mon = { toggles: [], frames: [], stop: false });
    let last = root.classList.contains('bar-released');
    new MutationObserver(() => {
      const r = root.classList.contains('bar-released');
      if (r !== last) {
        last = r;
        mon.toggles.push({ t: Math.round(performance.now()), released: r, vh: innerHeight, h: bar.offsetHeight });
      }
    }).observe(root, { attributes: true, attributeFilter: ['class'] });
    const loop = () => {
      if (mon.stop) return;
      const r = bar.getBoundingClientRect();
      mon.frames.push([Math.round(performance.now()), root.classList.contains('bar-released') ? 1 : 0, Math.round(r.top), Math.round(r.height), innerHeight, Math.round(scrollY)]);
      if (mon.frames.length > 30000) mon.frames.shift();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });
}
const resetMonitor = (p) => p.evaluate(() => { window.__mon.toggles = []; window.__mon.frames = []; });
const readMonitor = (p) => p.evaluate(() => ({ toggles: window.__mon.toggles.slice(), frames: window.__mon.frames.slice() }));
const anchorTop = (p) => p.evaluate(() => Math.round(document.querySelector('[data-testid=era-group]').getBoundingClientRect().top + window.scrollY));
const shouldRelease = (h, vh) => h > vh * 0.5;
// 앱은 띠 높이를 offsetHeight(정수 반올림)로 잰다 — 소수점 아래 0.5px 안쪽(예 150.4px vs 절반 150px)은 어느 쪽이어도 어긋남으로 세지 않고 따로 센다
const consistent = (released, h, vh) => released === shouldRelease(h, vh) || Math.abs(h - vh * 0.5) <= 0.6;
const subpx = (released, h, vh) => released !== shouldRelease(h, vh) && Math.abs(h - vh * 0.5) <= 0.6;

/** 같은 상태에서 경계 높이(띠 높이의 2배)를 잰다 */
async function boundaryOf(p, w) {
  await p.setViewportSize({ width: w, height: 1200 });
  await sleep(250);
  await settleBar(p);
  const i = await p.evaluate(BAR_INFO);
  return { h: i.h, vhB: i.h * 2, info: i };
}

// ---------- B04a: 천천히 1px씩 ----------
if (want('B04a'))
  await runCase(
    { id: 'M2-B04a' + SUF, cat: '공격', title: `경계 근처에서 창 높이를 1px씩 천천히 내렸다 올림 — 해제↔고정이 한 번씩만 바뀌고 깜빡이지 않는가 (QM2-12 규칙 5)${withScrollbars ? ' [눈에 보이는 스크롤바 15px 크롬]' : ''}`, steps: '조합 7종(320·360·667·1280 폭 × 새 판·이어하기·확인 단계 × 글자 100·200%)에서 경계 높이(= 띠 높이 × 2)를 잰 뒤 그 +25px에서 −25px까지 1px씩(단계마다 90ms 정착) 내리고 다시 올린다. 매 단계 해제 여부·띠 높이·본문 앵커 위치를 기록하고 MutationObserver로 전환 횟수를, rAF로 프레임별 상태를 센다', expected: '내리는 동안 전환 1회, 올리는 동안 1회(합 2), 단계마다 해제 여부 = (띠 높이 > 뷰포트 높이 × 0.5), 본문 앵커 위치 변화 ≤ 1px, 200ms 안 전환 2번 이상(깜빡임) 0, 정착 뒤 1.5초 전환 0' },
    async () => {
      const problems = [];
      const facts = [];
      const shots = [];
      const subpxNotes = new Set();
      for (const [name, w, state, font] of COMBOS) {
        const { ctx, p } = await openCombo({}, state, font, w);
        try {
          const { h, vhB } = await boundaryOf(p, w);
          const top = Math.round(vhB + 25);
          const bot = Math.round(vhB - 25);
          await installMonitor(p);
          const sweep = async (from, to) => {
            const step = from < to ? 1 : -1;
            const rec = [];
            for (let vh = from; vh !== to + step; vh += step) {
              await p.setViewportSize({ width: w, height: vh });
              await sleep(90);
              const i = await p.evaluate(BAR_INFO);
              const a = await anchorTop(p);
              rec.push({ vh, released: i.released, h: i.h, ratio: i.ratio, pos: i.pos, anchor: a, sy: i.scrollY });
            }
            return rec;
          };
          await resetMonitor(p);
          const down = await sweep(top, bot);
          const mDown = await readMonitor(p);
          await resetMonitor(p);
          const up = await sweep(bot, top);
          const mUp = await readMonitor(p);
          // 정착 뒤 1.5초 관찰
          await resetMonitor(p);
          await sleep(1500);
          const quiet = await readMonitor(p);
          const check = (rec, m, dir) => {
            const flips = rec.filter((r, i) => i > 0 && r.released !== rec[i - 1].released).length;
            if (flips !== 1) problems.push(`${name} ${dir}: 해제↔고정 전환 ${flips}번(1번 기대) [${rec.filter((r, i) => i > 0 && r.released !== rec[i - 1].released).map((r) => r.vh).join(',')}]`);
            if (m.toggles.length !== 1) problems.push(`${name} ${dir}: 클래스 전환 ${m.toggles.length}번(MutationObserver, 1번 기대)`);
            // 200ms 안에 전환 2번 이상
            for (let i = 1; i < m.toggles.length; i++) if (m.toggles[i].t - m.toggles[i - 1].t < 200) problems.push(`${name} ${dir}: ${m.toggles[i].t - m.toggles[i - 1].t}ms 간격으로 연속 전환(깜빡임)`);
            for (const r of rec) {
              const exp = shouldRelease(r.h, r.vh);
              if (subpx(r.released, r.h, r.vh)) subpxNotes.add(`${name} 높이 ${r.vh}: 띠 ${r.h}px(절반 ${r.vh / 2}px보다 ${Math.round((r.h - r.vh / 2) * 10) / 10}px 큼)인데 고정 유지`);
              else if (!consistent(r.released, r.h, r.vh)) problems.push(`${name} ${dir}: 높이 ${r.vh}에서 해제=${r.released}인데 띠 ${r.h}px/${r.vh}=${Math.round(r.ratio * 1000) / 10}% (기대 해제=${exp}) — 어긋난 채 정착`);
              if (r.released !== (r.pos !== 'fixed' && r.pos !== 'sticky')) problems.push(`${name} ${dir}: 높이 ${r.vh}에서 클래스(${r.released})와 position(${r.pos})이 어긋남`);
            }
            const a0 = rec[0].anchor;
            for (const r of rec) if (Math.abs(r.anchor - a0) > 1) problems.push(`${name} ${dir}: 높이 ${r.vh}에서 본문 앵커 위치가 ${a0}→${r.anchor}로 튐`);
          };
          check(down, mDown, '내림');
          check(up, mUp, '올림');
          if (quiet.toggles.length) problems.push(`${name}: 정착 뒤 1.5초 동안 전환 ${quiet.toggles.length}번(스스로 번갈아 바뀜)`);
          const heightsFixed = [...down, ...up].filter((r) => !r.released).map((r) => r.h);
          const heightsRel = [...down, ...up].filter((r) => r.released).map((r) => r.h);
          const hf = heightsFixed.length ? Math.max(...heightsFixed) - Math.min(...heightsFixed) : 0;
          const hr = heightsRel.length ? Math.max(...heightsRel) - Math.min(...heightsRel) : 0;
          const avg = (a) => (a.length ? Math.round((a.reduce((x, y) => x + y, 0) / a.length) * 10) / 10 : null);
          facts.push(`${name}: 경계 ${vhB.toFixed(1)}(띠 ${h}) 내림 전환 ${mDown.toggles.length}·올림 ${mUp.toggles.length}, 고정일 때 띠 ${avg(heightsFixed)}px(편차 ${hf.toFixed(1)}) 해제일 때 ${avg(heightsRel)}px(편차 ${hr.toFixed(1)}), 정착 뒤 전환 ${quiet.toggles.length}, 프레임 ${mDown.frames.length + mUp.frames.length}`);
          if (Math.abs((avg(heightsFixed) ?? 0) - (avg(heightsRel) ?? 0)) > 0.6) problems.push(`${name}: 고정일 때 띠 높이(${avg(heightsFixed)})와 풀렸을 때(${avg(heightsRel)})가 다름 — 경계에서 서로를 부를 수 있음`);
          // 사람 눈: 경계 양쪽 화면
          await p.setViewportSize({ width: w, height: Math.round(vhB + 12) });
          await sleep(300);
          const s1 = await shot(p, 'B04a' + SUF, `${name.replace(/ /g, '')}-above`);
          await p.setViewportSize({ width: w, height: Math.round(vhB - 12) });
          await sleep(300);
          const s2 = await shot(p, 'B04a' + SUF, `${name.replace(/ /g, '')}-below`);
          if (name === '320 확인 100%' || name === '667 확인 200%') shots.push(s1, s2);
        } catch (e) {
          problems.push(`${name}: 스크립트 오류 ${String(e.message).slice(0, 160)}`);
        }
        await ctx.close();
      }
      const uniq = [...new Set(problems)];
      return { verdict: uniq.length ? 'FAIL' : 'PASS', severity: uniq.length ? '낮음' : undefined, actual: (uniq.length ? `이상 ${uniq.length}건: ${uniq.slice(0, 8).join(' // ')} || ` : '조합 7종 모두 내림 1회·올림 1회 전환, 어긋난 정착 0, 깜빡임 0, 본문 튐 0, 정착 뒤 전환 0 || ') + facts.join(' ; ') + (subpxNotes.size ? ` || [기록·소수점] ${[...subpxNotes].join(' / ')}` : ''), shots };
    }
  );

// ---------- B04b: 빠르게 번갈아 ----------
if (want('B04b'))
  await runCase(
    { id: 'M2-B04b' + SUF, cat: '공격', title: `경계 양쪽을 빠르게 번갈아 바꿔 본다(밀려드는 resize) — 마지막 자극 뒤 스스로 번갈아 바뀌지 않는가${withScrollbars ? ' [눈에 보이는 스크롤바 크롬]' : ''}`, steps: '조합 7종에서 경계 −4px / +4px 높이를 0·8·30ms 간격으로 80번 번갈아 setViewportSize, 이어서 경계 아래로 정지. 매 자극 1번당 전환 ≤ 1번(스스로 만든 전환 0), 마지막 자극 700ms 뒤 해제 여부가 최종 높이에 맞고 그 뒤 1.5초 전환 0, 콘솔 오류(ResizeObserver 루프 포함) 0', expected: '전환 횟수 ≤ 자극 횟수, 최종 상태가 맞음, 정착 뒤 전환 0, 콘솔 오류 0' },
    async () => {
      const problems = [];
      const facts = [];
      for (const [name, w, state, font] of COMBOS) {
        const { ctx, p } = await openCombo({}, state, font, w);
        try {
          const { h, vhB } = await boundaryOf(p, w);
          await installMonitor(p);
          con.take();
          for (const delay of [0, 8, 30]) {
            await resetMonitor(p);
            let stim = 0;
            const lo = Math.floor(vhB - 4);
            const hi = Math.ceil(vhB + 4);
            for (let n = 0; n < 80; n++) {
              await p.setViewportSize({ width: w, height: n % 2 ? lo : hi });
              stim++;
              if (delay) await sleep(delay);
            }
            await p.setViewportSize({ width: w, height: lo });
            stim++;
            await sleep(700);
            const m1 = await readMonitor(p);
            const i = await p.evaluate(BAR_INFO);
            if (!consistent(i.released, i.h, i.vh)) problems.push(`${name} 간격 ${delay}ms: 마지막 높이 ${i.vh}에서 해제=${i.released}인데 띠 ${i.h}px (어긋난 채 정착)`);
            if (m1.toggles.length > stim) problems.push(`${name} 간격 ${delay}ms: 자극 ${stim}번에 전환 ${m1.toggles.length}번 — 스스로 만든 전환`);
            await resetMonitor(p);
            await sleep(1500);
            const m2 = await readMonitor(p);
            if (m2.toggles.length) problems.push(`${name} 간격 ${delay}ms: 정착 뒤 1.5초 동안 전환 ${m2.toggles.length}번(스스로 번갈아 바뀜)`);
            facts.push(`${name}/${delay}ms: 자극 ${stim} 전환 ${m1.toggles.length} 정착 뒤 ${m2.toggles.length}`);
          }
          const errs = con.take().filter((c) => /ResizeObserver|error|Error/i.test(c.text) || c.type === 'pageerror');
          if (errs.length) problems.push(`${name}: 콘솔 오류 ${errs.length}건 ${errs[0].text.slice(0, 100)}`);
        } catch (e) {
          problems.push(`${name}: 스크립트 오류 ${String(e.message).slice(0, 160)}`);
        }
        await ctx.close();
      }
      const uniq = [...new Set(problems)];
      return { verdict: uniq.length ? 'FAIL' : 'PASS', severity: uniq.length ? '낮음' : undefined, actual: (uniq.length ? `이상 ${uniq.length}건: ${uniq.slice(0, 8).join(' // ')} || ` : '모든 조합에서 스스로 만든 전환 0·정착 뒤 전환 0·콘솔 오류 0 || ') + facts.slice(0, 9).join(' ; ') + ' …', shots: [] };
    }
  );

// ---------- B04c: 글자 크기 훑기 ----------
if (want('B04c'))
  await runCase(
    { id: 'M2-B04c' + SUF, cat: '공격', title: `글자 크기를 바꾸는 도중의 해제↔고정 (QM2-12 규칙 5)${withScrollbars ? ' [스크롤바 크롬]' : ''}`, steps: '667×375 확인 단계와 360×400 확인 단계에서 html 글자 크기를 100→300→100%로 2%씩(120ms 정착) 훑으며 전환 횟수·어긋남을 보고, 100%↔300%를 0·10ms 간격으로 60번 번갈아 바꾼 뒤 정착 상태·정착 뒤 전환 0을 본다. 확인 단계 포커스가 유지되는지', expected: '훑는 동안 전환 올림/내림 1번씩(글자 1%마다 띠 높이가 바뀌어도 한 방향), 어긋난 정착 0, 포커스 유지, 정착 뒤 전환 0' },
    async () => {
      const problems = [];
      const facts = [];
      for (const [name, w, h0] of [['667x375 확인', 667, 375], ['360x400 확인', 360, 400], ['320x568 확인', 320, 568]]) {
        const ctx = await mkctx(browser, { viewport: { width: w, height: h0 } });
        await seedContext(ctx, fx);
        const p = await ctx.newPage();
        try {
          await openState(p, 'continue');
          await settleBar(p);
          await p.getByTestId('begin-new').click();
          await p.waitForSelector('[data-testid=confirm-new-ask]');
          await sleep(450);
          await installMonitor(p);
          const seq = [];
          for (let f = 100; f <= 300; f += 2) seq.push(f);
          for (let f = 300; f >= 100; f -= 2) seq.push(f);
          await resetMonitor(p);
          const rec = [];
          for (const f of seq) {
            await setRootFont(p, f);
            await sleep(120);
            const i = await p.evaluate(BAR_INFO);
            rec.push({ f, released: i.released, h: i.h, vh: i.vh, ratio: i.ratio, active: i.active });
          }
          const m = await readMonitor(p);
          const flips = rec.filter((r, i) => i > 0 && r.released !== rec[i - 1].released).length;
          for (const r of rec) {
            if (!consistent(r.released, r.h, r.vh)) problems.push(`${name} 글자 ${r.f}%: 해제=${r.released}인데 띠 ${r.h}px/${r.vh} (어긋난 채 정착)`);
            if (r.active !== 'confirm-new-no') problems.push(`${name} 글자 ${r.f}%: 포커스 ${r.active}`);
          }
          // 띠 높이가 글자에 따라 단조롭지 않을 수 있으니(줄바꿈), 전환 횟수는 높이 곡선에서 기대되는 횟수와 견준다
          const expFlips = rec.filter((r, i) => i > 0 && shouldRelease(r.h, r.vh) !== shouldRelease(rec[i - 1].h, rec[i - 1].vh)).length;
          if (flips !== expFlips) problems.push(`${name}: 전환 ${flips}번인데 띠 높이 곡선상 기대 ${expFlips}번`);
          if (m.toggles.length !== flips) problems.push(`${name}: MutationObserver 전환 ${m.toggles.length}번 ≠ 관측 ${flips}번`);
          const hMax = Math.max(...rec.map((r) => r.h));
          facts.push(`${name}: 훑기 ${seq.length}단계 전환 ${flips}번(기대 ${expFlips}) 띠 높이 ${Math.min(...rec.map((r) => r.h))}~${hMax}px`);
          // 빠르게 번갈아
          for (const delay of [0, 10]) {
            await resetMonitor(p);
            for (let n = 0; n < 60; n++) {
              await setRootFont(p, n % 2 ? 300 : 100);
              if (delay) await sleep(delay);
            }
            await setRootFont(p, 200);
            await sleep(700);
            const m1 = await readMonitor(p);
            const i = await p.evaluate(BAR_INFO);
            if (!consistent(i.released, i.h, i.vh)) problems.push(`${name} 번갈아(${delay}ms): 마지막 200%에서 해제=${i.released} 띠 ${i.h}/${i.vh} 어긋남`);
            if (i.active !== 'confirm-new-no') problems.push(`${name} 번갈아(${delay}ms): 포커스 ${i.active}`);
            if (m1.toggles.length > 61) problems.push(`${name} 번갈아(${delay}ms): 전환 ${m1.toggles.length}번 > 자극 61번`);
            await resetMonitor(p);
            await sleep(1500);
            const m2 = await readMonitor(p);
            if (m2.toggles.length) problems.push(`${name} 번갈아(${delay}ms): 정착 뒤 전환 ${m2.toggles.length}번`);
            facts.push(`${name}/번갈아 ${delay}ms: 전환 ${m1.toggles.length}, 정착 뒤 ${m2.toggles.length}`);
          }
        } catch (e) {
          problems.push(`${name}: 스크립트 오류 ${String(e.message).slice(0, 160)}`);
        }
        await ctx.close();
      }
      const uniq = [...new Set(problems)];
      return { verdict: uniq.length ? 'FAIL' : 'PASS', severity: uniq.length ? '낮음' : undefined, actual: (uniq.length ? `이상 ${uniq.length}건: ${uniq.slice(0, 8).join(' // ')} || ` : '글자 훑기·빠른 번갈아 모두 어긋남 0·포커스 유지·정착 뒤 전환 0 || ') + facts.join(' ; '), shots: [] };
    }
  );

// ---------- B04d: 이분 상태(bistability) 점검 ----------
if (want('B04d'))
  await runCase(
    { id: 'M2-B04d' + SUF, cat: '공격', title: `띠를 고정으로 둘 때와 풀어 둘 때의 높이가 같은가 — 폭 280~1300 훑기 (경계에서 서로를 부르는 진동 가능성)${withScrollbars ? ' [스크롤바 크롬]' : ''}`, steps: '폭 280~1300을 6px 간격으로 바꾸며(높이 1200) 글자 100·200% × 새 판·이어하기·확인 단계에서 앱의 판정과 무관하게 띠의 position을 !important로 fixed / static으로 번갈아 강제해 높이(offsetHeight)를 잰다. 차이 ≥ 1px인 폭은 위험 구간 [2×해제 높이, 2×고정 높이)의 높이로 실제로 열어 정착 뒤 전환을 센다', expected: '모든 폭에서 고정 높이 = 해제 높이(차이 < 1px). 차이가 있으면 그 구간에서 정착 뒤 전환 0' },
    async () => {
      const problems = [];
      const diffs = [];
      let scanned = 0;
      const ctxs = [];
      for (const [state, font] of [['new', 100], ['new', 200], ['continue', 100], ['continue', 200], ['confirm', 100], ['confirm', 200]]) {
        const { ctx, p } = await openCombo({}, state, font, 360, 1200);
        ctxs.push(ctx);
        try {
          for (let w = 280; w <= 1300; w += 6) {
            await p.setViewportSize({ width: w, height: 1200 });
            await sleep(60);
            const r = await p.evaluate(() => {
              const bar = document.querySelector('[data-testid=bottom-bar]');
              const st = document.createElement('style');
              document.head.appendChild(st);
              const m = (pos) => {
                st.textContent = `.bottom-bar{position:${pos} !important}`;
                return Math.round(bar.getBoundingClientRect().height * 10) / 10;
              };
              const hFixed = m('fixed');
              const hStatic = m('static');
              st.remove();
              return { hFixed, hStatic };
            });
            scanned++;
            if (Math.abs(r.hFixed - r.hStatic) >= 1) diffs.push({ state, font, w, ...r });
          }
        } catch (e) {
          problems.push(`${state}/${font}: 스크립트 오류 ${String(e.message).slice(0, 140)}`);
        }
      }
      for (const c of ctxs) await c.close();
      // 차이가 있는 폭: 위험 구간을 실제로 열어 본다 (고정 높이가 더 클 때: vh ∈ [2*hStatic, 2*hFixed) / 해제 높이가 더 클 때는 반대)
      const tested = [];
      for (const d of diffs.slice(0, 12)) {
        const lo = Math.min(d.hFixed, d.hStatic) * 2;
        const hi = Math.max(d.hFixed, d.hStatic) * 2;
        const vh = Math.round((lo + hi) / 2);
        const { ctx, p } = await openCombo({}, d.state, d.font, d.w, 1200);
        await installMonitor(p);
        await p.setViewportSize({ width: d.w, height: vh });
        await sleep(800);
        await resetMonitor(p);
        await sleep(1500);
        const m = await readMonitor(p);
        const i = await p.evaluate(BAR_INFO);
        tested.push(`${d.state}/${d.font}%/폭${d.w}/높이${vh}: 고정 ${d.hFixed}·해제 ${d.hStatic}, 정착 뒤 전환 ${m.toggles.length}, 현재 ${i.released ? '해제' : '고정'} ${i.h}px`);
        if (m.toggles.length) problems.push(`폭 ${d.w} 높이 ${vh} (${d.state}/${d.font}%): 고정 ${d.hFixed}px·해제 ${d.hStatic}px가 달라 정착 뒤에도 ${m.toggles.length}번 번갈아 바뀜`);
        await ctx.close();
      }
      const uniq = [...new Set(problems)];
      fs.writeFileSync(path.join(OUT, `bar-bistability${SUF}.json`), JSON.stringify({ scanned, diffs }, null, 1));
      return { verdict: uniq.length ? 'FAIL' : 'PASS', severity: uniq.length ? '낮음' : undefined, actual: (uniq.length ? `이상 ${uniq.length}건: ${uniq.slice(0, 6).join(' // ')} || ` : `조합 ${scanned}개 폭에서 고정 높이 ≠ 해제 높이(≥ 1px)인 곳 ${diffs.length}개${diffs.length ? ', 위험 구간을 열어 봐도 정착 뒤 전환 0' : ''} || `) + tested.join(' ; ') + (diffs.length ? '' : ''), shots: [] };
    }
  );

await browser.close();
