// QA-003 M3 공격 4: 세상 선택 직후 태어나기(경쟁), 로케일·시간대, 가로 모드 회전
import { launch, mkctx, fixSeed, runCase, shot, openTitle, waitGuard, toRoulette, readRoulette, readBirth, skipToBirth, saveJson, overflowX, VP, TOUCH, PROD, sleep } from './m3-lib.mjs';
const browser = await launch();
const push = (c, msg, arr) => (c ? null : arr.push(msg));

await runCase(
  { id: 'M3-A18', cat: '공격', title: '세상 카드를 고른 직후(0·30·100·250ms) 곧바로 「태어나기」: 룰렛·출생신고가 고른 세상으로 나온다', steps: '지난·다가올 세상 라디오를 클릭하자마자 지연 0~250ms 뒤 태어나기를 클릭(마우스·터치). 저장 era와 출생 연도 범위를 확인', expected: '고른 세상으로 태어나거나(가드로 태어나기가 무시되면 첫 화면에 머묾), 라디오는 past인데 present로 태어나는 불일치 0' },
  async () => {
    const bad = [];
    const notes = [];
    for (const [mode, vp, t] of [['mouse', VP.d1280, {}], ['touch', VP.m360, TOUCH]]) {
      for (const era of ['past', 'future']) {
        for (const delay of [0, 30, 100, 250]) {
          const ctx = await mkctx(browser, { viewport: vp, ...t });
          await fixSeed(ctx, 77);
          const p = await ctx.newPage();
          await openTitle(p);
          await waitGuard(p, 'start-birth');
          const radio = p.locator(`[data-testid="era-${era}"]`);
          const rb = await radio.boundingBox();
          const sb = await p.getByTestId('start-birth').boundingBox();
          const click = async (b) => (mode === 'touch' ? p.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2) : p.mouse.click(b.x + b.width / 2, b.y + b.height / 2));
          await radio.scrollIntoViewIfNeeded();
          const rb2 = await radio.boundingBox();
          await click(rb2);
          if (delay) await sleep(delay);
          const sb2 = await p.getByTestId('start-birth').boundingBox();
          await click(sb2);
          await sleep(900);
          const scr = await p.evaluate(() => (document.querySelector('[data-testid="roulette-screen"]') ? 'roulette' : document.querySelector('[data-testid="title-screen"]') ? 'title' : 'other'));
          const sv = await saveJson(p);
          const checked = await p.evaluate(() => document.querySelector('[data-testid="era-group"] input:checked')?.value ?? null);
          notes.push(`${mode}/${era}/${delay}ms: ${scr}${sv?.data?.phase === 'roulette' ? ' era=' + sv.data.era : ''}`);
          if (scr === 'roulette') push(sv?.data?.era === era, `${mode}/${era}/${delay}ms: 라디오는 ${era}인데 저장 era ${sv?.data?.era}`, bad);
          if (scr === 'title' && checked !== era && checked !== null) bad.push(`${mode}/${era}/${delay}ms: 첫 화면에 머물렀고 선택 ${checked}`);
          await ctx.close();
        }
      }
    }
    return { verdict: bad.length ? 'FAIL' : 'PASS', severity: '중간', actual: bad.length ? bad.join(' / ') : `16조합: 고른 세상과 다른 세상으로 태어난 경우 0 (${notes.filter((n) => /title/.test(n)).length}건은 가드로 태어나기가 무시되어 첫 화면에 머묾)`, shots: [] };
  },
);

await runCase(
  { id: 'M3-A19', cat: '공격', title: '로케일·시간대(ar-EG·de-DE·en-US, 시간대 Pacific/Kiritimati·America/Anchorage)에서 룰렛·출생신고 숫자·날짜 표기가 깨지지 않는다', steps: '컨텍스트 locale·timezoneId를 바꿔 전 과정 진행, 출생신고 글자에 아랍 숫자·로케일 구분자·「Invalid」·「NaN」이 없는지', expected: '숫자는 ASCII, 「NaN」·「undefined」·「Invalid」 0, 화면 문구는 한국어 그대로' },
  async () => {
    const bad = [];
    const notes = [];
    const shots = [];
    for (const [loc, tz] of [['ar-EG', 'Pacific/Kiritimati'], ['de-DE', 'America/Anchorage'], ['en-US', 'UTC']]) {
      const ctx = await mkctx(browser, { viewport: VP.m360, ...TOUCH, locale: loc, timezoneId: tz });
      await fixSeed(ctx, 8181);
      const p = await ctx.newPage();
      await openTitle(p);
      await toRoulette(p, 'present');
      await p.waitForSelector('[data-testid="roulette-screen"][data-state="result"]', { timeout: 9000 });
      await waitGuard(p, 'to-birth');
      await p.getByTestId('to-birth').click();
      await p.waitForSelector('[data-testid="birth-screen"]');
      await sleep(400);
      const txt = await p.evaluate(() => document.body.innerText);
      push(!/NaN|undefined|Invalid|null/.test(txt), `${loc}: 이상 문자열 ${/NaN|undefined|Invalid|null/.exec(txt)}`, bad);
      push(!/[\u0660-\u0669\u06F0-\u06F9]/.test(txt), `${loc}: 아랍 숫자 ${/[\u0660-\u0669]/.exec(txt)}`, bad);
      const b = await readBirth(p);
      push(/^\d{4}년 \d{1,2}월$/.test(b.fields.month.value), `${loc}: 출생 연월 ${b.fields.month.value}`, bad);
      const dir = await p.evaluate(() => document.documentElement.dir || getComputedStyle(document.body).direction);
      push(dir === 'ltr', `${loc}: 방향 ${dir}`, bad);
      const ov = await overflowX(p);
      push(!ov.overflow, `${loc}: 가로 넘침`, bad);
      notes.push(`${loc}/${tz}: ${b.fields.month.value} ${b.name}`);
      if (loc === 'ar-EG') shots.push(await shot(p, 'A19', 'locale-ar-EG-birth'));
      await ctx.close();
    }
    return { verdict: bad.length ? 'FAIL' : 'PASS', severity: '낮음', actual: bad.length ? bad.join(' / ') : notes.join(' | '), shots };
  },
);

await runCase(
  { id: 'M3-A20', cat: '공격', title: '가로 모드 회전(667x375↔375x667)을 룰렛 결과·출생신고에서 반복: 포커스·스크롤·결과 불변', steps: '결과 화면과 출생신고에서 세로↔가로를 10번 번갈아 바꾸고 스크롤 위치·포커스·값을 비교', expected: '결과·값 불변, 가로 넘침 0, 포커스 유지(띠 버튼)' },
  async () => {
    const bad = [];
    const shots = [];
    const ctx = await mkctx(browser, { viewport: { width: 375, height: 667 }, ...TOUCH });
    await fixSeed(ctx, 9191);
    const p = await ctx.newPage();
    await openTitle(p);
    await toRoulette(p, 'present');
    await p.waitForSelector('[data-testid="roulette-screen"][data-state="result"]', { timeout: 9000 });
    const r0 = (await readRoulette(p)).status;
    await p.getByTestId('to-birth').focus();
    for (let i = 0; i < 10; i++) {
      await p.setViewportSize(i % 2 ? { width: 375, height: 667 } : { width: 667, height: 375 });
      await sleep(150);
    }
    const r1 = (await readRoulette(p)).status;
    push(r0 === r1, `룰렛 결과 문구 변동 ${r0} → ${r1}`, bad);
    push((await p.evaluate(() => document.activeElement?.getAttribute('data-testid'))) === 'to-birth', '회전 뒤 포커스 이동', bad);
    shots.push(await shot(p, 'A20', 'roulette-landscape'));
    await waitGuard(p, 'to-birth');
    await p.getByTestId('to-birth').click();
    await p.waitForSelector('[data-testid="birth-screen"]');
    const b0 = await readBirth(p);
    await p.evaluate(() => window.scrollTo(0, 600));
    for (let i = 0; i < 10; i++) {
      await p.setViewportSize(i % 2 ? { width: 375, height: 667 } : { width: 667, height: 375 });
      await sleep(150);
    }
    const b1 = await readBirth(p);
    push(JSON.stringify(b0.fields) === JSON.stringify(b1.fields) && b0.sentence === b1.sentence, '출생신고 값 변동', bad);
    const ov = await overflowX(p);
    push(!ov.overflow, '가로 넘침', bad);
    shots.push(await shot(p, 'A20', 'birth-landscape'));
    await ctx.close();
    return { verdict: bad.length ? 'FAIL' : 'PASS', severity: '낮음', actual: bad.length ? bad.join(' / ') : '10번 회전 뒤에도 룰렛 결과·출생신고 값 불변, 포커스 유지, 넘침 0', shots };
  },
);
await browser.close();
