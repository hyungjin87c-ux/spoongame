// QA-003 M7e 2회차 집중 확인(M7e-4가 바꾼 곳): 「살 곳을 구하는 일」의 새 선택지 `return`·`parents` 조건(T03a), 부모님과 한집 미혼 판에 「혼자 맞는 명절」·「혼자 사는 집」이 안 나옴(T03b·T03c),
// 부모 임종 뒤 가족 집 → 월세 규칙에서 자식 곁으로 옮긴(moved_home) 판 제외(T03d).
// 사용: QA_OUT=qa/results/m7e/r2 QA_SHOT_PREFIX=M7e-r2 QA_CASES=... node qa/scripts/m7e-r2-focus.mjs [T03a|T03b|T03d]
import fs from 'node:fs';
import path from 'node:path';
import { launch, mkctx, seedStorage, sleep, OUT, PROD, DEV, GAME_KEY, SETTINGS_KEY, TOUCH, VP, READ_DASH_M7E, runCase, shot, appendJsonl } from './m7e-lib.mjs';

const ONLY = process.argv[2] || '';
const run = (c, fn) => (!ONLY || c.id.endsWith(ONLY) ? runCase(c, fn) : null);
const SAVES = path.join(OUT, 'saves');
const save = (n) => fs.readFileSync(path.join(SAVES, n + '.json'), 'utf8');
const SPEED8 = JSON.stringify({ version: 3, data: { speed: 8, autoMode: false, era: 'present', lifeLength: 'short30', bgm: { on: false, volume: 30 }, theme: 'system' } });
let browser = await launch();
let n = 0;
const gameOf = (p) => p.evaluate((k) => JSON.parse(localStorage.getItem(k)).data, GAME_KEY);
async function open(raw, { dev = false, vp = { viewport: VP.m360, ...TOUCH }, snaps = false } = {}) {
  if (++n % 8 === 0) {
    await browser.close().catch(() => {});
    browser = await launch();
  }
  const ctx = await mkctx(browser, vp);
  await seedStorage(ctx, { [GAME_KEY]: raw, [SETTINGS_KEY]: SPEED8 });
  await ctx.addInitScript(`window.__readDash = ${READ_DASH_M7E.toString()};`);
  if (snaps)
    await ctx.addInitScript(() => {
      // 저장이 쓰일 때마다 (나이·주거·플래그·대기 카드·연표 길이) 얇은 스냅샷 — 사건이 뜬 해의 주거를 대조하는 근거
      window.__snaps = [];
      const orig = Storage.prototype.setItem;
      Storage.prototype.setItem = function (k, v) {
        if (k === 'suzeo-game:save') {
          try {
            const d = JSON.parse(v).data;
            const sn = { age: d.age, ph: d.phase, fl: d.flags, dw: d.assets ? d.assets.dwelling : null, pe: d.pending ? d.pending.key : null, hl: d.history.length };
            const sig = [sn.age, sn.ph, sn.fl.join(','), sn.dw, sn.pe, sn.hl].join('|');
            const last = window.__snaps[window.__snaps.length - 1];
            if (!last || last.sig !== sig) {
              sn.sig = sig;
              window.__snaps.push(sn);
            }
          } catch {}
        }
        return orig.apply(this, arguments);
      };
    });
  const page = await ctx.newPage();
  await page.goto(dev ? `${DEV}?__timescale=60` : PROD, { waitUntil: 'load' });
  return { ctx, page };
}
async function card(raw) {
  const { ctx, page } = await open(raw);
  await page.waitForSelector('[data-testid="choice-panel"]', { timeout: 30000 });
  await page.waitForFunction(() => [...document.querySelectorAll('[data-testid="choice-panel"] .choice')].every((b) => b.getAttribute('aria-disabled') !== 'true'), null, { timeout: 8000 }).catch(() => {});
  await sleep(300);
  return { ctx, page, d: await page.evaluate(() => window.__readDash()) };
}
/** DEV(시간 배율)에서 maxAge까지 진행하며 카드는 첫 선택지를 누른다. 끝나면 저장의 연표·플래그·스냅샷을 돌려준다 */
async function drive(raw, maxAge, ms = 90000) {
  const { ctx, page } = await open(raw, { dev: true, vp: { viewport: { width: 1280, height: 800 } }, snaps: true });
  await page.waitForSelector('[data-testid="life-screen"]', { timeout: 30000 });
  await page.locator('[data-speed="8"]').click().catch(() => {});
  const pb = page.locator('[data-testid="pause"]');
  if ((await pb.count()) && (await pb.getAttribute('data-paused')) === 'true') await pb.click().catch(() => {});
  const t0 = Date.now();
  let g;
  for (;;) {
    g = await gameOf(page);
    if (g.phase === 'ending' || g.age >= maxAge || Date.now() - t0 > ms) break;
    await page.evaluate(() => {
      const panel = document.querySelector('[data-testid="choice-panel"]');
      if (panel) {
        const b = [...panel.querySelectorAll('.choice')];
        if (b.length && b.every((x) => x.getAttribute('aria-disabled') !== 'true')) b[0].click();
      }
    });
    await sleep(60);
  }
  g.__snaps = await page.evaluate(() => window.__snaps ?? []);
  await ctx.close();
  return g;
}
const sameSet = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());

// ---------------------------------------------------------------- T03a
await run({ id: 'M7e-T03a', cat: '1회차 FAIL 재확인', title: 'T03a: 「살 곳을 구하는 일」 — 독립 판에는 「부모님 집으로 돌아간다」(return), 가족 집 판에만 「부모님 집에 머문다」(parents), lives_alone 판은 둘 다 안 보임', steps: '5상태(월세·가족 집·월세+lives_alone·전세·지난 세상 월세)의 카드 저장을 prod에서 열어 보이는 선택지·라벨·영향 줄을 읽고, return·parents를 눌러 결과 줄·주거·플래그를 본다', expected: '월세·전세 판 = rent·return·loan, 가족 집 판 = rent·parents·loan, lives_alone = rent·loan, return 결과 = 새 문장·주거 family·lives_with_parents' }, async () => {
  const bad = [];
  const shots = [];
  const rows = [];
  const EXP = { 'card-youth-housing-rent': ['rent', 'return', 'loan'], 'card-youth-housing-family': ['rent', 'parents', 'loan'], 'card-youth-housing-alone': ['rent', 'loan'], 'card-youth-housing-jeonse': ['rent', 'return', 'loan'], 'card-youth-housing-past-rent': ['rent', 'return', 'loan'] };
  for (const [name, want] of Object.entries(EXP)) {
    const { ctx, page, d } = await card(save(name));
    const ids = d.choices.map((c) => c.id);
    if (!sameSet(ids, want)) bad.push(`${name}: 보이는 선택지 ${ids} ≠ ${want}`);
    const lab = (id) => d.choices.find((c) => c.id === id)?.label;
    if (ids.includes('return') && lab('return') !== '부모님 집으로 돌아간다') bad.push(`${name}: return 라벨 「${lab('return')}」`);
    if (ids.includes('parents') && lab('parents') !== '부모님 집에 머문다') bad.push(`${name}: parents 라벨 「${lab('parents')}」`);
    rows.push(`${name.replace('card-youth-housing-', '')}: ${d.choices.map((c) => `${c.id}「${c.label}」[${c.impact.join(' ')}]`).join(' ')}`);
    const g0 = await gameOf(page);
    if (name === 'card-youth-housing-rent' || name === 'card-youth-housing-family') shots.push(await shot(page, 'T03a', name.replace('card-youth-housing-', '') + '-card'));
    // 선택 결과
    const pick = ids.includes('return') ? 'return' : ids.includes('parents') ? 'parents' : null;
    if (pick && (name === 'card-youth-housing-rent' || name === 'card-youth-housing-family' || name === 'card-youth-housing-past-rent')) {
      await page.locator(`[data-testid="choice-${pick}"]`).click();
      await sleep(700);
      const g1 = await gameOf(page);
      const row = g1.history.find((h) => h.eventId === 'youth-housing');
      const wantText = pick === 'return' ? '짐을 싸 부모님 집으로 돌아갔습니다. 한 식탁에 앉는 저녁이 다시 늘었고 살림도 가벼워졌습니다. 독립은 한 걸음 물러섰습니다.' : '집을 나서지 않기로 했습니다. 돈은 아꼈지만 독립은 조금씩 미뤄졌습니다.';
      if (row?.text !== wantText) bad.push(`${name}/${pick}: 결과 「${row?.text}」`);
      if (g1.assets.dwelling !== 'family') bad.push(`${name}/${pick}: 선택 뒤 주거 ${g1.assets.dwelling}`);
      if (!g1.flags.includes('lives_with_parents')) bad.push(`${name}/${pick}: lives_with_parents 없음`);
      if (pick === 'return' && g0.assets.dwelling === 'family') bad.push(`${name}: 이미 가족 집인데 return이 보임`);
      rows.push(`  → ${pick} 결과 「${row?.text}」 주거 ${g0.assets.dwelling} → ${g1.assets.dwelling}`);
      await page.evaluate(() => document.querySelector('[data-testid="log-list"]')?.scrollTo({ top: 1e6, behavior: 'instant' }));
      if (name === 'card-youth-housing-rent') shots.push(await shot(page, 'T03a', 'return-after'));
    }
    await ctx.close();
  }
  fs.writeFileSync(path.join(OUT, 'housing-states.json'), JSON.stringify(rows, null, 1));
  return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.join(' / ') : `5상태 모두 기대대로. ${rows.slice(0, 5).join(' | ').slice(0, 700)}`, shots };
});

// ---------------------------------------------------------------- T03b·T03c
let famRes = null;
await run({ id: 'M7e-T03b', cat: '1회차 FAIL 재확인', title: 'T03b: 부모님과 한집(가족 집)에 사는 미혼 판에 「혼자 맞는 명절」·「혼자 사는 집」이 나오지 않고, 독립 판에는 여전히 나온다 — 사건이 뜬 해의 주거를 저장 스냅샷으로 대조', steps: '지금 세상 재력 3단계 45세·미혼·무자녀·`lives_with_parents`·주거 family 저장 12개와 같은 판의 독립(월세) 변형 12개를 개발 서버(시간 배율)에서 80세까지 돌려(카드는 첫 선택지) 연표에서 middle-lonely-holiday·senior-alone이 뜬 해를 찾고, 저장이 쓰일 때마다 모은 스냅샷에서 그 사건 직전 주거(dwelling)를 읽는다. 결함 = 직전 주거가 family·care인데 사건이 뜸', expected: '사건이 뜬 해의 주거가 family인 경우 0 (집을 사거나 부모가 떠나 월세·자가로 바뀐 뒤에 뜬 것은 규칙대로), 독립 판에서는 나옴(대조)' }, async () => {
  const bad = [];
  const note = [];
  const fam = { holiday: 0, alone: 0, lives: 0, ageEnd: [], atFamily: 0, atOther: 0, reasons: {} };
  const ind = { holiday: 0, alone: 0, lives: 0, ageEnd: [] };
  const seedsList0 = fs.readdirSync(SAVES).filter((f) => /^life-family-single-45-s\d+\.json$/.test(f)).map((f) => /s(\d+)\.json/.exec(f)[1]);
  const seedsList = process.env.QA_T03B_LIMIT ? seedsList0.slice(0, Number(process.env.QA_T03B_LIMIT)) : seedsList0;
  for (const s of seedsList) {
    for (const [kind, tgt] of [['family', fam], ['rent', ind]]) {
      const raw0 = save(`life-${kind}-single-45-s${s}`);
      const h0 = JSON.parse(raw0).data.history.length; // 저장 만들 때 이미 있던 연표 줄은 제외(만들어 낸 이력)
      const g = await drive(raw0, 80);
      tgt.lives++;
      tgt.ageEnd.push(g.age);
      // 첫 저장 전에(첫 해 틱에서) 뜬 사건은 시작 저장의 주거·플래그를 직전 상태로 쓴다
      const d0 = JSON.parse(raw0).data;
      const snaps = [{ age: d0.age, ph: d0.phase, fl: d0.flags, dw: d0.assets.dwelling, pe: null, hl: d0.history.length }, ...(g.__snaps ?? [])];
      const evs = [];
      g.history.forEach((h, i) => {
        if (i < h0 || !['middle-lonely-holiday', 'senior-alone'].includes(h.eventId)) return;
        const before = [...snaps].reverse().find((x) => x.hl <= i);
        if (!before) { bad.push('시드 ' + s + ' ' + h.age + '세 ' + h.eventId + ': 스냅샷 없음(스냅 ' + snaps.length + '개, 연표 ' + g.history.length + '줄, 줄번호 ' + i + ', 첫 스냅 hl ' + (snaps[0] ? snaps[0].hl : '-') + ')'); return; }
        const dw = before ? before.dw : null;
        const fl = before ? before.fl : [];
        evs.push({ id: h.eventId, age: h.age, dw, parentsGone: fl.includes('parents_gone'), ownHome: fl.includes('own_home'), renting: fl.includes('renting'), livesWithParents: fl.includes('lives_with_parents') });
        if (h.eventId === 'middle-lonely-holiday') tgt.holiday++;
        else tgt.alone++;
        if (kind === 'family') {
          if (dw === 'family' || dw === 'care') {
            tgt.atFamily++;
            bad.push(`시드 ${s} ${h.age}세 ${h.eventId}: 직전 주거 ${dw}`);
          } else {
            tgt.atOther++;
            const why = (before.fl.includes('parents_gone') ? '부모 임종 뒤 월세' : '') + (before.fl.includes('own_home') ? '집 마련(자가)' : '') + (!before.fl.includes('parents_gone') && !before.fl.includes('own_home') ? '기타(' + dw + ')' : '');
            tgt.reasons[why] = (tgt.reasons[why] ?? 0) + 1;
          }
        }
      });
      appendJsonl('samples-r2-t03b-v2.jsonl', { kind, seed: s, age: g.age, snapsN: snaps.length, events: evs, dwellingPath: snaps.reduce((a, x) => (a.length && a[a.length - 1].dw === x.dw ? a : [...a, { age: x.age, dw: x.dw }]), []) });
    }
  }
  fs.writeFileSync(path.join(OUT, 'r2-t03b-summary.json'), JSON.stringify({ fam, ind }, null, 1));
  if (ind.holiday === 0) bad.push('독립 판에서도 「혼자 맞는 명절」이 한 번도 안 나옴(대조 실패)');
  const reasons = Object.entries(fam.reasons).map(([k, v]) => k + ' ' + v).join(', ');
  return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.slice(0, 5).join(' / ') + ` (총 ${bad.length})` : `가족 집·미혼 ${fam.lives}판(진행 ${Math.min(...fam.ageEnd)}~${Math.max(...fam.ageEnd)}세): 사건이 뜬 해의 직전 주거가 family인 경우 0 — 두 사건 합 ${fam.holiday + fam.alone}번 모두 주거가 이미 바뀐 뒤(${reasons}) / 대조 독립(월세) ${ind.lives}판: 「혼자 맞는 명절」 ${ind.holiday}번·「혼자 사는 집」 ${ind.alone}번(나옴)`, shots: [] };
});

// ---------------------------------------------------------------- T03d moved_home
await run({ id: 'M7e-T03d', cat: '1회차 FAIL 재확인', title: 'T03d(R-378): 부모가 모두 떠난 뒤 가족 집 → 월세 규칙에서 자식 곁으로 옮긴(moved_home) 판은 가족 집이 유지되고, 일반 가족 집 판은 월세로 바뀐다', steps: '부모 임종 카드 저장(moved_home 있음/없음, 주거 family)에서 「곁을 지킨다」를 고르고 다음 해들을 돌려 저장의 주거를 읽는다', expected: 'moved_home → family 유지, 일반 → rent' }, async () => {
  const bad = [];
  const out = [];
  for (const name of ['card-farewell-moved', 'card-farewell-plain']) {
    const { ctx, page } = await card(save(name));
    await page.locator('[data-testid="choice-stay"]').click();
    await sleep(900);
    let g = await gameOf(page);
    const goneAge = g.age;
    const gone = g.flags.includes('parents_gone');
    // 두 해 더
    const t0 = Date.now();
    while (g.age < goneAge + 2 && Date.now() - t0 < 25000) {
      await page.evaluate(() => {
        const panel = document.querySelector('[data-testid="choice-panel"]');
        if (panel) {
          const b = [...panel.querySelectorAll('.choice')];
          if (b.length && b.every((x) => x.getAttribute('aria-disabled') !== 'true')) b[0].click();
        }
      });
      const pb = page.locator('[data-testid="pause"]');
      if ((await pb.count()) && (await pb.getAttribute('data-paused')) === 'true') await pb.click().catch(() => {});
      await page.locator('[data-speed="8"]').click().catch(() => {});
      await sleep(300);
      g = await gameOf(page);
    }
    const want = name === 'card-farewell-moved' ? 'family' : 'rent';
    if (!gone) bad.push(`${name}: parents_gone이 안 켜짐`);
    if (g.assets.dwelling !== want) bad.push(`${name}: ${goneAge}세 임종 뒤 ${g.age}세 주거 ${g.assets.dwelling} ≠ ${want}`);
    out.push(`${name.replace('card-farewell-', '')}: ${goneAge}세 임종 → ${g.age}세 주거 ${g.assets.dwelling}`);
    await ctx.close();
  }
  return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.join(' / ') : out.join(' | '), shots: [] };
});
await browser.close();
