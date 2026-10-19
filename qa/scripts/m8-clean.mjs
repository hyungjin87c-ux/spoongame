// QA-003 M8 LM6 흐름: 사망 직전 상태를 실제 화면(prod, 1배속)으로 끝까지 살아 엔딩에 이르는 길에서
//  CL-a  깨끗한 판(1배속·수동·카드 직접 선택, 중간에 일시정지·접기·기록 시트·나가기 확인을 써도): 엔딩 값 = 저장 play에서 센 값, 「깨끗하지 않은 판」 문장 없음, 엔딩에서 더 쌓이지 않음·새로고침 3번 같은 값, 의견 주소에 시간 없음, 다시 태어나기 뒤 0부터
//  CL-b  배속을 바꿨다가 1배속으로 되돌린 판 → 문장 있음 / CL-c 자동 모드를 켰다 끈 판 → 문장 있음 / CL-d 「다음 결정으로」를 쓴 판 → 문장 있음
// 사용: node qa/scripts/m8-clean.mjs <part ...>   part: a b c d
import { launch, openOracle, evalCore, openSeeded, flushPlay, readSave, shot, sleep, runCase, appendJsonl, toRoulette, skipToBirth, birthToLife, SET_OFF, GAME_KEY, SAVE_VERSION, PROD } from './m8-lib.mjs';

const parts = process.argv.slice(2);
const browser = await launch();
const { page: oracle } = await openOracle(browser);

const nearDeath = (era, seed, back) =>
  evalCore(
    oracle,
    `let s = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(arg.seed), arg.era)));
     const states = [];
     for (let g = 0; g < 2000 && s.phase === 'life'; g++) {
       if (s.pending === null) states.push(s);
       const r = s.pending !== null ? core.autoResolveStep(s, s.pending.key) : core.stepYear(s);
       s = r.state;
     }
     return { state: states[Math.max(0, states.length - arg.back)], deathAge: s.death ? s.death.age : null };`,
    { era, seed, back },
  );

const NOTCLEAN = '배속이나 자동 모드, 「다음 결정으로」를 쓴 판이라 1배속으로 직접 고른 판보다 짧게 잡힙니다.';

const readEnding = (page) =>
  page.evaluate(() => {
    const q = (s) => document.querySelector(s);
    const t = (s) => (q(s) ? q(s).textContent.replace(/\s+/g, ' ').trim() : null);
    return { value: q('[data-testid="ending-playtime-value"] [aria-hidden="true"]')?.textContent ?? null, spoken: q('[data-testid="ending-playtime-value"] .sr-only')?.textContent ?? null, hold: q('[data-testid="ending-playtime-hold"] [aria-hidden="true"]')?.textContent ?? null, decide: q('[data-testid="ending-playtime-decide"] [aria-hidden="true"]')?.textContent ?? null, note: t('[data-testid="ending-playtime-note"]'), block: !!q('[data-testid="ending-playtime"]') };
  });

/** 결정 카드가 뜨면 첫 선택지를 고르면서, 엔딩까지 기다린다. hooks.onTick(page)는 매 반복 불린다 */
async function driveToEnding(page, { limitMs = 240000, onTick = null } = {}) {
  const t0 = Date.now();
  while (Date.now() - t0 < limitMs) {
    const s = await page.evaluate(() => ({ end: !!document.querySelector('[data-testid="ending-screen"]'), card: document.querySelector('[data-testid="choice-panel"] button[data-testid^="choice-"]:not([aria-disabled="true"])')?.getAttribute('data-testid') ?? null, note: !!document.querySelector('[data-testid="note-sheet"]') }));
    if (s.end) return true;
    if (onTick) await onTick(page, s);
    if (s.card) {
      await sleep(700);
      await page.locator(`[data-testid="${s.card}"]`).click({ timeout: 3000 }).catch(() => {});
    }
    await sleep(120);
  }
  return false;
}

const nd = await nearDeath('present', 41, 3);
const base = { ...nd.state, paused: false };

async function runFlow(id, title, tweak, expectClean) {
  await runCase({ id, title }, async () => {
    const { ctx, page } = await openSeeded(browser, base, { settings: SET_OFF, localFlag: true });
    const flags = { used: [] };
    const ok = await driveToEnding(page, { onTick: tweak ? (p, s) => tweak(p, s, flags) : null });
    if (!ok) {
      const sh = await shot(page, id, 'timeout');
      await ctx.close();
      return { verdict: 'FAIL', actual: '엔딩에 이르지 못함(4분)', shots: [sh] };
    }
    await sleep(500);
    const e = await readEnding(page);
    const save = await readSave(page);
    const play = save.data.play;
    const exp = `${String(Math.floor((Math.floor(play.hold / 1000) + Math.floor(play.decide / 1000)) / 60)).padStart(2, '0')}:${String((Math.floor(play.hold / 1000) + Math.floor(play.decide / 1000)) % 60).padStart(2, '0')}`;
    const hasNot = !!e.note && e.note.includes(NOTCLEAN);
    const problems = [];
    if (!e.block) problems.push('블록 없음');
    if (e.value !== exp) problems.push(`표시값 ${e.value} ≠ 저장 play에서 센 ${exp}`);
    if (hasNot === expectClean) problems.push(`깨끗하지 않은 판 문장 ${hasNot}, 기대 ${!expectClean}`);
    const s1 = await shot(page, id, 'ending');
    // 엔딩에서 더 쌓이지 않음 + 새로고침 3번 같은 값
    await sleep(8000);
    const save2 = await readSave(page);
    if (save2.data.play.hold !== play.hold || save2.data.play.decide !== play.decide) problems.push(`엔딩에서 더 쌓임 hold ${play.hold}→${save2.data.play.hold}`);
    for (let i = 0; i < 3; i++) {
      await page.reload({ waitUntil: 'load' });
      await page.waitForSelector('[data-testid="ending-screen"]');
      await sleep(300);
      const e2 = await readEnding(page);
      if (e2.value !== e.value || e2.hold !== e.hold || e2.decide !== e.decide) problems.push(`새로고침 ${i + 1}번 뒤 값 ${e2.value} ≠ ${e.value}`);
    }
    const detail = `엔딩 ${e.value}(${e.spoken}) = ${e.hold} + ${e.decide}, 저장 play ${JSON.stringify(play)}, 문장 ${hasNot}${flags.used.length ? ', 쓴 조작 ' + flags.used.join('·') : ''}`;
    let extra = '';
    if (id === 'CL-a') {
      // 다시 태어나기 → 0부터
      await page.getByTestId('rebirth').click();
      await page.waitForSelector('[data-testid="title-screen"]');
      await toRoulette(page, 'present');
      await skipToBirth(page);
      await birthToLife(page);
      await sleep(400);
      const z = await flushPlay(page);
      await sleep(5000);
      const z2 = await flushPlay(page);
      if (!(z.hold <= 1500 && z.decide === 0 && z.resumes === 0 && z.offSpeed === 0 && z.auto === 0 && z.skips === 0)) problems.push(`다시 태어난 뒤 play가 0에서 시작하지 않음 ${JSON.stringify(z)}`);
      if (!(z2.hold - z.hold >= 4000 && z2.hold - z.hold <= 6000)) problems.push(`새 판 5초 hold ${z2.hold - z.hold}`);
      extra = ` / 다시 태어난 직후 play ${JSON.stringify(z)} → 5초 뒤 hold ${z2.hold}`;
      await shot(page, id, 'reborn-life');
    }
    await ctx.close();
    return { verdict: problems.length === 0 ? 'PASS' : 'FAIL', actual: (problems.length ? problems.join(' / ') + ' :: ' : '') + detail + extra, shots: [s1] };
  });
}

if (parts.includes('a')) {
  // 깨끗한 판이지만 일시정지·나가기 확인·기록 시트·카드 접기를 써 본다 (시간에서 빠지고 깨끗함은 그대로)
  await runFlow(
    'CL-a',
    '깨끗한 판(1배속·수동): 일시정지·나가기 확인·기록 시트·카드 접기를 거쳐도 문장 없음, 엔딩 값 = 저장 play에서 센 값, 엔딩에서 안 쌓임·새로고침 같은 값, 다시 태어나기 뒤 0부터',
    async (page, s, flags) => {
      if (!flags.did1) {
        flags.did1 = true;
        await sleep(1500);
        await page.getByTestId('pause').click();
        await sleep(2500);
        await page.getByTestId('pause').click();
        flags.used.push('일시정지 2.5초');
        await sleep(500);
        await page.getByTestId('tool-exit').click();
        await page.waitForSelector('[data-testid="exit-ask"]');
        await sleep(2500);
        await page.getByTestId('exit-no').click();
        flags.used.push('나가기 확인 2.5초');
        await sleep(500);
        await page.getByTestId('tool-note').click();
        await page.waitForSelector('[data-testid="note-sheet"]');
        await sleep(2500);
        await page.keyboard.press('Escape');
        flags.used.push('기록 시트 2.5초');
        await sleep(1200);
        const href = await page.getByTestId('tool-feedback').getAttribute('href');
        flags.href = href;
        const play = await flushPlay(page);
        flags.mid = play;
        const dec = decodeURIComponent(href);
        if (/play|플레이|분|초|\d{2}:\d{2}/.test(dec.replace(/screen=.*/, (m) => m)) && /\d{2}:\d{2}/.test(dec)) flags.used.push('(경고: 의견 주소에 시간 모양)');
        flags.used.push(`의견 주소 ${dec.replace(/^https:\/\/github.com\/[^/]+\/[^/]+/, '<저장소>')}, 중간 play note=${play.note} idle=${play.idle}`);
      }
    },
    true,
  );
}
if (parts.includes('b')) {
  await runFlow(
    'CL-b',
    '배속을 2배로 바꿨다가 1배속으로 되돌린 판: 「깨끗하지 않은 판」 문장이 나온다',
    async (page, s, flags) => {
      if (!flags.did) {
        flags.did = true;
        await sleep(800);
        await page.locator('[data-speed="2"]').click();
        await sleep(3500);
        await page.locator('[data-speed="1"]').click();
        flags.used.push('2배속 3.5초 → 1배속');
      }
    },
    false,
  );
}
if (parts.includes('c')) {
  await runFlow(
    'CL-c',
    '자동 모드를 켰다가 끈 판: 「깨끗하지 않은 판」 문장이 나온다',
    async (page, s, flags) => {
      if (!flags.did) {
        flags.did = true;
        await sleep(800);
        await page.getByTestId('auto').click();
        await sleep(3500);
        await page.getByTestId('auto').click();
        flags.used.push('자동 모드 3.5초 → 끔');
      }
    },
    false,
  );
}
if (parts.includes('d')) {
  await runFlow(
    'CL-d',
    '「다음 결정으로」를 쓴 판: 「깨끗하지 않은 판」 문장이 나온다',
    async (page, s, flags) => {
      if (!flags.did && !s.card) {
        flags.did = true;
        await sleep(800);
        await page.getByTestId('skip').click({ timeout: 3000 }).catch(() => {});
        flags.used.push('다음 결정으로 1회');
      }
    },
    false,
  );
}

await browser.close();
console.log('parts done', parts.join(','));
