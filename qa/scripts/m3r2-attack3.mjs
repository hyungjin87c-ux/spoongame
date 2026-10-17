// QA-003 M3 공격 3: URL 변조·개발 탐침이 prod에서 무효인가, 폭주 입력(마우스 휠·드래그·우클릭·텍스트 선택)
import { launch, mkctx, fixSeed, installRouletteProbe, getProbe, runCase, shot, openTitle, waitGuard, toRoulette, readRoulette, saveJson, whichScreen, overflowX, VP, TOUCH, PROD, sleep } from './m3r2-lib.mjs';
const browser = await launch();
const push = (c, msg, arr) => (c ? null : arr.push(msg));

await runCase(
  { id: 'M3-A16', cat: '공격', title: 'prod 빌드에서 URL 변조·개발 탐침(?__timescale·?__quota·?__exit·?__crash)이 무효이고 스크립트가 실행되지 않는다', steps: 'prod 주소에 ?__timescale=1000&__quota&__exit&__crash, ?x=<script>alert(1)</script>, #<img src=x onerror=alert(1)>, %00·8KB 쿼리를 붙여 열고 태어나기 → 룰렛이 5.4초에 멈추는지·저장이 되는지·첫 화면이 정상인지', expected: '탐침은 prod에서 무시(룰렛 4~6초, 저장 정상, 크래시 화면 없음), 대화상자·코드 실행 0' },
  async () => {
    const bad = [];
    const notes = [];
    const shots = [];
    const queries = [
      '?__timescale=1000&__quota&__exit&__crash',
      '?x=<script>alert(1)</script>',
      '#<img src=x onerror=alert(1)>',
      '?a=%00&b=' + 'A'.repeat(6000),
      '?__proto__[polluted]=1&constructor[prototype][x]=1',
    ];
    for (const q of queries) {
      const ctx = await mkctx(browser, { viewport: VP.m360, ...TOUCH });
      await fixSeed(ctx, 31);
      await installRouletteProbe(ctx);
      const p = await ctx.newPage();
      const dialogs = [];
      p.on('dialog', (d) => { dialogs.push(d.message()); d.dismiss().catch(() => {}); });
      const errs = [];
      p.on('pageerror', (e) => errs.push(String(e).slice(0, 120)));
      await p.goto(PROD + q, { waitUntil: 'load' });
      await p.waitForSelector('[data-testid="title-screen"]', { timeout: 8000 });
      await waitGuard(p, 'start-birth');
      await p.getByTestId('start-birth').click();
      await p.waitForSelector('[data-testid="roulette-screen"]');
      await p.waitForSelector('[data-testid="roulette-screen"][data-state="result"]', { timeout: 9000 });
      const pr = await getProbe(p);
      const stop = pr.events.find((e) => e.id === 'reel-wealth' && e.state === 'stopped')?.t;
      const sv = await saveJson(p);
      const polluted = await p.evaluate(() => ({}).polluted !== undefined || ({}).x !== undefined);
      push(stop >= 4000 && stop <= 6000, `${q.slice(0, 30)}: 수저 정지 ${stop}ms (탐침이 prod에서 작동?)`, bad);
      push(sv?.data?.phase === 'roulette', `${q.slice(0, 30)}: 저장 phase ${sv?.data?.phase} (__quota가 먹혔나)`, bad);
      push(dialogs.length === 0, `${q.slice(0, 30)}: 대화상자 ${dialogs}`, bad);
      push(errs.length === 0, `${q.slice(0, 30)}: pageerror ${errs}`, bad);
      push(!polluted, `${q.slice(0, 30)}: 객체 오염`, bad);
      notes.push(`${q.slice(0, 22)}…: 정지 ${stop}ms`);
      if (q.startsWith('?__timescale')) shots.push(await shot(p, 'A16', 'probes-ignored'));
      await ctx.close();
    }
    return { verdict: bad.length ? 'FAIL' : 'PASS', severity: '중간', actual: bad.length ? bad.join(' / ') : notes.join(' | '), shots };
  },
);

await runCase(
  { id: 'M3-A17', cat: '공격', title: '폭주 입력: 휠·우클릭·드래그·텍스트 선택·핀치 흉내를 룰렛·출생신고에 퍼붓기', steps: '회전 중과 결과·출생신고에서 마우스 휠 위아래 50번, 우클릭 20번, 릴 위 드래그, 문서 전체 선택(Ctrl+A), 더블클릭·트리플클릭 텍스트 선택, 키보드 PageUp/Down·Home/End 연타', expected: '화면 전환·결과 변경·크래시 없음(우클릭·드래그가 건너뛰기를 누르지 않음), 룰렛은 계속 돈다' },
  async () => {
    const bad = [];
    const shots = [];
    const ctx = await mkctx(browser, { viewport: VP.d1280 });
    await fixSeed(ctx, 4040);
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', (e) => errs.push(String(e).slice(0, 120)));
    await openTitle(p);
    await toRoulette(p, 'present');
    const fp0 = JSON.stringify((await saveJson(p)).data.birthReport);
    await sleep(700);
    for (let i = 0; i < 50; i++) await p.mouse.wheel(0, i % 2 ? 300 : -300);
    for (let i = 0; i < 20; i++) await p.mouse.click(640 + (i % 5) * 20, 400, { button: 'right' });
    await p.mouse.move(400, 300);
    await p.mouse.down();
    await p.mouse.move(900, 500, { steps: 8 });
    await p.mouse.up();
    await p.keyboard.press('Control+A');
    await p.mouse.dblclick(640, 130);
    await p.mouse.click(640, 130, { clickCount: 3 });
    for (const k of ['PageDown', 'PageUp', 'End', 'Home', 'PageDown', 'Home']) await p.keyboard.press(k);
    await sleep(300);
    const st = (await readRoulette(p)).state;
    push((await whichScreen(p)) === 'roulette-screen', `화면 ${await whichScreen(p)}`, bad);
    push(st === 'spinning' || st === 'result', `상태 ${st}`, bad);
    shots.push(await shot(p, 'A17', 'after-storm-roulette'));
    await p.waitForSelector('[data-testid="roulette-screen"][data-state="result"]', { timeout: 8000 });
    push(JSON.stringify((await saveJson(p)).data.birthReport) === fp0, '저장된 출생 결과가 바뀜', bad);
    await waitGuard(p, 'to-birth');
    await p.getByTestId('to-birth').click();
    await p.waitForSelector('[data-testid="birth-screen"]');
    await sleep(400);
    for (let i = 0; i < 40; i++) await p.mouse.wheel(0, i % 2 ? 500 : -500);
    for (let i = 0; i < 15; i++) await p.mouse.click(300 + i * 10, 300, { button: 'right' });
    await p.keyboard.press('Control+A');
    shots.push(await shot(p, 'A17', 'after-storm-birth-select-all'));
    push((await whichScreen(p)) === 'birth-screen', '출생신고에서 화면 이탈', bad);
    const ov = await overflowX(p);
    push(!ov.overflow, '가로 넘침', bad);
    push(errs.length === 0, `오류 ${errs}`, bad);
    await ctx.close();
    return { verdict: bad.length ? 'FAIL' : 'PASS', severity: '낮음', actual: bad.length ? bad.join(' / ') : `휠·우클릭·드래그·전체 선택·더블/트리플클릭·키 이동 모두 화면 유지, 룰렛 결과 불변(결과 상태 ${st})`, shots };
  },
);
await browser.close();
