// 같은 해 모순(완료 기준 3·5, R-631·R-632·R-633) + 결정 카드 중 새로고침·연타·뒤로가기(pending.choiceIds 복원)
// 사용: QA_STATES=<states2> QA_BASE=http://localhost:5311 node qa/scripts/009/fm7a-sameyear.mjs [키…]   (키 생략 = _picks.json 전부)
import { chromium, boot, loadState, picks, cardNow, ageNow, readSave, GAME_KEY } from './fm7a-lib.mjs';

const WORDS = /부모님|의논|조부모|할머니|할아버지|동생|형제|누나|언니|오빠|형이|형과|아버지|어머니/;
const keys = process.argv.slice(2).length ? process.argv.slice(2) : picks().map((p) => p.key);
const b = await chromium.launch();
const summary = [];
for (const key of keys) {
  const st = loadState(key);
  const a0 = st.data.age;
  const { ctx, page, errors } = await boot(b, st, { scale: 60, settings: { speed: 1, autoMode: false } });
  await page.getByTestId('life-screen').waitFor({ timeout: 15000 });
  const seen = [];
  const t0 = Date.now();
  let reloaded = false;
  let mismatch = null;
  while (Date.now() - t0 < 60000) {
    const card = await cardNow(page);
    const a = await ageNow(page);
    if (card && a === a0) {
      const sv = await readSave(page);
      const ids = sv?.data?.pending?.choiceIds ?? null;
      const shown = card.choices.map((c) => c.id);
      seen.push({ age: a, title: card.title, shown, saved: ids, labels: card.choices.map((c) => c.label) });
      if (ids && JSON.stringify(ids) !== JSON.stringify(shown)) mismatch = `화면 ${shown} ≠ 저장 ${ids}`;
      if (!reloaded) {
        // 결정 카드가 떠 있는 상태에서 새로고침 연타(10회) → 같은 선택지 2~3개로 복원되는가
        reloaded = true;
        const afterReload = [];
        for (let r = 0; r < 10; r++) {
          await page.reload();
          await page.getByTestId('life-screen').waitFor({ timeout: 8000 }).catch(() => {});
          const c2 = await page.waitForFunction(() => document.querySelector('button[data-testid^="choice-"]:not([data-testid="choice-ask"])') !== null, null, { timeout: 4000 }).then(() => cardNow(page)).catch(() => null);
          afterReload.push(c2 ? c2.choices.map((c) => c.id).join('|') : 'none');
        }
        seen[seen.length - 1].afterReload = afterReload;
        const c3 = await cardNow(page);
        if (!c3) continue;
        // 뒤로가기(한 번 이동 뒤)도
        await page.goBack().catch(() => {});
        await page.waitForTimeout(300);
        if (!page.url().includes('5311')) await page.goto(page.url());
        await page.getByTestId('life-screen').waitFor({ timeout: 8000 }).catch(() => {});
        continue;
      }
      // 모순을 일으키기 쉬운 선택지를 고른다
      const i = card.choices.findIndex((c) => WORDS.test(c.label));
      await page.getByTestId(`choice-${card.choices[Math.max(i, 0)].id}`).click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(60);
      continue;
    }
    if (card) { await page.getByTestId(`choice-${card.choices[0].id}`).click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(40); continue; }
    if (a >= a0 + 1) break;
    const paused = await page.getByTestId('pause').getAttribute('data-paused').catch(() => null);
    if (paused === 'true') await page.getByTestId('pause').click().catch(() => {});
    await page.waitForTimeout(40);
  }
  await page.getByTestId('pause').click({ timeout: 800 }).catch(() => {});
  await page.waitForTimeout(250);
  const sv = await readSave(page);
  const hist = sv.data.history.filter((h) => h.age === a0 || h.age === a0 + 0);
  const lineRow = hist.find((h) => /^fam-(parent-gone|gp-gone|sib-lost)$/.test(h.eventId ?? ''));
  const yearRows = hist.filter((h) => h !== lineRow && h.kind !== 'stage' && !(h.eventId ?? '').startsWith('fam-') && h.kind !== 'era');
  const wordRows = yearRows.filter((h) => WORDS.test(h.text.replace(/\(부모님이 이렇게 정했습니다[^)]*\)/g, '')));
  const sameYearCardWords = seen.filter((s) => s.labels.some((l) => WORDS.test(l)));
  const FL = ['has_grandparent', 'lives_with_grandparent', 'has_sibling', 'has_older_sibling', 'has_younger_sibling', 'mother_gone', 'father_gone', 'parents_gone'];
  const flagsEnd = FL.filter((f) => sv.data.flags.includes(f));
  const lineKind = lineRow?.eventId ?? '';
  const GP_W = /조부모|할머니|할아버지/, SIB_W = /형제|동생|누나|언니|오빠|형[이과을]/, PAR_W = /부모님|의논|아버지|어머니/;
  let contradiction = null;
  if (lineKind === 'fam-gp-gone' && !flagsEnd.includes('has_grandparent')) contradiction = wordRows.find((h) => GP_W.test(h.text)) ?? null;
  if (lineKind === 'fam-sib-lost' && !flagsEnd.includes('has_sibling')) contradiction = wordRows.find((h) => SIB_W.test(h.text)) ?? null;
  if (lineKind === 'fam-parent-gone') contradiction = wordRows.find((h) => PAR_W.test(h.text.replace(/(부모님이 이렇게 정했습니다[^)]*)/g, ''))) ?? null;
  if (!contradiction && seen.some((s) => s.labels.some((l) => (lineKind === 'fam-gp-gone' && !flagsEnd.includes('has_grandparent') && GP_W.test(l)) || (lineKind === 'fam-parent-gone' && PAR_W.test(l)) || (lineKind === 'fam-sib-lost' && !flagsEnd.includes('has_sibling') && SIB_W.test(l))))) contradiction = { text: '카드 선택지 낱말: ' + seen.flatMap((s) => s.labels).join(' ; '), eventId: 'card' };
  const rec = { key, a0, flagsEnd, contradiction: contradiction ? `${contradiction.eventId}: ${contradiction.text.slice(0, 80)}` : null, line: lineRow?.text ?? '(줄 없음)', cards: seen.map((s) => ({ title: s.title, shown: s.shown.join('|'), saved: (s.saved ?? []).join('|'), labels: s.labels, afterReload: s.afterReload })), wordRows: wordRows.map((h) => `${h.age}세 ${h.eventId ?? h.kind}: ${h.text.slice(0, 70)}`), mismatch, errors: errors.length };
  summary.push(rec);
  const famTxt = await page.evaluate(() => [...document.querySelectorAll('[data-testid="family-list"] dt')].map((dt) => dt.textContent.trim() + ' ' + (dt.nextElementSibling?.querySelector('.family-who')?.textContent ?? '')).join(' ; ')).catch(() => '');
  console.log(`\n=== ${key} | 줄: ${rec.line} | 연말 플래그 ${flagsEnd.join(',') || '-'}${rec.contradiction ? ' | ★모순 후보 ' + rec.contradiction : ''}${mismatch ? ' | !!' + mismatch : ''} | errors ${errors.length}`);
  if (process.env.FAMLIST) console.log('  식구 카드: ' + famTxt);
  for (const c of rec.cards) console.log(`  카드 「${c.title}」 화면 ${c.shown} / 저장 ${c.saved} | 선택지 ${c.labels.join(' ; ')}${c.afterReload ? ' | 새로고침 10회 뒤 ' + [...new Set(c.afterReload)].join(' , ') : ''}`);
  for (const r of rec.wordRows) console.log('  [낱말 확인] ' + r);
  await ctx.close();
}
await b.close();
console.log('\n요약: 줄이 난 해 판 ' + summary.length + ', 카드 불일치 ' + summary.filter((s) => s.mismatch).length + ', 낱말 걸린 줄이 있는 판 ' + summary.filter((s) => s.wordRows.length).length + ', ★모순 후보 ' + summary.filter((s) => s.contradiction).length);
