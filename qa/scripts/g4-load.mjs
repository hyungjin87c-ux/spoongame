import { open, go, sleep, rec, VP } from './g4-lib.mjs';
import { chromium } from 'playwright-core';
const U = 'http://localhost:4377/';
// 1. 초기 로드 바이트·글꼴 요청 (1280, 캐시 없음) — 새 컨텍스트
{
  const browser = await chromium.launch(); const ctx = await browser.newContext({ ...VP.d1280 }); const page = await ctx.newPage();
  const resp = [];
  page.on('requestfinished', async (r) => { try { const s = await r.sizes(); resp.push({ url: r.url().replace(U, '/'), type: r.resourceType(), bytes: s.responseBodySize + s.responseHeadersSize, body: s.responseBodySize }); } catch {} });
  await page.goto(U, { waitUntil: 'networkidle' }); await sleep(2500);
  const total = resp.reduce((a, r) => a + r.body, 0); const fonts = resp.filter((r) => /font|\.woff2?/.test(r.type + r.url));
  console.log(resp.map((r) => `${r.type} ${r.body} ${r.url}`).join('\n'));
  rec('P01', '첫 화면 로드(캐시 없음, networkidle+2.5초) 합계', '≤ 400,000 B', `본문 합계 ${total} B (헤더 제외), 요청 ${resp.length}개`, total <= 400000 ? 'PASS' : 'FAIL');
  rec('P02', '첫 화면 글꼴 요청', 's0 400·700 둘뿐', JSON.stringify(fonts.map((f) => f.url + ' ' + f.body)), fonts.length === 2 && fonts.every((f) => /s0-/.test(f.url)) ? 'PASS' : 'FAIL');
  const ext = resp.filter((r) => !r.url.startsWith('/')); rec('P03', '외부 도메인 요청', '0', JSON.stringify(ext), ext.length === 0 ? 'PASS' : 'FAIL');
  await browser.close();
}
