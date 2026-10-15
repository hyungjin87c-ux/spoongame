// 공격 #7 저장 차단 (쿼터 초과 흉내·setItem 차단·localStorage 접근 불가) — 안내가 뜨고 진행은 되는지, 복구되면 안내가 사라지는지
import { DEV, GAME_KEY, SETTINGS_KEY, launch, mkctx, runCase, shot, snap, toLife, toBirth, waitScreen, readSave, readRaw, sleep, con } from './f-compat.mjs';

const G = 'a-quota';
const browser = await launch();
let n = 77;
const aId = () => `F-AQ${String(n++).padStart(2, '0')}`;
const curId = () => `F-AQ${String(n - 1).padStart(2, '0')}`;
const notice = (page) => page.locator('[data-testid="save-notice"]').count();
const noticeText = async (page) => ((await notice(page)) ? (await page.locator('[data-testid="save-notice"]').textContent()).trim() : null);

const BLOCK = () => {
  window.__origSet = Storage.prototype.setItem;
  window.__blocked = true;
  Storage.prototype.setItem = function () {
    if (window.__blocked) throw new DOMException('quota blocked', 'QuotaExceededError');
    return window.__origSet.apply(this, arguments);
  };
};

n = 77;
await runCase(G, { id: aId(), cat: '#7 저장 차단', title: '빈 저장소 + setItem 차단(쿼터 초과 흉내): 안내가 즉시 뜨고, 안내가 떠 있어도 시작해서 인생까지 진행됨', steps: '처음 여는 사용자(저장 없음)에서 setItem이 항상 예외 → 타이틀에서 안내 확인 → 시작 → 시대 → 출생 → 살아가기 → 다음 결정으로 → 선택', expected: '안내("저장하지 못했습니다…")가 곧바로 뜨고 게임은 계속 진행됨. 오류 화면·흰 화면 없음' }, async () => {
  const ctx = await mkctx(browser, { viewport: { width: 360, height: 740 } });
  const page = await ctx.newPage();
  await page.addInitScript(BLOCK);
  await page.goto(DEV + '/');
  await waitScreen(page, 'title-screen');
  await sleep(600);
  const bad = [];
  const rows = [];
  const t = await noticeText(page);
  rows.push(`타이틀 안내: ${t}`);
  if (!t) bad.push('빈 저장소에서 안내가 즉시 뜨지 않음');
  const shT = await shot(page, curId(), 'title-notice');
  await page.getByRole('button', { name: '시작' }).click();
  await waitScreen(page, 'era-screen');
  await page.getByTestId('confirm-era').click();
  await waitScreen(page, 'birth-screen');
  await page.getByTestId('next-life').click();
  await waitScreen(page, 'life-screen');
  await sleep(600);
  await page.getByTestId('skip').click();
  await page.waitForSelector('[data-testid="choice-panel"]');
  await sleep(500);
  const shC = await shot(page, curId(), 'choice-notice');
  await page.locator('.choice-list button').first().click();
  await sleep(500);
  const s = await snap(page);
  rows.push(`진행 후 화면 ${s.screen} ${s.age} 안내=${await notice(page) ? '있음' : '없음'}`);
  if (s.screen !== 'life-screen') bad.push(`진행 화면 이상 ${s.screen}`);
  if (!(await notice(page))) bad.push('진행 중 안내가 사라짐');
  // 저장소엔 아무것도 없어야 함
  const raw = await readRaw(page);
  if (raw !== null) bad.push('차단했는데 저장됨?');
  // 새로고침하면 진행이 사라지는 것은 예상(저장 불가). 안내 문구 그대로 사실
  await page.reload();
  await sleep(700);
  const s2 = await snap(page);
  rows.push(`새로고침 후 화면 ${s2.screen} (저장 불가라 처음부터가 정상)`);
  return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.join('; ') + ' :: ' + rows.join(' | ') : rows.join(' | '), shots: [shT, shC] };
});

await runCase(G, { id: aId(), cat: '#7 저장 차단', title: '기존 저장이 있을 때 setItem 차단: 첫 진행 때 안내, 차단 해제 후 다음 저장에서 안내가 사라짐', steps: '정상 저장 후 새 탭에서 setItem 차단(로드 때는 안내 없음) → 다음 결정으로 → 안내 확인 → 차단 해제 → 진행 → 안내 소멸 확인', expected: '로드 직후엔 안내 없음, 첫 진행(저장 실패) 때 안내, 복구되면 다음 저장 성공과 함께 안내가 사라짐' }, async () => {
  const ctx = await mkctx(browser, { viewport: { width: 360, height: 740 } });
  const p0 = await ctx.newPage();
  await p0.goto(DEV + '/');
  await toLife(p0, 'present');
  await sleep(600);
  await p0.getByTestId('skip').click();
  await p0.waitForSelector('[data-testid="choice-panel"]');
  await sleep(500);
  const saved = await readRaw(p0);
  await p0.close();
  const page = await ctx.newPage();
  await page.addInitScript(BLOCK);
  await page.goto(DEV + '/');
  await waitScreen(page, 'life-screen');
  await sleep(800);
  const bad = [];
  const rows = [];
  rows.push(`로드 직후 안내: ${(await notice(page)) ? '있음' : '없음'} (선택지 대기 중이라 저장 시도 없음)`);
  if (await notice(page)) bad.push('로드 직후(진행 없음)에 안내가 뜸');
  await page.locator('.choice-list button').first().click(); // 선택 → 저장 시도 → 실패
  await sleep(600);
  const t1 = await noticeText(page);
  rows.push(`선택 후 안내: ${t1}`);
  if (!t1) bad.push('첫 진행(저장 실패) 때 안내가 안 뜸');
  const shN = await shot(page, curId(), 'blocked');
  const sv = await readRaw(page);
  if (sv !== saved) bad.push('차단했는데 저장소 값이 바뀜');
  await page.evaluate(() => { window.__blocked = false; });
  // 진행: 다음 결정으로 (저장 성공 → 안내 소멸)
  await page.getByTestId('skip').click();
  await sleep(700);
  const t2 = await noticeText(page);
  rows.push(`복구 후 진행 뒤 안내: ${t2}`);
  if (t2) bad.push('복구 후에도 안내가 남음');
  const shR = await shot(page, curId(), 'recovered');
  return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.join('; ') + ' :: ' + rows.join(' | ') : rows.join(' | '), shots: [shN, shR] };
});

await runCase(G, { id: aId(), cat: '#7 저장 차단', title: '실제 쿼터 초과: 저장소를 가득 채운 뒤 진행(실제 QuotaExceededError)', steps: 'localStorage에 큰 더미 값을 한도까지 채움 → 앱 진행 → 안내 → 더미 삭제 후 저장 복구', expected: '실제 쿼터 오류에서도 안내 후 진행 가능, 더미를 지우면 저장이 다시 되고 안내 소멸' }, async () => {
  const ctx = await mkctx(browser, { viewport: { width: 360, height: 740 } });
  const page = await ctx.newPage();
  await page.goto(DEV + '/');
  await toLife(page, 'present');
  await sleep(600);
  // 더미로 한도 채우기: 1MB 조각을 넣다가 실패하면 100KB, 1KB 단위로 더 채운다
  const filled = await page.evaluate(() => {
    let total = 0;
    for (const size of [1000000, 100000, 10000, 1000, 100, 10, 1]) {
      for (let i = 0; i < 12; i++) {
        try { localStorage.setItem(`fill-${size}-${i}`, 'x'.repeat(size)); total += size; } catch { break; }
      }
    }
    return total;
  });
  await sleep(200);
  const bad = [];
  const rows = [`더미 ${filled}자로 채움`];
  await page.getByTestId('skip').click();
  await sleep(800);
  const t1 = await noticeText(page);
  const s = await snap(page);
  rows.push(`진행 후 화면 ${s.screen} ${s.age} 안내=${t1}`);
  if (s.screen !== 'life-screen') bad.push(`화면 ${s.screen}`);
  if (!t1) bad.push('실제 쿼터 초과에서 안내가 안 뜸');
  const sh = await shot(page, curId(), 'full');
  await page.evaluate(() => { for (const k of Object.keys(localStorage)) if (k.startsWith('fill-')) localStorage.removeItem(k); });
  // 선택지가 있으면 고르고 없으면 skip
  const s1 = await snap(page);
  if (s1.hasChoice) await page.locator('.choice-list button').first().click();
  else await page.getByTestId('skip').click();
  await sleep(800);
  const t2 = await noticeText(page);
  rows.push(`더미 삭제 후 진행 → 안내=${t2}`);
  if (t2) bad.push('복구 후에도 안내가 남음');
  const sh2 = await shot(page, curId(), 'recovered');
  return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.join('; ') + ' :: ' + rows.join(' | ') : rows.join(' | '), shots: [sh, sh2] };
});

await runCase(G, { id: aId(), cat: '#7 저장 차단', title: 'localStorage 접근 자체가 예외(차단·시크릿 모드 흉내): window.localStorage getter가 throw', steps: 'Object.defineProperty(window,"localStorage",{get(){throw}}) 상태로 처음부터 진행', expected: '앱은 뜨고 끝까지 진행 가능(저장 안내 표시). 흰 화면·오류 화면 없음' }, async () => {
  const ctx = await mkctx(browser, { viewport: { width: 360, height: 740 } });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new DOMException('denied', 'SecurityError'); } });
  });
  await page.goto(DEV + '/');
  await sleep(1000);
  const bad = [];
  const rows = [];
  const s0 = await snap(page);
  rows.push(`로드 화면 ${s0.screen}, 안내=${await noticeText(page)}`);
  if (s0.screen !== 'title-screen') bad.push(`타이틀이 아님 ${s0.screen}`);
  const sh = await shot(page, curId(), 'title');
  await toLife(page, 'present').catch((e) => bad.push('진행 중단 ' + e.message.slice(0, 80)));
  await sleep(500);
  await page.getByTestId('skip').click().catch(() => {});
  await page.waitForSelector('[data-testid="choice-panel"]', { timeout: 5000 }).catch(() => bad.push('선택지까지 못 감'));
  const sh2 = await shot(page, curId(), 'life');
  const s1 = await snap(page);
  rows.push(`진행 화면 ${s1.screen} ${s1.age} 선택지=${s1.hasChoice} 안내=${await noticeText(page)}`);
  return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.join('; ') + ' :: ' + rows.join(' | ') : rows.join(' | '), shots: [sh, sh2] };
});

await runCase(G, { id: aId(), cat: '#7 저장 차단', title: '쿼터 초과 중 새로고침·탭 닫기 반복: 이전 저장은 유지되고 되살아나는 오류 없음 (setItem 차단 + 새로고침 x6)', steps: '유효 저장이 있는 상태에서 setItem 차단 → 진행 → 새로고침 6회 → 상태 비교', expected: '새로고침하면 마지막으로 저장에 성공했던 상태로 돌아가며(예상), 손상·오류 없음' }, async () => {
  const ctx = await mkctx(browser, { viewport: { width: 360, height: 740 } });
  const p0 = await ctx.newPage();
  await p0.goto(DEV + '/');
  await toLife(p0, 'present');
  await sleep(600);
  await p0.getByTestId('skip').click();
  await p0.waitForSelector('[data-testid="choice-panel"]');
  await sleep(500);
  const base = await readSave(p0);
  await p0.close();
  const page = await ctx.newPage();
  await page.addInitScript(BLOCK);
  await page.goto(DEV + '/');
  await waitScreen(page, 'life-screen');
  await sleep(600);
  await page.locator('.choice-list button').first().click();
  await sleep(500);
  await page.getByTestId('skip').click();
  await sleep(500);
  const bad = [];
  const rows = [];
  const mem = await snap(page);
  for (let i = 0; i < 6; i++) { await page.reload({ waitUntil: i % 2 ? 'commit' : 'load' }).catch(() => {}); await sleep(300); }
  await sleep(600);
  const s = await snap(page);
  const sv = await readSave(page);
  rows.push(`메모리 ${mem.age} → 새로고침 6회 후 ${s.screen} ${s.age}(저장 ${sv.data.age}세, 저장 시점 ${base.data.age}세)`);
  if (sv.__corrupt) bad.push('저장 손상');
  if (sv.data.age !== base.data.age) bad.push('차단 중 저장이 바뀜');
  if (s.screen !== 'life-screen') bad.push(`화면 ${s.screen}`);
  const sh = await shot(page, curId());
  return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.join('; ') + ' :: ' + rows.join(' | ') : rows.join(' | '), shots: [sh] };
});
await browser.close();
