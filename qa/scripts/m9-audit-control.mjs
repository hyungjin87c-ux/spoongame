// QA-003 M9: 공통 감사기(m9-audit.mjs)가 공허하게 통과하지 않는지 점검한다(M8의 DET-control과 같은 방식).
// 실제 화면에 문제를 일부러 심어 감사기가 잡는지 본다: 가로 넘침 · 겹친 글자 · 가려진 글자(문서 끝의 고정 띠) · 낱말 끊김 · 대비 부족 · 가려진 포커스.
// 사용: node qa/scripts/m9-audit-control.mjs
import { launch, mkctx, cleanStorageOnce, sleep, runCase, PROD, readCard } from './m7c-lib.mjs';
import { auditLayout, auditWords, auditContrast, auditFocus } from './m9-audit.mjs';

const browser = await launch();
const open = async (vp = { width: 1280, height: 800 }) => {
  const ctx = await mkctx(browser, { viewport: vp });
  await cleanStorageOnce(ctx);
  const page = await ctx.newPage();
  await page.goto(PROD, { waitUntil: 'load' });
  await page.waitForSelector('[data-testid="title-screen"]');
  await sleep(400);
  return { ctx, page };
};

await runCase({ id: 'AUD-control-clean', cat: '감사기 점검', title: '대조(무결): 심은 문제가 없는 첫 화면에서 배치·낱말·대비·포커스 감사가 모두 0건이다', steps: '첫 화면 1280×800에서 네 감사 실행' }, async () => {
  const { ctx, page } = await open();
  const lay = await auditLayout(page);
  const w = await auditWords(page);
  const c = await auditContrast(page);
  const f = await auditFocus(page, 'control-clean', 800);
  await ctx.close();
  const probs = [...lay.problems, ...w.problems, ...c.problems, ...f.problems];
  return { verdict: probs.length ? 'FAIL' : 'PASS', actual: probs.length ? probs.join(' / ') : `배치·낱말·대비 검사 ${c.checked}곳·포커스 정지 ${f.stops}곳 모두 0건`, shots: [] };
});

const PLANTS = [
  ['AUD-control-overflow', '심은 가로 넘침(폭 2000px 요소)을 배치 감사가 잡는다', async (page) => { await page.evaluate(() => { const d = document.createElement('div'); d.style.cssText = 'width:2000px;height:20px;background:#ccc'; d.textContent = '넘침 심기'; document.body.appendChild(d); }); return (await auditLayout(page)).problems; }, /가로 넘침|화면 밖/],
  ['AUD-control-overlap', '심은 겹친 글자(일반 흐름의 두 줄이 음수 여백으로 포개짐)를 배치 감사가 잡는다', async (page) => { await page.evaluate(() => { const wrap = document.createElement('div'); wrap.style.cssText = 'position:relative;z-index:3;background:#fff'; const x = document.createElement('div'); x.style.cssText = 'font-size:22px;line-height:28px;margin:0'; x.textContent = '첫째 줄 겹치기 시험 글'; const y = document.createElement('div'); y.style.cssText = 'font-size:22px;line-height:28px;margin:-20px 0 0 6px;position:relative'; y.textContent = '둘째 줄이 포개진 글'; wrap.append(x, y); document.body.prepend(wrap); }); return (await auditLayout(page)).problems; }, /겹친 글자|가려진 글자/],
  ['AUD-control-covered', '심은 가려진 글자(문서 끝에서 고정 띠가 마지막 글을 덮음)를 배치 감사가 잡는다', async (page) => { await page.evaluate(() => { const bar = document.createElement('div'); bar.style.cssText = 'position:fixed;left:0;right:0;bottom:0;height:90px;background:#123;color:#fff;z-index:99'; bar.textContent = '심은 고정 띠'; document.body.appendChild(bar); const p = document.createElement('p'); p.id = 'qa-last'; p.textContent = '문서 맨 끝 마지막 글줄 — 띠에 가려지는 자리'; p.style.cssText = 'margin:0;padding:0'; document.body.appendChild(p); const pad = document.querySelector('.page-end-space'); if (pad) pad.remove(); document.documentElement.style.scrollPaddingBottom = '0'; }); return (await auditLayout(page)).problems; }, /문서 끝.*가려진/],
  ['AUD-control-wordbreak', '심은 낱말 끊김(좁은 상자에 word-break: break-all)을 낱말 감사가 잡는다', async (page) => { await page.evaluate(() => { const d = document.createElement('div'); d.style.cssText = 'width:70px;word-break:break-all;font-size:18px'; d.textContent = '인생시뮬레이션게임'; document.body.prepend(d); }); return (await auditWords(page)).problems; }, /낱말 중간 끊김/],
  ['AUD-control-contrast', '심은 대비 부족(연회색 글자 on 흰 바탕)을 대비 감사가 잡는다', async (page) => { await page.evaluate(() => { const d = document.createElement('p'); d.style.cssText = 'color:#bbb;background:#fff;font-size:16px;margin:0'; d.textContent = '대비가 낮은 글'; document.body.prepend(d); }); return (await auditContrast(page)).problems; }, /대비 부족/],
];
for (const [id, title, plant, re] of PLANTS) {
  await runCase({ id, cat: '감사기 점검', title: `대조(심기): ${title}`, steps: '첫 화면에 문제를 심고 해당 감사를 실행' }, async () => {
    const { ctx, page } = await open();
    const probs = await plant(page);
    await ctx.close();
    const hit = probs.some((p) => re.test(p));
    return { verdict: hit ? 'PASS' : 'FAIL', actual: hit ? `잡음: ${probs.filter((p) => re.test(p))[0].slice(0, 120)}` : `못 잡음(감사 결과: ${probs.join(' / ') || '0건'}) — 감사기가 공허함`, shots: [] };
  });
}

await runCase({ id: 'AUD-control-focus', cat: '감사기 점검', title: '대조(심기): 심은 고정 띠가 하단 버튼을 덮으면 포커스 감사가 가려진 포커스로 잡는다', steps: '첫 화면에 높이 260px 고정 띠를 아래에 심어 「태어나기」(고정 하단 띠 안)가 아니라 본문 맨 아래 조작 요소를 덮게 한 뒤 Tab 순회' }, async () => {
  const { ctx, page } = await open({ width: 360, height: 568 });
  await page.evaluate(() => {
    const bar = document.createElement('div');
    bar.style.cssText = 'position:fixed;left:0;right:0;top:0;height:520px;background:#123;z-index:99;pointer-events:none';
    bar.setAttribute('data-testid', 'qa-planted-cover');
    document.body.appendChild(bar);
  });
  const f = await auditFocus(page, 'control-focus', 568);
  await ctx.close();
  const hit = f.problems.some((p) => /가려짐|화면 밖|가려/.test(p));
  return { verdict: hit ? 'PASS' : 'FAIL', actual: hit ? `잡음 ${f.problems.length}건: ${f.problems[0].slice(0, 120)}` : `못 잡음(정지 ${f.stops}곳, 문제 0) — 포커스 감사가 공허함`, shots: [] };
});

await browser.close();
