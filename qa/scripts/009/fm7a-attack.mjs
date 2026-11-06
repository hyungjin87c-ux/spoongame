// SPEC-009 FM7a 공격 테스트 묶음. 사용: QA_STATES=<states> QA_BASE=http://localhost:5311 node qa/scripts/009/fm7a-attack.mjs <시나리오…>
// legacy | tamper | tabs | rapid | killreload | backbtn | gentletoggle
import { chromium, boot, loadState, readSave, cardNow, ageNow, GAME_KEY, BASE, stopSaving, settingsEnvelope, SETTINGS_KEY } from './fm7a-lib.mjs';
import { readFileSync } from 'node:fs';

const STATES = process.env.QA_STATES;
const S3 = process.env.QA_STATES3; // 자녀 판
const load = (dir, key) => JSON.parse(readFileSync(`${dir}/${key}.json`, 'utf8'));
const which = process.argv.slice(2);
const b = await chromium.launch();

async function screenOf(page) {
  return page.evaluate(() => {
    const ids = ['life-screen', 'title-screen', 'error-screen', 'load-failed', 'ending-screen', 'superseded-screen', 'roulette-screen', 'birth-screen'];
    const on = ids.filter((i) => { const e = document.querySelector(`[data-testid="${i}"]`); return e && e.getClientRects().length > 0; });
    return on.join(',') || 'none';
  });
}
const histKey = (h) => `${h.age}|${h.kind}|${h.eventId ?? ''}|${h.text}`;
const dupFam = (hist) => { const c = {}; for (const h of hist) if (/^fam-/.test(h.eventId ?? '') && h.eventId !== 'fam-sib-born' && h.eventId !== 'fam-sib-left') c[`${h.eventId}@${h.age}`] = (c[`${h.eventId}@${h.age}`] ?? 0) + 1; return Object.entries(c).filter(([, n]) => n > 1).map(([k]) => k); };
const monotone = (hist) => hist.every((h, i) => i === 0 || h.age >= hist[i - 1].age);

const scenarios = {
  // ① 공개 v0.3 형식(lg: 1) 저장: lives_with_child 없음. 첫 해 끝에 채워지고 깨지지 않는가 / 형제 별세 계획은 소급되지 않는가
  async legacy() {
    for (const key of ['k2-boomer', 'k3-g86', 'k1-genx']) {
      const st = load(S3, key);
      const hadFlag = st.data.flags.includes('lives_with_child');
      st.data.flags = st.data.flags.filter((f) => f !== 'lives_with_child');
      st.data.family.lg = 1;
      const { ctx, page, errors } = await boot(b, st, { scale: 40, settings: { speed: 8, autoMode: true } });
      await page.getByTestId('life-screen').waitFor({ timeout: 15000 });
      const a0 = st.data.age;
      await page.waitForFunction((a) => Number(document.querySelector('[data-testid="life-age"]')?.textContent?.match(/\d+/)?.[0] ?? 0) >= a + 2, a0, { timeout: 60000 });
      await page.getByTestId('pause').click().catch(() => {});
      const sv = await readSave(page);
      const kids = await page.evaluate(() => [...document.querySelectorAll('[data-testid="family-child"]')].map((e) => e.getAttribute('data-state')));
      console.log(`legacy ${key}: 원래 플래그 ${hadFlag} → 제거(lg=1) → ${a0}→${sv.data.age}세 후 lives_with_child=${sv.data.flags.includes('lives_with_child')} (화면 자녀 ${kids.join('/')}) lg=${sv.data.family?.lg} | 화면 ${await screenOf(page)} | errors ${errors.length}`);
      await ctx.close();
    }
    // 형제 별세 계획이 소급되지 않는다(lg:1) — T06 상태에 lg:1을 달면 그 해에 줄이 없다
    for (const key of ['T06-male-형-industrial', 'T06-female-언니-g86']) {
      const st = load(STATES, key);
      st.data.family.lg = 1;
      const { ctx, page, errors } = await boot(b, st, { scale: 40, settings: { speed: 8, autoMode: true } });
      await page.getByTestId('life-screen').waitFor({ timeout: 15000 });
      const a0 = st.data.age;
      await page.waitForFunction((a) => Number(document.querySelector('[data-testid="life-age"]')?.textContent?.match(/\d+/)?.[0] ?? 0) >= a + 2, a0, { timeout: 60000 });
      await page.getByTestId('pause').click().catch(() => {});
      const sv = await readSave(page);
      const lost = sv.data.history.filter((h) => h.eventId === 'fam-sib-lost').length;
      const gone = await page.evaluate(() => [...document.querySelectorAll('[data-testid="family-gone"] dt')].map((e) => e.textContent.trim()));
      console.log(`legacy-Q3 ${key} lg=1: ${a0}→${sv.data.age}세, fam-sib-lost 줄 ${lost}개, 떠난 가족 카드 ${JSON.stringify(gone)} | 화면 ${await screenOf(page)} | errors ${errors.length}`);
      await ctx.close();
    }
  },

  // ② 저장 조작(값 변조): 거부·복구되는가, 흰 화면·오류 화면이 없는가
  async tamper() {
    const base = () => load(STATES, 'T06-male-형-industrial');
    const mut = {
      'family.l 로그 범위 밖 [3,999,10,99]': (d) => { d.family.l = [...(d.family.l ?? []), [3, 999, 10, 99]]; },
      'family.l 없는 형제 [3,5,30,4]': (d) => { d.family.l = [...(d.family.l ?? []), [3, 5, 30, 4]]; },
      'family.l 종류 3 두 번(한 판 최대 1건 위반)': (d) => { d.family.l = [...(d.family.l ?? []), [3, 3, 10, 5], [3, 4, 11, 5]]; },
      'family.lg = 2': (d) => { d.family.lg = 2; },
      'family.v = 99': (d) => { d.family.v = 99; },
      'family.p[0].d = -5': (d) => { d.family.p[0].d = -5; },
      'family.p[1].d = 0 (0세 별세 계획)': (d) => { d.family.p[1].d = 0; },
      "character.name = '<script>alert(1)</script>'": (d) => { d.character.name = '<script>alert(1)</script>'; },
      "character.name = '😀😀😀'": (d) => { d.character.name = '😀😀😀'; },
      'character.name = 가 400자': (d) => { d.character.name = '가'.repeat(400); },
      'flags: lives_with_child 가짜(자녀 없음)': (d) => { d.flags.push('lives_with_child'); },
      'flags: has_sibling 제거': (d) => { d.flags = d.flags.filter((f) => f !== 'has_sibling'); },
      'history: fam-sib-lost 줄 text 변조': (d) => { const h = d.history.find((x) => x.eventId === 'fam-sib-lost'); if (h) h.text = '<b>변조</b>'; else d.history.push({ age: 3, kind: 'event', eventId: 'fam-sib-lost', text: '<b>변조</b>' }); },
      'history: fam 줄 age 음수': (d) => { d.history.push({ age: -4, kind: 'event', eventId: 'fam-sib-lost', text: '5살이던 형이 세상을 떠났습니다.' }); },
      'age = 999': (d) => { d.age = 999; },
      'seed = "abc"': (d) => { d.seed = 'abc'; },
      'pending.choiceIds 가짜': (d) => { d.pending = { key: 'x', eventId: 'school-teacher-notice', choiceIds: ['nope', 'ask'] }; },
    };
    for (const [label, fn] of Object.entries(mut)) {
      const st = base();
      fn(st.data);
      const { ctx, page, errors } = await boot(b, st, { scale: 30, settings: { speed: 8, autoMode: true } });
      await page.waitForTimeout(1800);
      const scr = await screenOf(page);
      const age = scr.includes('life-screen') ? await ageNow(page) : null;
      const note = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 90));
      const xss = await page.evaluate(() => window.__xss ?? 0);
      const sv = await readSave(page);
      const stored = sv ? `저장 age ${sv.data?.age} name ${JSON.stringify(sv.data?.character?.name)}` : '저장 없음';
      console.log(`tamper [${label}] → 화면 ${scr}${age !== null ? ' 나이 ' + age : ''} | ${stored} | 본문 「${note}」 | errors ${errors.length}${errors.length ? ' ' + errors[0].slice(0, 80) : ''}`);
      await ctx.close();
    }
  },

  // ③ 탭 두 개: 같은 판을 두 탭에서 → 한쪽만 이어지고 같은 해를 두 번 진행하지 않는가
  async tabs() {
    const st = load(STATES, 'T01-industrial');
    const a0 = st.data.age;
    const { ctx, page: A, errors } = await boot(b, st, { scale: 20, settings: { speed: 1, autoMode: true } });
    await A.getByTestId('life-screen').waitFor({ timeout: 15000 });
    await A.waitForTimeout(400);
    const B = await ctx.newPage();
    B.on('pageerror', (e) => errors.push('B pageerror ' + e.message));
    await B.goto(BASE + '/?__timescale=20');
    await B.waitForTimeout(1500);
    const scrA = await screenOf(A), scrB = await screenOf(B);
    await A.waitForTimeout(6000);
    const sv = await readSave(A);
    const scrA2 = await screenOf(A), scrB2 = await screenOf(B);
    console.log(`tabs: A ${scrA}→${scrA2}, B ${scrB}→${scrB2} | 저장 age ${sv.data.age} (시작 ${a0}) | 가족 줄 중복 ${JSON.stringify(dupFam(sv.data.history))} | 연표 단조 ${monotone(sv.data.history)} | errors ${errors.length}`);
    // B에서 이어서 하기를 눌러 본다(밀린 쪽이 다시 이어받을 수 있는가)
    const resume = B.getByTestId('resume');
    if (await resume.isVisible().catch(() => false)) { await resume.click().catch(() => {}); await B.waitForTimeout(1500); }
    await A.waitForTimeout(1500);
    const sv2 = await readSave(A);
    console.log(`tabs(이어받기 뒤): A ${await screenOf(A)}, B ${await screenOf(B)} | 저장 age ${sv2.data.age} | 가족 줄 중복 ${JSON.stringify(dupFam(sv2.data.history))} | 연표 단조 ${monotone(sv2.data.history)} | errors ${errors.length}`);
    await ctx.close();
  },

  // ④ 빠른 연속 진행: 다음 결정으로·일시정지·배속을 연타해도 같은 해 모순이 없고 기록 순서가 맞는가
  async rapid() {
    for (const key of (process.env.RAPID_KEYS ?? 'T01-industrial,T06-female-언니-g86,T04-boomer').split(',')) {
      const st = load(STATES, key);
      const { ctx, page, errors } = await boot(b, st, { scale: 60, settings: { speed: 1, autoMode: false } });
      await page.getByTestId('life-screen').waitFor({ timeout: 15000 });
      const click = (id) => page.getByTestId(id).click({ timeout: 500, noWaitAfter: true }).catch(() => {});
      for (let round = 0; round < 14; round++) {
        for (let i = 0; i < 10; i++) { await click('skip'); await click('pause'); if (!process.env.RAPID_NOSPEED) { await page.locator('[data-speed="4"]').click({ timeout: 300 }).catch(() => {}); await page.locator('[data-speed="8"]').click({ timeout: 300 }).catch(() => {}); } }
        const card = await cardNow(page);
        if (card) { const id = card.choices[0].id; for (let k = 0; k < 4; k++) await page.getByTestId(`choice-${id}`).click({ timeout: 300, noWaitAfter: true }).catch(() => {}); }
      }
      await page.waitForTimeout(500);
      const sv = await readSave(page);
      const rows = await page.evaluate(() => [...document.querySelectorAll('[data-testid="log-list"] li[data-testid="log-row"]')].map((li) => Number(li.querySelector('.log__age')?.textContent?.match(/\d+/)?.[0] ?? -1)));
      const rowsDesc = rows.every((a, i) => i === 0 || a <= rows[i - 1]);
      const sameYear = []; // 같은 해에 줄 뒤 떠난 분을 산 사람으로 말하는 줄: 이 키의 줄 종류별 점검
      const hist = sv.data.history;
      const lines = hist.filter((h) => /^fam-(parent-gone|gp-gone|sib-lost)$/.test(h.eventId ?? ''));
      console.log(`rapid ${key}: age ${sv.data.age} phase ${sv.data.phase} | 연표 단조 ${monotone(hist)} | 화면 줄 나이 내림차순(최신 위) ${rowsDesc} | 가족 줄 중복 ${JSON.stringify(dupFam(hist))} | 가족 별세 줄 ${lines.map((h) => h.age + '세').join(',')} | errors ${errors.length}`);
      await ctx.close();
    }
  },

  // ⑤ 저장 중 종료: 진행 중 임의 시점에 탭을 닫고 다시 열기를 반복 — 끝까지 한 번에 간 판과 연표가 같은가
  async killreload() {
    for (const key of ['T01-industrial', 'T05-g86']) {
      const st = load(STATES, key);
      const a0 = st.data.age, target = a0 + Number(process.env.KR_YEARS ?? 25);
      // 기준: 한 번에 끝까지
      const ref = await boot(b, st, { scale: 40, settings: { speed: 8, autoMode: true } });
      await ref.page.waitForFunction((t) => Number(document.querySelector('[data-testid="life-age"]')?.textContent?.match(/\d+/)?.[0] ?? 0) >= t, target, { timeout: 90000 });
      await ref.page.getByTestId('pause').click().catch(() => {});
      await ref.page.waitForTimeout(300);
      const refHist = (await readSave(ref.page)).data.history.filter((h) => h.age < target - 1);
      await ref.ctx.close();
      // 시험: 임의 시점 종료·재개 반복(같은 컨텍스트 = 같은 localStorage)
      const { ctx, page: p0, errors } = await boot(b, st, { scale: 40, settings: { speed: 8, autoMode: true } });
      let page = p0, kills = 0, reloads = 0;
      const t0 = Date.now();
      while (Date.now() - t0 < 150000) {
        await page.waitForTimeout(40 + Math.floor(Math.random() * 260));
        const done = await page.evaluate((t) => Number(document.querySelector('[data-testid="life-age"]')?.textContent?.match(/\d+/)?.[0] ?? 0) >= t, target).catch(() => false);
        if (done) break;
        if (Math.random() < 0.6) { await page.close({ runBeforeUnload: false }); kills++; page = await ctx.newPage(); page.on('pageerror', (e) => errors.push(e.message)); await page.goto(BASE + '/?__timescale=40'); }
        else { await page.reload().catch(() => {}); reloads++; }
        await page.waitForSelector('[data-testid="life-screen"], [data-testid="title-screen"]', { timeout: 8000 }).catch(() => {});
        if (await page.getByTestId('title-screen').isVisible().catch(() => false)) await page.getByTestId('resume').click({ timeout: 2000 }).catch(() => {});
      }
      await page.getByTestId('pause').click().catch(() => {});
      await page.waitForTimeout(300);
      const sv = await readSave(page);
      const got = sv.data.history.filter((h) => h.age < target - 1);
      const same = JSON.stringify(got.map(histKey)) === JSON.stringify(refHist.map(histKey));
      const firstDiff = same ? '' : got.map(histKey).findIndex((k, i) => k !== refHist.map(histKey)[i]);
      console.log(`killreload ${key}: 종료 ${kills}회 · 새로고침 ${reloads}회 → age ${sv.data.age} | 한 번에 간 판과 연표 같음=${same}${same ? '' : ' (첫 차이 줄 ' + firstDiff + ': ' + got.map(histKey)[firstDiff] + ' ≠ ' + refHist.map(histKey)[firstDiff] + ')'} | 가족 줄 중복 ${JSON.stringify(dupFam(sv.data.history))} | errors ${errors.length}`);
      await ctx.close();
    }
  },

  // ⑥ 뒤로가기: 결정 카드가 떠 있는 상태에서 뒤로/앞으로
  async backbtn() {
    const st = load(process.env.QA_STATES4, 'parentc-industrial-81000531');
    const { ctx, page, errors } = await boot(b, st, { scale: 60, settings: { speed: 1, autoMode: false } });
    await page.getByTestId('life-screen').waitFor({ timeout: 15000 });
    const t0 = Date.now(); let card = null;
    while (Date.now() - t0 < 30000 && !(card = await cardNow(page))) await page.waitForTimeout(50);
    const ids0 = card?.choices.map((c) => c.id).join('|');
    const sv0 = (await readSave(page)).data;
    const out = [];
    for (let i = 0; i < 6; i++) {
      await page.goBack().catch(() => {});
      await page.waitForTimeout(250);
      await page.goForward().catch(() => {});
      await page.waitForTimeout(250);
      if (await page.getByTestId('title-screen').isVisible().catch(() => false)) await page.getByTestId('resume').click({ timeout: 2000 }).catch(() => {});
      await page.waitForSelector('[data-testid="life-screen"]', { timeout: 5000 }).catch(() => {});
      const c = await cardNow(page);
      out.push(c ? c.choices.map((x) => x.id).join('|') : '(카드 없음 ' + (await screenOf(page)) + ')');
    }
    const sv1 = (await readSave(page)).data;
    console.log(`backbtn: 처음 ${ids0} → 뒤/앞 6회 ${JSON.stringify([...new Set(out)])} | 나이 ${sv0.age}→${sv1.age} | pending ${sv0.pending?.key}→${sv1.pending?.key} choiceIds ${JSON.stringify(sv1.pending?.choiceIds)} | errors ${errors.length}`);
    // 빠른 연타: 같은 선택지를 6번 연달아 눌러도 한 번만 처리
    const c = await cardNow(page);
    if (c) { for (let k = 0; k < 6; k++) await page.getByTestId(`choice-${c.choices[0].id}`).click({ timeout: 200, noWaitAfter: true }).catch(() => {}); await page.waitForTimeout(500); }
    const sv2 = (await readSave(page)).data;
    const rowsOfEvent = sv2.history.filter((h) => h.eventId === 'school-teacher-notice').length;
    console.log(`선택지 연타 6회 → school-teacher-notice 줄 ${rowsOfEvent}개 (1이어야 함) | 연표 단조 ${monotone(sv2.history)} | 가족 줄 중복 ${JSON.stringify(dupFam(sv2.history))}`);
    await ctx.close();
  },

  // ⑦ 가리기 스위치 껐다 켰다(첫 화면 경유): T06 줄이 원문 ↔ 가림으로 바뀌는가
  async gentletoggle() {
    const st = load(STATES, 'T06-male-형-industrial');
    st.data.paused = true;
    const a0 = st.data.age;
    const { ctx, page, errors } = await boot(b, st, { scale: 40, settings: { speed: 8, autoMode: true, gentle: false } });
    await page.getByTestId('life-screen').waitFor({ timeout: 15000 });
    await page.getByTestId('pause').click().catch(() => {});
    await page.waitForFunction((a) => Number(document.querySelector('[data-testid="life-age"]')?.textContent?.match(/\d+/)?.[0] ?? 0) >= a + 1, a0, { timeout: 40000 });
    await page.getByTestId('pause').click().catch(() => {});
    const body = () => page.evaluate(() => document.querySelector('[data-testid="log-list"]').innerText.replace(/\s+/g, ' '));
    const has = (t) => /7살이던 형이 세상을 떠났습니다/.test(t);
    const veilN = () => page.locator('[data-testid="log-list"] li[data-veiled="true"]:not([data-tl="era"])').count();
    const t1 = await body(); const v1 = await veilN();
    const toggle = async (on) => {
      await page.getByTestId('tool-exit').click(); await page.getByTestId('exit-yes').click();
      await page.getByTestId('title-screen').waitFor();
      await page.waitForFunction(() => { const x = document.querySelector('[data-testid="resume"]'); return x && !x.disabled; });
      await page.waitForTimeout(1500);
      const sw = page.getByTestId('gentle-switch');
      if ((await sw.getAttribute('aria-checked')) !== String(on)) await sw.click();
      await page.waitForTimeout(200);
      await page.getByTestId('resume').click();
      await page.getByTestId('life-screen').waitFor();
      await page.waitForTimeout(400);
      await page.getByTestId('pause').click().catch(() => {});
    };
    await toggle(true);
    const t2 = await body(); const v2 = await veilN();
    await toggle(false);
    const t3 = await body(); const v3 = await veilN();
    console.log(`gentletoggle: 끔 → 원문 ${has(t1)} 가림줄 ${v1} | 켬 → 원문 ${has(t2)} 가림줄 ${v2} | 다시 끔 → 원문 ${has(t3)} 가림줄 ${v3} | errors ${errors.length}`);
    await ctx.close();
  },
};
for (const w of which) { console.log(`\n--- ${w}`); await scenarios[w](); }
await b.close();
