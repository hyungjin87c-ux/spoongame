// QA-003 M5 공격 B: 저장값 변조 매트릭스(v8 assets·familyFund·dwelling·__proto__·범위 밖 …), 옛 저장(v7·v6) → 새 게임과 안내, 이름 변조, 오프라인, 화면 회전.
// 사용: node qa/scripts/m5-attack-b.mjs
import fs from 'node:fs';
import { launch, mkctx, PROD, DEV, GAME_KEY, SETTINGS_KEY, sleep, shot, runCase, READ_DASH_M5, editSave, con, parseMan, setRootFont } from './m5-lib.mjs';
import { loadSave } from './m5-states.mjs';

const ONLY = process.env.ONLY || '';
const run = (c, fn) => (!ONLY || c.id.endsWith(ONLY) ? runCase(c, fn) : null);
const browser = await launch();
const ADULT = loadSave('present', 'adult-dash');
const YOUNG = loadSave('present', 'young-choice');
const ENDING = loadSave('present', 'ending');
const CHOICE = loadSave('present', 'adult-choice');
// 출생신고(birth) 단계 저장: 20세 미만 선택지 저장에서 인생 진행 기록을 비운 모양
const BIRTH = editSave(YOUNG, (d) => {
  d.phase = 'birth';
  d.age = 0;
  d.history = [];
  d.flags = [];
  d.seen = {};
  d.pending = null;
  d.lastChoiceAge = null;
  d.paused = false;
  d.stats = { ...d.birthStats };
  d.familyFund = 0;
  d.assets = null;
});

/** 저장을 심고 PROD를 연다(탭마다 다시 심지 않도록 첫 페이지에서 한 번만 심고 새로고침) */
async function openWith(raw, { base = PROD, vp = { width: 360, height: 740 }, settings = null, extra = {} } = {}) {
  const ctx = await mkctx(browser, { viewport: vp, ...extra });
  const page = await ctx.newPage();
  await page.addInitScript(`window.__readDash = ${READ_DASH_M5.toString()};`);
  await page.goto(base, { waitUntil: 'load' });
  await page.evaluate(([k, v, sk, sv]) => {
    localStorage.clear();
    localStorage.setItem(k, v);
    if (sv) localStorage.setItem(sk, sv);
  }, [GAME_KEY, raw, SETTINGS_KEY, settings]);
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => document.querySelector('[data-testid]') !== null, null, { timeout: 15000 });
  await sleep(350);
  return { ctx, page };
}
const screenOf = (page) => page.evaluate(() => window.__readDash().screen);

const ev = (mod) => (raw) => editSave(raw, mod);
const rawEdit = (fn) => (raw) => fn(raw);

// 변형 목록: [이름, 바탕, 만드는 법, 기대('invalid' = 새 게임(첫 화면), 'valid' = 그대로 열림)]
const V = [
  ['net 소수 1.5', ADULT, ev((d) => (d.assets.net = 1.5)), 'invalid'],
  ['net 문자열 "5000"', ADULT, ev((d) => (d.assets.net = '5000')), 'invalid'],
  ['net 범위 밖 +2,000,001', ADULT, ev((d) => (d.assets.net = 2000001)), 'invalid'],
  ['net 범위 밖 −200,001', ADULT, ev((d) => ((d.assets.net = -200001), (d.assets.debt = 200001))), 'invalid'],
  ['debt < −net (net −5000, debt 0)', ADULT, ev((d) => ((d.assets.net = -5000), (d.assets.debt = 0))), 'invalid'],
  ['debt 음수', ADULT, ev((d) => (d.assets.debt = -1)), 'invalid'],
  ['debt 소수 1.25', ADULT, ev((d) => (d.assets.debt = 1.25)), 'invalid'],
  ['debt 범위 밖 1,000,001', ADULT, ev((d) => (d.assets.debt = 1000001)), 'invalid'],
  ['income 음수', ADULT, ev((d) => (d.assets.income = -1)), 'invalid'],
  ['income 범위 밖 100,001', ADULT, ev((d) => (d.assets.income = 100001)), 'invalid'],
  ['incomeAdj 범위 밖 10,001', ADULT, ev((d) => (d.assets.incomeAdj = 10001)), 'invalid'],
  ['dwelling 엉뚱한 값 "castle"', ADULT, ev((d) => (d.assets.dwelling = 'castle')), 'invalid'],
  ['dwelling "__proto__"', ADULT, ev((d) => (d.assets.dwelling = '__proto__')), 'invalid'],
  ['dwelling 숫자 1', ADULT, ev((d) => (d.assets.dwelling = 1)), 'invalid'],
  ['assets 배열 [1,2,3]', ADULT, ev((d) => (d.assets = [1, 2, 3])), 'invalid'],
  ['assets 문자열', ADULT, ev((d) => (d.assets = 'x')), 'invalid'],
  ['assets 숫자 0', ADULT, ev((d) => (d.assets = 0)), 'invalid'],
  ['assets 안에 __proto__ 만 있음', ADULT, rawEdit((raw) => raw.replace(/"assets":\{[^}]*\}/, '"assets":{"__proto__":{"net":1,"income":1,"debt":1,"incomeAdj":0,"dwelling":"rent"}}')), 'invalid'],
  ['assets null (20세 이상)', ADULT, ev((d) => (d.assets = null)), 'invalid'],
  ['net 1e999(무한대)', ADULT, rawEdit((raw) => raw.replace(/"net":-?\d+/, '"net":1e999')), 'invalid'],
  ['20세 이상에 familyFund 5', ADULT, ev((d) => (d.familyFund = 5)), 'invalid'],
  ['stats에 옛 wealth 키', ADULT, ev((d) => (d.stats.wealth = 50)), 'invalid'],
  ['birthStats에 옛 wealth 키', ADULT, ev((d) => (d.birthStats.wealth = 50)), 'invalid'],
  ['20세 전에 assets 있음', YOUNG, ev((d) => (d.assets = { net: 100, income: 0, debt: 0, incomeAdj: 0, dwelling: 'family' })), 'invalid'],
  ['familyFund 거대 1e12', YOUNG, ev((d) => (d.familyFund = 1e12)), 'invalid'],
  ['familyFund 3,001', YOUNG, ev((d) => (d.familyFund = 3001)), 'invalid'],
  ['familyFund −3,001', YOUNG, ev((d) => (d.familyFund = -3001)), 'invalid'],
  ['familyFund 소수 1.5', YOUNG, ev((d) => (d.familyFund = 1.5)), 'invalid'],
  ['familyFund 문자열', YOUNG, ev((d) => (d.familyFund = '100')), 'invalid'],
  ['familyFund 없음(undefined)', YOUNG, ev((d) => delete d.familyFund), 'invalid'],
  ['엔딩인데 assets null (20세 이상)', ENDING, ev((d) => (d.assets = null)), 'invalid'],
  ['엔딩인데 20세 전 나이에 assets 있음', ENDING, ev((d) => ((d.age = 15), (d.death.age = 15))), 'invalid'],
  // 정상 범위 안의 극단값: 그대로 열려야 한다
  ['[경계] net 2,000,000·debt 1,000,000·income 100,000', ADULT, ev((d) => (d.assets = { net: 2000000, debt: 1000000, income: 100000, incomeAdj: 10000, dwelling: 'own' })), 'valid'],
  ['[경계] net −200,000·debt 200,000·income 0', ADULT, ev((d) => (d.assets = { net: -200000, debt: 200000, income: 0, incomeAdj: -10000, dwelling: 'care' })), 'valid'],
  ['[경계] debt = −net 정확히', ADULT, ev((d) => ((d.assets.net = -1234), (d.assets.debt = 1234))), 'valid'],
  ['[경계] familyFund ±3,000', YOUNG, ev((d) => (d.familyFund = -3000)), 'valid'],
  ['[경계] familyFund +3,000', YOUNG, ev((d) => (d.familyFund = 3000)), 'valid'],
  // R-357(r4): assets는 키를 정확히 다섯 개로 요구한다(여분 키·__proto__ 거부)
  ['assets에 알 수 없는 키가 더 있음', ADULT, ev((d) => (d.assets.extra = 1)), 'invalid'],
  ['assets에 정상 키 + __proto__ 키 추가', ADULT, rawEdit((raw) => raw.replace(/"assets":{/, '"assets":{"__proto__":{"x":1},')), 'invalid'],
  ['assets 키 하나 빠짐(dwelling 없음)', ADULT, ev((d) => delete d.assets.dwelling), 'invalid'],
  ['출생신고 단계에 familyFund 450(R-357)', BIRTH, ev((d) => (d.familyFund = 450)), 'invalid'],
  ['[대조] 출생신고 단계에 familyFund 0', BIRTH, ev((d) => (d.familyFund = 0)), 'valid'],
  ['data 최상위에 __proto__ 키(오염 시도)', ADULT, rawEdit((raw) => raw.replace('"data":{', '"data":{"__proto__":{"polluted":1,"phase":"life"},')), 'valid'],
];

await run({ id: 'M5-A05', cat: '공격', title: `저장값 변조 ${V.length}종(v8 assets 소수·문자열·범위 밖·debt < −net·음수 debt·__proto__·배열·20세 전 assets·엉뚱한 dwelling·거대 familyFund …) + 범위 안 극단값`, steps: '변조한 저장을 심고 앱을 연다(prod 번들 360×740): 어느 화면이 뜨는지, 콘솔 오류·크래시, 극단값은 금액 표기와 가로 넘침을 본다', expected: '규칙을 어긴 저장은 모두 새 게임(첫 화면)이고 크래시·오류 화면·빈 화면 0. 규칙 안의 극단값은 그대로 열리고 금액이 「약」·NaN·undefined 없이 원 단위로 나오며 가로 넘침 0. 오염(Object.prototype) 0' }, async () => {
  const bad = [];
  const rows = [];
  const shots = [];
  for (const [name, base, mk, want] of V) {
    con.take();
    let raw;
    try {
      raw = mk(base);
    } catch (e) {
      bad.push(`${name}: 변조 생성 실패 ${e.message}`);
      continue;
    }
    const { ctx, page } = await openWith(raw);
    const screen = await screenOf(page);
    const text = await page.evaluate(() => document.body.innerText);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    const polluted = await page.evaluate(() => ({}).polluted !== undefined || Object.prototype.hasOwnProperty.call(Object.prototype, 'polluted') || ({}).phase !== undefined);
    const errs = con.take().filter((x) => x.type === 'pageerror' || x.type === 'error');
    const saved = await page.evaluate((k) => localStorage.getItem(k), GAME_KEY);
    let outcome;
    if (screen === 'title-screen') outcome = 'invalid';
    else if (screen === 'life-screen' || screen === 'ending-screen' || screen === 'birth-screen' || screen === 'roulette-screen') outcome = 'valid';
    else outcome = screen;
    if (outcome !== want) bad.push(`${name}: ${outcome}(기대 ${want})`);
    if (errs.length) bad.push(`${name}: 콘솔 오류 ${errs.length}건 ${errs[0].text.slice(0, 60)}`);
    if (polluted) bad.push(`${name}: Object.prototype 오염`);
    if (/NaN|undefined|Infinity|\[object/.test(text)) bad.push(`${name}: 화면에 NaN/undefined/Infinity`);
    if (overflow > 0) bad.push(`${name}: 가로 넘침 ${overflow}px`);
    if (want === 'invalid' && saved) {
      // 새 게임으로 시작하면 저장이 새 게임(첫 화면 단계)으로 바뀌어야 하고 변조 값이 남으면 안 된다
      try {
        const d = JSON.parse(saved).data;
        if (d.phase !== 'title' || d.assets !== null) bad.push(`${name}: 새 게임 저장이 아님 (phase ${d.phase})`);
      } catch {
        bad.push(`${name}: 저장이 JSON이 아님`);
      }
    }
    let note = outcome;
    if (want === 'valid') {
      const a = await page.evaluate(() => {
        const g = (id) => document.querySelector(`[data-testid="${id}"]`)?.textContent.trim() ?? null;
        return { net: g('assets-net'), income: g('assets-income'), debt: g('assets-debt') };
      });
      note = `${outcome} ${a.net ? `순자산 ${a.net}/소득 ${a.income}/부채 ${a.debt}` : ''}`;
      if (name.includes('경계')) shots.push(await shot(page, 'A05', name.replace(/[^\w가-힣]+/g, '-').slice(0, 30)));
    }
    rows.push(`${name} → ${note}`);
    await ctx.close();
  }
  return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.slice(0, 8).join(' / ') + ` (실패 ${bad.length}건)` : `${V.length}종 모두 기대대로: 규칙 위반 ${V.filter((v) => v[3] === 'invalid').length}종 → 새 게임, 경계·확장 ${V.filter((v) => v[3] === 'valid').length}종 → 그대로 열림. ${rows.filter((r) => r.includes('경계')).join(' | ')}`, shots };
});

// ---- A06: 옛 저장 v7·v6·v5·이상한 버전 ----
await run({ id: 'M5-A06', cat: '공격', title: '옛 저장(v7·v6·v5)을 넣으면 새 게임으로 시작하고 첫 화면에 안내 한 줄, 새로고침하면 안내가 사라짐. 버전 문자열·미래 버전·버전 없음은 안내 없이 새 게임', steps: '현재 저장 모양에서 옛 버전 모양(assets·familyFund 없음, stats.wealth 있음)과 버전 번호만 바꾼 저장을 심고 연다', expected: 'v7·v6·v5: 첫 화면 + 「이전 버전에서 저장된 판은 이어서 할 수 없어 새 게임으로 시작합니다.」 한 번, 새로고침 뒤 사라짐. 그 밖: 첫 화면, 크래시 0' }, async () => {
  const bad = [];
  const rows = [];
  const shots = [];
  const old = (ver) =>
    editSave(ADULT, (d, env) => {
      env.version = ver;
      delete d.assets;
      delete d.familyFund;
      d.stats.wealth = 60;
      if (d.birthStats) d.birthStats.wealth = 40;
      if (ver <= 6) delete d.paused;
    });
  const cases = [
    ['v7', old(7), true],
    ['v6', old(6), true],
    ['v5', old(5), true],
    ['v7 형태인데 현재 모양(assets 있음)', editSave(ADULT, (d, env) => (env.version = 7)), true],
    ['version "8"(문자열)', editSave(ADULT, (d, env) => (env.version = '8')), false],
    ['version 9(미래)', editSave(ADULT, (d, env) => (env.version = 9)), false],
    ['version 없음', JSON.stringify({ data: JSON.parse(ADULT).data }), false],
    ['JSON 아님', '{"version":8,"data":', false],
    ['빈 객체', '{}', false],
    ['배열', '[]', false],
  ];
  for (const [name, raw, wantNotice] of cases) {
    con.take();
    const { ctx, page } = await openWith(raw);
    const screen = await screenOf(page);
    const notice = await page.locator('[data-testid="old-save-notice"]').count();
    const errs = con.take().filter((x) => x.type === 'pageerror' || x.type === 'error');
    if (screen !== 'title-screen') bad.push(`${name}: ${screen}`);
    if (wantNotice && notice !== 1) bad.push(`${name}: 안내 ${notice}개(기대 1)`);
    if (!wantNotice && notice !== 0) rows.push(`${name}: 안내 ${notice}개(기대 0 — 분류에 따라 다를 수 있어 기록)`);
    if (errs.length) bad.push(`${name}: 콘솔 오류 ${errs.length}`);
    if (name === 'v7') shots.push(await shot(page, 'A06', 'v7-notice'));
    if (wantNotice) {
      await page.reload({ waitUntil: 'load' });
      await sleep(300);
      const again = await page.locator('[data-testid="old-save-notice"]').count();
      if (again !== 0) bad.push(`${name}: 새로고침 뒤에도 안내가 남음`);
    }
    rows.push(`${name}: ${screen} 안내 ${notice}`);
    await ctx.close();
  }
  return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.join(' / ') : rows.join(' | '), shots };
});

// ---- A07: 이름 변조 ----
const NAMES = [
  ['한글 20자', '가나다라마바사아자차카타파하가나다라마바'],
  ['W 20자(공백 없음)', 'WWWWWWWWWWWWWWWWWWWW'],
  ['태그 <b onclick>', '<b onclick=1>x</b>'],
  ['스크립트 태그', '<script>1</script>'],
  ['따옴표·세미콜론', `'"; DROP TABLE --`],
  ['이모지 10개', '😀😀😀😀😀😀😀😀😀😀'],
  ['ZWJ 가족 이모지', '👨‍👩‍👧‍👦👨‍👩‍👧‍👦'],
  ['한글 자모 분리', 'ㅎㅏㄴㄱㅡㄹㅈㅏㅁㅗ'],
  ['RTL(아랍어)', 'مرحبا بالعالم'],
  ['공백·줄바꿈', '이  름\n둘째줄'],
  ['한 글자', '김'],
];
await run({ id: 'M5-A08', cat: '공격', title: '이름 변조(특수문자·이모지·초장문·태그·RTL·자모 분리)가 영향 줄 안내 한 줄·선택지 카드·엔딩 줄과 겹칠 때', steps: '이름을 바꾼 성인 선택지 저장(360×740·320×568 × 글자 100·200%)과 엔딩 저장을 열어 안내 한 줄(「지금 {이름}에게 …」)·선택지 영향 줄·번호 원의 가로 넘침과 스크립트 실행·태그 해석을 본다', expected: '가로 넘침 0(큰 글자 200%·320폭 포함, 짧은 이름은 반드시), 태그는 글자로만 보이고 스크립트가 안 돈다, 선택지 영향 줄은 이름과 무관' }, async () => {
  const bad = [];
  const rec = [];
  const shots = [];
  for (const [label, name] of NAMES) {
    for (const [vpn, vp, font] of [['360x740', { width: 360, height: 740 }, 100], ['320x568', { width: 320, height: 568 }, 200]]) {
      const raw = editSave(CHOICE, (d) => (d.character.name = name));
      con.take();
      const { ctx, page } = await openWith(raw, { vp });
      await page.evaluate(() => {
        window.__pwned = 0;
      });
      if (font !== 100) await setRootFont(page, font);
      const hasPanel = await page.waitForSelector('[data-testid="choice-panel"]', { timeout: 4000 }).then(() => true).catch(() => false);
      if (!hasPanel) {
        const scr = await screenOf(page);
        // 저장 검증은 이름 길이를 1~20으로 본다(UTF-16 길이). 그 밖이면 거부(새 게임)가 맞다
        if (name.length > 20 || name.length === 0) rec.push(`(기록) ${label}: 이름 길이 ${name.length} > 20이라 저장 검증이 거부 → ${scr}`);
        else bad.push(`${label} ${vpn}/${font}%: 길이 ${name.length}인데 선택지 카드가 안 뜸(${scr})`);
        await ctx.close();
        continue;
      }
      await sleep(500);
      const m = await page.evaluate(() => {
        const root = document.documentElement;
        const hint = document.querySelector('[data-testid="choice-hint"]');
        const hr = hint ? hint.getBoundingClientRect() : null;
        const items = [...document.querySelectorAll('.impact__item')].length;
        const nameEl = document.querySelector('[data-testid="life-name"]');
        const inj = document.querySelectorAll('.dash-page script, .dash-page [onclick], .dash-page img[src="x"]').length;
        const vw = root.clientWidth;
        const overEls = [];
        for (const e of document.body.querySelectorAll('*')) {
          const r = e.getBoundingClientRect();
          if (r.width > 0 && r.right > vw + 0.5) overEls.push(e.getAttribute('data-testid') || (typeof e.className === 'string' ? e.className.split(' ')[0] : e.tagName));
        }
        return {
          overEls,
          overflow: root.scrollWidth - root.clientWidth,
          hintRight: hr ? Math.round(hr.right) : null,
          vw: root.clientWidth,
          hintText: hint ? hint.innerText.replace(/\s+/g, ' ').slice(0, 60) : null,
          items,
          nameText: nameEl ? nameEl.textContent : null,
          inj,
          pwned: window.__pwned,
        };
      });
      const errs = con.take().filter((x) => x.type === 'pageerror');
      // 넘침의 원인이 헤더의 이름(h1) 하나뿐이면 M4-A10에서 이미 기록된 현상(M5가 더한 요소가 아님)이라 기록으로 돌린다
      const mine = m.overEls.filter((e) => e !== 'life-name' && e !== 'fit-pair__probe');
      if (m.overflow > 0 && mine.length) bad.push(`${label} ${vpn}/${font}%: M5 요소가 넘침 ${m.overflow}px [${mine.join(',')}]`);
      else if (m.overflow > 0) rec.push(`(기록: M4-A10와 같은 헤더 이름 넘침) ${label} ${vpn}/${font}% ${m.overflow}px, 안내 한 줄·영향 줄·선택지는 안 넘침`);
      if (m.inj) bad.push(`${label}: 태그가 요소로 해석됨 ${m.inj}`);
      if (m.pwned) bad.push(`${label}: 스크립트 실행됨`);
      if (m.nameText !== null && m.nameText !== name) bad.push(`${label}: 이름 글자가 달라짐 「${m.nameText}」`);
      if (!m.items) bad.push(`${label}: 영향 줄이 사라짐`);
      if (errs.length) bad.push(`${label}: pageerror ${errs[0].text.slice(0, 50)}`);
      rec.push(`${label} ${vpn}/${font}% 넘침 ${m.overflow}`);
      if (label === '한글 20자' || label === 'W 20자(공백 없음)') shots.push(await shot(page, 'A08', `${label.replace(/[^\w가-힣]/g, '')}-${vpn}-${font}`));
      await ctx.close();
    }
  }
  // 엔딩의 이름(제목)
  for (const [label, name] of NAMES.slice(0, 4)) {
    const raw = editSave(ENDING, (d) => (d.character.name = name));
    const { ctx, page } = await openWith(raw, { vp: { width: 320, height: 568 } });
    await setRootFont(page, 200);
    await sleep(300);
    const m = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, inj: document.querySelectorAll('.ending-page script, .ending-page b').length }));
    if (m.overflow > 0) rec.push(`(기록) 엔딩 ${label} 320×568/200% 넘침 ${m.overflow}px`);
    if (m.inj) bad.push(`엔딩 ${label}: 태그 해석`);
    await ctx.close();
  }
  return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.slice(0, 8).join(' / ') : `${NAMES.length}종 × 2조건 가로 넘침 0·태그 해석 0·스크립트 0 (${rec.filter((r) => r.includes('기록')).join(' ') || '엔딩 4종도 넘침 0'})`, shots };
});

// ---- A09: 오프라인 ----
await run({ id: 'M5-A09', cat: '공격', title: '오프라인: 열린 뒤 네트워크를 끊어도 선택·진행이 되고, 끊긴 채 새로고침은 (CM3상) 결함으로 보지 않고 기록', steps: 'prod에서 성인 선택지 카드를 열고 오프라인으로 전환 → 선택 클릭 → 새로고침', expected: '오프라인에서 선택·진행·저장 정상(외부 요청 0). 새로고침 실패는 기록만' }, async () => {
  const bad = [];
  const { ctx, page } = await openWith(CHOICE);
  await page.waitForSelector('[data-testid="choice-panel"]');
  await page.waitForFunction(() => [...document.querySelectorAll('[data-testid="choice-panel"] .choice')].every((b) => b.getAttribute('aria-disabled') !== 'true'));
  await ctx.setOffline(true);
  const pre = JSON.parse(await page.evaluate((k) => localStorage.getItem(k), GAME_KEY)).data;
  await page.locator('[data-testid="choice-panel"] .choice').first().click();
  await sleep(500);
  const post = JSON.parse(await page.evaluate((k) => localStorage.getItem(k), GAME_KEY)).data;
  if (!(post.age === pre.age + 1 || post.phase === 'ending')) bad.push('오프라인에서 선택이 적용되지 않음');
  let reload = '새로고침 성공';
  try {
    await page.reload({ waitUntil: 'load', timeout: 8000 });
    await sleep(300);
    const s = await screenOf(page).catch(() => 'unknown');
    reload = `새로고침 후 ${s}`;
  } catch (e) {
    reload = '새로고침 실패(예상된 기록: ' + String(e.message).slice(0, 40) + ')';
  }
  await ctx.close();
  return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.join(' / ') : `오프라인 선택 적용(나이 ${pre.age}→${post.age}), ${reload}`, shots: [] };
});

// ---- A10: 화면 회전·폭 변경 ----
await run({ id: 'M5-A10', cat: '공격', title: '결정을 기다리는 중 화면 회전·폭 변경(360×740 ↔ 740×360 ↔ 320×568 ↔ 1280×800 ↔ 320×256): 같은 카드·영향 줄, 넘침 0, 선택지가 눌림', steps: '성인 선택지 카드를 연 채 뷰포트를 여러 번 바꾸며 카드 키·영향 줄·넘침·선택지 버튼 중심점의 적중을 본다', expected: '카드·영향 줄 불변, 가로 넘침 0, 선택지 버튼 중심이 가려지지 않음(고정 요소 해제 규칙), 저장 불변' }, async () => {
  const bad = [];
  const { ctx, page } = await openWith(CHOICE, { vp: { width: 360, height: 740 } });
  await page.waitForSelector('[data-testid="choice-panel"]');
  await page.waitForFunction(() => [...document.querySelectorAll('[data-testid="choice-panel"] .choice')].every((b) => b.getAttribute('aria-disabled') !== 'true'));
  const ref = await page.evaluate(() => window.__readDash());
  const refLines = JSON.stringify(ref.choices.map((c) => [c.id, c.impact.map((i) => i.shown)]));
  const raw0 = await page.evaluate((k) => localStorage.getItem(k), GAME_KEY);
  const seq = [[740, 360], [320, 568], [1280, 800], [360, 740], [320, 256], [667, 375], [768, 1024], [360, 740]];
  const rows = [];
  for (const [w, h] of seq) {
    await page.setViewportSize({ width: w, height: h });
    await sleep(350);
    const m = await page.evaluate(() => {
      const d = window.__readDash();
      const root = document.documentElement;
      const hits = [...document.querySelectorAll('[data-testid="choice-panel"] .choice')].map((b) => {
        b.scrollIntoView({ block: 'center' });
        const r = b.getBoundingClientRect();
        const cx = Math.min(Math.max(r.left + r.width / 2, 0), root.clientWidth - 1);
        const cy = Math.min(Math.max(r.top + Math.min(r.height / 2, 20), 0), window.innerHeight - 1);
        const el = document.elementFromPoint(cx, cy);
        return el !== null && (b === el || b.contains(el));
      });
      return { key: d.choiceKey, lines: JSON.stringify(d.choices.map((c) => [c.id, c.impact.map((i) => i.shown)])), overflow: root.scrollWidth - root.clientWidth, hits };
    });
    if (m.key !== ref.choiceKey) bad.push(`${w}×${h}: 카드 키 변함`);
    if (m.lines !== refLines) bad.push(`${w}×${h}: 영향 줄 변함`);
    if (m.overflow > 0) bad.push(`${w}×${h}: 넘침 ${m.overflow}px`);
    if (m.hits.some((x) => !x)) bad.push(`${w}×${h}: 선택지 버튼이 가려짐 ${m.hits.map((x) => (x ? 'O' : 'X')).join('')}`);
    rows.push(`${w}×${h} 넘침 ${m.overflow}`);
  }
  const raw1 = await page.evaluate((k) => localStorage.getItem(k), GAME_KEY);
  if (raw1 !== raw0) bad.push('저장이 변함');
  const s = await shot(page, 'A10', 'after-rotations-360x740');
  await ctx.close();
  return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.slice(0, 6).join(' / ') : `${seq.length}단계 모두 같은 카드·영향 줄·넘침 0·선택지 적중, 저장 불변`, shots: [s] };
});

await browser.close();
