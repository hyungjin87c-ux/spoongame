// 추가 공격: 초기 화면 새로고침 연타, 극단적 이름 레이아웃, 오프라인, 출처 링크
import fs from 'node:fs';
import path from 'node:path';
import { DEV, GAME_KEY, RES_DIR, launch, mkctx, runCase, shot, snap, toLife, waitScreen, readRaw, sleep } from './f-compat.mjs';

const G = 'a-extra';
const golden = JSON.parse(fs.readFileSync(path.join(RES_DIR, 'golden.json'), 'utf8'));
const clone = (o) => JSON.parse(JSON.stringify(o));
const browser = await launch();
const only = process.argv[2];

if (!only || only === 'R') {
  await runCase(G, { id: 'F-AE102', cat: '#9 새로고침', title: '시대 선택·출생 화면에서 새로고침 연타 x15 (로드 중단 포함): 시대 선택과 뽑힌 인물이 그대로', steps: '시대 선택 화면에서 다가올 세상을 고른 뒤 15회, 출생 화면에서 15회 새로고침(절반은 commit만 기다리고 다시)', expected: '선택한 시대 유지, 출생 인물(이름·연도·재력 문구)이 다시 뽑히지 않고 동일' }, async () => {
    const ctx = await mkctx(browser, { viewport: { width: 360, height: 740 } });
    const page = await ctx.newPage();
    await page.goto(DEV + '/');
    await waitScreen(page, 'title-screen');
    await sleep(500);
    await page.getByRole('button', { name: '시작' }).click();
    await waitScreen(page, 'era-screen');
    await sleep(500);
    await page.locator('[data-era="future"]').click();
    const bad = [];
    const rows = [];
    for (let i = 0; i < 15; i++) await page.reload({ waitUntil: i % 2 ? 'commit' : 'domcontentloaded' }).catch(() => {});
    await page.waitForLoadState('load').catch(() => {});
    await sleep(700);
    const e = await snap(page);
    const pressed = await page.locator('[data-era="future"]').getAttribute('aria-pressed').catch(() => null);
    rows.push(`시대 선택 화면 연타 후 ${e.screen}, 다가올 세상 선택=${pressed}`);
    if (e.screen !== 'era-screen' || pressed !== 'true') bad.push('시대 선택이 유지되지 않음');
    await page.getByTestId('confirm-era').click();
    await waitScreen(page, 'birth-screen');
    await sleep(600);
    const t0 = await page.locator('main[data-testid="birth-screen"]').innerText();
    const sh1 = await shot(page, 'F-AE102', 'birth-before');
    for (let i = 0; i < 15; i++) await page.reload({ waitUntil: i % 2 ? 'commit' : 'domcontentloaded' }).catch(() => {});
    await page.waitForLoadState('load').catch(() => {});
    await sleep(700);
    const t1 = await page.locator('main[data-testid="birth-screen"]').innerText().catch(() => '(birth 화면 아님)');
    rows.push(`출생 화면 연타 후 동일=${t0 === t1}`);
    if (t0 !== t1) bad.push(`출생 인물이 달라짐: ${t0.split('\n')[1]} → ${t1.split('\n')[1]}`);
    const sh2 = await shot(page, 'F-AE102', 'birth-after');
    return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.join('; ') : rows.join(' | '), shots: [sh1, sh2] };
  });
}

if (!only || only === 'N') {
  const LIFE = JSON.parse(golden.lifeChoice);
  const BIRTH = JSON.parse(golden.birth);
  const ENDING = JSON.parse(golden.ending);
  const NAMES = ['가나다라마바사아자차카타파하거너더러머버', 'ＷＷＷＷＷＷＷＷＷＷＷＷＷＷＷＷＷＷＷＷ', '👨‍👩‍👧‍👦👨‍👩‍👧‍👦👨‍👩‍👧‍👦', '‮김민준‬가나다라마바사아자', 'WWWWWWWWWWWWWWWWWWWW', '<svg/onload=__xss=1>'];
  await runCase(G, { id: 'F-AE103', cat: '#8 저장 변조', title: '극단적인 이름(20자 한글·전각·이모지·RTL·영문 W·태그)의 레이아웃: 출생·인생·엔딩 × 320/360px — 가로 넘침·잘림', steps: '이름을 바꾼 유효 저장(출생/인생/엔딩)을 심고 열어 요소가 뷰포트 밖으로 나가는지 측정, 스크린샷', expected: '가로 스크롤 없음, 이름이 줄바꿈되어 보임' }, async () => {
    const bad = [];
    const rows = [];
    const shots = [];
    for (const w of [320, 360]) {
      for (const [ni, name] of NAMES.entries()) {
        for (const [kind, base] of [['birth', BIRTH], ['life', LIFE], ['ending', ENDING]]) {
          const o = clone(base);
          o.data.character.name = name;
          const ctx = await mkctx(browser, { viewport: { width: w, height: 600 } });
          await ctx.addInitScript(([k, v]) => {
            if (location.protocol === 'about:') return;
            if (!localStorage.getItem('__qa_seeded')) { localStorage.setItem(k, v); localStorage.setItem('__qa_seeded', '1'); }
          }, [GAME_KEY, JSON.stringify(o)]);
          const page = await ctx.newPage();
          await page.addInitScript(() => { window.__xss = 0; window.alert = () => { window.__xss++; }; });
          await page.goto(DEV + '/');
          await sleep(500);
          const r = await page.evaluate(() => {
            const root = document.documentElement;
            const vw = root.clientWidth;
            const off = [];
            for (const el of document.querySelectorAll('main *')) {
              const b = el.getBoundingClientRect();
              if (b.width > 0 && (b.right > vw + 1 || b.left < -1)) off.push(el.tagName);
            }
            return { h: root.scrollWidth > vw, off: off.slice(0, 3), x: window.__xss };
          });
          if (r.h || r.off.length || r.x) bad.push(`${w}px ${kind} 이름${ni}: 가로스크롤=${r.h} 밖=${r.off.join(',')} xss=${r.x}`);
          if (kind === 'birth' && w === 320 && (ni <= 1 || ni === 3)) shots.push(await shot(page, 'F-AE103', `${w}-${kind}-n${ni}`));
          if (kind === 'life' && w === 320 && ni === 1) shots.push(await shot(page, 'F-AE103', `${w}-${kind}-n${ni}`));
          await ctx.close();
        }
      }
      rows.push(`${w}px 6종 이름 × 3화면 측정 완료`);
    }
    return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.slice(0, 6).join('; ') : rows.join(' | ') + ' — 가로 넘침·스크립트 실행 0건', shots };
  });

  await runCase(G, { id: 'F-AE104', cat: '심술 조작', title: '오프라인 전환: 진행 중 네트워크를 끊고(setOffline) 사망까지 진행', steps: '인생 진행 중 context.setOffline(true) → 선택지·다음 결정으로 반복해 사망까지', expected: '게임 진행은 네트워크와 무관(서버 없음)' }, async () => {
    const ctx = await mkctx(browser, { viewport: { width: 360, height: 740 } });
    const page = await ctx.newPage();
    await page.goto(DEV + '/?__timescale=15');
    await toLife(page, 'present');
    await sleep(500);
    await ctx.setOffline(true);
    const bad = [];
    for (let i = 0; i < 60; i++) {
      const s = await snap(page);
      if (s.screen === 'ending-screen') break;
      if (s.hasChoice) { await page.locator('.choice-list button').first().click(); await sleep(150); }
      else { await page.getByTestId('skip').click({ timeout: 3000 }).catch(() => {}); await sleep(100); }
    }
    const s = await snap(page);
    if (s.screen !== 'ending-screen') bad.push(`오프라인에서 끝까지 진행 못함(${s.screen})`);
    const sh = await shot(page, 'F-AE104');
    return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.join('; ') : `오프라인 상태로 사망까지 진행: ${s.death}`, shots: [sh] };
  });
}

if (!only || only === 'L') {
  await runCase(G, { id: 'F-AE105', cat: '정상 문구', title: '타이틀 출처 링크: 속성·클릭해도 게임 탭이 영향받지 않음', steps: '출처 링크의 href·target·rel 확인, 클릭하면 새 탭이 열리고 원래 탭의 화면·저장이 그대로인지 (외부 주소는 요청을 가로채 막아 둠)', expected: 'target=_blank rel에 noopener 포함, 원래 탭 불변' }, async () => {
    const ctx = await mkctx(browser, { viewport: { width: 360, height: 740 } });
    await ctx.route(/stfamily\.scourt\.go\.kr/, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<title>blocked</title>' }));
    const page = await ctx.newPage();
    await page.goto(DEV + '/');
    await waitScreen(page, 'title-screen');
    await sleep(500);
    const a = await page.locator('[data-testid="names-credit"] a').evaluate((el) => ({ href: el.href, target: el.target, rel: el.rel, text: el.textContent }));
    const raw0 = await readRaw(page);
    const [popup] = await Promise.all([ctx.waitForEvent('page', { timeout: 5000 }).catch(() => null), page.locator('[data-testid="names-credit"] a').click()]);
    await sleep(500);
    const s = await snap(page);
    const raw1 = await readRaw(page);
    const bad = [];
    if (a.target !== '_blank' || !/noopener/.test(a.rel)) bad.push(`링크 속성 ${a.target}/${a.rel}`);
    if (!popup) bad.push('새 탭이 열리지 않음');
    if (s.screen !== 'title-screen' || raw0 !== raw1) bad.push('원래 탭 변화');
    const sh = await shot(page, 'F-AE105');
    return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.join('; ') : `href=${a.href.slice(0, 70)} target=${a.target} rel=${a.rel}, 클릭 시 새 탭 ${popup ? '열림' : '없음'}, 원래 탭 타이틀 유지·저장 불변`, shots: [sh] };
  });
}
await browser.close();
