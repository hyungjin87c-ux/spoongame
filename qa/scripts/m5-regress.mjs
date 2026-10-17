// QA-003 M5 회귀 표본: M4 대시보드(일시정지·배속·다음 결정으로·자동 모드), 나가기 확인, BGM 버튼, 다크, 의견 보내기, 출생신고, 룰렛, 첫 화면.
// 사용: node qa/scripts/m5-regress.mjs
import { launch, mkctx, fixSeed, cleanStorageOnce, openTitle, toRoulette, skipToBirth, birthToLife, waitGuard, sleep, shot, runCase, PROD, readBirth, readDash, parseRgb, READ_DASH_M5, con } from './m5-lib.mjs';

const browser = await launch();
const ctx = await mkctx(browser, { viewport: { width: 360, height: 740 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
await cleanStorageOnce(ctx);
await fixSeed(ctx, 4321);
const page = await ctx.newPage();
await page.addInitScript(`window.__readDash = ${READ_DASH_M5.toString()};`);

await runCase({ id: 'M5-R01', cat: '회귀', title: '첫 화면: 로고·가상 인구·세상 3개·인생 길이 2개(「약 1시간」 선택 불가)·캐러셀·태어나기·푸터 빌드 표기', steps: '새 저장소로 prod 첫 화면을 연다', expected: 'M4와 같은 구성이 그대로' }, async () => {
  await openTitle(page, PROD);
  const t = await page.evaluate(() => {
    const q = (s) => document.querySelector(s);
    const all = (s) => [...document.querySelectorAll(s)];
    return {
      logo: !!q('header [role="img"], header svg, [data-testid="site-head"] svg, .site-head svg'),
      pop: (q('[data-testid="population"]')?.textContent ?? document.body.innerText.match(/가상 인구[^\n]*/)?.[0] ?? '').replace(/\s+/g, ' ').slice(0, 60),
      eras: all('[data-testid^="era-"]').map((e) => e.getAttribute('data-testid')).filter((x) => x !== 'era-group'),
      lengths: all('[data-testid^="life-"]').filter((e) => /^life-(short|long)/.test(e.getAttribute('data-testid'))).map((e) => `${e.getAttribute('data-testid')}${e.disabled || e.getAttribute('aria-disabled') === 'true' || e.querySelector('input[disabled]') || (e.tagName === 'INPUT' && e.disabled) ? '(불가)' : ''}`),
      start: !!q('[data-testid="start-birth"]'),
      carousel: all('[data-testid^="carousel"], .carousel').length > 0 || /슬라이드|캐러셀|통계/.test(document.body.innerText),
      footer: (document.querySelector('[data-testid="build-version"]')?.innerText ?? '').replace(/\s+/g, ' ').slice(0, 80),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
  const bad = [];
  if (t.eras.length !== 3) bad.push(`세상 ${t.eras.length}개`);
  if (t.lengths.length !== 2 || !t.lengths.some((x) => x.includes('불가'))) bad.push(`인생 길이 ${t.lengths}`);
  if (!t.start) bad.push('태어나기 없음');
  if (!/v\d+\.\d+\.\d+/.test(t.footer)) bad.push(`푸터 ${t.footer}`);
  if (t.overflow > 0) bad.push('넘침');
  const s = await shot(page, 'R01', 'title');
  return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.join(' / ') : `세상 ${t.eras.length}·인생 길이 ${t.lengths.join(',')}·푸터 「${t.footer}」·가상 인구 「${t.pop}」`, shots: [s] };
});

await runCase({ id: 'M5-R02', cat: '회귀', title: '룰렛 → 출생신고: 룰렛이 돌고 결과가 확정되며 출생신고 항목이 모두 보이고 또래 4명이 있다', steps: '태어나기 → 룰렛 → 건너뛰기 → 출생신고', expected: '출생신고 항목 ≥ 11, 또래 4명, 살아가기 버튼' }, async () => {
  await toRoulette(page, 'present');
  const sR = await shot(page, 'R02', 'roulette');
  await skipToBirth(page);
  const b = await readBirth(page);
  const bad = [];
  const n = Object.keys(b.fields).length;
  if (n < 11) bad.push(`출생신고 항목 ${n}개`);
  if (b.peers.length !== 4) bad.push(`또래 ${b.peers.length}명`);
  if (/외모\s*\d+\s*점/.test(b.bodyText)) bad.push('외모 점수 글자');
  const sB = await shot(page, 'R02', 'birth');
  return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.join(' / ') : `항목 ${n}개, 또래 ${b.peers.length}명, 이름 ${b.name}`, shots: [sR, sB] };
});

await birthToLife(page);
await sleep(300);

await runCase({ id: 'M5-R03', cat: '회귀', title: '대시보드 컨트롤: 일시정지·배속 4종·다음 결정으로·자동 모드·BGM·다크·의견 보내기·생각 남기기(준비 중)', steps: '새 판 0세 대시보드에서 각 버튼을 눌러 상태를 읽는다', expected: 'M4와 같이 동작(눌린 표시·저장 설정 일치, 의견 보내기 주소에 이름·기록 없음)' }, async () => {
  const bad = [];
  const notes = [];
  await waitGuard(page, 'pause');
  const d0 = await page.evaluate(() => window.__readDash());
  // 일시정지
  await page.getByTestId('pause').click();
  await sleep(150);
  let paused = await page.getByTestId('pause').getAttribute('data-paused');
  if (paused !== 'true') bad.push('일시정지가 안 눌림');
  const nameP = await page.getByTestId('pause').innerText();
  await page.getByTestId('pause').click();
  await sleep(150);
  if ((await page.getByTestId('pause').getAttribute('data-paused')) !== 'false') bad.push('다시 진행이 안 눌림');
  notes.push(`일시정지 이름 「${nameP.trim()}」 → 해제`);
  // 배속
  for (const sp of [2, 4, 8, 1]) {
    await page.locator(`[data-speed="${sp}"]`).click();
    await sleep(100);
    const pressed = await page.evaluate(() => [...document.querySelectorAll('[data-speed][aria-pressed="true"]')].map((e) => e.getAttribute('data-speed')));
    if (pressed.length !== 1 || pressed[0] !== String(sp)) bad.push(`배속 ${sp}: 눌린 표시 ${pressed}`);
  }
  const savedSp = await page.evaluate(() => JSON.parse(localStorage.getItem('suzeo-game:settings')).data.speed);
  if (savedSp !== 1) bad.push(`저장된 배속 ${savedSp}`);
  // 자동 모드 켜고 끄기
  await page.getByTestId('auto').click();
  await sleep(100);
  const autoOn = await page.getByTestId('auto').getAttribute('aria-pressed');
  await page.getByTestId('auto').click();
  await sleep(100);
  const autoOff = await page.getByTestId('auto').getAttribute('aria-pressed');
  if (autoOn !== 'true' || autoOff !== 'false') bad.push(`자동 모드 ${autoOn}/${autoOff}`);
  // BGM: 켜고 끄기(장치 생성만 확인)
  await page.getByTestId('tool-bgm').click();
  await sleep(200);
  const bgmOn = await page.getByTestId('tool-bgm').getAttribute('aria-pressed');
  const volume = await page.locator('[data-testid="bgm-volume-input"]').count();
  await page.getByTestId('tool-bgm').click();
  await sleep(150);
  const bgmOff = await page.getByTestId('tool-bgm').getAttribute('aria-pressed');
  if (bgmOn !== 'true' || volume !== 1 || bgmOff !== 'false') bad.push(`BGM ${bgmOn}/${volume}/${bgmOff}`);
  // 생각 남기기: 준비 중
  const note = await page.evaluate(() => ({ disabled: document.querySelector('[data-testid="tool-note"]').getAttribute('aria-disabled'), text: document.querySelector('[data-testid="tool-note"]').innerText.replace(/\s+/g, ' ') }));
  if (note.disabled !== 'true' || !/준비/.test(note.text)) bad.push(`생각 남기기 ${JSON.stringify(note)}`);
  // 다크
  const bg0 = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  await page.getByTestId('tool-dark').click();
  await sleep(300);
  const bg1 = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const sD = await shot(page, 'R03', 'dark');
  await page.getByTestId('tool-dark').click();
  await sleep(200);
  if (bg0 === bg1) bad.push('다크 전환 때 배경이 안 바뀜');
  // 의견 보내기 주소
  const href = await page.evaluate(() => document.querySelector('[data-testid="tool-feedback"], a[href*="issues/new"]')?.getAttribute('href') ?? null);
  const name = d0.screen === 'life-screen' ? await page.evaluate(() => document.querySelector('[data-testid="life-name"]').textContent) : '';
  if (!href || href.includes(encodeURIComponent(name)) || href.includes(name)) bad.push(`의견 보내기 주소에 이름 ${href}`);
  const params = href ? [...new URL(href).searchParams.keys()] : [];
  notes.push(`의견 보내기 키 ${params.join(',')}`);
  // 다음 결정으로
  await page.getByTestId('skip').click();
  await page.waitForSelector('[data-testid="choice-panel"]', { timeout: 10000 }).catch(() => bad.push('다음 결정으로 뒤 카드가 안 뜸'));
  const sC = await shot(page, 'R03', 'after-skip-card');
  return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.join(' / ') : `정상: ${notes.join(' · ')} · 다음 결정으로 → 카드`, shots: [sD, sC] };
});

await runCase({ id: 'M5-R04', cat: '회귀', title: '나가기 확인 → 돌아가기 / 나가기 → 첫 화면 「이어서 살기」 → 같은 카드·같은 영향 줄', steps: '선택지 카드가 떠 있는 채 나가기 → 확인 → 돌아가기, 다시 나가기 → 첫 화면 → 이어서 살기', expected: '카드·영향 줄이 그대로 복원, 이어서 살기 뒤에도 일시정지' }, async () => {
  const bad = [];
  const ref = await page.evaluate(() => window.__readDash());
  const refLines = JSON.stringify(ref.choices.map((c) => [c.id, c.impact.map((i) => i.shown)]));
  await waitGuard(page, 'tool-exit');
  await page.getByTestId('tool-exit').click();
  await page.waitForSelector('[data-testid="exit-ask"]');
  const sA = await shot(page, 'R04', 'exit-ask');
  await waitGuard(page, 'exit-no');
  await page.getByTestId('exit-no').click();
  await sleep(200);
  if (await page.locator('[data-testid="exit-ask"]').count()) bad.push('돌아가기가 확인 단계를 안 닫음');
  await page.getByTestId('tool-exit').click();
  await waitGuard(page, 'exit-yes');
  await page.getByTestId('exit-yes').click();
  await page.waitForSelector('[data-testid="title-screen"]', { timeout: 6000 });
  await waitGuard(page, 'resume');
  await page.getByTestId('resume').click();
  await page.waitForSelector('[data-testid="life-screen"]');
  await sleep(400);
  const cur = await page.evaluate(() => window.__readDash());
  const curLines = JSON.stringify(cur.choices.map((c) => [c.id, c.impact.map((i) => i.shown)]));
  if (cur.choiceKey !== ref.choiceKey || curLines !== refLines) bad.push('이어서 살기 뒤 카드·영향 줄이 달라짐');
  if (cur.paused !== 'true') bad.push(`이어서 살기 뒤 일시정지 ${cur.paused}`);
  const sB = await shot(page, 'R04', 'resumed-card');
  return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.join(' / ') : `카드 ${cur.choiceKey} 영향 줄 그대로, 이어서 살기 뒤 일시정지 유지`, shots: [sA, sB] };
});

await ctx.close();
await browser.close();
