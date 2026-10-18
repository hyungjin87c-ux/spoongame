// QA-003 M7a 공격 보충(A03 세부): ① 연표 299줄 위에 마일스톤 해가 두 줄을 더할 때 연표 상한 처리 ② pending 위조로 재력 조건 선택지 노출 ③ 동생 없는 판의 「동생의 장난감」(플래그 변조) ④ 조부모 플래그 없는 grandma 노출.
// 사용: node qa/scripts/m7a-attack2.mjs     결과: cases.jsonl (M7a-A03b~d), 스크린샷 M7a-A03*-*
import fs from 'node:fs';
import path from 'node:path';
import { launch, mkctx, seedStorage, sleep, OUT, PROD, GAME_KEY, SETTINGS_KEY, TOUCH, VP, READ_DASH_M7A, runCase, shot } from './m7a-lib.mjs';
import { RP, SHOT_PREFIX } from './m7a-lib.mjs';

const craft = JSON.parse(fs.readFileSync(path.join(OUT, RP + 'craft-saves.json'), 'utf8'));
const SPEED8 = JSON.stringify({ version: 3, data: { speed: 8, autoMode: false, era: 'present', lifeLength: 'short30', bgm: { on: false, volume: 30 }, theme: 'system' } });
let browser = await launch();
const gameOf = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k)).data, GAME_KEY);
async function open(env, { waitCard = false } = {}) {
  const ctx = await mkctx(browser, { viewport: VP.m360, ...TOUCH });
  await seedStorage(ctx, { [GAME_KEY]: JSON.stringify(env), [SETTINGS_KEY]: SPEED8 });
  const page = await ctx.newPage();
  await page.addInitScript(`window.__readDash = ${READ_DASH_M7A.toString()};`);
  await page.goto(PROD, { waitUntil: 'load' });
  await page.waitForSelector(waitCard ? '[data-testid="choice-panel"]' : '[data-testid="life-screen"], [data-testid="title-screen"]', { timeout: 30000 });
  await page.waitForFunction(() => [...document.querySelectorAll('[data-testid="choice-panel"] .choice')].every((b) => b.getAttribute('aria-disabled') !== 'true'), null, { timeout: 4000 }).catch(() => {});
  await sleep(300);
  return { ctx, page };
}

await runCase({ id: 'M7a-A03b', cat: '공격', title: '연표 299줄(상한 300) 위에 마일스톤 해가 한 해에 줄 둘을 더함: 출생 줄·최신 줄이 남고 오래된 서술부터 버려진다, 화면·저장 정상', steps: '0세·연표 299줄(출생 + 서술 298) 저장을 열어 예방접종(마일스톤)·이유식 선택 해를 지나게 한다', expected: '연표 ≤ 300, 첫 줄은 출생 문장, 예방접종 줄과 선택 결과 줄이 남음, 화면의 인생 기록이 열려 새 줄이 보임' }, async () => {
  const bad = [];
  const env = JSON.parse(craft['w-infant-meal-start-present-t5'].raw);
  env.data.age = 0;
  env.data.seen = {};
  env.data.lastChoiceAge = null;
  env.data.history = [env.data.history[0], ...Array.from({ length: 298 }, (_, i) => ({ age: 0, kind: 'event', title: `줄${i}`, text: `채움 줄 ${i}입니다.`, eventId: `infant-fill-${i % 9}` }))];
  // 0세 난수 상태를 이유식 카드가 나오는 쪽으로 다시 찾는다(코어 없이: craft 저장의 rngState는 age 0에서 이유식이 나오게 만든 값)
  env.data.rngState = JSON.parse(craft['w-infant-meal-start-present-t5'].raw).data.rngState;
  const { ctx, page } = await open(env, { waitCard: true });
  const d = await page.evaluate(() => window.__readDash());
  const before = await gameOf(page);
  await page.locator(`[data-testid="choice-${d.choices[0].id}"]`).click();
  await sleep(1200);
  const g = await gameOf(page);
  const first = g.history[0];
  if (g.history.length > 300) bad.push(`연표 ${g.history.length}줄(>300)`);
  if (first.kind !== 'stage') bad.push(`첫 줄이 출생(단계)이 아님: ${first.kind}`);
  if (!g.history.some((h) => h.eventId === 'infant-vaccine')) bad.push('예방접종 줄이 사라짐');
  if (!g.history.some((h) => h.kind === 'choice' && h.eventId === 'infant-meal-start')) bad.push('선택 결과 줄이 사라짐');
  const fills = g.history.filter((h) => /infant-fill/.test(h.eventId ?? '')).length;
  const rows = await page.evaluate(() => document.querySelectorAll('[data-testid="log-row"]').length);
  const sh = await shot(page, 'A03b', 'cap-299-lines');
  await ctx.close();
  return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.join(' / ') : `선택 전 ${before.history.length}줄(마일스톤 줄 포함 ${before.history.some((h) => h.eventId === 'infant-vaccine') ? '예' : '아니오'}) → 선택 뒤 ${g.history.length}줄, 첫 줄 「${first.text.slice(0, 14)}…」, 예방접종·선택 결과 줄 유지, 채움 줄 ${fills}/298개 남음, 화면 기록 줄 ${rows}개`, shots: [sh] };
});

await runCase({ id: 'M7a-A03c', cat: '공격', title: 'pending 위조로 재력 조건 선택지 노출: 재력 1단계 저장의 pending.choiceIds에 보이지 않아야 할 선택지(first-birthday grand)를 넣음', steps: '재력 1단계 1세 저장에 pending(infant-first-birthday, choiceIds grand·small·skip)을 심어 연다 → 카드에 보이는 선택지, grand를 눌렀을 때 결과', expected: '(변조) 앱이 멈추지 않는다. 노출 여부는 기록 — 기존 구조에서 pending의 선택지 목록을 그대로 신뢰하는지' }, async () => {
  const env = JSON.parse(craft['w-infant-first-birthday-present-t1'].raw);
  env.data.age = 1;
  env.data.seen = { 'infant-first-birthday': 1 };
  env.data.lastChoiceAge = 1;
  env.data.pending = { eventId: 'infant-first-birthday', key: 'infant-first-birthday@1', age: 1, choiceIds: ['grand', 'small', 'skip'] };
  const { ctx, page } = await open(env, { waitCard: true });
  const d = await page.evaluate(() => window.__readDash());
  const ids = d.choices.map((c) => c.id);
  const sh = await shot(page, 'A03c', 'tier1-pending-grand');
  let applied = null;
  if (ids.includes('grand')) {
    await page.locator('[data-testid="choice-grand"]').click();
    await sleep(1200);
    const g = await gameOf(page);
    applied = g.history.filter((h) => h.kind === 'choice').map((h) => h.choice).join(',');
  }
  await ctx.close();
  return { verdict: 'RECORD', actual: `재력 1단계 저장에 pending 선택지 ${ids.join(',')} → ${ids.includes('grand') ? `재력 4단계 이상이어야 보이는 「손님을 모아 크게 치른다」가 보이고 눌러 적용됨(연표 「${applied}」)` : '보이지 않음(걸러짐)'}. 앱은 멈추지 않음`, shots: [sh] };
});

await runCase({ id: 'M7a-A03d', cat: '공격', title: '동생 없는 판의 「동생의 장난감」(플래그·seen 변조): 둘째 이상(birthOrder 3)·동생 맞이 기록 없음 저장에 younger_sibling 플래그와 장난감 카드', steps: '「동생의 장난감」 카드 저장(재력 5, 4세)에서 birthOrder 3으로 바꾸고 seen[infant-new-sibling]을 지워 연다 → 카드·가족 카드·눌렀을 때 결과', expected: '(변조) 앱이 멈추지 않는다. 카드 문장(동생이)과 가족 카드(동생 없음)의 어긋남은 기록' }, async () => {
  const env = JSON.parse(craft['w-infant-sibling-toy-present-t5'].raw);
  env.data.birthReport.birthOrder = 3;
  delete env.data.seen['infant-new-sibling'];
  const { ctx, page } = await open(env, { waitCard: true });
  const d = await page.evaluate(() => window.__readDash());
  const fam = await page.evaluate(() => [...document.querySelectorAll('[data-testid="family-sibling"]')].map((e) => e.textContent.replace(/\s+/g, ' ').trim()));
  const sh = await shot(page, 'A03d', 'toy-without-sibling');
  await page.locator(`[data-testid="choice-${d.choices[0].id}"]`).click();
  await sleep(1200);
  const g = await gameOf(page);
  const err = await page.evaluate(() => !!document.querySelector('[data-testid="error-screen"]'));
  await ctx.close();
  return { verdict: err ? 'FAIL' : 'RECORD', actual: `카드 「${d.choiceTitle}」「${(d.choiceText ?? '').slice(0, 26)}…」 · 가족 카드 ${fam.join(' / ')} → ${fam.some((t) => /동생/.test(t)) ? '동생이 보임' : '동생 줄 없음(카드 문장과 어긋남, 변조 한정)'}. 선택 뒤 ${g.history.filter((h) => h.kind === 'choice').length}개 기록, 화면 정상`, shots: [sh] };
});

await runCase({ id: 'M7a-A03e', cat: '공격', title: '조건 선택지 위조: 조부모 플래그 없이 pending에 동생 맞이의 grandma(조부모 품) 선택지', steps: '첫째 3세 저장에 pending(infant-new-sibling, choiceIds help·grandma), flags에 grandparent_close 없음', expected: '(변조) 앱이 멈추지 않는다. 노출 여부 기록' }, async () => {
  const env = JSON.parse(craft['w-infant-new-sibling-present-t5'].raw);
  env.data.seen = { 'infant-new-sibling': 3 };
  env.data.flags = [];
  env.data.lastChoiceAge = 3;
  env.data.pending = { eventId: 'infant-new-sibling', key: 'infant-new-sibling@3', age: 3, choiceIds: ['help', 'grandma'] };
  const { ctx, page } = await open(env, { waitCard: true });
  const d = await page.evaluate(() => window.__readDash());
  const ids = d.choices.map((c) => c.id);
  const sh = await shot(page, 'A03e', 'grandma-without-flag');
  await ctx.close();
  return { verdict: 'RECORD', actual: `조부모 플래그 없는 저장의 선택지 ${ids.join(',')} → ${ids.includes('grandma') ? '「조부모님 품에서 마음을 달랜다」가 보임(requires 미적용, 변조 한정)' : '걸러짐'}`, shots: [sh] };
});

await browser.close();
