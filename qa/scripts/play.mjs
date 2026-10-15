// 정상 플레이 한 판 (사람처럼). 인자: --id --era --vw --vh --speed --mode manual|skip|auto --pick wait|first|rotate --shots all|few --url
// 1배속 수동 판은 --pick wait 로, 선택지에서 멈춰 qa/results/<id>-cmd.txt 에 번호(0부터)가 적히길 기다린다(읽는 동안은 경과 시간에서 뺀다).
import fs from 'node:fs';
import path from 'node:path';
import { DEV, RES_DIR, launch, mkctx, shot, snap, readChoice, waitScreen, con, sleep, readSave, readSettings } from './lib.mjs';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, arr) => {
    if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : 'true']);
    return acc;
  }, []),
);
const id = args.id || 'M3-NXX';
const era = args.era || 'present';
const vw = Number(args.vw || 360);
const vh = Number(args.vh || 740);
const speed = Number(args.speed || 1);
const mode = args.mode || 'manual';
const pick = args.pick || 'first';
const shots = args.shots || 'all';
const base = args.url || DEV;
const query = args.query || '';

const cmdFile = path.join(RES_DIR, `${id}-cmd.txt`);
const statusFile = path.join(RES_DIR, `${id}-status.json`);
try { fs.unlinkSync(cmdFile); } catch {}

const browser = await launch();
const ctx = await mkctx(browser, { viewport: { width: vw, height: vh } });
const page = await ctx.newPage();
con.take();
const report = { id, era, vw, vh, speed, mode, pick, shots: [], choices: [], timeline: [], notes: [], overflow: [], base };
const S = async (suffix, full = false) => report.shots.push(await shot(page, id, suffix, { full }));

await page.goto(base + '/' + query);
await waitScreen(page, 'title-screen');
await sleep(500);
await S('title');
await page.getByRole('button', { name: '시작' }).click();
await waitScreen(page, 'era-screen');
await sleep(500);
await S('era-default');
if (era !== 'present') {
  await page.locator(`[data-era="${era}"]`).click();
  await sleep(300);
  await S(`era-${era}`);
}
await page.getByTestId('confirm-era').click();
await waitScreen(page, 'birth-screen');
await sleep(500);
await S('birth', true);
report.birthText = await page.locator('main[data-testid="birth-screen"]').innerText();
await page.getByTestId('next-life').click();
await waitScreen(page, 'life-screen');
const tLife = Date.now();
let paused = 0;
await sleep(100);
await S('life-enter');
// 배속/자동 설정은 화면의 버튼으로 (사람이 하듯)
if (speed !== 1) {
  await page.locator(`[data-speed="${speed}"]`).click();
}
if (mode === 'auto') {
  await page.getByTestId('auto').click();
  await sleep(200);
  await S('auto-on');
}
let lastAge = null;
let choiceN = 0;
let shotsLife = 0;
let skipClicks = 0;
const maxMs = Number(args.maxms || 30 * 60 * 1000);
let ended = false;
while (Date.now() - tLife < maxMs) {
  const s = await snap(page);
  if (s.overflowX) report.overflow.push({ at: s.age, screen: s.screen, scrollW: s.scrollW, clientW: s.clientW });
  if (s.screen !== 'life-screen' && s.screen !== 'ending-placeholder') {
    report.notes.push(`예상 밖 화면 ${s.screen} @${s.age}`);
    await S(`unexpected-${s.screen}`);
    break;
  }
  if (s.screen === 'ending-placeholder') {
    ended = true;
    break;
  }
  if (s.age !== lastAge) {
    report.timeline.push([s.age, Date.now() - tLife - paused, s.hasChoice ? 'choice' : '']);
    lastAge = s.age;
    // 단계 바뀔 때 한 장
    if (shots === 'all' && shotsLife < 6 && ['3', '10', '25', '45', '70'].includes(String(s.age).replace('세', '')) && !s.hasChoice) {
      await S(`life-age${String(s.age).replace('세', '')}`);
      shotsLife++;
    }
  }
  if (s.hasChoice) {
    choiceN++;
    const c = await readChoice(page);
    report.choices.push({ n: choiceN, age: s.age, title: c.title, textLen: c.text.length, labels: c.choices.map((x) => x.label), labelLen: c.choices.reduce((a, b) => a + b.label.length, 0), text: c.text, active: Date.now() - tLife - paused });
    if (shots === 'all' || choiceN <= 2) await S(`choice-${choiceN}`);
    let idx = 0;
    if (pick === 'wait') {
      fs.writeFileSync(statusFile, JSON.stringify({ state: 'choice', n: choiceN, age: s.age, title: c.title, text: c.text, choices: c.choices.map((x) => x.label) }, null, 1));
      const t0 = Date.now();
      for (;;) {
        if (fs.existsSync(cmdFile)) {
          await sleep(100);
          idx = Number(fs.readFileSync(cmdFile, 'utf8').trim());
          fs.unlinkSync(cmdFile);
          break;
        }
        await sleep(300);
      }
      paused += Date.now() - t0;
    } else if (mode === 'auto') {
      // 자동 모드에서는 사람이 고르지 않는다: 선택지가 스스로 사라질 때까지 기다린다.
      const t0 = Date.now();
      await page.waitForFunction((k) => !document.querySelector(`[data-testid="choice-panel"][data-key="${k}"]`), c.key, { timeout: 20000 }).catch(() => report.notes.push('자동 모드 선택 지연'));
      report.choices[report.choices.length - 1].autoWaitMs = Date.now() - t0;
      continue;
    } else if (pick === 'rotate') {
      idx = (choiceN - 1) % c.choices.length;
    }
    report.choices[report.choices.length - 1].picked = idx;
    const btn = page.locator('.choice-list button').nth(idx);
    await btn.click();
    await sleep(250);
    if (shots === 'all' || choiceN <= 2) await S(`after-choice-${choiceN}`);
    continue;
  }
  if (mode === 'skip' && s.screen === 'life-screen') {
    await page.getByTestId('skip').click({ timeout: 5000 }).catch(() => {});
    skipClicks++;
    await sleep(150);
    continue;
  }
  await sleep(250);
}
const tEnd = Date.now();
report.activeMs = tEnd - tLife - paused;
report.pausedMs = paused;
report.totalMs = tEnd - tLife;
report.ended = ended;
if (ended) {
  await sleep(700);
  await S('ending');
  await S('ending-full', true);
  report.endingText = await page.locator('main[data-testid="ending-placeholder"]').innerText();
  const save = await readSave(page);
  report.saveAfterEnd = { phase: save && save.data && save.data.phase, age: save && save.data && save.data.age, histLen: save && save.data && save.data.history && save.data.history.length };
  report.history = save && save.data ? save.data.history : null;
  report.finalStats = save && save.data ? save.data.stats : null;
  report.name = save && save.data ? save.data.character.name : null;
  // 사망 후 새로고침 — 죽은 인생이 되살아나지 않는지
  await page.reload();
  await waitScreen(page, 'ending-placeholder');
  await sleep(300);
  await S('ending-reload');
}
report.settings = await readSettings(page);
report.console = con.take();
report.skipClicks = skipClicks;
fs.writeFileSync(path.join(RES_DIR, `${id}-report.json`), JSON.stringify(report, null, 1));
console.log(JSON.stringify({ id, ended, activeMs: report.activeMs, pausedMs: report.pausedMs, choices: choiceN, overflow: report.overflow.length, notes: report.notes, console: report.console.length }));
await browser.close();
