// QA-003 M2 추가 공격 3: 이 기기의 시계·언어가 이상할 때 가상 인구와 첫 화면 (VP1)
import { launch, mkctx, runCase, shot, openTitle, VP, TOUCH, sleep } from './m2r3-lib.mjs';

const browser = await launch();

await runCase({ id: 'M2-A19', cat: '공격', title: '기기 시계가 이상할 때(1970·2000·2035·2100·9999년·시계 역행)·브라우저 언어가 다를 때 가상 인구 (VP1)', steps: '시계를 고정해 첫 화면의 인구 숫자 읽기, 같은 페이지에서 시계를 하루 뒤로 돌렸다가 다시 앞으로 · 언어 en-US·de-DE·ar-EG·ja-JP로 열기', expected: '모든 경우 유한한 숫자(4만~6만 안), 쉼표 천 단위 그대로(언어 무관), 시계를 돌려도 오류·NaN 없음' }, async () => {
  const problems = [];
  const facts = [];
  const shots19 = [];
  const read = async (p) => {
    const line = (await p.getByTestId('population-line').innerText()).replace(/\s+/g, ' ');
    const m = /^([\d,]+)명이/.exec(line);
    return m ? Number(m[1].replace(/,/g, '')) : line;
  };
  for (const [label, iso] of [['1970', '1970-01-01T00:00:00Z'], ['2000', '2000-06-01T00:00:00Z'], ['2026-10', '2026-10-15T00:00:00Z'], ['2035', '2035-01-01T00:00:00Z'], ['2100', '2100-01-01T00:00:00Z'], ['9999', '9999-06-01T00:00:00Z']]) {
    const ctx = await mkctx(browser, { viewport: VP.m360, ...TOUCH });
    const p = await ctx.newPage();
    await p.clock.install({ time: new Date(iso) });
    await openTitle(p);
    const n = await read(p);
    facts.push(`${label}: ${typeof n === 'number' ? n.toLocaleString('en-US') : JSON.stringify(n)}`);
    if (label === '9999') shots19.push(await shot(p, 'A19', 'clock-9999'));
    if (typeof n !== 'number' || !Number.isFinite(n) || n < 40000 || n > 60000) problems.push(`시계 ${label}: 인구 ${JSON.stringify(n)}`);
    await ctx.close();
  }
  // 시계 역행
  {
    const ctx = await mkctx(browser, { viewport: VP.m360, ...TOUCH });
    const p = await ctx.newPage();
    await p.clock.install({ time: new Date('2026-10-15T09:00:00+09:00') });
    await openTitle(p);
    const a = await read(p);
    await p.clock.runFor(3600_000);
    const b = await read(p);
    await p.clock.setSystemTime(new Date('2026-10-14T09:00:00+09:00'));
    await p.clock.runFor(61_000);
    const c = await read(p);
    facts.push(`역행: ${a} → +1h ${b} → 하루 전으로 ${c}`);
    if ([a, b, c].some((x) => typeof x !== 'number' || x < 40000 || x > 60000)) problems.push(`시계 역행 뒤 인구 ${[a, b, c]}`);
    await ctx.close();
  }
  for (const loc of ['en-US', 'de-DE', 'ar-EG', 'ja-JP']) {
    const ctx = await browser.newContext({ viewport: VP.m360, locale: loc });
    const p = await ctx.newPage();
    await openTitle(p);
    const line = (await p.getByTestId('population-line').innerText()).replace(/\s+/g, ' ');
    const ok = /^\d{2},\d{3}명이 이 시뮬레이션 속에서 각자의 삶을 살고 있어요\.$/.test(line);
    facts.push(`${loc}: ${line.slice(0, 12)}…`);
    if (loc === 'ar-EG') shots19.push(await shot(p, 'A19', 'locale-ar-EG'));
    if (!ok) problems.push(`언어 ${loc}: ${line}`);
    await ctx.close();
  }
  return { verdict: problems.length ? 'FAIL' : 'PASS', actual: problems.length ? problems.join(' / ') : facts.join(' | '), shots: shots19 };
});

await browser.close();
