// 엔딩 문장·방향·20세 전 사망·긴 연표·다시 태어나기: 실제 한 판의 엔딩 저장을 바탕으로 저장 주입으로 만든 상태를 화면에서 확인한다.
import fs from 'node:fs';
import path from 'node:path';
import { DEV, PROD, FAST, FIN, launch, mkctx, MOBILE, DESKTOP, shot, snap, waitScreen, con, sleep, readSave, readRaw, toLife, drive, runCase, GAME_KEY, SETTINGS_KEY, envelope } from './f-lib.mjs';

const WEIGHTS = { past: [40, 32, 20, 7, 1], present: [25, 30, 28, 14, 3], future: [30, 28, 24, 13, 5] };
const ERAS = ['past', 'present', 'future'];

// ---- 독립 기준: 화면 문장에서 숫자만 읽어 방향을 다시 정한다 (구현의 movementOf를 쓰지 않는다) ----
function parseBand(t) {
  let m;
  if ((m = t.match(/^하위 (\d+)% 안쪽$/))) return [0, +m[1]];
  if ((m = t.match(/^상위 (\d+)% 안쪽$/))) return [100 - +m[1], 100];
  if ((m = t.match(/^상위 (\d+)% 밖$/))) return [0, 100 - +m[1]];
  if ((m = t.match(/^하위 (\d+)% 밖$/))) return [+m[1], 100];
  if ((m = t.match(/^하위 (\d+)~(\d+)% 사이$/))) return [+m[1], +m[2]];
  if ((m = t.match(/^상위 (\d+)~(\d+)% 사이$/))) return [100 - +m[2], 100 - +m[1]];
  if ((m = t.match(/^하위 (\d+)%와 상위 (\d+)% 사이$/))) return [+m[1], 100 - +m[2]];
  if ((m = t.match(/^하위 약 (\d+)%$/))) return [+m[1], +m[1]];
  if ((m = t.match(/^상위 약 (\d+)%$/))) return [100 - +m[1], 100 - +m[1]];
  return null;
}
function parseEnd(t) {
  let m;
  if (t === '딱 중간쯤') return 50;
  if ((m = t.match(/^상위 약 (\d+)%$/))) return 100 - +m[1];
  if ((m = t.match(/^하위 약 (\d+)%$/))) return +m[1];
  if ((m = t.match(/^상위 (\d+)% 안쪽$/))) return 100 - +m[1];
  if ((m = t.match(/^하위 (\d+)% 안쪽$/))) return +m[1];
  return null;
}
function oracleMove(band, score) {
  const upG = band[1] + 2 >= 99 ? 0 : 2;
  const dnG = band[0] - 2 <= 1 ? 0 : 2;
  if (score > band[1] + upG) return '앞선 자리';
  if (score < band[0] - dnG) return '뒤쪽';
  return '비슷한 자리';
}
function expectedBand(era, pw) {
  const w = WEIGHTS[era];
  const low = w.slice(0, pw - 1).reduce((a, b) => a + b, 0);
  const high = low + w[pw - 1];
  return [low, high];
}
function moveKind(s) {
  if (s.includes('앞선 자리')) return '앞선 자리';
  if (s.includes('비슷한 자리')) return '비슷한 자리';
  if (s.includes('뒤쪽')) return '뒤쪽';
  return null;
}

/** 실제 한 판을 끝까지 돌려 얻은 엔딩 저장(원문)을 era별로 준비한다 */
async function baseEndings(browser) {
  const out = {};
  for (const era of ERAS) {
    const ctx = await mkctx(browser, MOBILE);
    const page = await ctx.newPage();
    await page.goto(DEV + '/' + FAST);
    await toLife(page, era);
    const r = await drive(page, { seed: 77, strategy: 'first' });
    if (r.done !== 'ending') throw new Error(`base ${era}: ${r.done}`);
    out[era] = (await readSave(page)).data;
    await ctx.close();
  }
  fs.writeFileSync(path.join(FIN, 'base-endings.json'), JSON.stringify(out));
  return out;
}

const mod = (base, o) => {
  const st = JSON.parse(JSON.stringify(base));
  if (o.pw) st.character.parentWealth = o.pw;
  if (o.wealth !== undefined) st.stats.wealth = o.wealth;
  if (o.deathAge !== undefined) {
    st.death = { age: o.deathAge, cause: o.cause || '노환' };
    st.age = o.deathAge;
    st.history = st.history.filter((h) => h.age <= o.deathAge && h.kind !== 'death');
    st.history.push({ age: o.deathAge, kind: 'death', text: `${o.deathAge}세에 세상을 떠났다.` });
    st.seen = Object.fromEntries(Object.entries(st.seen).filter(([, a]) => a <= o.deathAge));
    if (st.lastChoiceAge !== null && st.lastChoiceAge > o.deathAge) st.lastChoiceAge = null;
  }
  if (o.noChoices) st.history = st.history.filter((h) => h.kind !== 'choice');
  return st;
};

async function showEnding(page, st, { settings } = {}) {
  await page.evaluate(
    ([g, v, s, sv]) => {
      localStorage.setItem(g, v);
      if (sv) localStorage.setItem(s, sv);
    },
    [GAME_KEY, envelope(st), SETTINGS_KEY, settings ? JSON.stringify({ version: 1, data: settings }) : null],
  );
  await page.reload();
  await waitScreen(page, 'ending-screen', 8000);
}
const readEndText = (page) =>
  page.evaluate(() => {
    const t = (id) => (document.querySelector(`[data-testid="${id}"]`) ? document.querySelector(`[data-testid="${id}"]`).innerText.replace(/\s+/g, ' ').trim() : null);
    return { journey: t('ending-journey'), movement: t('ending-movement'), death: t('ending-death'), choices: t('ending-choices'), name: t('ending-name'), born: t('ending-born'), note: t('ending-note') };
  });
const journeyShot = async (page, id, suffix) => {
  const f = path.join(path.resolve(import.meta.dirname, '..', '..', 'qa', 'screenshots', '001'), `${id}-${suffix}.png`);
  const head = await page.locator('.ending-head').boundingBox();
  const sec = await page.locator('[data-testid="ending-journey-section"]').boundingBox();
  await page.screenshot({ path: f, clip: { x: 0, y: Math.max(0, head.y), width: page.viewportSize().width, height: sec.y + sec.height - head.y + 16 } });
  return `qa/screenshots/001/${id}-${suffix}.png`;
};

const only = process.argv[2] || 'all';
const run = (n) => only === 'all' || only === n;
const browser = await launch();
const base = fs.existsSync(path.join(FIN, 'base-endings.json')) && only !== 'rebase' ? JSON.parse(fs.readFileSync(path.join(FIN, 'base-endings.json'), 'utf8')) : await baseEndings(browser);
const table = JSON.parse(fs.readFileSync(path.join(FIN, 'end-table.json'), 'utf8'));
const wFor = (era, pw, label) => table.find((r) => r.era === era && r.pw === pw && r.end === label)?.wealth;

// =============== F-E: 문장 샘플 (스크린샷) ===============
const ctx = await mkctx(browser, MOBILE);
const page = await ctx.newPage();
await page.goto(DEV + '/');
const samples = [
  ['F-E01', 'present', 4, '상위 약 2%', '지금 세상 4단계 출생 → 상위 약 2% 도착 (R-095 앞선 자리)'],
  ['F-E02', 'present', 4, '상위 약 1%', '지금 세상 4단계 출생 → 상위 약 1% 도착 (R-095 앞선 자리)'],
  ['F-E03', 'present', 4, '상위 1% 안쪽', '지금 세상 4단계 출생 → 상위 1% 안쪽 도착 (R-095 앞선 자리)'],
  ['F-E04', 'present', 4, '상위 약 17%', '지금 세상 4단계 출생 → 구간 끝 근처(상위 약 17%) 비슷한 자리'],
  ['F-E05', 'present', 1, '하위 약 40%', '지금 세상 1단계(맨 아래) 출생 → 구간 밖 위쪽 도착 앞선 자리 (구간 「하위 25% 안쪽」)'],
  ['F-E06', 'present', 1, '하위 약 3%', '지금 세상 1단계 출생 → 하위 약 3% 도착: 맨 아래 단계엔 「뒤쪽」이 없다'],
  ['F-E07', 'present', 2, '하위 약 3%', '지금 세상 2단계(가운데 걸침, 「하위 25%와 상위 45% 사이」) → 뒤쪽'],
  ['F-E08', 'present', 2, '딱 중간쯤', '지금 세상 2단계 → 딱 중간쯤 → 비슷한 자리'],
  ['F-E09', 'present', 3, '상위 약 10%', '지금 세상 3단계(「상위 17~45% 사이」) → 상위 약 10% 앞선 자리'],
  ['F-E10', 'present', 3, '하위 약 10%', '지금 세상 3단계 → 하위 약 10% 뒤쪽'],
  ['F-E11', 'present', 5, '상위 약 3%', '지금 세상 5단계(「상위 3% 안쪽」) → 상위 약 3% 비슷한 자리'],
  ['F-E12', 'present', 5, '하위 약 20%', '지금 세상 5단계 → 하위 약 20% 뒤쪽'],
  ['F-E13', 'past', 1, '딱 중간쯤', '지난 세상 1단계 → 딱 중간쯤 앞선 자리'],
  ['F-E14', 'past', 5, '하위 약 20%', '지난 세상 5단계 → 하위 약 20% 뒤쪽'],
  ['F-E15', 'future', 3, '상위 약 10%', '다가올 세상 3단계 → 상위 약 10% 앞선 자리'],
  ['F-E16', 'future', 2, '하위 약 10%', '다가올 세상 2단계 → 하위 약 10% 뒤쪽'],
];
for (const [id, era, pw, label, title] of (run('samples') ? samples : [])) {
  await runCase({ id, cat: 'E 엔딩 문장', title, steps: `${era} 실제 엔딩 저장에서 재력 ${pw}단계·최종 재산을 바꿔 주입 → 엔딩 화면`, expected: '문장이 담담, 방향 문장이 화면 숫자와 맞음' }, async () => {
    let w = wFor(era, pw, label);
    if (w === undefined) {
      // 가까운 라벨로 대체
      const cands = table.filter((r) => r.era === era && r.pw === pw && r.end.startsWith(label.slice(0, 5)));
      w = cands.length ? cands[Math.floor(cands.length / 2)].wealth : 50;
    }
    await showEnding(page, mod(base[era], { pw, wealth: w }));
    const t = await readEndText(page);
    const m = t.journey.match(/^(.*?)의 집에서 태어나, (.*?)의 형편으로 생을 마쳤다\.$/);
    const band = m ? parseBand(m[1]) : null;
    const score = m ? parseEnd(m[2]) : null;
    const want = band && score !== null ? oracleMove(band, score) : null;
    const got = moveKind(t.movement || '');
    const exp = expectedBand(era, pw);
    const bandOk = band && (band[0] === exp[0] || (exp[0] === 0 && band[0] === 0)) && (band[1] === exp[1] || (exp[1] === 0 && band[1] === 1));
    const ok = band && score !== null && want === got && bandOk;
    const s1 = await journeyShot(page, id, 'journey');
    return { verdict: ok ? 'PASS' : 'FAIL', actual: `${t.journey} / ${t.movement} (독립 기준 ${want}, 기대 구간 ${exp}, 읽은 구간 ${band}, 읽은 도착 ${score}) 재산 ${w}`, shots: [s1], text: t };
  });
}

// =============== F-E20: 전수 스윕 (시대 × 재력 단계 × 재산 0~100) ===============
if (run('sweep')) await runCase({ id: 'F-E20', cat: 'E 엔딩 문장', title: '방향 문장 전수: 3시대 × 5단계 × 최종 재산 0~100 (1515판 엔딩을 화면에서 읽어 독립 기준과 대조)', steps: '각 칸마다 실제 엔딩 저장을 바꿔 주입하고 새로고침해 화면 문장의 구간·도착 숫자로 방향을 다시 계산', expected: '화면 방향 문장이 화면 숫자와 항상 맞고, 구간은 가중치표와 같고, 50을 넘는 숫자·약 0%·약 100%가 없고, 맨 아래 단계 「뒤쪽」·맨 위 단계 「앞선」이 구조상 없고, 재산이 늘면 도착 점수가 줄지 않는다' }, async () => {
  const bad = [];
  const counts = {};
  const byEra = await Promise.all(
    ERAS.map(async (era) => {
      const c2 = await mkctx(browser, MOBILE);
      const p = await c2.newPage();
      await p.goto(PROD + '/');
      const local = { n: 0, bad: [], mv: {} };
      for (let pw = 1; pw <= 5; pw++) {
        let prevScore = -1;
        for (let w = 0; w <= 100; w++) {
          await showEnding(p, mod(base[era], { pw, wealth: w }));
          const t = await readEndText(p);
          local.n++;
          const m = (t.journey || '').match(/^(.*?)의 집에서 태어나, (.*?)의 형편으로 생을 마쳤다\.$/);
          const band = m ? parseBand(m[1]) : null;
          const score = m ? parseEnd(m[2]) : null;
          const probs = [];
          if (!band || score === null) probs.push(`문장 읽기 실패: ${t.journey}`);
          else {
            const want = oracleMove(band, score);
            const got = moveKind(t.movement || '');
            if (want !== got) probs.push(`방향 불일치: 기대 ${want} / 화면 ${got}`);
            const exp = expectedBand(era, pw);
            if (!(band[0] === exp[0] || (exp[0] === 0 && band[0] === 0)) || !(band[1] === exp[1] || (exp[1] === 0 && band[1] === 1))) probs.push(`구간 불일치: ${band} vs ${exp}`);
            if (score < prevScore) probs.push(`재산이 늘었는데 도착 점수가 줆: ${prevScore} → ${score}`);
            prevScore = score;
            if (pw === 1 && got === '뒤쪽') probs.push('맨 아래 단계에 뒤쪽');
            if (pw === 5 && got === '앞선 자리') probs.push('맨 위 단계에 앞선 자리');
            local.mv[`${pw}:${got}`] = (local.mv[`${pw}:${got}`] || 0) + 1;
          }
          const nums = (t.journey || '').match(/\d+/g) || [];
          if (nums.some((x) => +x > 50 || +x === 0)) probs.push(`50 초과/0 숫자: ${t.journey}`);
          if (/약 0%|약 100%|100%|[^\d]0%/.test(t.journey || '')) probs.push(`0%/100% 표현: ${t.journey}`);
          if (/[!！]|\p{Extended_Pictographic}|(흙|동|은|금|다이아)\s*수저/u.test((t.journey || '') + (t.movement || ''))) probs.push('금지 표현');
          if (probs.length && local.bad.length < 12) local.bad.push({ era, pw, w, probs, journey: t.journey, movement: t.movement });
          else if (probs.length) local.bad.push({ era, pw, w, probs: probs.slice(0, 1) });
        }
      }
      await c2.close();
      return local;
    }),
  );
  let total = 0;
  for (const r of byEra) {
    total += r.n;
    bad.push(...r.bad);
    for (const [k, v] of Object.entries(r.mv)) counts[k] = (counts[k] || 0) + v;
  }
  fs.writeFileSync(path.join(FIN, 'F-E20-sweep.json'), JSON.stringify({ total, bad: bad.slice(0, 60), counts }, null, 1));
  return { verdict: bad.length === 0 && total === 1515 ? 'PASS' : 'FAIL', actual: `${total}칸 읽음, 불일치 ${bad.length}건${bad.length ? ' 예: ' + JSON.stringify(bad[0]).slice(0, 300) : ''}; 단계:방향 합계 ${JSON.stringify(counts)}`, shots: [] };
});

// =============== F-E30~: 20세 전 사망·0선택 사망 ===============
for (const [id, deathAge, era, extra] of [
  ['F-E30', 3, 'present', {}],
  ['F-E31', 12, 'past', {}],
  ['F-E32', 19, 'present', {}],
  ['F-E33', 20, 'present', {}],
].filter(() => run('early'))) {
  await runCase({ id, cat: 'E 엔딩 문장', title: `${deathAge}세 사망 (${era}) — 20세 전이면 「…의 집에서 태어났다.」만 (R-083)`, steps: '엔딩 저장의 사망 나이를 바꿔 주입', expected: deathAge < 20 ? '도착 자리·방향 문장 없음, 집안 형편 표시' : '20세는 비교 문장 있음' }, async () => {
    await showEnding(page, mod(base[era], { pw: 2, wealth: 40, deathAge, ...extra }));
    const t = await readEndText(page);
    const early = deathAge < 20;
    const hasMove = !!t.movement;
    const endsOk = early ? /의 집에서 태어났다\.$/.test(t.journey) && !hasMove && !/형편으로 생을 마쳤다/.test(t.journey) : /형편으로 생을 마쳤다\.$/.test(t.journey) && hasMove;
    const label = await page.locator('[data-stat="wealth"] .stat-line span').first().innerText();
    const labelOk = early ? label.includes('집안 형편') : !label.includes('집안 형편');
    const s1 = await shot(page, id, 'ending', { full: false });
    return { verdict: endsOk && labelOk ? 'PASS' : 'FAIL', actual: `${t.death} | ${t.journey} | movement=${t.movement} | 재산 라벨 ${label}`, shots: [s1] };
  });
}
if (run('early')) await runCase({ id: 'F-E34', cat: 'E 엔딩 문장', title: '선택 0번으로 끝난 인생 문구 + 어린 사망', steps: '사망 나이 4, 선택 기록 없음 주입', expected: '「선택을 내려야 하는 순간이 오기 전에 생이 끝났다.」, 담담' }, async () => {
  await showEnding(page, mod(base.present, { pw: 1, wealth: 30, deathAge: 4, cause: '질병', noChoices: true }));
  const t = await readEndText(page);
  const s1 = await shot(page, 'F-E34', 'ending', { full: true });
  return { verdict: /선택을 내려야 하는 순간이 오기 전에 생이 끝났다\./.test(t.choices) && /의 집에서 태어났다\.$/.test(t.journey) ? 'PASS' : 'FAIL', actual: `${t.death} | ${t.choices} | ${t.journey}`, shots: [s1] };
});

// =============== F-E40: 긴 연표 + 터치 스크롤 + 다시 태어나기 ===============
const ev = JSON.parse(fs.readFileSync(path.join(FIN, 'events-all.json'), 'utf8'));
function longHistory(era) {
  const h = [{ age: 0, kind: 'stage', text: '2015년, 남자아이로 태어났다.' }];
  const ents = [];
  for (const e of ev) {
    if (e.eras && !e.eras.includes(era)) continue;
    const age = e.ageRange ? Math.round((e.ageRange.min + e.ageRange.max) / 2) : 5;
    if (e.choices) ents.push({ age, kind: 'choice', title: e.title, choice: e.choices[0].label, text: e.choices[0].result, eventId: e.id });
    else ents.push({ age, kind: 'event', title: e.title, text: e.text, eventId: e.id });
  }
  for (const a of [7, 20, 40, 65]) ents.push({ age: a, kind: 'stage', text: '새로운 시기가 시작되었다.' });
  ents.sort((a, b) => a.age - b.age);
  return [...h, ...ents].slice(0, 150).concat([{ age: 99, kind: 'death', text: '99세에 세상을 떠났다.' }]);
}
async function touchScrollCase(id, title, st, note) {
  return runCase({ id, cat: 'E 엔딩', title, steps: 'history 주입 → 모바일 터치 스와이프(CDP 터치 이벤트)로 스크롤 → 「다시 태어나기」 탭', expected: '스와이프로 버튼에 닿음, 탭 1회로 시대 선택 화면, 새 판 하나', ts: false }, async () => {
    await showEnding(page, st);
    await sleep(600);
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    const s0 = await shot(page, id, 'top');
    const cdp = await ctx.newCDPSession(page);
    const swipe = async (dy) => {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 180, y: 600 }] });
      for (let i = 1; i <= 10; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 180, y: 600 + (dy * i) / 10 }] }); await sleep(16); }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    };
    let swipes = 0;
    const vis = () => page.evaluate(() => { const b = document.querySelector('[data-testid="rebirth"]').getBoundingClientRect(); return b.top >= 0 && b.bottom <= window.innerHeight; });
    const settle = async () => { let prev = -1; for (let i = 0; i < 40; i++) { const y = await page.evaluate(() => window.scrollY); if (y === prev) return; prev = y; await sleep(250); } };
    for (; swipes < 80; swipes++) { await settle(); if (await vis()) break; await swipe(-450); await sleep(200); }
    await settle();
    const s1 = await shot(page, id, 'bottom-btn');
    const reached = await vis();
    const seed0 = (await readSave(page)).data.seed;
    await sleep(1800); // 관성 스크롤(fling)이 끝날 시간
    let taps = 0;
    for (; taps < 3; taps++) {
      const box = await page.getByTestId('rebirth').boundingBox();
      await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
      if (await page.waitForSelector('main[data-testid="era-screen"]', { timeout: 1500 }).then(() => true, () => false)) { taps++; break; }
    }
    await waitScreen(page, 'era-screen', 3000);
    const s2 = await shot(page, id, 'after-rebirth');
    const sv = (await readSave(page)).data;
    return { verdict: reached && sv.phase === 'eraSelect' && sv.seed !== seed0 ? 'PASS' : 'FAIL', actual: `문서 높이 ${height}px, 스와이프 ${swipes}회로 버튼 도달=${reached}, 탭 후 phase=${sv.phase}, 시드 바뀜=${sv.seed !== seed0}, 탭 ${taps}번, 연표 ${st.history.length}줄 ${note}`, shots: [s0, s1, s2] };
  });
}
if (run('long')) {
  await touchScrollCase('F-E40', '실제 한 판의 엔딩(연표 약 5600px)에서 터치 스와이프로 「다시 태어나기」에 닿고 한 번 탭 → 시대 선택 (R-088)', mod(base.present, { pw: 3, wealth: 55 }), '(실제 판)');
  const st = mod(base.present, { pw: 3, wealth: 55 });
  st.history = longHistory('present');
  st.age = 99;
  st.death = { age: 99, cause: '노환' };
  st.seen = {};
  await touchScrollCase('F-E42', '스트레스: 모든 이벤트가 나온 가상의 인생(연표 150줄, 약 12000px)에서 터치 스와이프 → 「다시 태어나기」 탭', st, '(가상 스트레스)');
}
if (run('long')) await runCase({ id: 'F-E41', cat: 'E 엔딩', title: '「처음 N」 표기(R-089) — 학력·행복·관계 옆에만 붙고 재산·건강·외모에는 없다', steps: '엔딩 화면 최종 스탯 영역 요소 스크린샷', expected: '처음 값은 학력·행복·관계에만, 읽는 사람이 오해하지 않게 보임(판단)' }, async () => {
  await showEnding(page, mod(base.present, { pw: 3, wealth: 60 }));
  const rows = await page.evaluate(() => [...document.querySelectorAll('[data-testid="ending-stats"] .stat')].map((r) => ({ stat: r.dataset.stat, text: r.innerText.replace(/\s+/g, ' ').trim() })));
  const f = path.join(path.resolve(import.meta.dirname, '..', '..', 'qa', 'screenshots', '001'), 'F-E41-stats.png');
  await page.locator('[data-testid="ending-stats"]').screenshot({ path: f });
  const withStart = rows.filter((r) => /처음/.test(r.text)).map((r) => r.stat);
  const ok = JSON.stringify(withStart.sort()) === JSON.stringify(['education', 'happiness', 'relationships']);
  return { verdict: ok ? 'PASS' : 'FAIL', actual: `처음 표기 칸: ${withStart.join(',')} / ${rows.map((r) => r.text).join(' | ')}`, shots: ['qa/screenshots/001/F-E41-stats.png'] };
});

await ctx.close();
await browser.close();
console.log('done');
