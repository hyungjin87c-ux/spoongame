// QA-003 M4 추가 관찰: 진행률 복원·다크 지속·자동 모드 유지·첫 페인트. 사용: node qa/scripts/m4-extra.mjs [id-prefix]
import fs from 'node:fs';
import path from 'node:path';
import { launch, mkctx, fixSeed, cleanStorageOnce, newGameToLife, readDash, shot, sleep, runCase, con, PROD, DEV, TOUCH, VP, waitGuard, readRaw, GAME_KEY, SETTINGS_KEY, OUT, openTitle, toRoulette, skipToBirth, birthToLife, whichScreen } from './m4-lib.mjs';
import { openState, loadSave } from './m4-states.mjs';

const only = process.argv[2] || '';
const want = (id) => !only || id.startsWith(only);
const browser = await launch();
const errs = () => con.take();

if (want('M4-O01')) {
  await runCase(
    { id: 'M4-O01', cat: '기록', title: '(RECORD) 올해 진행률 바는 저장되지 않는다: 나가기 → 이어서 살기(새로고침 없이)·새로고침 뒤에는 한 해 진행이 0%에서 다시 시작', steps: '새 판 → 진행률 약 60%에서 나가기 → 이어서 살기(새로고침 없이) → 바 / 같은 상태에서 새로고침 → 바', expected: '(기록) SPEC DB8은 저장된 화면 복원만 요구 — 해 중간 진행률은 요구하지 않음. 사용자가 느끼는 손실(최대 한 해 = 1배속 약 7~13초) 기록' },
    async () => {
      const ctx = await mkctx(browser, { viewport: VP.m360, ...TOUCH });
      await cleanStorageOnce(ctx);
      await fixSeed(ctx, 229);
      const p = await ctx.newPage();
      await newGameToLife(p);
      await sleep(4800);
      const before = await readDash(p);
      await p.getByTestId('tool-exit').click();
      await waitGuard(p, 'exit-yes');
      await p.getByTestId('exit-yes').click();
      await p.waitForSelector('[data-testid="resume"]');
      await waitGuard(p, 'resume');
      await p.getByTestId('resume').click();
      await p.waitForSelector('[data-testid="life-screen"]');
      await sleep(300);
      const resumed = await readDash(p);
      await p.reload({ waitUntil: 'load' });
      await p.waitForSelector('[data-testid="life-screen"]');
      await sleep(300);
      const reloaded = await readDash(p);
      await ctx.close();
      return { verdict: 'RECORD', severity: '낮음', actual: `나가기 직전 ${before.age}세 ${before.pct} → 이어서 살기 뒤(새로고침 없이) ${resumed.age}세 ${resumed.pct}(일시정지 ${resumed.paused}) → 새로고침 뒤 ${reloaded.age}세 ${reloaded.pct}`, shots: [] };
    },
  );
}

if (want('M4-O02')) {
  await runCase(
    { id: 'M4-O02', cat: '기록', title: '(RECORD) 수동 다크 선택 + 라이트 시스템에서 JS가 늦게 올 때의 첫 페인트 색', steps: '설정 theme=dark 저장, 번들 JS 요청을 2.5초 늦춰 JS 실행 전 화면 색을 찍는다', expected: '(기록) 리뷰어 관찰의 실측 — 수동 다크 사용자는 JS 전에 밝은 바탕을 잠깐 볼 수 있음' },
    async () => {
      const ctx = await mkctx(browser, { viewport: VP.m360, ...TOUCH });
      await fixSeed(ctx, 229);
      const p0 = await ctx.newPage();
      await newGameToLife(p0);
      await p0.getByTestId('tool-dark').click();
      await sleep(400);
      await p0.close();
      const p = await ctx.newPage();
      await p.route('**/assets/*.js', async (route) => {
        await sleep(2500);
        await route.continue();
      });
      const nav = p.goto(PROD, { waitUntil: 'commit' });
      await nav;
      await sleep(1200);
      const early = await p.evaluate(() => ({ bg: getComputedStyle(document.body).backgroundColor, root: document.documentElement.getAttribute('data-theme'), hasApp: !!document.querySelector('[data-testid]') }));
      await shot(p, 'O02', 'before-js');
      await p.waitForSelector('[data-testid="life-screen"]', { timeout: 15000 });
      await sleep(400);
      const late = await p.evaluate(() => ({ bg: getComputedStyle(document.body).backgroundColor }));
      await ctx.close();
      return { verdict: 'RECORD', severity: '낮음', actual: `JS 전(1.2초): body 배경 ${early.bg}, data-theme ${early.root}, 앱 요소 ${early.hasApp} → JS 뒤: ${late.bg}`, shots: ['qa/screenshots/003/M4-O02-before-js.png'] };
    },
  );
}

if (want('M4-N16')) {
  await runCase(
    { id: 'M4-N16', cat: '정상', title: '새 판에서 설정 유지·엔딩 뒤 첫 화면: 자동 모드·수동 다크는 다음 판에도 유지(마스터 결정), 엔딩 뒤 첫 화면에는 이어서 살기가 없다, 다크는 첫 화면·룰렛·출생신고·엔딩에도 적용', steps: '개발 서버 시간 배율 ×40 + 자동 모드 + 수동 다크로 한 판 완주 → 엔딩(다크?) → 다시 태어나기 → 첫 화면(이어서 살기 없음·다크) → 새 판 → 룰렛·출생신고(다크) → 대시보드(자동 모드 유지)', expected: '자동 모드 켜짐이 새 판에도 유지, 수동 다크가 모든 화면에 유지, 엔딩 뒤 이어서 살기 없음' },
    async () => {
      const bad = [];
      const notes = [];
      const ctx = await mkctx(browser, { viewport: VP.m360, ...TOUCH });
      await cleanStorageOnce(ctx);
      await fixSeed(ctx, 229);
      const p = await ctx.newPage();
      await newGameToLife(p, { base: DEV, query: '?__timescale=40' });
      await p.getByTestId('auto').click();
      await p.getByTestId('tool-dark').click();
      await sleep(300);
      const bgOf = () => p.evaluate(() => getComputedStyle(document.body).backgroundColor);
      const darkBg = await bgOf();
      await p.waitForSelector('[data-testid="ending-screen"]', { timeout: 120000 });
      await sleep(500);
      const endBg = await bgOf();
      notes.push(`엔딩 배경 ${endBg} (다크 ${darkBg})`);
      if (endBg !== darkBg) bad.push(`엔딩이 다크가 아님 ${endBg}`);
      await waitGuard(p, 'rebirth');
      await p.getByTestId('rebirth').click();
      await p.waitForSelector('[data-testid="title-screen"]');
      await sleep(400);
      const t = await p.evaluate(() => ({ resume: !!document.querySelector('[data-testid="resume"]'), start: !!document.querySelector('[data-testid="start-birth"]'), bg: getComputedStyle(document.body).backgroundColor }));
      notes.push(`다시 태어나기 뒤 첫 화면: 이어서 살기 ${t.resume}, 태어나기 ${t.start}, 배경 ${t.bg}`);
      if (t.resume) bad.push('엔딩 뒤 첫 화면에 이어서 살기가 있음');
      if (t.bg !== darkBg) bad.push(`첫 화면이 다크가 아님 ${t.bg}`);
      await toRoulette(p);
      const rBg = await bgOf();
      await skipToBirth(p);
      const bBg = await bgOf();
      if (rBg !== darkBg || bBg !== darkBg) bad.push(`룰렛/출생신고 다크 아님 ${rBg}/${bBg}`);
      await birthToLife(p);
      await sleep(400);
      const d = await readDash(p);
      notes.push(`새 판 대시보드: 자동 모드 ${d.auto}(${d.autoText}), 다음 결정으로 선택불가 ${d.skipDisabled}, 다크 ${d.darkOn}`);
      if (d.auto !== 'true') bad.push(`새 판에서 자동 모드가 유지되지 않음 ${d.auto}`);
      if (d.darkOn !== 'true') bad.push(`새 판에서 다크가 유지되지 않음 ${d.darkOn}`);
      await shot(p, 'N16', 'new-game-auto-dark');
      const e = errs();
      if (e.length) bad.push(`콘솔 ${JSON.stringify(e).slice(0, 200)}`);
      await ctx.close();
      return { verdict: bad.length ? 'FAIL' : 'PASS', severity: '중간', actual: (bad.length ? bad.join(' / ') + ' | ' : '') + notes.join(' | '), shots: ['qa/screenshots/003/M4-N16-new-game-auto-dark.png'] };
    },
  );
}

await browser.close();
