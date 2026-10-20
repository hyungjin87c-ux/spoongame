// QA-003 M9 P3: 인생 길이 — 「약 1시간」은 선택 불가 + 「준비 중」, 설정(suzeo-game:settings)에 저장된 long60은 short30으로 읽힘(R-202),
// 게임 저장의 long60은 판에 고정된 값이라 그대로 통과(변조 저장에서만 생김 — REV-003-M9-1 R-433), 판 도중 모드 변경 불가(LM3).
// 사용: node qa/scripts/m9-p3.mjs      기본 1280×800 마우스, 둘째 360×740 터치(첫 화면 1회)
import { launch, openOracle, plainLife, openSeeded, mkctx, fixSeed, cleanStorageOnce, readCard, readSave, sleep, shot, runCase, waitGuard, toRoulette, skipToBirth, birthToLife, settingsEnvelope, SETTINGS_KEY, GAME_KEY, TOUCH, PROD, SET_MANUAL } from './m7c-lib.mjs';
import { freshCtx } from './m8-lib.mjs';
import { auditLayout } from './m9-audit.mjs';

const browser = await launch();
const { page: oracle } = await openOracle(browser);
const adult = await plainLife(oracle, { era: 'present', seed: 4242, age: 20, paused: true });

const READ_LEN = () => {
  const q = (s) => document.querySelector(s);
  const tx = (e) => (e ? e.textContent.replace(/\s+/g, ' ').trim() : null);
  const one = (v) => {
    const label = q(`[data-testid="life-${v}"]`);
    const input = label ? label.querySelector('input') || (label.tagName === 'INPUT' ? label : null) : null;
    const card = label ? label.closest('label') || label : null;
    return {
      present: !!label,
      checked: input ? input.checked : null,
      disabled: input ? input.disabled || input.getAttribute('aria-disabled') === 'true' : null,
      text: tx(card),
      cls: card ? card.className : null,
    };
  };
  return { short30: one('short30'), long60: one('long60'), group: !!q('[data-testid="life-length-group"]'), hint: tx(q('[data-testid="life-length-hint"]')) };
};

async function titleChecks(vpName, vp, touch) {
  return runCase({ id: `P3-title-${vpName}`, cat: 'P3 인생 길이', title: `첫 화면(${vpName}): 「약 1시간」은 선택 불가 + 「준비 중」, 기본은 「약 30분」, 눌러도 방향키로도 바뀌지 않는다`, steps: '새 저장소로 첫 화면 → 인생 길이 두 카드 읽기 → 「약 1시간」 클릭/탭 → 방향키(→)·Space → 상태 다시 읽기 → 레이아웃 감사' }, async () => {
    const ctx = await mkctx(browser, { viewport: vp, ...(touch ? TOUCH : {}) });
    await cleanStorageOnce(ctx);
    const p = await ctx.newPage();
    await p.goto(PROD, { waitUntil: 'load' });
    await p.waitForSelector('[data-testid="title-screen"]');
    await sleep(500);
    const a = await p.evaluate(READ_LEN);
    const problems = [];
    if (!a.short30.present || !a.long60.present) problems.push('카드 둘이 안 보임');
    if (a.short30.checked !== true) problems.push(`약 30분이 기본 선택이 아님(${a.short30.checked})`);
    if (a.long60.checked === true) problems.push('약 1시간이 선택됨');
    if (a.long60.disabled !== true) problems.push(`약 1시간이 비활성이 아님(${a.long60.disabled})`);
    if (!/준비 중/.test(a.long60.text || '')) problems.push(`「준비 중」 표시 없음: ${a.long60.text}`);
    if (/준비 중/.test(a.short30.text || '')) problems.push('약 30분에 준비 중 표시');
    const target = p.getByTestId('life-long60');
    await target.click({ force: true, timeout: 2000 }).catch(() => {});
    if (touch) await target.tap({ force: true, timeout: 2000 }).catch(() => {});
    await sleep(200);
    await p.getByTestId('life-short30').focus().catch(() => {});
    await p.keyboard.press('ArrowRight');
    await p.keyboard.press('ArrowDown');
    await p.keyboard.press('Space');
    await sleep(200);
    const b = await p.evaluate(READ_LEN);
    if (b.long60.checked === true || b.short30.checked !== true) problems.push(`누르거나 방향키를 쳐도 바뀌지 않아야 함: 30분 ${b.short30.checked}, 1시간 ${b.long60.checked}`);
    const st = await p.evaluate((k) => localStorage.getItem(k), SETTINGS_KEY);
    if (st && /long60/.test(st)) problems.push('설정에 long60이 저장됨');
    const lay = await auditLayout(p);
    problems.push(...lay.problems);
    const s = problems.length ? await shot(p, `P3-title-${vpName}`) : null;
    await ctx.close();
    return { verdict: problems.length ? 'FAIL' : 'PASS', actual: problems.length ? problems.join(' / ') : `카드: 30분 선택됨·1시간 비활성(「준비 중」 표시), 누르기·방향키·Space 뒤에도 그대로, 설정에 long60 없음, 배치 감사 0 (힌트: ${a.hint})`, shots: s ? [s] : [] };
  });
}
await titleChecks('d1280', { width: 1280, height: 800 }, false);
await titleChecks('m360', { width: 360, height: 740 }, true);

// 설정의 long60 → short30으로 읽힘, 새 판 저장의 lifeLength는 short30
await runCase({ id: 'P3-settings-long60', cat: 'P3 인생 길이', title: '설정(suzeo-game:settings)에 저장된 lifeLength long60(변조)은 short30으로 읽힌다 — 첫 화면도 새 판도 short30', steps: '설정에 long60을 심고 열기 → 첫 화면 선택 상태 → 태어나기~살아가기 → 게임 저장의 lifeLength·설정 다시 읽기' }, async () => {
  const ctx = await freshCtx(browser, { seed: 77, settings: { lifeLength: 'long60', speed: 8 }, vp: { width: 1280, height: 800 }, touch: false, observer: false });
  const p = await ctx.newPage();
  await p.goto(PROD, { waitUntil: 'load' });
  await p.waitForSelector('[data-testid="title-screen"]');
  await sleep(500);
  const a = await p.evaluate(READ_LEN);
  const problems = [];
  if (a.long60.checked === true) problems.push('long60이 선택됨(설정이 그대로 읽힘)');
  if (a.short30.checked !== true) problems.push('short30이 선택되지 않음');
  await toRoulette(p, 'present');
  await skipToBirth(p);
  await birthToLife(p);
  await sleep(600);
  const sv = await readSave(p);
  const gl = sv && sv.data ? sv.data.lifeLength : '(저장 없음)';
  if (gl !== 'short30') problems.push(`게임 저장 lifeLength ${gl}`);
  const sraw = await p.evaluate((k) => localStorage.getItem(k), SETTINGS_KEY);
  const sl = (() => { try { return JSON.parse(sraw).data.lifeLength; } catch { return '(읽기 실패)'; } })();
  if (sl === 'long60') problems.push('설정의 long60이 그대로 남음(다음 판에도 영향)');
  const s = problems.length ? await shot(p, 'P3-settings-long60') : null;
  await ctx.close();
  return { verdict: problems.length ? 'FAIL' : 'PASS', actual: problems.length ? problems.join(' / ') : `첫 화면 short30 선택, 새 판 저장 lifeLength=${gl}, 설정 lifeLength=${sl}`, shots: s ? [s] : [] };
});

// 게임 저장의 long60은 판에 고정된 값이라 그대로 통과(변조 저장에서만 생김)
await runCase({ id: 'P3-save-long60', cat: 'P3 인생 길이', title: '게임 저장의 lifeLength long60(변조 저장)은 판에 고정된 값이라 그대로 통과한다 — 열리고 돌고 저장에서도 long60 그대로(R-433)', steps: '오라클 상태에 lifeLength long60을 넣어 심고 열기 → 6초 뒤 화면·저장 읽기' }, async () => {
  const { ctx, page } = await openSeeded(browser, { ...adult, lifeLength: 'long60', paused: false }, { vp: { width: 1280, height: 800 }, touch: false, settings: SET_MANUAL });
  await sleep(6000);
  const c = await readCard(page);
  const sv = await readSave(page);
  const gl = sv && sv.data ? sv.data.lifeLength : '(없음)';
  const problems = [];
  if (c.screen !== 'life-screen') problems.push(`화면 ${c.screen}`);
  if (gl !== 'long60') problems.push(`저장 lifeLength ${gl} (그대로여야 함)`);
  const s = problems.length ? await shot(page, 'P3-save-long60') : null;
  await ctx.close();
  return { verdict: problems.length ? 'FAIL' : 'PASS', actual: problems.length ? problems.join(' / ') : `화면 ${c.screen}, ${c.age}세, 저장 lifeLength=${gl}(그대로 통과 — 정상 경로로는 생기지 않는 변조 저장)`, shots: s ? [s] : [] };
});

// LM3: 판 도중 모드 변경 불가
await runCase({ id: 'P3-lm3-mid-game', cat: 'P3 인생 길이', title: 'LM3: 판 도중에는 인생 길이를 바꿀 수 없다 — 대시보드에 길이 선택 없음, 설정을 바꿔도 이어서 살기·새로고침 뒤 판의 길이는 그대로, 나가기 뒤 첫 화면도 이어서 살기', steps: '새 판(short30)으로 대시보드 → 길이 선택 요소 없음 확인 → 다른 쪽에서 설정을 long60으로 변조 → 새로고침 → 저장 lifeLength 확인 → 나가기 → 첫 화면 이어서 살기 → 이어서' }, async () => {
  const ctx = await freshCtx(browser, { seed: 78, settings: { lifeLength: 'short30', speed: 8 }, vp: { width: 1280, height: 800 }, touch: false, observer: false });
  const p = await ctx.newPage();
  await p.goto(PROD, { waitUntil: 'load' });
  await p.waitForSelector('[data-testid="title-screen"]');
  await toRoulette(p, 'present');
  await skipToBirth(p);
  await birthToLife(p);
  await sleep(500);
  const problems = [];
  const groupInLife = await p.evaluate(() => !!document.querySelector('[data-testid="life-length-group"], [data-testid^="life-short"], [data-testid^="life-long"]'));
  if (groupInLife) problems.push('대시보드에 인생 길이 선택이 보임');
  const before = (await readSave(p)).data.lifeLength;
  // 설정만 long60으로 변조(다른 탭이 설정을 바꾼 상황) 뒤 새로고침
  await p.evaluate(([k, v]) => localStorage.setItem(k, v), [SETTINGS_KEY, settingsEnvelope({ lifeLength: 'long60', speed: 8 })]);
  await p.reload({ waitUntil: 'load' });
  await p.waitForSelector('[data-testid="life-screen"], [data-testid="title-screen"], [data-testid="superseded-screen"]', { timeout: 8000 });
  await sleep(600);
  const c = await readCard(p);
  const after = (await readSave(p))?.data?.lifeLength;
  if (before !== 'short30' || after !== 'short30') problems.push(`판의 길이가 바뀜: ${before} → ${after}`);
  // 나가기 → 첫 화면
  if (c.screen === 'life-screen') {
    await waitGuard(p, 'tool-exit');
    await p.getByTestId('tool-exit').click();
    await p.waitForSelector('[data-testid="exit-ask"]');
    await waitGuard(p, 'exit-yes');
    await p.getByTestId('exit-yes').click();
    await p.waitForSelector('[data-testid="title-screen"]', { timeout: 6000 });
    await sleep(400);
    const titleHas = await p.evaluate(() => ({ resume: !!document.querySelector('[data-testid="resume"]'), len: document.querySelector('[data-testid="life-length-group"]') !== null }));
    const a2 = (await readSave(p))?.data?.lifeLength;
    if (!titleHas.resume) problems.push('나간 뒤 첫 화면에 이어서 살기가 없음');
    if (a2 !== 'short30') problems.push(`나간 뒤 저장 lifeLength ${a2}`);
    await waitGuard(p, 'resume');
    await p.getByTestId('resume').click();
    await p.waitForSelector('[data-testid="life-screen"]', { timeout: 6000 });
    const a3 = (await readSave(p))?.data?.lifeLength;
    if (a3 !== 'short30') problems.push(`이어서 살기 뒤 lifeLength ${a3}`);
    const lengthRadioAtTitleWithSave = titleHas.len;
    var note = `나간 뒤 첫 화면에 길이 선택 ${lengthRadioAtTitleWithSave ? '있음(새 판용)' : '없음'}`;
  } else {
    problems.push(`새로고침 뒤 화면 ${c.screen}`);
  }
  const s = problems.length ? await shot(p, 'P3-lm3-mid-game') : null;
  await ctx.close();
  return { verdict: problems.length ? 'FAIL' : 'PASS', actual: problems.length ? problems.join(' / ') : `판 시작 ${before} → 설정 long60 변조·새로고침 뒤 ${after}, 나가기→이어서 살기 뒤에도 short30. ${note}`, shots: s ? [s] : [] };
});

await browser.close();
