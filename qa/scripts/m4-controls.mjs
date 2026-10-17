// QA-003 M4 정상 플로우: 진행률 바·컨트롤·도구(BGM·생각 남기기·다크 모드·의견 보내기·나가기). 사용: node qa/scripts/m4-controls.mjs [only-id-prefix]
import fs from 'node:fs';
import path from 'node:path';
import { OUT } from './m4-lib.mjs';
import { launch, mkctx, fixSeed, cleanStorageOnce, newGameToLife, readDash, shot, sleep, runCase, con, PROD, TOUCH, VP, waitGuard, saveJson, readRaw, SETTINGS_KEY, GAME_KEY, bodyText } from './m4-lib.mjs';

const only = process.argv[2] || '';
const want = (id) => !only || id.startsWith(only);
const browser = await launch();

// 진행률 바·나이 변화 기록기
const TL_INIT = () => {
  window.__tl = [];
  const read = () => {
    const age = document.querySelector('[data-testid="life-age"] b');
    const fill = document.querySelector('[data-testid="year-progress-fill"]');
    if (!age || !fill) return;
    const w = parseFloat(fill.style.width);
    const a = parseInt(age.textContent, 10);
    const last = window.__tl[window.__tl.length - 1];
    if (!last || last.a !== a || Math.abs(last.w - w) > 0.001) window.__tl.push({ t: Math.round(performance.now()), a, w: Math.round(w * 100) / 100 });
  };
  const start = () => new MutationObserver(read).observe(document.documentElement, { subtree: true, attributes: true, childList: true, characterData: true });
  document.documentElement ? start() : document.addEventListener('DOMContentLoaded', start);
};
const AC_INIT = () => {
  window.__ac = { ctxs: [], osc: 0 };
  const wrap = (name) => {
    const O = window[name];
    if (!O) return;
    const W = function (...a) {
      const c = new O(...a);
      window.__ac.ctxs.push(c);
      const co = c.createOscillator.bind(c);
      c.createOscillator = (...x) => {
        window.__ac.osc++;
        return co(...x);
      };
      return c;
    };
    W.prototype = O.prototype;
    window[name] = W;
  };
  wrap('AudioContext');
  wrap('webkitAudioContext');
};

async function game(opts = {}) {
  const ctx = await mkctx(browser, opts.ctx ?? { viewport: VP.m360, ...TOUCH });
  await cleanStorageOnce(ctx);
  await fixSeed(ctx, opts.seed ?? 229);
  if (opts.tl) await ctx.addInitScript(TL_INIT);
  if (opts.ac) await ctx.addInitScript(AC_INIT);
  const p = await ctx.newPage();
  await newGameToLife(p, { era: opts.era ?? 'present' });
  return { ctx, p };
}
const getTl = (p) => p.evaluate(() => window.__tl);
const acState = (p) => p.evaluate(() => ({ n: window.__ac.ctxs.length, states: window.__ac.ctxs.map((c) => c.state), osc: window.__ac.osc }));

/** tl → 해별 분석 */
function analyzeTl(tl) {
  const byAge = new Map();
  for (const r of tl) {
    if (!byAge.has(r.a)) byAge.set(r.a, []);
    byAge.get(r.a).push(r);
  }
  const ages = [...byAge.keys()].sort((a, b) => a - b);
  const issues = [];
  const years = [];
  for (let i = 0; i < ages.length; i++) {
    const rs = byAge.get(ages[i]);
    for (let j = 1; j < rs.length; j++) if (rs[j].w < rs[j - 1].w - 0.001) issues.push(`나이 ${ages[i]}: 바가 줄어듦 ${rs[j - 1].w} → ${rs[j].w}`);
    const first = rs[0];
    // 새 나이의 첫 기록이 이전 해의 가득 찬 값이면 깜빡임(새 나이 + 이전 100%)
    if (i > 0 && first.w >= 90) issues.push(`나이 ${ages[i]}: 새 나이의 첫 기록이 바 ${first.w}%(깜빡임)`);
    const maxW = rs.reduce((m, r) => Math.max(m, r.w), 0);
    const next = byAge.get(ages[i + 1]);
    years.push({ age: ages[i], startT: first.t, endT: next ? next[0].t : null, firstW: first.w, maxW, n: rs.length });
  }
  return { issues, years, ages };
}

// ===== N02 진행률 바 =====
if (want('M4-N02')) {
  await runCase(
    { id: 'M4-N02', cat: '정상', title: '진행률 바가 한 해에 한 번 차오른다(1배속, 2해 이상): 단조 증가·나이 +1 때 0으로 리셋·가득 찬 값 위에 새 나이가 보이는 깜빡임 0', steps: '새 판(지금 세상) 살아가기 → 1배속으로 둔 채 18초 관찰. 페이지 안 기록기가 DOM 변경마다 (나이, 바 너비)를 기록', expected: '같은 나이 안에서 바 너비가 줄지 않고, 바가 거의 100%까지 찬 뒤 나이가 +1, 새 나이의 첫 기록은 0 근처, 새 나이 + 이전 100% 기록 0' },
    async () => {
      const { ctx, p } = await game({ tl: true });
      await sleep(18500);
      const tl = await getTl(p);
      const a = analyzeTl(tl);
      const done = a.years.filter((y) => y.endT !== null);
      const bad = [...a.issues];
      if (done.length < 1) bad.push(`완료된 해가 ${done.length}개(1배속 18초에 한 해 이상 기대)`);
      for (const y of done) if (y.maxW < 95) bad.push(`나이 ${y.age}: 바 최대 ${y.maxW}%만 차고 나이가 올랐음`);
      const durs = done.map((y) => Math.round(y.endT - y.startT));
      await shot(p, 'N02', 'bar-mid');
      await ctx.close();
      return { verdict: bad.length ? 'FAIL' : 'PASS', severity: '중간', actual: bad.length ? bad.join(' / ') : `나이 ${a.ages.join('→')}, 완료된 해 ${done.length}개 길이 ${durs.join('/')}ms, 기록 ${tl.length}개 — 단조 증가·리셋·깜빡임 0`, shots: ['qa/screenshots/003/M4-N02-bar-mid.png'] };
    },
  );
}

if (want('M4-N02b')) {
  await runCase(
    { id: 'M4-N02b', cat: '정상', title: '배속에 따라 바가 차는 속도가 바뀐다(1·2·4·8배): 같은 해(0→1세)의 바 속도가 배속에 비례, 배속을 바꿔도 바가 되감기지 않음', steps: '배속마다 새 판을 열어 0세 해의 바 너비 변화 기울기(구간 중앙값)를 재고 한 해 길이로 환산. 같은 판에서 배속을 바꾼 직전·직후 바 너비도 비교', expected: '해 길이가 1배 ≈ 2배의 2배 ≈ 4배의 4배 ≈ 8배의 8배(±25%), 배속 변경 직후 바 너비가 줄지 않음' },
    async () => {
      const bad = [];
      const res = {};
      for (const sp of [1, 2, 4, 8]) {
        const { ctx, p } = await game({ tl: true });
        await waitGuard(p, 'pause');
        await p.locator(`[data-speed="${sp}"]`).click();
        await sleep(sp === 1 ? 4500 : sp === 2 ? 2800 : 1500);
        const tl = (await getTl(p)).filter((r) => r.a === 0);
        const slopes = [];
        for (let i = 1; i < tl.length; i++) {
          const dt = tl[i].t - tl[i - 1].t;
          const dw = tl[i].w - tl[i - 1].w;
          if (dt > 0 && dt < 250 && dw > 0) slopes.push(dw / dt);
        }
        slopes.sort((a, b) => a - b);
        const med = slopes.length ? slopes[Math.floor(slopes.length / 2)] : null;
        res[sp] = med ? Math.round(100 / med) : null;
        if (!med) bad.push(`배속 ${sp}: 기울기를 못 잼(기록 ${tl.length}개)`);
        await ctx.close();
      }
      const base = res[1];
      if (base) for (const sp of [2, 4, 8]) {
        const expect = base / sp;
        if (!res[sp] || Math.abs(res[sp] - expect) > expect * 0.25 + 60) bad.push(`배속 ${sp}: 한 해 ${res[sp]}ms (1배 ${base}ms → 기대 ${Math.round(expect)}±25%)`);
      }
      // 같은 판에서 배속을 바꿀 때 연속성
      const { ctx, p } = await game({ tl: true });
      await sleep(1500);
      const seq = [];
      for (const sp of [4, 1, 8, 2]) {
        const before = (await getTl(p)).slice(-1)[0];
        await waitGuard(p, 'pause');
        await p.locator(`[data-speed="${sp}"]`).click();
        await sleep(120);
        const tl2 = await getTl(p);
        const after = tl2.slice(-1)[0];
        seq.push(`${sp}배:${before.a === after.a ? before.w + '→' + after.w : '해 넘김'}`);
        if (before.a === after.a && after.w < before.w - 0.001) bad.push(`배속 ${sp}로 바꿀 때 바가 되감김 ${before.w}→${after.w}`);
        await sleep(300);
      }
      await ctx.close();
      return { verdict: bad.length ? 'FAIL' : 'PASS', severity: '중간', actual: bad.length ? bad.join(' / ') + ` | 한 해 길이 ${JSON.stringify(res)}` : `0세 해 길이(ms) ${JSON.stringify(res)} — 배속에 반비례. 배속 전환 연속성 ${seq.join(', ')}`, shots: [] };
    },
  );
}

if (want('M4-N02c')) {
  await runCase(
    { id: 'M4-N02c', cat: '정상', title: '일시정지하면 바가 그 자리에 멈추고 다시 진행하면 이어서 찬다(처음부터 다시 재지 않음). 일시정지 중 값 읽기 이름', steps: '새 판 → 3초 뒤 일시정지 → 3초 대기 → 바 너비·나이·접근 이름 확인 → 다시 진행 → 2초 뒤', expected: '멈춘 동안 바·나이 불변(±0), 읽기 이름에 「일시정지 중」, 재개 뒤 바가 멈춘 값에서 이어 늘어남(되감기 0), 저장에 paused true → false' },
    async () => {
      const { ctx, p } = await game({ tl: true });
      const bad = [];
      await sleep(3000);
      await waitGuard(p, 'pause');
      await p.getByTestId('pause').click();
      await sleep(250);
      const d1 = await readDash(p);
      const sv1 = await readRaw(p);
      await sleep(3000);
      const d2 = await readDash(p);
      await shot(p, 'N02c', 'paused');
      if (d1.fillStyle !== d2.fillStyle || d1.age !== d2.age) bad.push(`멈춘 동안 바/나이가 변함 ${d1.fillStyle}→${d2.fillStyle}`);
      if (!/일시정지 중/.test(d2.barText ?? '')) bad.push(`읽기 이름에 「일시정지 중」 없음: ${d2.barText}`);
      if (d2.pauseText !== '다시 진행') bad.push(`버튼 이름 ${d2.pauseText}`);
      if (!/"paused":true/.test(sv1 ?? '')) bad.push('저장에 paused true 없음');
      await p.getByTestId('pause').click();
      await sleep(2000);
      const d3 = await readDash(p);
      const w2 = parseFloat((d2.fillStyle ?? '').replace(/[^0-9.]/g, ''));
      const w3 = parseFloat((d3.fillStyle ?? '').replace(/[^0-9.]/g, ''));
      if (!(w3 > w2 || d3.age > d2.age)) bad.push(`재개 뒤 바가 늘지 않음 ${w2}→${w3}`);
      if (d3.age === d2.age && w3 < w2) bad.push('재개 뒤 바가 되감김');
      if (d3.pauseText !== '일시정지') bad.push(`재개 뒤 버튼 이름 ${d3.pauseText}`);
      const sv3 = await readRaw(p);
      if (/"paused":true/.test(sv3 ?? '')) bad.push('재개 뒤 저장에 paused true 남음');
      await ctx.close();
      return { verdict: bad.length ? 'FAIL' : 'PASS', severity: '중간', actual: bad.length ? bad.join(' / ') : `멈춤 ${d1.fillStyle} → 3초 뒤 ${d2.fillStyle}(불변), 이름 「${d2.barText}」, 재개 ${w2} → ${w3}`, shots: ['qa/screenshots/003/M4-N02c-paused.png'] };
    },
  );
}

// ===== N03 컨트롤 =====
if (want('M4-N03')) {
  await runCase(
    { id: 'M4-N03', cat: '정상', title: '컨트롤 줄: 1·2·4·8배 선택 표시·저장, 일시정지 이름 토글, 다음 결정으로(다음 선택지까지 건너뜀·선택지 대기 중 선택 불가), 자동 모드(켜짐 표시·선택지 자동 선택)', steps: '새 판 → 배속 버튼 4개를 차례로 → 일시정지/재개 → 다음 결정으로 → 선택지 카드에서 선택 → 자동 모드 켜고 20초 관찰', expected: '눌린 배속만 aria-pressed true·설정 저장, 이름 일시정지 ↔ 다시 진행, 다음 결정으로가 나이를 건너뛰어 선택지 카드를 띄움, 카드 대기 중에는 aria-disabled, 자동 모드는 카드를 스스로 고르고 켜짐 표시' },
    async () => {
      const { ctx, p } = await game();
      const bad = [];
      const notes = [];
      await waitGuard(p, 'pause');
      for (const sp of [2, 4, 8, 1]) {
        await p.locator(`[data-speed="${sp}"]`).click();
        await sleep(100);
        const pressed = await p.evaluate(() => [...document.querySelectorAll('[data-speed]')].map((b) => `${b.getAttribute('data-speed')}:${b.getAttribute('aria-pressed')}`));
        const st = JSON.parse((await readRaw(p, SETTINGS_KEY)) || '{}');
        const exp = [1, 2, 4, 8].map((s) => `${s}:${s === sp}`);
        if (JSON.stringify(pressed) !== JSON.stringify(exp)) bad.push(`배속 ${sp}: aria-pressed ${pressed}`);
        const savedSpeed = st.speed ?? st.data?.speed;
        if (savedSpeed !== sp) bad.push(`배속 ${sp}: 저장된 speed ${JSON.stringify(savedSpeed)}`);
      }
      notes.push('배속 4종 표시·저장 OK');
      // 일시정지 토글
      await p.getByTestId('pause').click();
      const dPaused = await readDash(p);
      if (dPaused.pauseText !== '다시 진행') bad.push(`일시정지 뒤 이름 ${dPaused.pauseText}`);
      await p.getByTestId('pause').click();
      // 다음 결정으로
      const before = await readDash(p);
      await p.locator('[data-speed="8"]').click();
      await waitGuard(p, 'skip');
      const t0 = Date.now();
      await p.getByTestId('skip').click();
      let card = null;
      for (let i = 0; i < 100; i++) {
        const d = await readDash(p);
        if (d.hasChoice) {
          card = d;
          break;
        }
        await sleep(100);
      }
      notes.push(`다음 결정으로 → ${card ? `나이 ${before.age}→${card.age}, ${Math.round(Date.now() - t0)}ms 만에 카드 「${card.choiceTitle}」` : '카드 안 뜸'}`);
      if (!card) bad.push('다음 결정으로를 눌렀는데 10초 안에 선택지 카드가 뜨지 않음');
      else {
        if (card.age <= before.age && card.logRows <= before.logRows) bad.push('다음 결정으로가 시간을 건너뛰지 않음');
        if (card.skipDisabled !== 'true') bad.push(`카드 대기 중 다음 결정으로 aria-disabled=${card.skipDisabled}`);
        await shot(p, 'N03', 'skip-card');
        const rows0 = card.logRows;
        await p.locator('[data-testid="choice-panel"] .choice').first().click();
        await sleep(300);
        const after = await readDash(p);
        if (after.hasChoice && after.choiceTitle === card.choiceTitle) bad.push('선택 뒤에도 같은 카드가 남음');
        if (!/선택:/.test(after.logLast ?? '') && after.logRows <= rows0) bad.push(`선택 결과가 기록에 안 쌓임: ${after.logLast}`);
        notes.push(`선택 뒤 마지막 기록: ${(after.logLast ?? '').slice(0, 60)}`);
      }
      // 자동 모드
      await p.getByTestId('auto').click();
      await sleep(200);
      const dAuto = await readDash(p);
      if (dAuto.auto !== 'true' || dAuto.autoText !== '자동 모드 켜짐') bad.push(`자동 모드 표시 ${dAuto.auto}/${dAuto.autoText}`);
      if (dAuto.skipDisabled !== 'true') bad.push('자동 모드에서 다음 결정으로가 선택 불가가 아님');
      await shot(p, 'N03', 'auto-on');
      let sawCard = false;
      let stuck = 0;
      const startAge = (await readDash(p)).age;
      for (let i = 0; i < 200; i++) {
        const d = await readDash(p);
        if (d.hasChoice) {
          sawCard = true;
          stuck++;
          if (stuck > 60) {
            bad.push('자동 모드에서 선택지가 6초 넘게 남음');
            break;
          }
        } else stuck = 0;
        await sleep(100);
      }
      const endAge = (await readDash(p)).age;
      notes.push(`자동 모드 20초: 나이 ${startAge}→${endAge}, 카드 본 적 ${sawCard}`);
      if (endAge <= startAge) bad.push('자동 모드에서 시간이 흐르지 않음');
      await ctx.close();
      return { verdict: bad.length ? 'FAIL' : 'PASS', severity: '중간', actual: bad.length ? bad.join(' / ') : notes.join(' | '), shots: ['qa/screenshots/003/M4-N03-skip-card.png', 'qa/screenshots/003/M4-N03-auto-on.png'] };
    },
  );
}

// ===== N04a BGM =====
if (want('M4-N04a')) {
  await runCase(
    { id: 'M4-N04a', cat: '정상', title: 'BGM 켜기·볼륨·끄기: 기본 꺼짐·사용자 동작 전 소리 장치 0·켜면 AudioContext 1개가 running·볼륨 저장·끄면 음 예약 중단', steps: '새 판 → 소리 장치 개수 → BGM 켜기(터치) → 볼륨 슬라이더를 50→10으로 → 설정 저장 확인 → 3초 뒤 음 예약 수 증가 확인 → 끄기 → 음 예약 중단 확인. (소리 자체는 귀로 확인할 수 없어 미확인)', expected: '켜기 전 장치 0, 켜면 장치 1·running·음 예약이 늘어남, 볼륨 값·저장, 끄면 예약 중단·슬라이더 사라짐, 기본 설정 꺼짐' },
    async () => {
      const { ctx, p } = await game({ ac: true });
      const bad = [];
      const notes = [];
      const d0 = await readDash(p);
      const ac0 = await acState(p);
      if (d0.bgmOn !== 'false') bad.push(`기본 BGM aria-pressed=${d0.bgmOn}`);
      if (ac0.n !== 0) bad.push(`켜기 전 소리 장치 ${ac0.n}개`);
      await waitGuard(p, 'tool-bgm');
      await p.getByTestId('tool-bgm').tap?.().catch(async () => p.getByTestId('tool-bgm').click());
      await sleep(300);
      let d1 = await readDash(p);
      if (d1.bgmOn !== 'true') {
        await p.getByTestId('tool-bgm').click();
        await sleep(300);
        d1 = await readDash(p);
      }
      const ac1 = await acState(p);
      notes.push(`켠 뒤 장치 ${ac1.n}개 ${ac1.states.join(',')}`);
      if (d1.bgmOn !== 'true') bad.push(`켠 뒤 aria-pressed=${d1.bgmOn}`);
      if (ac1.n !== 1 || ac1.states[0] !== 'running') bad.push(`켠 뒤 장치 ${JSON.stringify(ac1)}`);
      const vol = p.getByTestId('bgm-volume-input');
      if (!(await vol.count())) bad.push('켠 뒤 볼륨 슬라이더가 없음');
      else {
        const v0 = await vol.inputValue();
        await vol.focus();
        for (let i = 0; i < 8; i++) await p.keyboard.press('ArrowLeft');
        await sleep(200);
        const v1 = await vol.inputValue();
        notes.push(`볼륨 ${v0} → ${v1}`);
        if (Number(v1) >= Number(v0)) bad.push(`볼륨이 내려가지 않음 ${v0}→${v1}`);
        const st = JSON.parse((await readRaw(p, SETTINGS_KEY)) || '{}');
        const sv = st.bgm ?? st.data?.bgm;
        if (!sv || sv.on !== true || sv.volume !== Number(v1)) bad.push(`설정 저장 ${JSON.stringify(sv)} (볼륨 ${v1} 기대)`);
        const out = await p.locator('[data-testid="bgm-volume"] output').textContent();
        if (out.trim() !== `${v1}%`) bad.push(`볼륨 글자 ${out}`);
        await shot(p, 'N04a', 'bgm-on');
      }
      const o1 = (await acState(p)).osc;
      await sleep(3500);
      const o2 = (await acState(p)).osc;
      notes.push(`음 예약 ${o1} → ${o2}`);
      if (o2 <= o1) bad.push(`켜진 3.5초 동안 음 예약이 늘지 않음 ${o1}→${o2}`);
      await p.getByTestId('tool-bgm').click();
      await sleep(400);
      const o3 = (await acState(p)).osc;
      await sleep(2500);
      const o4 = (await acState(p)).osc;
      const d2 = await readDash(p);
      notes.push(`끈 뒤 음 예약 ${o3} → ${o4}`);
      if (o4 > o3 + 2) bad.push(`끈 뒤에도 음 예약이 계속 늘어남 ${o3}→${o4}`);
      if (d2.bgmOn !== 'false') bad.push('끈 뒤 aria-pressed true');
      if (await p.getByTestId('bgm-volume-input').count()) bad.push('끈 뒤 볼륨 슬라이더가 남음');
      await shot(p, 'N04a', 'bgm-off');
      await ctx.close();
      return { verdict: bad.length ? 'FAIL' : 'PASS', severity: '중간', actual: (bad.length ? bad.join(' / ') + ' | ' : '') + notes.join(' | ') + ' (소리 자체는 미확인)', shots: ['qa/screenshots/003/M4-N04a-bgm-on.png', 'qa/screenshots/003/M4-N04a-bgm-off.png'] };
    },
  );
}

// ===== N04b 생각 남기기 =====
if (want('M4-N04b')) {
  await runCase(
    { id: 'M4-N04b', cat: '정상', title: '생각 남기기는 「준비 중」이고 선택할 수 없다(눌러도 무변화·포커스는 받음·읽는 이름에 준비 중)', steps: '새 판 → 도구 줄의 「생각 남기기」 확인 → 클릭·Enter·Space → 화면·시계·저장 비교 → Tab으로 포커스 도달', expected: 'aria-disabled true·이름 「생각 남기기 준비 중」·점선 표식·눌러도 일시정지·카드·새 요소 없음·키보드 포커스 가능' },
    async () => {
      const { ctx, p } = await game();
      const bad = [];
      await sleep(600);
      const info = await p.getByTestId('tool-note').evaluate((b) => {
        const cs = getComputedStyle(b);
        return { dis: b.getAttribute('aria-disabled'), disabledProp: b.disabled, border: cs.borderStyle, name: b.getAttribute('aria-label') || b.textContent.replace(/\s+/g, ' ').trim(), unavail: b.getAttribute('data-unavailable') };
      });
      if (info.dis !== 'true') bad.push(`aria-disabled=${info.dis}`);
      if (!/생각 남기기/.test(info.name) || !/준비 중/.test(info.name)) bad.push(`이름 ${info.name}`);
      if (info.border !== 'dashed') bad.push(`테두리 ${info.border} (점선 기대)`);
      const before = await p.evaluate(() => ({ html: document.querySelector('main').innerHTML.length, dialogs: document.querySelectorAll('[role="dialog"],dialog').length }));
      const b0 = await readDash(p);
      await p.getByTestId('tool-note').click({ force: true });
      await p.getByTestId('tool-note').focus();
      await p.keyboard.press('Enter');
      await p.keyboard.press('Space');
      await sleep(400);
      const after = await p.evaluate(() => ({ dialogs: document.querySelectorAll('[role="dialog"],dialog').length }));
      const b1 = await readDash(p);
      if (after.dialogs !== before.dialogs) bad.push('눌렀더니 대화상자가 생김');
      if (b1.paused !== b0.paused) bad.push(`눌렀더니 일시정지 상태가 바뀜 ${b0.paused}→${b1.paused}`);
      if (b1.hasChoice) bad.push('눌렀더니 선택지 카드');
      const focused = await p.evaluate(() => document.activeElement?.getAttribute('data-testid'));
      if (focused !== 'tool-note') bad.push(`포커스가 버튼에 머물지 않음(${focused})`);
      await shot(p, 'N04b', 'note-disabled');
      await ctx.close();
      return { verdict: bad.length ? 'FAIL' : 'PASS', severity: '낮음', actual: bad.length ? bad.join(' / ') : `이름 「${info.name}」, aria-disabled true, 테두리 ${info.border}, 눌러도 무변화·포커스 유지`, shots: ['qa/screenshots/003/M4-N04b-note-disabled.png'] };
    },
  );
}

// ===== N04c 다크 모드 =====
if (want('M4-N04c')) {
  await runCase(
    { id: 'M4-N04c', cat: '정상', title: '다크 모드 수동 토글: 켜짐 표시(aria-pressed)·화면 색 변경·저장·새로고침 유지, 처음엔 시스템 설정 따름', steps: '라이트 시스템에서 새 판 → 다크 모드 누름 → 배경색·aria-pressed·저장·새로고침 → 다시 눌러 라이트. 다크 시스템에서 새 판 → 처음부터 켜짐 표시이고 저장은 비어 있음', expected: '토글마다 배경색이 바뀌고 aria-pressed·아이콘이 따라 바뀜, 수동 선택은 settings.theme에 저장되고 새로고침 뒤에도 유지, 시스템 다크는 저장 없이 켜짐' },
    async () => {
      const bad = [];
      const notes = [];
      const bgOf = (p) => p.evaluate(() => getComputedStyle(document.body).backgroundColor + '|' + getComputedStyle(document.documentElement).backgroundColor);
      let { ctx, p } = await game();
      const d0 = await readDash(p);
      const bg0 = await bgOf(p);
      await waitGuard(p, 'tool-dark');
      await p.getByTestId('tool-dark').click();
      await sleep(300);
      const d1 = await readDash(p);
      const bg1 = await bgOf(p);
      const st1 = JSON.parse((await readRaw(p, SETTINGS_KEY)) || '{}');
      notes.push(`라이트 ${bg0} → 다크 ${bg1}`);
      if (d0.darkOn !== 'false') bad.push(`처음 aria-pressed ${d0.darkOn}`);
      if (d1.darkOn !== 'true') bad.push(`누른 뒤 aria-pressed ${d1.darkOn}`);
      if (bg0 === bg1) bad.push('배경색이 안 바뀜');
      if ((st1.theme ?? st1.data?.theme) !== 'dark') bad.push(`저장 theme ${JSON.stringify(st1.theme ?? st1.data?.theme)}`);
      await shot(p, 'N04c', 'dark-on');
      await p.reload({ waitUntil: 'load' });
      await p.waitForSelector('[data-testid="life-screen"]');
      await sleep(300);
      const d2 = await readDash(p);
      const bg2 = await bgOf(p);
      if (d2.darkOn !== 'true' || bg2 !== bg1) bad.push(`새로고침 뒤 다크 유지 안 됨(${d2.darkOn}, ${bg2})`);
      await p.getByTestId('tool-dark').click();
      await sleep(300);
      const d3 = await readDash(p);
      const bg3 = await bgOf(p);
      const st3 = JSON.parse((await readRaw(p, SETTINGS_KEY)) || '{}');
      if (d3.darkOn !== 'false' || bg3 !== bg0) bad.push(`다시 누른 뒤 라이트 복귀 안 됨 ${d3.darkOn} ${bg3}`);
      if ((st3.theme ?? st3.data?.theme) !== 'light') bad.push(`저장 theme ${JSON.stringify(st3.theme ?? st3.data?.theme)} (light 기대)`);
      await ctx.close();
      // 시스템 다크
      ({ ctx, p } = await game({ ctx: { viewport: VP.m360, ...TOUCH, colorScheme: 'dark' } }));
      const e0 = await readDash(p);
      const st = JSON.parse((await readRaw(p, SETTINGS_KEY)) || 'null');
      notes.push(`시스템 다크 시작: aria-pressed ${e0.darkOn}, 저장 theme ${JSON.stringify(st && (st.theme ?? st.data?.theme))}`);
      if (e0.darkOn !== 'true') bad.push(`시스템 다크인데 처음 aria-pressed ${e0.darkOn}`);
      if (st && (st.theme ?? st.data?.theme) && (st.theme ?? st.data?.theme) !== 'system') bad.push('시스템 다크를 따르는 것만으로 수동 선택이 저장됨');
      await shot(p, 'N04c', 'system-dark');
      await p.getByTestId('tool-dark').click();
      await sleep(300);
      const e1 = await readDash(p);
      if (e1.darkOn !== 'false') bad.push(`시스템 다크에서 누르면 라이트(수동)가 되어야 함: ${e1.darkOn}`);
      await ctx.close();
      return { verdict: bad.length ? 'FAIL' : 'PASS', severity: '중간', actual: (bad.length ? bad.join(' / ') + ' | ' : '') + notes.join(' | '), shots: ['qa/screenshots/003/M4-N04c-dark-on.png', 'qa/screenshots/003/M4-N04c-system-dark.png'] };
    },
  );
}

// ===== N04d 의견 보내기 =====
if (want('M4-N04d')) {
  await runCase(
    { id: 'M4-N04d', cat: '정상', title: '의견 보내기: 새 창 주소가 허용 목록(화면·세상·인생 길이·빌드)뿐 — 이름·나이·기록·저장 데이터 0, rel=noopener noreferrer, target=_blank', steps: '세 세상의 새 판·저장 불러온 판에서 링크 href와 클릭 시 열리는 새 창 주소를 읽는다(github.com 요청은 가로채 빈 응답, 외부로 나가지 않음)', expected: 'https://github.com/hyungjin87c-ux/spoongame/issues/new?template=feedback.yml 로 시작, 쿼리 키가 허용 목록뿐, 캐릭터 이름·기록 문장·저장 JSON 조각이 주소에 0' },
    async () => {
      const bad = [];
      const notes = [];
      const urls = [];
      for (const era of ['present', 'past', 'future']) {
        const { ctx, p } = await game({ era, seed: era === 'past' ? 155 : era === 'future' ? 138 : 229 });
        await ctx.route('https://github.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<title>stub</title>' }));
        const name = (await readDash(p)).name;
        const link = p.getByTestId('tool-feedback');
        const info = await link.evaluate((a) => ({ href: a.href, target: a.target, rel: a.rel, text: a.textContent.replace(/\s+/g, ' ').trim() }));
        urls.push(info.href);
        const popupP = ctx.waitForEvent('page', { timeout: 4000 }).catch(() => null);
        await waitGuard(p, 'tool-feedback').catch(() => {});
        await sleep(500);
        await link.click();
        const pop = await popupP;
        let popUrl = null;
        if (pop) {
          await pop.waitForLoadState('domcontentloaded').catch(() => {});
          popUrl = pop.url();
          await pop.close().catch(() => {});
        }
        const u = new URL(info.href);
        const keys = [...u.searchParams.keys()];
        const sv = await readRaw(p);
        notes.push(`${era}: ${info.href.slice(0, 160)}`);
        if (u.origin !== 'https://github.com' || !/\/issues\/new$/.test(u.pathname)) bad.push(`${era}: 주소 ${info.href}`);
        if (info.target !== '_blank') bad.push(`${era}: target=${info.target}`);
        if (!/noopener/.test(info.rel) || !/noreferrer/.test(info.rel)) bad.push(`${era}: rel=${info.rel}`);
        if (popUrl === null) bad.push(`${era}: 클릭해도 새 창이 열리지 않음`);
        else if (popUrl !== info.href && decodeURIComponent(popUrl) !== decodeURIComponent(info.href)) bad.push(`${era}: 새 창 주소 ${popUrl} ≠ href`);
        const dec = decodeURIComponent(info.href);
        if (dec.includes(name)) bad.push(`${era}: 주소에 이름 「${name}」`);
        const hist = JSON.parse(sv).data?.history ?? JSON.parse(sv).history ?? [];
        for (const h of hist) if (h.text && dec.includes(h.text.slice(0, 8))) bad.push(`${era}: 주소에 기록 문장 조각`);
        if (/seed|birthReport|history|"age"|gender|flags/.test(dec)) bad.push(`${era}: 주소에 저장 필드 이름`);
        notes.push(`${era} 쿼리 키 ${keys.join(',')}`);
        await ctx.close();
      }
      fs.writeFileSync(path.join(OUT, 'feedback-urls.json'), JSON.stringify(urls.map((u) => ({ href: u, decoded: decodeURIComponent(u) })), null, 1));
      return { verdict: bad.length ? 'FAIL' : 'PASS', severity: '높음(개인정보)', actual: bad.length ? bad.join(' / ') : notes.join(' | '), shots: [] };
    },
  );
}

// ===== N04e 나가기 =====
if (want('M4-N04e')) {
  await runCase(
    { id: 'M4-N04e', cat: '정상', title: '나가기 → 확인 → 첫 화면 「이어서 살기」 → 새로고침해도 멈춘 채 복원', steps: '새 판 → 3초 뒤 「나가기」 → 확인 단계(시계 정지·안전한 쪽 포커스) → 돌아가기 → 다시 나가기 → 「첫 화면으로 나가기」 → 첫 화면 → 새로고침 → 이어서 살기', expected: '확인 단계 동안 바·나이 불변, 돌아가기로 닫히고 포커스가 나가기로, 나가기 뒤 첫 화면에 「이어서 살기」가 기본 버튼, 새로고침하면 대시보드가 그대로(멈춘 상태, 나이·바 같음), 이어서 살기를 누르면 멈춘 채로 대시보드, 다시 진행으로 재개' },
    async () => {
      const { ctx, p } = await game();
      const bad = [];
      const notes = [];
      await sleep(3000);
      await waitGuard(p, 'tool-exit');
      await p.getByTestId('tool-exit').click();
      await p.waitForSelector('[data-testid="exit-ask"]');
      await sleep(300);
      const ask = await p.evaluate(() => ({ text: document.querySelector('[data-testid="exit-ask"]').innerText.replace(/\s+/g, ' '), focus: document.activeElement?.getAttribute('data-testid') }));
      notes.push(`확인 단계 「${ask.text.slice(0, 80)}」 포커스 ${ask.focus}`);
      if (ask.focus !== 'exit-no') bad.push(`확인 단계 포커스 ${ask.focus} (돌아가기 기대)`);
      const a0 = await readDash(p);
      await shot(p, 'N04e', 'exit-ask');
      await sleep(2500);
      const a1 = await readDash(p);
      if (a0.fillStyle !== a1.fillStyle || a0.age !== a1.age) bad.push(`확인 단계 동안 시계가 흐름 ${a0.fillStyle}→${a1.fillStyle}`);
      await waitGuard(p, 'exit-no');
      await p.getByTestId('exit-no').click();
      await sleep(300);
      const a2 = await p.evaluate(() => ({ ask: !!document.querySelector('[data-testid="exit-ask"]'), focus: document.activeElement?.getAttribute('data-testid') }));
      if (a2.ask) bad.push('돌아가기를 눌러도 확인 단계가 남음');
      if (a2.focus !== 'tool-exit') bad.push(`돌아가기 뒤 포커스 ${a2.focus} (나가기 기대)`);
      await sleep(1200);
      const a3 = await readDash(p);
      if (a3.fillStyle === a1.fillStyle && a3.age === a1.age) bad.push('돌아가기 뒤 시계가 다시 흐르지 않음');
      await p.getByTestId('tool-exit').click();
      await p.waitForSelector('[data-testid="exit-yes"]');
      await waitGuard(p, 'exit-yes');
      const beforeExit = await readDash(p);
      await p.getByTestId('exit-yes').click();
      await p.waitForSelector('[data-testid="title-screen"]', { timeout: 4000 });
      await sleep(300);
      const title = await p.evaluate(() => ({ resume: document.querySelector('[data-testid="resume"]')?.textContent.trim(), begin: document.querySelector('[data-testid="begin-new"]')?.textContent.trim(), start: !!document.querySelector('[data-testid="start-birth"]') }));
      notes.push(`첫 화면 버튼: ${JSON.stringify(title)}`);
      if (title.resume !== '이어서 살기') bad.push(`첫 화면 「이어서 살기」 없음 ${JSON.stringify(title)}`);
      await shot(p, 'N04e', 'title-resume');
      const sv = await readRaw(p);
      if (!/"paused":true/.test(sv ?? '')) bad.push('나가기 뒤 저장이 일시정지가 아님');
      // 첫 화면 상태에서 새로고침 → 저장된 화면(대시보드) 복원, 멈춘 채
      await p.reload({ waitUntil: 'load' });
      await sleep(500);
      const r1 = await readDash(p);
      notes.push(`새로고침 뒤: ${r1.screen} 나이 ${r1.age} 멈춤 ${r1.paused} ${r1.fillStyle} (나가기 전 ${beforeExit.age} ${beforeExit.fillStyle})`);
      if (r1.screen !== 'life-screen') bad.push(`새로고침 뒤 ${r1.screen}`);
      if (r1.paused !== 'true') bad.push(`새로고침 뒤 일시정지 아님(${r1.paused})`);
      if (r1.age !== beforeExit.age) bad.push(`나이 ${beforeExit.age}→${r1.age}`);
      await sleep(2000);
      const r2 = await readDash(p);
      if (r2.fillStyle !== r1.fillStyle) bad.push('복원 뒤 멈춘 상태인데 바가 움직임');
      await shot(p, 'N04e', 'restored-paused');
      // 다시 나가기 → 이어서 살기
      await p.getByTestId('tool-exit').click();
      await waitGuard(p, 'exit-yes');
      await p.getByTestId('exit-yes').click();
      await p.waitForSelector('[data-testid="resume"]');
      await waitGuard(p, 'resume');
      await p.getByTestId('resume').click();
      await p.waitForSelector('[data-testid="life-screen"]');
      await sleep(400);
      const r3 = await readDash(p);
      if (r3.paused !== 'true') bad.push(`이어서 살기 뒤 일시정지 아님(${r3.paused})`);
      await waitGuard(p, 'pause');
      await p.getByTestId('pause').click();
      await sleep(1500);
      const r4 = await readDash(p);
      if (r4.fillStyle === r3.fillStyle && r4.age === r3.age) bad.push('다시 진행을 눌러도 안 흐름');
      await ctx.close();
      return { verdict: bad.length ? 'FAIL' : 'PASS', severity: '중간', actual: (bad.length ? bad.join(' / ') + ' | ' : '') + notes.join(' | '), shots: ['qa/screenshots/003/M4-N04e-exit-ask.png', 'qa/screenshots/003/M4-N04e-title-resume.png', 'qa/screenshots/003/M4-N04e-restored-paused.png'] };
    },
  );
}

await browser.close();
