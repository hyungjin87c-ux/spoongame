// QA-003 M8 저장 변조(play 필드)·모드(LM1·LM3) 시험.
// 사용: node qa/scripts/m8-tamper.mjs <part ...>   part: play mode ending-end
//  play        : 인생 단계 저장의 play를 음수·문자열·거대값·NaN·배열 등으로 바꿔 연다 → 판은 열리고(나이 그대로) play 필드만 버려지는가
//  ending-end  : 사망 직전 상태 + 변조 play / 정상 play / play 없음 → 8배속으로 엔딩까지 → 엔딩의 블록 유무
//  mode        : 첫 화면의 인생 길이 선택·설명·「준비 중」, 변조된 설정·판의 처리
import fs from 'node:fs';
import { launch, openOracle, evalCore, openSeededRaw, openSeeded, plainLife, flushPlay, readSave, shot, sleep, runCase, appendJsonl, writeJson, SET_MANUAL, GAME_KEY, SETTINGS_KEY, SETTINGS_VERSION, SAVE_VERSION, PROD, mkctx, TOUCH, OBSERVER_INIT, holdModel } from './m8-lib.mjs';

const parts = process.argv.slice(2);
const browser = await launch();
const { page: oracle } = await openOracle(browser);

const nearDeath = (era, seed, back = 2) =>
  evalCore(
    oracle,
    `let s = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(arg.seed), arg.era)));
     const states = [];
     for (let g = 0; g < 2000 && s.phase === 'life'; g++) {
       if (s.pending === null) states.push(s);
       const r = s.pending !== null ? core.autoResolveStep(s, s.pending.key) : core.stepYear(s);
       s = r.state;
     }
     const pick = states[Math.max(0, states.length - arg.back)];
     return { state: pick, deathAge: s.death ? s.death.age : null };`,
    { era, seed, back },
  );

const lifeBase = await plainLife(oracle, { era: 'present', seed: 4242, age: 9, paused: true });

// ---------------------------------------------------------------- play 변조
const BAD = {
  negative: (p) => ({ ...p, hold: -5000 }),
  string: (p) => ({ ...p, hold: '12345' }),
  stringAll: () => 'play',
  nullField: (p) => ({ ...p, decide: null }),
  float: (p) => ({ ...p, hold: 1500.5 }),
  huge: (p) => ({ ...p, hold: 1e308 }),
  over24h: (p) => ({ ...p, hold: 86400001 }),
  overCount: (p) => ({ ...p, skips: 100001 }),
  array: () => [1, 2, 3, 4, 5, 6, 7, 8, 9],
  empty: () => ({}),
  extraKey: (p) => ({ ...p, extra: 1 }),
  missingKey: (p) => {
    const { resumes, ...rest } = p;
    return rest;
  },
  boolean: (p) => ({ ...p, note: true }),
  nested: (p) => ({ ...p, idle: { v: 1 } }),
  number: () => 5,
  nullPlay: () => null,
  nanLiteral: 'RAW_NAN',
  negZero: (p) => p,
};

if (parts.includes('play')) {
  const goodPlay = { hold: 120000, decide: 30000, fold: 1000, note: 2000, idle: 3000, offSpeed: 0, auto: 0, skips: 0, resumes: 2 };
  for (const [name, fn] of Object.entries({ valid: (p) => p, ...BAD })) {
    await runCase({ id: `TP-${name}`, title: `저장 변조: 인생 단계의 play = ${name}` }, async () => {
      let raw;
      const state = { ...lifeBase, play: goodPlay };
      if (fn === 'RAW_NAN') {
        raw = JSON.stringify({ version: SAVE_VERSION, data: state }).replace('"hold":120000', '"hold":NaN');
      } else {
        const next = fn(goodPlay);
        raw = JSON.stringify({ version: SAVE_VERSION, data: { ...state, play: next } });
        if (name === 'negZero') raw = raw.replace('"hold":120000', '"hold":-0');
      }
      const { ctx, page } = await openSeededRaw(browser, raw, { settings: SET_MANUAL });
      const screen = await page.evaluate(() => ['life-screen', 'title-screen', 'error-screen', 'ending-screen', 'superseded-screen'].find((id) => document.querySelector(`[data-testid="${id}"]`)) || 'none');
      let age = null;
      if (screen === 'life-screen') age = await page.evaluate(() => parseInt(document.querySelector('[data-testid="life-age"] b').textContent, 10));
      await sleep(1500);
      await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
      await sleep(100);
      const save = await readSave(page);
      const savedPlay = save && save.data ? save.data.play : undefined;
      const s = await shot(page, `TP-${name}`, screen);
      await ctx.close();
      const expectNaN = name === 'nanLiteral';
      const keep = name === 'valid' || name === 'negZero'; // -0은 0으로 읽힌다(JSON.parse("-0") === -0 → 정수 0으로 취급)
      let ok;
      let note;
      if (expectNaN) {
        ok = screen === 'title-screen' || screen === 'life-screen';
        note = `NaN 글자가 든 저장은 JSON 파손: 화면 ${screen} (오류 화면이 아니면 통과)`;
      } else if (keep) {
        ok = screen === 'life-screen' && age === lifeBase.age && savedPlay !== undefined && (name === 'negZero' ? savedPlay.hold >= 0 && savedPlay.hold < 3000 : savedPlay.hold >= 120000);
        note = `play 유지: 화면 ${screen}, 나이 ${age}, 저장된 play.hold ${savedPlay && savedPlay.hold}, resumes ${savedPlay && savedPlay.resumes}`;
      } else {
        ok = screen === 'life-screen' && age === lifeBase.age && savedPlay === undefined;
        note = `play만 버림: 화면 ${screen}, 나이 ${age}, 저장의 play ${savedPlay === undefined ? '없음' : JSON.stringify(savedPlay)}`;
      }
      return { verdict: ok ? 'PASS' : 'FAIL', actual: note, shots: [s] };
    });
  }
  // 엔딩 단계 저장 변조
  const endOr = await evalCore(oracle, `return core.playToEnd(core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(9), 'present'))), null).state;`);
  for (const name of ['valid', 'negative', 'string', 'huge', 'array', 'missingKey', 'extraKey', 'nullPlay']) {
    await runCase({ id: `TPE-${name}`, title: `저장 변조: 엔딩 단계의 play = ${name}` }, async () => {
      const fn = name === 'valid' ? (p) => p : BAD[name];
      const raw = JSON.stringify({ version: SAVE_VERSION, data: { ...endOr, play: fn({ hold: 600000, decide: 300000, fold: 0, note: 0, idle: 0, offSpeed: 0, auto: 0, skips: 0, resumes: 1 }) } });
      const { ctx, page } = await openSeededRaw(browser, raw, { settings: SET_MANUAL });
      const screen = await page.evaluate(() => ['ending-screen', 'title-screen', 'error-screen', 'life-screen'].find((id) => document.querySelector(`[data-testid="${id}"]`)) || 'none');
      const hasBlock = await page.evaluate(() => !!document.querySelector('[data-testid="ending-playtime"]'));
      const val = await page.evaluate(() => document.querySelector('[data-testid="ending-playtime-value"]')?.textContent.replace(/\s+/g, ' ').trim() ?? null);
      const s = await shot(page, `TPE-${name}`, screen);
      await ctx.close();
      const expectBlock = name === 'valid';
      const ok = screen === 'ending-screen' && hasBlock === expectBlock;
      return { verdict: ok ? 'PASS' : 'FAIL', actual: `엔딩 화면 ${screen}, 블록 ${hasBlock}(기대 ${expectBlock}), 값 ${val}`, shots: [s] };
    });
  }
  // 시작 판(첫 화면·룰렛·출생신고 단계)에 play가 있는 저장
  await runCase({ id: 'TP-title-has-play', title: '저장 변조: 첫 화면(title) 단계 저장에 play가 끼어 있음' }, async () => {
    const t = await evalCore(oracle, `return core.createInitialState(5);`);
    const raw = JSON.stringify({ version: SAVE_VERSION, data: { ...t, play: { hold: 1, decide: 1, fold: 1, note: 1, idle: 1, offSpeed: 0, auto: 0, skips: 0, resumes: 0 } } });
    const { ctx, page } = await openSeededRaw(browser, raw, { settings: SET_MANUAL });
    const screen = await page.evaluate(() => ['title-screen', 'life-screen', 'error-screen'].find((id) => document.querySelector(`[data-testid="${id}"]`)) || 'none');
    await sleep(800);
    const save = await readSave(page);
    await ctx.close();
    return { verdict: screen === 'title-screen' ? 'PASS' : 'FAIL', actual: `화면 ${screen}, 저장의 play ${save && save.data && save.data.play !== undefined ? JSON.stringify(save.data.play) : '없음'}` };
  });
}

// ---------------------------------------------------------------- 사망 직전 → 엔딩까지
if (parts.includes('ending-end')) {
  const nd = await nearDeath('present', 31, 3);
  const { state, deathAge } = nd;
  appendJsonl('near-death.jsonl', { age: state.age, deathAge, pendingNull: state.pending === null });
  const variants = [
    ['valid-clean', { hold: 100000, decide: 40000, fold: 0, note: 0, idle: 0, offSpeed: 0, auto: 0, skips: 0, resumes: 0 }, true],
    ['negative', { hold: -1, decide: 40000, fold: 0, note: 0, idle: 0, offSpeed: 0, auto: 0, skips: 0, resumes: 0 }, false],
    ['huge', { hold: 1e308, decide: 0, fold: 0, note: 0, idle: 0, offSpeed: 0, auto: 0, skips: 0, resumes: 0 }, false],
    ['string', { hold: 'abc', decide: 0, fold: 0, note: 0, idle: 0, offSpeed: 0, auto: 0, skips: 0, resumes: 0 }, false],
    ['none', undefined, false],
  ];
  for (const [name, play, expectBlock] of variants) {
    await runCase({ id: `TE-${name}`, title: `사망 직전 상태(play=${name})를 8배속으로 엔딩까지: 판 계속, 블록 ${expectBlock ? '있음' : '없음'}` }, async () => {
      const data = { ...state, paused: false };
      if (play === undefined) delete data.play;
      else data.play = play;
      const raw = JSON.stringify({ version: SAVE_VERSION, data });
      const { ctx, page } = await openSeededRaw(browser, raw, { settings: { speed: 8, autoMode: true, noteCards: false } });
      await page.waitForSelector('[data-testid="ending-screen"]', { timeout: 90000 });
      await sleep(400);
      const b = await page.evaluate(() => ({ block: !!document.querySelector('[data-testid="ending-playtime"]'), value: document.querySelector('[data-testid="ending-playtime-value"]')?.textContent.replace(/\s+/g, ' ').trim() ?? null, note: document.querySelector('[data-testid="ending-playtime-note"]')?.textContent.replace(/\s+/g, ' ').trim() ?? null }));
      const save = await readSave(page);
      const s = await shot(page, `TE-${name}`, 'ending');
      await ctx.close();
      const ok = b.block === expectBlock;
      return { verdict: ok ? 'PASS' : 'FAIL', actual: `엔딩 도착, 블록 ${b.block}(기대 ${expectBlock}), 값 ${b.value}, 저장의 play ${save.data.play === undefined ? '없음' : JSON.stringify(save.data.play)}`, shots: [s] };
    });
  }
}

// ---------------------------------------------------------------- 모드 (LM1·LM3)
if (parts.includes('mode')) {
  const settingsOf = (o) => JSON.stringify({ version: SETTINGS_VERSION, data: { era: 'present', lifeLength: 'short30', bgm: { on: false, volume: 30 }, theme: 'system', speed: 1, autoMode: false, noteCards: true, ...o } });
  await runCase({ id: 'MD01', title: '첫 화면: 인생 길이 두 카드, 약 30분 선택·설명 문구(D-92), 약 1시간은 「준비 중」으로 비활성' }, async () => {
    const ctx = await mkctx(browser, { viewport: { width: 360, height: 740 }, ...TOUCH });
    await ctx.addInitScript(() => {
      try {
        if (!sessionStorage.getItem('__c')) {
          localStorage.clear();
          sessionStorage.setItem('__c', '1');
        }
      } catch {}
    });
    const page = await ctx.newPage();
    await page.goto(PROD, { waitUntil: 'load' });
    await page.waitForSelector('[data-testid="title-screen"]');
    await sleep(400);
    const r = await page.evaluate(() => {
      const q = (s) => document.querySelector(s);
      const t = (e) => (e ? e.textContent.replace(/\s+/g, ' ').trim() : null);
      const g = q('[data-testid="life-length-group"]');
      const radios = [...g.querySelectorAll('input[type=radio]')];
      const s30 = q('[data-testid="life-short30"]');
      const l60 = q('[data-testid="life-long60"]');
      const lab = (i) => i.closest('label');
      return {
        n: radios.length,
        s30: { checked: s30.checked, disabled: s30.disabled, label: t(lab(s30)) },
        l60: { checked: l60.checked, disabled: l60.disabled, label: t(lab(l60)), meta: t(lab(l60).querySelector('.radio-card__meta')), border: getComputedStyle(lab(l60)).borderTopStyle, cursor: getComputedStyle(lab(l60)).cursor },
        hint: t(q('[data-testid="life-length-hint"]')),
        groupName: g.getAttribute('aria-label'),
      };
    });
    const HINT = '평균 수명까지 살아 보는 데 걸리는 시간이에요. 생각을 적는 시간은 넣지 않았어요. 도중에 나가도 진행은 이 기기에 남아요.';
    const problems = [];
    if (r.n !== 2) problems.push(`라디오 ${r.n}개`);
    if (!r.s30.checked || r.s30.disabled) problems.push('약 30분이 선택·활성이 아님');
    if (!/약 30분/.test(r.s30.label) || !/가볍게 한 판/.test(r.s30.label)) problems.push(`약 30분 카드 글 ${r.s30.label}`);
    if (!r.l60.disabled || r.l60.checked) problems.push('약 1시간이 선택 가능');
    if (r.l60.meta !== '준비 중') problems.push(`메타 ${r.l60.meta}`);
    if (r.l60.border !== 'dashed' || r.l60.cursor !== 'not-allowed') problems.push(`모양 ${r.l60.border}/${r.l60.cursor}`);
    if (r.hint !== HINT) problems.push(`설명 문구 ${r.hint}`);
    await page.getByTestId('life-length-group').evaluate((e) => e.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await sleep(200);
    const s = await shot(page, 'MD01', 'title-lifelength');
    await ctx.close();
    return { verdict: problems.length === 0 ? 'PASS' : 'FAIL', actual: problems.length === 0 ? `카드 둘, 약 30분 선택됨, 약 1시간 비활성 + 「준비 중」(점선·not-allowed), 설명 문구 일치` : problems.join(' / '), shots: [s] };
  });

  await runCase({ id: 'MD02', title: '「약 1시간」을 클릭·강제 클릭·방향키·Space로 골라도 선택·저장이 바뀌지 않고 아무 데도 넘어가지 않는다' }, async () => {
    const ctx = await mkctx(browser, { viewport: { width: 360, height: 740 }, ...TOUCH });
    await ctx.addInitScript(() => {
      try {
        if (!sessionStorage.getItem('__c')) {
          localStorage.clear();
          sessionStorage.setItem('__c', '1');
        }
      } catch {}
    });
    const page = await ctx.newPage();
    await page.goto(PROD, { waitUntil: 'load' });
    await page.waitForSelector('[data-testid="title-screen"]');
    await sleep(500);
    await page.getByTestId('life-long60').evaluate((el) => el.scrollIntoView({ block: 'center' }));
    const label = page.locator('label', { has: page.getByTestId('life-long60') });
    await label.click({ force: true }).catch(() => {});
    await page.getByTestId('life-long60').click({ force: true }).catch(() => {});
    await page.getByTestId('life-long60').dispatchEvent('click').catch(() => {});
    await page.getByTestId('life-short30').focus();
    for (const k of ['ArrowRight', 'ArrowDown', 'Space', 'ArrowRight']) await page.keyboard.press(k);
    await page.evaluate(() => {
      const el = document.querySelector('[data-testid="life-long60"]');
      el.disabled = false; // 개발자 도구로 비활성을 풀어 눌러 본다
      el.click();
    });
    await sleep(500);
    const st = await page.evaluate((k) => ({ s30: document.querySelector('[data-testid="life-short30"]').checked, l60: document.querySelector('[data-testid="life-long60"]').checked, settings: localStorage.getItem(k), screen: document.querySelector('[data-testid="title-screen"]') ? 'title' : 'other' }), SETTINGS_KEY);
    const lifeLength = st.settings ? JSON.parse(st.settings).data.lifeLength : null;
    const s = await shot(page, 'MD02', 'after-attempts');
    await ctx.close();
    const ok = st.s30 && !st.l60 && lifeLength !== 'long60' && st.screen === 'title';
    return { verdict: ok ? 'PASS' : 'FAIL', actual: `시도 후 약 30분 ${st.s30}, 약 1시간 ${st.l60}, 저장된 설정 lifeLength ${lifeLength}, 화면 ${st.screen}`, shots: [s] };
  });

  await runCase({ id: 'MD03', title: '변조된 설정(lifeLength long60)은 short30으로 읽고 새 판의 인생 길이도 short30' }, async () => {
    const ctx = await mkctx(browser, { viewport: { width: 360, height: 740 }, ...TOUCH });
    await ctx.addInitScript(
      ([sk, sv]) => {
        try {
          if (!sessionStorage.getItem('__c')) {
            localStorage.clear();
            localStorage.setItem(sk, sv);
            sessionStorage.setItem('__c', '1');
          }
        } catch {}
      },
      [SETTINGS_KEY, settingsOf({ lifeLength: 'long60', era: 'past' })],
    );
    const page = await ctx.newPage();
    await page.goto(PROD, { waitUntil: 'load' });
    await page.waitForSelector('[data-testid="title-screen"]');
    await sleep(500);
    const checked = await page.evaluate(() => ({ s30: document.querySelector('[data-testid="life-short30"]').checked, l60: document.querySelector('[data-testid="life-long60"]').checked, era: document.querySelector('[data-testid="era-past"]').checked }));
    await page.getByTestId('start-birth').click();
    await page.waitForSelector('[data-testid="roulette-screen"]');
    await sleep(400);
    const save = await readSave(page);
    const settings = JSON.parse(await page.evaluate((k) => localStorage.getItem(k), SETTINGS_KEY));
    await ctx.close();
    const ok = checked.s30 && !checked.l60 && checked.era && save.data.lifeLength === 'short30' && settings.data.lifeLength === 'short30';
    return { verdict: ok ? 'PASS' : 'FAIL', actual: `첫 화면 약 30분 ${checked.s30}, 약 1시간 ${checked.l60}, 세상 지난 ${checked.era} 유지 / 새 판 lifeLength ${save.data.lifeLength}, 다시 쓰인 설정 ${settings.data.lifeLength}` };
  });

  // 변조된 판(lifeLength long60): 연출 대기가 2.0배로 도는가, 첫 화면을 다시 열어도 판은 long60 그대로인가
  await runCase({ id: 'MD04', title: '저장 변조로 1시간 모드(long60)를 넣은 판: 열리고 연출 대기가 2.0배(조용한 해 14.0초)로 돈다, 첫 화면을 다시 열었다 이어도 그대로, 의견 주소는 허용 목록 안' }, async () => {
    const data = { ...lifeBase, paused: false, lifeLength: 'long60' };
    const raw = JSON.stringify({ version: SAVE_VERSION, data });
    const ctx = await mkctx(browser, { viewport: { width: 360, height: 740 }, ...TOUCH });
    await ctx.addInitScript(
      ([k, v, sk, sv]) => {
        try {
          if (!localStorage.getItem('__seeded')) {
            localStorage.clear();
            localStorage.setItem(k, v);
            localStorage.setItem(sk, sv);
            localStorage.setItem('__seeded', '1');
          }
        } catch {}
      },
      [GAME_KEY, raw, SETTINGS_KEY, settingsOf({})],
    );
    await ctx.addInitScript(OBSERVER_INIT);
    const page = await ctx.newPage();
    await page.goto(PROD, { waitUntil: 'load' });
    await page.waitForSelector('[data-testid="life-screen"]');
    await sleep(34000);
    const ev = await page.evaluate(() => window.__ev.filter((e) => e.k === 'age'));
    const fb = await page.getByTestId('tool-feedback').getAttribute('href');
    const save1 = await readSave(page);
    // 나가기 → 첫 화면 → 약 30분 누름 → 이어서 살기
    await page.getByTestId('tool-exit').click();
    await page.waitForSelector('[data-testid="exit-ask"]');
    await page.getByTestId('exit-yes').click();
    await page.waitForSelector('[data-testid="title-screen"]');
    const titleCheck = await page.evaluate(() => ({ s30: document.querySelector('[data-testid="life-short30"]').checked, l60: document.querySelector('[data-testid="life-long60"]').checked }));
    await page.getByTestId('life-short30').evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await page.locator('label', { has: page.getByTestId('life-short30') }).click({ force: true }).catch(() => {});
    await page.getByTestId('resume').click();
    await page.waitForSelector('[data-testid="life-screen"]');
    await sleep(300);
    const save2 = await readSave(page);
    const s = await shot(page, 'MD04', 'long60-life');
    await ctx.close();
    // 간격: 나이가 바뀐 간격 중 조용한 해(14000ms) 근처
    const gaps = [];
    for (let i = 1; i < ev.length; i++) gaps.push(Math.round(ev[i].t - ev[i - 1].t));
    const quietGaps = gaps.filter((g) => g > 10000);
    const ok = save1.data.lifeLength === 'long60' && save2.data.lifeLength === 'long60' && quietGaps.length >= 1 && quietGaps.every((g) => g >= 14000 * 0.98 && g <= 14000 * 1.03 + 250 || g >= 34000 * 0.98) && !!fb && !/play|플레이|[0-9]{2}:[0-9]{2}/.test(decodeURIComponent(fb));
    return { verdict: ok ? 'PASS' : 'FAIL', actual: `판 lifeLength ${save1.data.lifeLength} → 이어 살기 뒤 ${save2.data.lifeLength}, 나이 간격(ms) ${gaps.join(',')}, 첫 화면 약 30분 ${titleCheck.s30}/약 1시간 ${titleCheck.l60}, 의견 주소 ${decodeURIComponent(fb).replace(/^https:\/\/github.com\/[^/]+\/[^/]+/, '<저장소>')}`, shots: [s] };
  });

  await runCase({ id: 'MD05', title: 'reducer: 진행 중인 판에서 setLifeLength(long60·short30·알 수 없는 값)를 보내도 판의 lifeLength 불변, 설정은 고를 수 있는 값만' }, async () => {
    const r = await evalCore(
      oracle,
      `const base = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(5), 'present', 'short30')));
       const settings = { ...core.DEFAULT_SETTINGS };
       let sess = core.createSession(base, settings);
       const out = {};
       for (const v of ['long60', 'short30', 'bogus', null, 7]) {
         const after = core.sessionReducer(sess, { type: 'setLifeLength', lifeLength: v });
         out[String(v)] = { game: after.game.lifeLength, settings: after.settings.lifeLength };
       }
       return out;`,
    );
    const ok = Object.values(r).every((x) => x.game === 'short30' && x.settings === 'short30');
    return { verdict: ok ? 'PASS' : 'FAIL', actual: JSON.stringify(r) };
  });
}

await browser.close();
console.log('parts done', parts.join(','));
