// QA-003 M2 문구 점검: 모든 화면의 「접속자」「동시 접속」·느낌표·이모지, 첫 화면·캐러셀 문구가 문구 기준표대로인가 (VP2·CM7·copy.md)
import { launch, mkctx, runCase, shot, openTitle, waitGuard, bodyText, VP, TOUCH, PROD, DEV, sleep, lifeInfo, startToLife, driveLife } from './m2r3-lib.mjs';

const browser = await launch();

await runCase({ id: 'M2-N13', cat: '정상', title: '문구 점검 — 모든 화면의 금지 낱말·느낌표·이모지, 첫 화면 문구가 문구 기준표와 같은가 (VP2·CM7·R-131)', steps: '첫 화면·캐러셀 14장 전체 텍스트와 출생·인생·엔딩 화면 텍스트(개발 서버 빠른 진행 탐침, 시간만 줄임)에서 「접속자」「동시 접속」·느낌표·이모지 검색, 첫 화면 주요 문구를 문구 기준표와 문자열로 대조', expected: '금지 낱말·느낌표·이모지 0, 형진 님 지정 문구와 보조 문구·인생 길이 설명·버튼 이름이 문구 기준표와 일치' }, async () => {
  const problems = [];
  const facts = [];
  const forbidden = ['접속자', '동시 접속', '동시접속'];
  const emoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u;
  const scan = (name, text) => {
    for (const w of forbidden) if (text.includes(w)) problems.push(`${name}: 「${w}」`);
    if (/[!！]/.test(text)) problems.push(`${name}: 느낌표 ${text.match(/.{0,12}[!！].{0,8}/)?.[0]}`);
    if (emoji.test(text)) problems.push(`${name}: 이모지`);
  };
  // 첫 화면 + 14장 (prod)
  const ctx = await mkctx(browser, { viewport: VP.d1280 });
  const p = await ctx.newPage();
  await openTitle(p);
  await waitGuard(p);
  const first = await p.evaluate(() => ({
    pop: document.querySelector('[data-testid=population-line]').innerText.replace(/\s+/g, ' '),
    note: document.querySelector('[data-testid=population-note]').innerText,
    hint: document.querySelector('[data-testid=life-length-hint]').innerText,
    begin: document.querySelector('[data-testid=start-birth]').innerText,
    eras: [...document.querySelectorAll('[data-testid=era-group] .radio-card')].map((l) => l.innerText.replace(/\s+/g, ' ')),
    lives: [...document.querySelectorAll('[data-testid=life-length-group] .radio-card')].map((l) => l.innerText.replace(/\s+/g, ' ')),
    tag: document.querySelector('.hero__tag').innerText.replace(/\s+/g, ' '),
    carouselTitle: document.querySelector('.carousel .card__title').innerText,
    carouselNote: document.querySelector('[data-testid=carousel-auto-note]').innerText,
    prev: document.querySelector('[data-testid=carousel-prev]').getAttribute('aria-label'),
    next: document.querySelector('[data-testid=carousel-next]').getAttribute('aria-label'),
    pause: document.querySelector('[data-testid=carousel-pause]').getAttribute('aria-label'),
  }));
  const expect = {
    pop: /^[\d,]+명이 이 시뮬레이션 속에서 각자의 삶을 살고 있어요\.$/,
    note: /^이 기기 안에서 계산한 가상의 사람들이에요\. 실제로 게임하는 사람 수가 아니에요\.$/,
    hint: /^평균 수명까지 살아 보는 데 걸리는 시간이에요\. 도중에 나가도 진행은 이 기기에 남습니다\.$/,
    begin: /^태어나기$/,
  };
  for (const [k, re] of Object.entries(expect)) if (!re.test(first[k])) problems.push(`첫 화면 ${k} 문구가 문구 기준표와 다름: 「${first[k]}」`);
  if (first.carouselTitle !== '한국 사회 통계' || first.carouselNote !== '7초마다 다음 지표' || first.prev !== '이전 지표' || first.next !== '다음 지표' || first.pause !== '자동 넘김 일시정지') problems.push(`캐러셀 머리 문구 ${JSON.stringify([first.carouselTitle, first.carouselNote, first.prev, first.next, first.pause])}`);
  facts.push(`첫 화면: 「${first.tag}」/「${first.pop}」/「${first.note}」/ 세상 ${first.eras.length}개 · 길이 ${first.lives.join(' | ')}`);
  scan('첫 화면', await bodyText(p));
  const n13shots = [await shot(p, 'N13', 'title-text')];
  await p.getByTestId('carousel-pause').click();
  let slideChars = 0;
  for (let i = 0; i < 14; i++) {
    const t = await p.evaluate(() => document.querySelector('.slide.is-active').textContent);
    slideChars += t.length;
    scan(`슬라이드 ${i + 1}`, t);
    await p.getByTestId('carousel-next').click();
    await sleep(60);
  }
  facts.push(`슬라이드 14장 ${slideChars}자 점검`);
  await ctx.close();
  // 출생·인생·엔딩 (개발 서버, 시간 탐침으로 빠르게)
  const c2 = await mkctx(browser, { viewport: VP.m360, ...TOUCH });
  const q = await c2.newPage();
  await q.goto(DEV + '?__timescale=1000');
  await q.waitForSelector('[data-testid=title-screen]');
  await waitGuard(q);
  await q.getByTestId('era-future').evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await q.getByTestId('era-future').check();
  await q.getByTestId('start-birth').click();
  await q.waitForSelector('[data-testid=birth-screen]');
  scan('출생 화면', await bodyText(q));
  await waitGuard(q, 'next-life');
  await q.getByTestId('next-life').click();
  await q.waitForSelector('[data-testid=life-screen]');
  await q.locator('[data-speed="8"]').click();
  await q.locator('[data-testid="auto"]').click();
  await driveLife(q, (i) => i.screen === 'ending-screen', 120000);
  await sleep(300);
  scan('엔딩 화면', await bodyText(q));
  await q.getByTestId('rebirth').scrollIntoViewIfNeeded();
  n13shots.push(await shot(q, 'N13', 'ending-text'));
  const logText = await q.evaluate(() => document.querySelector('[data-testid=ending-timeline]')?.innerText.length);
  facts.push(`옛 화면(출생·엔딩) 점검 완료, 엔딩 연표 ${logText}자`);
  await c2.close();
  return { verdict: problems.length ? 'FAIL' : 'PASS', actual: problems.length ? problems.slice(0, 8).join(' / ') : facts.join(' | '), shots: n13shots };
});

await browser.close();
