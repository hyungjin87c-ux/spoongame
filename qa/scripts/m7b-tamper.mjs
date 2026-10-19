// QA-003 M7b 저장 변조: 카드가 대기 중인 저장을 여러 방식으로 고쳐 prod에서 연다. 기대: 빈 화면·잡히지 않은 오류·스크립트 실행 0, 무엇이든 정상 화면(생애·첫 화면·오류 안내) 중 하나.
// 사용: node qa/scripts/m7b-tamper.mjs   결과: qa/results/m7b/tamper.jsonl + 케이스 A12
import fs from 'node:fs';
import path from 'node:path';
import { launch, sleep, OUT, mkctx, PROD, GAME_KEY, SETTINGS_KEY, shot, runCase, readCard, settingsEnvelope, SET_MANUAL, SET_AUTO, TOUCH } from './m7b-lib.mjs';

const STATES = path.join(OUT, 'states');
const load = (n) => JSON.parse(fs.readFileSync(path.join(STATES, `${n}.json`), 'utf8'));
const browser = await launch();
const outFile = path.join(OUT, 'tamper.jsonl');
fs.writeFileSync(outFile, '');
const XSS = '<script>window.__xss=1</script><img src=x onerror="window.__xss=2"><svg onload="window.__xss=3">';

const clone = (o) => JSON.parse(JSON.stringify(o));
const T = [];
const add = (id, label, mut, base = 'tutoring-present', settings = SET_MANUAL) => T.push({ id, label, mut, base, settings });
add('T01', 'pending.eventId = 존재하지 않는 카드', (d) => { d.pending.eventId = 'no-such-card'; });
add('T02', 'pending.choiceIds = []', (d) => { d.pending.choiceIds = []; });
add('T03', 'pending.choiceIds = 모르는 선택지 id', (d) => { d.pending.choiceIds = ['zzz', 'yyy']; });
add('T04', 'pending.choiceIds = 같은 id 3번', (d) => { d.pending.choiceIds = [d.pending.choiceIds[0], d.pending.choiceIds[0], d.pending.choiceIds[0]]; });
add('T05', 'pending = {} (필드 없음)', (d) => { d.pending = {}; });
add('T06', 'pending.eventId에 HTML', (d) => { d.pending.eventId = XSS; });
add('T07', 'pending.key 초장문(20000자)', (d) => { d.pending.key = 'k'.repeat(20000); });
add('T08', 'age = -3', (d) => { d.age = -3; });
add('T09', 'age = 1e9', (d) => { d.age = 1e9; });
add('T10', 'age = 3.5', (d) => { d.age = 3.5; });
add('T11', 'age = "10"(문자열)', (d) => { d.age = '10'; });
add('T12', 'birthYear = 1700 (지금 세상)', (d) => { d.character.birthYear = 1700; });
add('T13', 'birthYear = 99999', (d) => { d.character.birthYear = 99999; });
add('T14', 'birthYear = "x"', (d) => { d.character.birthYear = 'x'; });
add('T15', '과거 세상 birthYear = 1949(범위 밖)', (d) => { d.character.birthYear = 1949; }, 'earlywork-past');
add('T16', '과거 세상 birthYear = 1990(범위 밖)', (d) => { d.character.birthYear = 1990; }, 'earlywork-past');
add('T17', '과거 세상 birthYear = 1989 + 나이 = 14 (범위 안)', (d) => { d.character.birthYear = 1989; }, 'earlywork-past');
add('T18', 'era = "bogus"', (d) => { d.era = 'bogus'; });
add('T19', '지금 세상 카드의 era를 past로(시대 바꿔치기)', (d) => { d.era = 'past'; });
add('T20', '이름에 스크립트·이미지 태그', (d) => { d.character.name = XSS; });
add('T21', '이름 5000자', (d) => { d.character.name = '가'.repeat(5000); });
add('T22', '이름 이모지 40개', (d) => { d.character.name = '😀🎉👨‍👩‍👧‍👦'.repeat(14); });
add('T23', "이름 SQL 꼴 '\"; DROP TABLE --", (d) => { d.character.name = "'\"; DROP TABLE users; --"; });
add('T24', '이름 한글 자모 분리(ㅎㅏㄴㄱㅡㄹ)', (d) => { d.character.name = 'ㅎㅏㄴㄱㅡㄹㅈㅏㅁㅗ'.repeat(3); });
add('T25', '이름 결합 문자·RTL·제로폭 섞임', (d) => { d.character.name = '김‮민​준́́́'; });
add('T26', 'history 항목에 HTML·초장문', (d) => { d.history.push({ age: d.age, kind: 'choice', title: XSS, text: 'x'.repeat(30000), choice: XSS, eventId: 'school-tutoring' }); });
add('T27', 'history = 문자열', (d) => { d.history = 'bogus'; });
add('T28', 'phase = life 인데 birthReport = null', (d) => { d.birthReport = null; });
add('T29', 'seed = NaN → null, rngState = -1', (d) => { d.seed = null; d.rngState = -1; });
add('T30', 'stats 값 NaN·음수·초과', (d) => { d.stats = { education: 'NaN', health: -50, happiness: 1e9, relationships: null }; });
add('T31', 'pending에 citation 필드(알 수 없는 필드) 주입', (d) => { d.pending.citation = XSS; d.citation = 'c-006'; d.noCitation = 'X1'; });
add('T32', 'flags에 스크립트 문자열·초장문', (d) => { d.flags = [XSS, 'x'.repeat(5000)]; });
add('T33', '자동 모드 설정 변조(autoMode "yes", speed 3, theme neon)', (d) => {}, 'tutoring-present', { speed: 3, autoMode: 'yes', theme: 'neon' });
add('T34', '미래 세상 카드의 birthYear = 2029·2061(범위 밖)', (d) => { d.character.birthYear = 2061; }, 'tutoring-future');
add('T35', 'paused = "true", death 채움(생존 중인데 사망 정보)', (d) => { d.paused = 'true'; d.death = { age: 5, cause: 'x' }; });

const RAW = [
  ['R01', '원문이 잘린 JSON', (v) => v.slice(0, Math.floor(v.length / 2))],
  ['R02', '원문 빈 문자열', () => ''],
  ['R03', '원문 null', () => 'null'],
  ['R04', '원문 빈 배열 []', () => '[]'],
  ['R05', '봉투만 {"version":8}', () => '{"version":8}'],
  ['R06', '버전 7', (v) => v.replace('"version":8', '"version":7')],
  ['R07', '버전 999', (v) => v.replace('"version":8', '"version":999')],
  ['R08', '원문에 NUL·제어 문자', (v) => v.slice(0, 20) + '\u0000\u0001' + v.slice(20)],
  ['R09', '원문 5MB 문자열', () => '"' + 'x'.repeat(5 * 1024 * 1024) + '"'],
];

const classify = async (page) => {
  await sleep(1800);
  return page.evaluate(() => {
    const q = (s) => document.querySelector(s);
    const screen = ['title-screen', 'roulette-screen', 'birth-screen', 'life-screen', 'ending-screen', 'superseded-screen', 'error-screen'].find((id) => q(`[data-testid="${id}"]`)) || (document.body.innerText.trim() === '' ? 'BLANK' : 'unknown');
    return {
      screen,
      xss: window.__xss ?? null,
      mode: q('[data-testid="choice-panel"]') ? q('[data-testid="choice-panel"]').getAttribute('data-mode') : q('[data-testid="decision-fold"]') ? 'fold' : null,
      cite: !!q('[data-testid="cite"]'),
      citeText: q('[data-testid="cite-text"]') ? q('[data-testid="cite-text"]').textContent.slice(0, 60) : null,
      when: q('[data-testid="decision-when"]') ? q('[data-testid="decision-when"]').textContent.trim() : null,
      title: q('[data-testid="choice-title"]') ? q('[data-testid="choice-title"]').textContent.slice(0, 30) : null,
      hint: q('.decision__hint') ? q('.decision__hint').textContent.slice(0, 70) : null,
      docOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      bodyLen: document.body.innerText.length,
      injected: !!document.querySelector('img[src="x"], svg[onload], body script:not([type="module"])'),
    };
  });
};

const rows = [];
const bad = [];
const shotsAll = [];
async function tryOne(id, label, raw, settingsRaw, tag) {
  const ctx = await mkctx(browser, { viewport: { width: 360, height: 740 }, ...TOUCH });
  await ctx.addInitScript(([k, v, sk, sv]) => { try { if (!sessionStorage.getItem('__qa_seeded')) { localStorage.clear(); localStorage.setItem(k, v); localStorage.setItem(sk, sv); sessionStorage.setItem('__qa_seeded', '1'); } } catch {} window.__vis = 'hidden'; Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => window.__vis }); }, [GAME_KEY, raw, SETTINGS_KEY, settingsRaw]);
  const page = await ctx.newPage();
  const errs = [];
  const dialogs = [];
  page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
  page.on('dialog', (d) => { dialogs.push(d.message().slice(0, 60)); d.dismiss().catch(() => {}); });
  let c;
  try {
    await page.goto(PROD, { waitUntil: 'load' });
    c = await classify(page);
  } catch (e) {
    c = { screen: 'LOAD-FAIL', err: String(e.message).slice(0, 100) };
  }
  const rec = { id, label, ...c, pageErrors: errs, dialogs };
  fs.appendFileSync(outFile, JSON.stringify(rec) + '\n');
  rows.push(rec);
  const failing = c.screen === 'BLANK' || c.screen === 'unknown' || c.screen === 'LOAD-FAIL' || errs.length > 0 || dialogs.length > 0 || c.xss !== null || c.injected;
  if (failing) {
    bad.push(`${id} ${label}: 화면 ${c.screen}${errs.length ? ' 오류 ' + errs[0] : ''}${dialogs.length ? ' 경고창 ' + dialogs[0] : ''}${c.xss !== null ? ' XSS 실행 ' + c.xss : ''}${c.injected ? ' 태그 주입됨' : ''}`);
    shotsAll.push(await shot(page, 'A12', id));
  } else if (['T01', 'T13', 'T20', 'T21', 'R01'].includes(id)) shotsAll.push(await shot(page, 'A12', id));
  await ctx.close();
}

await runCase({ id: 'A12', cat: '공격', title: `저장 변조 ${T.length + RAW.length}종 — 카드가 대기 중인 저장을 고쳐 열어도 빈 화면·잡히지 않은 오류·스크립트 실행·경고창이 없다`, steps: 'prod 360x740 터치. 필드 변조 35종(pending·나이·출생 연도·시대·이름 특수문자·history·설정)과 원문 변조 9종(잘림·빈·null·버전·제어 문자·5MB)을 localStorage에 심고 연다', expected: '화면은 생애·첫 화면·오류 안내 중 하나, 오류 0·경고창 0·window.__xss 없음·태그 주입 없음' }, async () => {
  for (const t of T) {
    const d = clone(load(t.base));
    t.mut(d);
    await tryOne(t.id, t.label, JSON.stringify({ version: 8, data: d }), settingsEnvelope(t.settings), 'T');
  }
  for (const [id, label, f] of RAW) {
    const v = JSON.stringify({ version: 8, data: load('tutoring-present') });
    await tryOne(id, label, f(v), settingsEnvelope(SET_MANUAL), 'R');
  }
  const byScreen = {};
  for (const r of rows) byScreen[r.screen] = (byScreen[r.screen] || 0) + 1;
  fs.writeFileSync(path.join(OUT, 'tamper-summary.json'), JSON.stringify({ byScreen, rows: rows.map((r) => ({ id: r.id, label: r.label, screen: r.screen, mode: r.mode, cite: r.cite, citeText: r.citeText, when: r.when, title: r.title, hint: r.hint, err: r.pageErrors, xss: r.xss })) }, null, 1));
  return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.slice(0, 5).join(' / ') + ` (총 ${bad.length}/${rows.length})` : `${rows.length}종 모두 정상 화면으로 열림(화면 분포 ${JSON.stringify(byScreen)}), 오류 0·경고창 0·스크립트 실행 0`, shots: shotsAll.slice(0, 8) };
});
await browser.close();
