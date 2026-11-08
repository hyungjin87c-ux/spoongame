// 옛 저장(v0.4.0·v0.3.0 고정 파일) 이어 하기: 끝까지 자동 진행 → 엔딩(QF1·도장 주어·연표 제목 → 고른 길 → 결과) + 중간 새로고침
import { chromium, newPage, evalCore, inject, BASE, GAME_KEY } from './lib.mjs';
import { readFileSync } from 'node:fs';
const FX = process.argv.slice(2).length ? process.argv.slice(2) : ['save-v040-both-age20', 'save-v040-mother-age20', 'save-v030-age20', 'save-v030-age65'];
const WHO = { mother: '어머니가', father: '아버지가', both: '부모님이', none: '부모님이' };
for (const fx of FX) {
  const raw = JSON.parse(readFileSync(`tests/fixtures/${fx}.json`, 'utf8')).data;
  const { browser, page, errors } = await newPage(chromium, { width: 1280, height: 800 });
  await page.goto(BASE + '/');
  const st = { ...raw, paused: false }; delete st.play;
  // 기대 도장: 코어의 가족 계획으로 줄 나이마다 계산
  const exp = await evalCore(page, `return arg.hist.filter((h) => h.by === 'parent').map((h) => ({ age: h.age, choice: h.choice, subject: core.coParentsOf(arg.st, h.age) }));`, { hist: raw.history, st: raw });
  await inject(page, st, { speed: 8, autoMode: true, noteCards: false }, '/?__timescale=30');
  const t0 = Date.now();
  let reloaded = false, ended = false;
  while (Date.now() - t0 < 300000) {
    if (!reloaded && Date.now() - t0 > 6000) { reloaded = true; await page.reload({ waitUntil: 'domcontentloaded' }); }
    if (await page.getByTestId('ending-screen').isVisible().catch(() => false)) { ended = true; break; }
    await page.waitForTimeout(500);
  }
  if (!ended) { console.log(`${fx} | FAIL | 엔딩에 못 닿음`); await browser.close(); continue; }
  const r = await page.evaluate(() => ({
    text: document.body.innerText,
    picked: [...document.querySelectorAll('[data-testid=timeline-picked][data-by=parent]')].map((e) => e.textContent.trim()),
    delegatedEl: !!document.querySelector('[data-testid=ending-delegated]'),
    choices: document.querySelector('[data-testid=ending-choices]')?.textContent.trim(),
    tlItems: [...document.querySelectorAll('[data-testid=ending-timeline] li, [data-testid=timeline] li')].length,
  }));
  const bad = [];
  for (const e of exp) {
    const want = `${WHO[e.subject]} 이렇게 정했습니다: ${e.choice}`;
    if (!r.picked.includes(want)) bad.push(`기대 "${want}" 없음`);
  }
  const hasSummary = /큰 결정 가운데/.test(r.text);
  // 부모 한 분인 해에 「부모님이」가 나오면(두 분인 줄 제외) 이미 위에서 걸림
  const q = await page.evaluate(() => [...document.querySelectorAll('[data-testid*=timeline]')].slice(0, 3).map((e) => e.dataset.testid));
  console.log(`${fx} | ${!hasSummary && !r.delegatedEl && /번의 선택/.test(r.choices ?? '') && bad.length === 0 && errors.length === 0 ? 'PASS' : 'FAIL'} | 엔딩 도착(재생 중 새로고침 ${reloaded}), 큰 결정 문장 ${hasSummary}, ending-delegated ${r.delegatedEl}, 선택 문장 "${r.choices}", 부모 결정 연표 줄 ${r.picked.length}/${exp.length}, 주어 불일치 ${bad.length} ${bad.slice(0, 2).join(';')}, 오류 ${errors.length} ${errors.slice(0, 1)} ${q.join(',')}`);
  await browser.close();
}
