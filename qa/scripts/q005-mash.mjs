// SPEC-005 QA 공격 보충: 화면마다 버튼 연타·새로고침 연타·뒤로가기, 캐러셀 연타·창 크기 즉석 변경, 저장소 쓰기 실패, 일시정지 중 「이번에는 자동으로 고르기」.
// 프로덕션 빌드(4391). 사용: node qa/scripts/q005-mash.mjs --vp d1280|m360 [--engine webkit]
import { launchChromium, launchWebkit, VP, Watch, PROD, DEV, run, ok, bad, note, shot, sleep, overflowOf, readSave, readSettings, seedPage, DEFAULT_SETTINGS, oracle, withoutPlay, screenOf } from './q005-lib.mjs';

const arg = (k, d) => {
  const i = process.argv.indexOf('--' + k);
  return i >= 0 ? process.argv[i + 1] : d;
};
const VPN = arg('vp', 'd1280');
const ENGINE = arg('engine', 'chromium');
const tag = `${ENGINE === 'webkit' ? 'W-' : ''}${VPN}`;
const touch = !!VP[VPN].hasTouch;
const browser = await (ENGINE === 'webkit' ? launchWebkit() : launchChromium());
const devBrowser = await launchChromium();
const dev = await (await devBrowser.newContext({ viewport: { width: 800, height: 600 } })).newPage();
await dev.goto(DEV + '/');
await dev.getByTestId('title-screen').waitFor({ timeout: 90000 });

async function fresh(extra = {}, seed = null) {
  const ctx = await browser.newContext({ ...VP[VPN], locale: 'ko-KR', ...extra });
  const watch = new Watch(tag).attach(ctx);
  const page = await ctx.newPage();
  if (seed) await seedPage(page, seed);
  return { ctx, page, watch };
}
const mid = async (page, testId) => {
  const loc = page.getByTestId(testId);
  await loc.waitFor({ state: 'visible', timeout: 30000 });
  await page.waitForFunction((id) => { const e = document.querySelector(`[data-testid="${id}"]`); return e && e.getAttribute('aria-disabled') !== 'true'; }, testId, { timeout: 30000 });
  await loc.scrollIntoViewIfNeeded();
  await sleep(200);
  const b = await loc.boundingBox();
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
};
const mashAt = async (page, p, n, gap = 40) => {
  for (let i = 0; i < n; i++) {
    if (touch) await page.touchscreen.tap(p.x, p.y).catch(() => {});
    else await page.mouse.click(p.x, p.y).catch(() => {});
    if (gap) await sleep(gap);
  }
};
const spam = async (page, n = 12) => {
  for (let i = 0; i < n; i++) {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await sleep(i % 3 === 0 ? 60 : 250);
  }
  await sleep(1200);
};

// ================================================================ M1 첫 화면 → 인생: 단계마다 버튼 연타
{
  const { ctx, page, watch } = await fresh();
  await page.goto(PROD + '/');
  await page.getByTestId('title-screen').waitFor({ timeout: 60000 });
  await sleep(900);
  const out = [];
  // 태어나기 연타
  await mashAt(page, await mid(page, 'start-birth'), 10, 30);
  await page.getByTestId('roulette-screen').waitFor({ timeout: 15000 });
  await sleep(600);
  out.push(`태어나기 10연타 → 화면 ${await screenOf(page)}`);
  // 룰렛: 건너뛰기 연타 → 결과 → 출생신고 보기 연타
  if ((await page.getByTestId('roulette-screen').getAttribute('data-state')) === 'spinning') await mashAt(page, await mid(page, 'skip-roulette'), 8, 30);
  await page.waitForFunction(() => document.querySelector('[data-testid="roulette-screen"]')?.getAttribute('data-state') === 'result', null, { timeout: 15000 });
  const rs = await readSave(page);
  const birth1 = rs?.data?.character?.name;
  await mashAt(page, await mid(page, 'to-birth'), 8, 30);
  await page.getByTestId('birth-screen').waitFor({ timeout: 15000 });
  await sleep(600);
  out.push(`출생신고 보기 8연타 → ${await screenOf(page)}`);
  // 출생신고 새로고침 연타 — 같은 인물
  await spam(page, 10);
  const bs = await readSave(page);
  out.push(`출생신고 새로고침 10회 → ${await screenOf(page)}, 이름 ${birth1}→${bs?.data?.character?.name}`);
  await mashAt(page, await mid(page, 'next-life'), 8, 30);
  await page.getByTestId('life-screen').waitFor({ timeout: 15000 });
  await sleep(800);
  const ls = await readSave(page);
  out.push(`살아가기 8연타 → ${await screenOf(page)}, 나이 ${ls.data.age}, 이름 ${ls.data.character.name}, history ${ls.data.history.length}줄`);
  const w = watch.take();
  await run({ id: `${tag}-M1-screens-mash`, area: '연타', title: `${tag} 첫 화면→룰렛→출생신고→인생 버튼 연타(10·8·8·8회)·출생신고 새로고침 10회: 한 번만 넘어가고 같은 인물`, steps: '각 화면의 주 버튼을 0.03초 간격으로 연타', expected: '화면이 하나씩만 넘어가고(건너뛰지 않음), 인물 이름 불변, 인생 0세·기록 1~3줄, 콘솔 0' }, async () => {
    const t = out.join(' · ') + ` · 콘솔 ${w.console.length}`;
    const pass = /roulette/.test(out[0]) && /birth/.test(out[1]) && /birth/.test(out[2]) && out[2].includes(`${birth1}→${birth1}`) && /life/.test(out[3]) && ls.data.age === 0 && w.console.length === 0;
    return pass ? ok(t) : bad(t, { shot: await shot(page, `${tag}-M1`) });
  });
  // 엔딩 → 다시 태어나기 연타
  const E = await oracle(dev, `const start = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(12), 'present'))); return core.playToEnd(start, (s) => s.pending.choiceIds[0]).state;`).then(withoutPlay);
  await ctx.close();
  const o2 = await fresh({}, { game: E, settings: DEFAULT_SETTINGS });
  await o2.page.goto(PROD + '/');
  await o2.page.getByTestId('ending-screen').waitFor({ timeout: 60000 });
  await sleep(900);
  await spam(o2.page, 10);
  const afterSpam = { scr: await screenOf(o2.page), age: (await readSave(o2.page)).data.age };
  await mashAt(o2.page, await mid(o2.page, 'rebirth'), 3, 0); // 입력 가드(0.4초) 안의 연타 — 더 느린 연타는 새 첫 화면의 버튼을 정상적으로 누르게 된다
  await o2.page.getByTestId('title-screen').waitFor({ timeout: 15000 });
  await sleep(800);
  const sv = await readSave(o2.page);
  const w2 = o2.watch.take();
  await run({ id: `${tag}-M2-ending-mash`, area: '연타', title: `${tag} 엔딩 새로고침 10회 뒤 같은 엔딩, 「다시 태어나기」 3연타(가드 0.4초 안): 새 첫 화면 하나에 머문다`, steps: '끝난 판을 열어 새로고침 연타 → 다시 태어나기 연타', expected: '새로고침해도 같은 엔딩(나이 불변), 연타해도 첫 화면 한 번, 저장 phase title, 콘솔 0' }, async () => {
    const t = `새로고침 뒤 ${afterSpam.scr}(${afterSpam.age}세), 다시 태어나기 뒤 저장 phase=${sv.data.phase}, history ${sv.data.history.length}, 콘솔 ${w2.console.length}`;
    return afterSpam.scr === 'ending-screen' && afterSpam.age === E.age && sv.data.phase === 'title' && w2.console.length === 0 ? ok(t) : bad(t, { shot: await shot(o2.page, `${tag}-M2`) });
  });
  await o2.ctx.close();
}

// ================================================================ M3 캐러셀 연타·창 크기 즉석 변경
{
  const { ctx, page, watch } = await fresh();
  await page.goto(PROD + '/');
  await page.getByTestId('title-screen').waitFor({ timeout: 60000 });
  await sleep(900);
  const next = await mid(page, 'carousel-next');
  const prev = await mid(page, 'carousel-prev');
  const pause = await mid(page, 'carousel-pause');
  const idx = async () => Number((await page.getByTestId('carousel-count').innerText()).split('/')[0]);
  await mashAt(page, pause, 1, 0);
  const i0 = await idx();
  await mashAt(page, next, 27, 15);
  const i1 = await idx();
  await mashAt(page, prev, 13, 15);
  const i2 = await idx();
  // 일시정지 20번 연타(짝수 → 원래 상태)
  const before = await page.getByTestId('carousel').getAttribute('data-autoplay');
  await mashAt(page, pause, 20, 25);
  const after = await page.getByTestId('carousel').getAttribute('data-autoplay');
  // 창 크기 즉석 변경 (슬라이드 #16 그래프가 카드 폭에 다시 맞는가)
  while ((await idx()) !== 16) await page.getByTestId('carousel-next').click({ force: true });
  const sizes = [];
  const base = VP[VPN].viewport;
  for (const [w, h] of [[base.width, base.height], [800, 700], [360, 740], [1100, 800], [base.width, base.height]]) {
    await page.setViewportSize({ width: w, height: h });
    await sleep(700);
    const m = await page.evaluate(() => { const c = document.querySelector('.slide.is-active').getBoundingClientRect(); const sr = [...document.querySelectorAll('.slide.is-active svg')].map((x) => x.getBoundingClientRect()).sort((a, b) => b.width - a.width)[0] ?? null; /* 가장 큰 svg = 그래프(작은 것은 아이콘) */ return { cardW: Math.round(c.width), svgW: sr ? Math.round(sr.width) : null, svgIn: sr ? sr.right <= c.right + 1 && sr.left >= c.left - 1 : null, over: document.documentElement.scrollWidth - document.documentElement.clientWidth }; });
    sizes.push(`${w}x${h}: 카드 ${m.cardW} 그래프 폭 ${m.svgW} 안 ${m.svgIn} 넘침 ${m.over}`);
  }
  const w = watch.take();
  await run({ id: `${tag}-M3-carousel-mash`, area: '연타', title: `${tag} 캐러셀 다음 27·이전 13·일시정지 20연타 + 창 크기 즉석 변경: 번호가 어긋나지 않고 그래프가 카드 안에 맞는다`, steps: '다음 27번(20장 순환 → +7), 이전 13번, 일시정지 20번, 창 크기 5번 변경', expected: `번호 ${'= (시작+27) 순환'}·(−13), 일시정지 짝수 번 = 원래 상태, 그래프 폭이 카드 안, 넘침 0, 콘솔 0` }, async () => {
    const t = `번호 ${i0} → 다음×27 ${i1} → 이전×13 ${i2}, 일시정지 ${before} → ×20 → ${after}, ${sizes.join(' | ')}, 콘솔 ${w.console.length}`;
    const expect1 = ((i0 - 1 + 27) % 20) + 1;
    const expect2 = ((expect1 - 1 - 13 + 20 * 2) % 20) + 1;
    return i1 === expect1 && i2 === expect2 && before === after && sizes.every((s) => /안 true|안 null/.test(s) && /넘침 0/.test(s)) && w.console.length === 0 ? ok(t) : bad(t, { shot: await shot(page, `${tag}-M3`) });
  });
  await ctx.close();
}

// ================================================================ M4 저장소 쓰기 실패(프라이빗·용량)에서도 첫 화면·패널·스위치가 죽지 않는다
{
  const ctx = await browser.newContext({ ...VP[VPN], locale: 'ko-KR' });
  const watch = new Watch(tag).attach(ctx);
  const page = await ctx.newPage();
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 120)));
  await page.addInitScript(() => {
    const orig = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) { throw new DOMException('QuotaExceededError', 'QuotaExceededError'); };
    void orig;
  });
  await page.goto(PROD + '/');
  await page.getByTestId('title-screen').waitFor({ timeout: 60000 });
  await sleep(900);
  const click = async (id) => (touch ? page.getByTestId(id).tap() : page.getByTestId(id).click());
  await click('gentle-switch');
  const sw = await page.getByTestId('gentle-switch').getAttribute('aria-checked');
  await click('link-news');
  await page.getByTestId('info-panel').waitFor({ timeout: 5000 }).catch(() => {});
  const panel = await page.getByTestId('info-panel').count();
  await page.keyboard.press('Escape');
  await sleep(700);
  await mashAt(page, await mid(page, 'start-birth'), 1, 0);
  await page.waitForSelector('[data-testid="roulette-screen"], [data-testid="error-screen"]', { timeout: 15000 }).catch(() => {});
  const scr = await screenOf(page);
  const notice = await page.getByTestId('save-notice').count();
  const w = watch.take();
  await run({ id: `${tag}-M4-storage-fail`, area: '입력 공격', title: `${tag} 저장소 쓰기가 모두 실패해도(용량 초과 흉내) 첫 화면 스위치·정보 패널·태어나기가 동작하고 처리되지 않은 오류가 없다`, steps: 'Storage.setItem을 항상 QuotaExceededError로 만들고 첫 화면 조작', expected: '스위치 토글됨(메모리), 패널 열림, 태어나기로 룰렛까지 감(저장 실패 안내가 뜰 수 있음), 처리 안 된 예외 0' }, async () => {
    const t = `스위치 ${sw}, 패널 ${panel}, 태어나기 뒤 화면 ${scr}, 저장 실패 안내 ${notice}개, 처리 안 된 예외 ${pageErrors.length}${pageErrors.length ? JSON.stringify(pageErrors) : ''}, 콘솔 ${w.console.length}`;
    return sw === 'true' && panel === 1 && /roulette/.test(scr) && pageErrors.length === 0 ? (w.console.length ? note(t + ' — 콘솔 메시지는 저장 실패 보고(의도된 경고)로 보임', { shot: await shot(page, `${tag}-M4`) }) : ok(t)) : bad(t, { shot: await shot(page, `${tag}-M4`) });
  });
  await ctx.close();
}

// ================================================================ M5 일시정지 중 「이번에는 자동으로 고르기」·「펼쳐서 읽기」
{
  const P = await oracle(dev, `const mod = await import('/src/data/events/index.ts');
    const ev = mod.EVENT_POOL.byId.get('middle-layoff'); const ages = core.possibleAgesOf(ev); const target = ages[Math.floor(ages.length / 2)];
    for (let seed = 1; seed <= 800; seed++) {
      let s = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(seed), 'present')));
      while (s.phase === 'life' && s.age < target) { if (s.pending !== null) s = core.resolveChoiceStep(s, s.pending.key, s.pending.choiceIds[0]).state; else s = core.stepYear(s).state; }
      if (s.phase !== 'life' || s.age !== target) continue;
      const visible = core.visibleChoices(ev, core.condContextOf(s)); if (visible.length < 2) continue;
      return { ...s, seen: { ...s.seen, 'middle-layoff': target }, lastChoiceAge: target, pending: { eventId: 'middle-layoff', key: 'middle-layoff@' + target, age: target, choiceIds: visible.map((c) => c.id) } };
    }
    return null;`).then(withoutPlay);
  const { ctx, page, watch } = await fresh({}, { game: { ...P, paused: true }, settings: { ...DEFAULT_SETTINGS, gentle: true, speed: 1, noteCards: false } });
  await page.goto(PROD + '/');
  await page.getByTestId('choice-panel').waitFor({ timeout: 30000 });
  await sleep(900);
  const before = (await readSave(page)).data;
  await mashAt(page, await mid(page, 'veil-auto'), 6, 50);
  await sleep(1500);
  const after = (await readSave(page)).data;
  const rows = after.history.filter((h) => h.eventId === 'middle-layoff' && h.age === P.pending.age);
  const w = watch.take();
  await run({ id: `${tag}-M5-paused-autopick`, area: '무거운 장면', title: `${tag} 일시정지 중 가린 결정 카드의 「이번에는 자동으로 고르기」를 6연타: 정확히 한 번 해결되고 결정 줄이 하나 남는다(일시정지는 그대로)`, steps: 'paused=true 판에서 버튼 6연타', expected: '기록 줄 1줄·pending 해제·시트 닫힘, 일시정지 유지, 콘솔 0 — (일시정지 중 눌러도 막히지 않는지 기록)' }, async () => {
    const t = `전 pending ${before.pending ? '있음' : '없음'} paused ${before.paused} → 후 pending ${after.pending ? '있음' : '없음'} paused ${after.paused}, 결정 줄 ${rows.length}, 시트 ${await page.getByTestId('choice-panel').count()}, 콘솔 ${w.console.length}`;
    return rows.length === 1 && !after.pending && after.paused === true && w.console.length === 0 ? ok(t) : rows.length === 0 && after.pending ? note(t + ' — 일시정지 중에는 자동 고르기 버튼이 해결하지 않는다(눌림 무시)', { shot: await shot(page, `${tag}-M5`) }) : bad(t, { shot: await shot(page, `${tag}-M5`) });
  });
  await ctx.close();
}

await browser.close();
await devBrowser.close();
console.log('done', tag);
