// QA-003 M3 2회차 — M3-L02(낱말 중간 끊김, QM3-1)·QM3-2(제목) 독립 측정.
// 11뷰포트 × 글자 100·125·150·175·200%(낱말은 100·150·200) × 상태(룰렛 결과 7·회전 중·움직임 줄이기·출생신고 15·첫 화면 새 판/이어하기/확인/캐러셀 14장).
// 사용: node qa/scripts/m3r2-l02.mjs <뷰포트이름[,이름]|all> [상태필터]   결과: qa/results/m3r2/l02-<뷰포트>.jsonl
import fs from 'node:fs';
import path from 'node:path';
import { launch, mkctx, fixSeed, openTitle, toRoulette, waitGuard, sleep, shot, OUT, STD_VIEWPORTS, TOUCH, setRootFont, DEV, PROD } from './m3r2-lib.mjs';
import { WB_AUDIT, H1_AUDIT } from './m3r2-wb.mjs';

const INTENDED = ['다이아몬드수저'];
const argVp = process.argv[2] && process.argv[2] !== 'all' ? process.argv[2].split(',') : null;
const argState = process.argv[3] || null;
const FONTS = [100, 125, 150, 175, 200];
const WB_FONTS = [100, 150, 200];

// 상태: 룰렛 결과(5수저 + 지난·다가올) · 회전 중 · 움직임 줄이기 · 출생신고 15표본
const RESULTS = [
  { key: 'result-dirt-honam', era: 'present', seed: 61 },
  { key: 'result-copper-honam', era: 'present', seed: 71 },
  { key: 'result-silver-honam', era: 'present', seed: 93 },
  { key: 'result-gold-honam', era: 'present', seed: 199 },
  { key: 'result-diamond-honam', era: 'present', seed: 229 },
  { key: 'result-past-dirt', era: 'past', seed: 155 },
  { key: 'result-future-diamond', era: 'future', seed: 138 },
];
const BIRTHS = [
  { key: 'birth-present-4242-silver-jeju', era: 'present', seed: 4242 },
  { key: 'birth-present-229-diamond-honam', era: 'present', seed: 229 },
  { key: 'birth-present-5-labor-service-changwon', era: 'present', seed: 5 },
  { key: 'birth-present-61-dirt-naju', era: 'present', seed: 61 },
  { key: 'birth-present-31-service-machine-seoul', era: 'present', seed: 31 },
  { key: 'birth-present-125-labor-labor-hwaseong', era: 'present', seed: 125 },
  { key: 'birth-present-62-farm', era: 'present', seed: 62 },
  { key: 'birth-present-113-jeju-seogwipo', era: 'present', seed: 113 },
  { key: 'birth-present-41-jeonbuk-deokjin', era: 'present', seed: 41 },
  { key: 'birth-present-42-gangwon-samcheok', era: 'present', seed: 42 },
  { key: 'birth-past-155-dirt', era: 'past', seed: 155 },
  { key: 'birth-past-183-gold-daejeon', era: 'past', seed: 183 },
  { key: 'birth-past-42-farm-labor', era: 'past', seed: 42 },
  { key: 'birth-future-138-diamond', era: 'future', seed: 138 },
  { key: 'birth-future-5-labor-service', era: 'future', seed: 5 },
];

const vps = STD_VIEWPORTS.filter((v) => !argVp || argVp.includes(v.name));
const browser = await launch();

const ctxFor = async (vp, extra = {}) => mkctx(browser, { viewport: { width: vp.width, height: vp.height }, ...(vp.touch ? TOUCH : {}), ...extra });

async function openRoulette(vp, era, seed, mode) {
  const extra = mode === 'reduced' ? { reducedMotion: 'reduce' } : {};
  const ctx = await ctxFor(vp, extra);
  await fixSeed(ctx, seed);
  const p = await ctx.newPage();
  await openTitle(p);
  await toRoulette(p, era);
  if (mode === 'spin') {
    await sleep(700);
    return { ctx, p };
  }
  if (mode === 'reduced') {
    await p.waitForSelector('[data-testid="roulette-screen"][data-state="result"]', { timeout: 4000 });
    await sleep(400);
    return { ctx, p };
  }
  await waitGuard(p, 'skip-roulette');
  await p.getByTestId('skip-roulette').click();
  await p.waitForSelector('[data-testid="roulette-screen"][data-state="result"]', { timeout: 3000 });
  await sleep(450);
  if (mode === 'birth') {
    await waitGuard(p, 'to-birth');
    await p.getByTestId('to-birth').click();
    await p.waitForSelector('[data-testid="birth-screen"]', { timeout: 4000 });
    await sleep(450);
  }
  return { ctx, p };
}

async function openTitleKind(vp, kind) {
  const ctx = await ctxFor(vp);
  await fixSeed(ctx, 2468);
  const p = await ctx.newPage();
  if (kind === 'title-new') {
    await openTitle(p);
    await sleep(500);
    return { ctx, p };
  }
  // 이어하기·확인 단계: 개발 서버에서 룰렛 단계 저장을 만든 뒤 ?__exit로 첫 화면을 다시 연다(앱 코드는 같다)
  await p.goto(DEV);
  await p.waitForSelector('[data-testid="title-screen"]');
  await toRoulette(p, 'present');
  await sleep(700);
  await p.goto(DEV + '?__exit');
  await p.waitForSelector('[data-testid="resume"]', { timeout: 8000 });
  await sleep(500);
  if (kind === 'title-confirm') {
    await waitGuard(p, 'begin-new');
    await p.getByTestId('begin-new').click();
    await p.waitForSelector('[data-testid="confirm-new-ask"]', { timeout: 4000 });
    await sleep(300);
  }
  return { ctx, p };
}

const rowsFile = (vp) => path.join(OUT, `l02-${vp.name}.jsonl`);
const flagShots = new Set();
async function record(p, vp, key, font, rowBase, doWb, doH1) {
  const row = { ...rowBase, vp: vp.name, font, key };
  if (doWb) {
    const wb = await p.evaluate(WB_AUDIT, { intended: INTENDED });
    row.wb = { wordsN: wb.wordsN, charsN: wb.charsN, shy: wb.shy, cats: wb.cats, broken: wb.broken, unavoidable: wb.unavoidable, intended: wb.intended, wbrEls: wb.wbrEls };
  }
  if (doH1) row.h1 = await p.evaluate(H1_AUDIT);
  row.screenState = await p.evaluate(() => document.querySelector('[data-testid="roulette-screen"]')?.getAttribute('data-state') ?? null);
  fs.appendFileSync(rowsFile(vp), JSON.stringify(row) + '\n');
  // 스크린샷: 낱말 끊김이 나온 조합(앞 12장) + 대표(허용된 끊김 첫 건)
  const flagged = row.wb && row.wb.broken.length;
  const unav = row.wb && row.wb.unavoidable.length;
  const tag = `${vp.name}-${font}-${key}`;
  if ((flagged && flagShots.size < 12) || (unav && flagShots.size < 6 && font === 200)) {
    if (!flagShots.has(tag)) {
      flagShots.add(tag);
      await p.evaluate(() => window.scrollTo(0, 0));
      await shot(p, 'L02', `${tag}${flagged ? '-FLAG' : '-unavoidable'}`);
    }
  }
  return row;
}

let total = 0;
for (const vp of vps) {
  fs.writeFileSync(rowsFile(vp), '');
  const t0 = Date.now();
  const jobs = [];
  for (const r of RESULTS) jobs.push({ key: r.key, open: () => openRoulette(vp, r.era, r.seed, 'result'), mode: 'static' });
  jobs.push({ key: 'roulette-reduced', open: () => openRoulette(vp, 'present', 229, 'reduced'), mode: 'static' });
  for (const b of BIRTHS) jobs.push({ key: b.key, open: () => openRoulette(vp, b.era, b.seed, 'birth'), mode: 'static' });
  jobs.push({ key: 'title-new', open: () => openTitleKind(vp, 'title-new'), mode: 'title' });
  jobs.push({ key: 'title-continue', open: () => openTitleKind(vp, 'title-continue'), mode: 'title' });
  jobs.push({ key: 'title-confirm', open: () => openTitleKind(vp, 'title-confirm'), mode: 'title' });
  jobs.push({ key: 'spin', mode: 'spin' });
  for (const j of jobs) {
    if (argState && !j.key.includes(argState)) continue;
    try {
      if (j.mode === 'spin') {
        for (const font of FONTS) {
          const { ctx, p } = await openRoulette(vp, 'present', 229, 'spin');
          await setRootFont(p, font);
          await sleep(120);
          const st0 = await p.evaluate(() => document.querySelector('[data-testid="roulette-screen"]')?.getAttribute('data-state'));
          await record(p, vp, 'spin', font, { stateBefore: st0 }, WB_FONTS.includes(font), true);
          total++;
          await ctx.close();
        }
        continue;
      }
      const { ctx, p } = await j.open();
      for (const font of FONTS) {
        await setRootFont(p, font);
        await sleep(220);
        await p.evaluate(() => window.scrollTo(0, 0));
        await sleep(80);
        await record(p, vp, j.key, font, {}, WB_FONTS.includes(font), true);
        total++;
      }
      if (j.key === 'title-new') {
        // 캐러셀 14장 전체: 글자 100·150·200%
        await setRootFont(p, 100);
        await sleep(250);
        await p.getByTestId('carousel-pause').scrollIntoViewIfNeeded().catch(() => {});
        for (const font of WB_FONTS) {
          await setRootFont(p, font);
          await sleep(250);
          // 처음 장으로
          for (let g = 0; g < 14; g++) {
            const c = (await p.getByTestId('carousel-count').textContent().catch(() => '')) || '';
            if (c.trim().startsWith('1 /')) break;
            await waitGuard(p, 'carousel-prev').catch(() => {});
            await p.getByTestId('carousel-prev').click().catch(() => {});
            await sleep(220);
          }
          for (let i = 1; i <= 14; i++) {
            await sleep(220);
            const row = await record(p, vp, `carousel-${String(i).padStart(2, '0')}`, font, {}, true, false);
            total++;
            if (i < 14) {
              await waitGuard(p, 'carousel-next').catch(() => {});
              await p.getByTestId('carousel-next').click().catch(() => {});
            }
          }
        }
      }
      await ctx.close();
    } catch (e) {
      fs.appendFileSync(rowsFile(vp), JSON.stringify({ vp: vp.name, key: j.key, error: String(e.message).slice(0, 300) }) + '\n');
      console.log(`오류 ${vp.name}/${j.key}: ${String(e.message).slice(0, 160)}`);
    }
  }
  console.log(`${vp.name} 완료 ${Math.round((Date.now() - t0) / 1000)}s (누적 ${total}회)`);
}
await browser.close();
