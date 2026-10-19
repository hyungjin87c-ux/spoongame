// QA-003 M8 새 판은 0부터: 진행 중인 판(play 누적 있음)에서 「나가기 → 새로 태어나기 → 확인」으로 새 판을 시작하면 이전 판의 play가 이어지지 않고 0에서 시작한다.
// 사용: node qa/scripts/m8-newgame.mjs
import { launch, openOracle, plainLife, openSeeded, flushPlay, readSave, shot, sleep, runCase, skipToBirth, birthToLife, SET_MANUAL } from './m8-lib.mjs';

const browser = await launch();
const { page: oracle } = await openOracle(browser);
const life = await plainLife(oracle, { era: 'present', seed: 4242, age: 9, paused: false });
const withPlay = { ...life, play: { hold: 500000, decide: 120000, fold: 4000, note: 9000, idle: 30000, offSpeed: 1000, auto: 0, skips: 2, resumes: 4 } };

await runCase({ id: 'NG01', title: '새 판은 0부터: 「나가기 → 새로 태어나기 → 확인」 뒤 새 판의 play는 이전 판의 값을 이어받지 않는다' }, async () => {
  const { ctx, page } = await openSeeded(browser, withPlay, { settings: SET_MANUAL, localFlag: true });
  await sleep(1500);
  const before = await flushPlay(page);
  await page.getByTestId('tool-exit').click();
  await page.waitForSelector('[data-testid="exit-ask"]');
  await page.getByTestId('exit-yes').click();
  await page.waitForSelector('[data-testid="title-screen"]');
  await page.getByTestId('begin-new').click();
  await page.getByTestId('confirm-new-yes').click();
  await page.waitForSelector('[data-testid="roulette-screen"]', { timeout: 8000 });
  const midSave = await readSave(page);
  await skipToBirth(page);
  await birthToLife(page);
  await sleep(600);
  const z = await flushPlay(page);
  await sleep(4000);
  const z2 = await flushPlay(page);
  const s1 = await shot(page, 'NG01', 'new-life');
  await ctx.close();
  const ok = before.hold >= 500000 && midSave.data.play === undefined && z.hold <= 1500 && z.decide === 0 && z.fold === 0 && z.note === 0 && z.idle === 0 && z.skips === 0 && z.resumes === 0 && z2.hold - z.hold >= 3500 && z2.hold - z.hold <= 4500;
  return { verdict: ok ? 'PASS' : 'FAIL', actual: `이전 판 hold ${(before.hold / 1000).toFixed(1)}초 → 룰렛 단계 저장의 play ${midSave.data.play === undefined ? '없음' : JSON.stringify(midSave.data.play)} → 새 판 인생 시작 직후 ${JSON.stringify(z)} → 4초 뒤 hold ${(z2.hold / 1000).toFixed(1)}`, shots: [s1] };
});

await runCase({ id: 'NG02', title: '룰렛·출생신고 단계에서는 시간이 쌓이지 않는다(저장의 play 없음), 인생에 들어가야 0에서 시작' }, async () => {
  const { ctx, page } = await openSeeded(browser, null, { wait: '[data-testid="title-screen"]', localFlag: true });
  await page.getByTestId('start-birth').click();
  await page.waitForSelector('[data-testid="roulette-screen"]');
  await sleep(6000);
  const rouletteSave = await readSave(page);
  await skipToBirth(page);
  await sleep(6000);
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  await sleep(100);
  const birthSave = await readSave(page);
  await birthToLife(page);
  await sleep(300);
  const lifeSave = await readSave(page);
  const s1 = await shot(page, 'NG02', 'life-start');
  await ctx.close();
  const ok = rouletteSave.data.play === undefined && birthSave.data.play === undefined && lifeSave.data.play !== undefined && lifeSave.data.play.hold <= 800;
  return { verdict: ok ? 'PASS' : 'FAIL', actual: `룰렛 6초 뒤 play ${rouletteSave.data.play === undefined ? '없음' : '있음'}, 출생신고 6초 뒤 ${birthSave.data.play === undefined ? '없음' : '있음'}, 인생 시작 직후 ${lifeSave.data.play ? JSON.stringify(lifeSave.data.play) : '없음'}`, shots: [s1] };
});

await browser.close();
