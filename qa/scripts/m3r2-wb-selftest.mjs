// 낱말 끊김 측정기(m3r2-wb.mjs) 자체 시험: 합성 DOM으로 「잡아야 할 것은 잡고, 잡으면 안 되는 것은 안 잡는지」 확인(1회차 측정 결함 12번의 재발 방지).
// 사용: node qa/scripts/m3r2-wb-selftest.mjs
import fs from 'node:fs';
import path from 'node:path';
import { launch, OUT } from './m3r2-lib.mjs';
import { WB_AUDIT } from './m3r2-wb.mjs';

const browser = await launch();
const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
const FONT = 'font: 16px/1.4 "Malgun Gothic","Noto Sans CJK KR",sans-serif;';

const CASES = [
  {
    id: 'S1 반쪽 칸에서 끊긴 짧은 낱말 = broken',
    html: `<dl style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;width:150px;margin:0;${FONT}"><div><dt>어머니</dt><dd style="margin:0">단순노무직</dd></div><div><dt>아버지</dt><dd style="margin:0">서비스직</dd></div></dl>`,
    expect: { broken: ['단순노무직'], unavoidable: [], intended: [] },
  },
  {
    id: 'S2 낱말 사이 줄바꿈은 세지 않는다(공백으로 이은 두 span)',
    html: `<p style="width:90px;margin:0;${FONT}"><span>서울특별시</span> <span>종로구</span></p>`,
    expect: { broken: [], unavoidable: [], intended: [] },
  },
  {
    id: 'S3 구두점 뒤 줄바꿈은 낱말 끊김이 아니다',
    html: `<p style="width:95px;margin:0;${FONT}">서울특별시(종로구)</p>`,
    expect: { broken: [], unavoidable: [], intended: [] },
  },
  {
    id: 'S4 <wbr> 지점 끊김 = intended',
    html: `<p style="width:100px;margin:0;${FONT}">다이아몬드<wbr>수저</p>`,
    expect: { broken: [], unavoidable: [], intended: ['다이아몬드수저'] },
  },
  {
    id: 'S5 허용 목록에 없는 낱말의 <wbr> 끊김 = broken',
    html: `<p style="width:120px;margin:0;${FONT}">가나다 서울특별<wbr>시청</p>`,
    expect: { broken: ['서울특별시청'], unavoidable: [], intended: [] },
  },
  {
    id: 'S6 한 줄 전체보다 긴 낱말 = unavoidable',
    html: `<p style="width:60px;margin:0;${FONT}">전남광주통합특별시</p>`,
    expect: { broken: [], unavoidable: ['전남광주통합특별시'], intended: [] },
  },
  {
    id: 'S7 <br>로 나눈 두 줄은 끊긴 낱말이 아니다',
    html: `<p style="width:300px;margin:0;${FONT}">다이아몬드<br>수저</p>`,
    expect: { broken: [], unavoidable: [], intended: [] },
  },
  {
    id: 'S8 요소 경계를 넘어 이어 붙은 글자는 한 낱말(한 줄보다 길면 unavoidable 하나로 센다)',
    html: `<p style="width:100px;margin:0;${FONT}">단순<b>노무</b>직입니다</p>`,
    expect: { broken: [], unavoidable: ['단순노무직입니다'], intended: [] },
  },
  {
    id: 'S9 가로 flex 행의 칩(inline-flex): 칩 폭이 아니라 행 전체 폭으로 잰다 — 행보다 짧은 낱말이 칩 안에서 끊기면 broken',
    html: `<ul style="margin:0;padding:0;list-style:none;width:220px"><li style="display:flex;flex-wrap:wrap;gap:4px;${FONT}"><span style="flex:1 1 4rem;min-width:0">이름</span><span style="display:inline-flex;flex:none;width:50px;border:1px solid"><svg width="10" height="10"></svg><span>다이아몬드수저</span></span></li></ul>`,
    expect: { broken: ['다이아몬드수저'], unavoidable: [], intended: [] },
  },
  {
    id: 'S10 보이지 않는 글자(sr-only·display:none)는 세지 않는다',
    html: `<p style="width:40px;margin:0;${FONT}">짧음<span style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)">보이지않는긴낱말입니다</span><span style="display:none">감춘긴낱말입니다</span></p>`,
    expect: { broken: [], unavoidable: [], intended: [] },
  },
  {
    id: 'S11 잘려 나간 칸(overflow:hidden 창 밖)은 세지 않는다',
    html: `<div style="width:60px;height:20px;overflow:hidden;${FONT}"><div><div style="height:20px">보임</div><div style="height:20px;width:30px">창밖에있는긴낱말</div></div></div>`,
    expect: { broken: [], unavoidable: [], intended: [] },
  },
  {
    id: 'S12 숫자 사이의 .는 낱말 안(한 낱말 「12345.6789」로 센다)',
    html: `<p style="width:30px;margin:0;${FONT}">12345.6789</p>`,
    expect: { broken: [], unavoidable: ['12345.6789'], intended: [] },
  },
];

const rows = [];
let bad = 0;
for (const c of CASES) {
  await page.setContent(`<!doctype html><meta charset="utf-8"><body style="margin:8px;${FONT}">${c.html}</body>`);
  await page.addStyleTag({ content: `* { word-break: keep-all; overflow-wrap: anywhere; }` });
  const r = await page.evaluate(WB_AUDIT, { intended: ['다이아몬드수저'] });
  const got = { broken: r.broken.map((x) => x.word), unavoidable: r.unavoidable.map((x) => x.word), intended: r.intended.map((x) => x.word) };
  let ok;
  if (c.expect.brokenAny) ok = got.broken.length + got.unavoidable.length > 0;
  else ok = JSON.stringify(got) === JSON.stringify(c.expect);
  if (!ok) bad++;
  rows.push({ id: c.id, ok, expect: c.expect, got, words: r.wordsN });
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${c.id} → ${JSON.stringify(got)} (낱말 ${r.wordsN})`);
}
fs.writeFileSync(path.join(OUT, 'wb-selftest.json'), JSON.stringify({ bad, rows }, null, 1));
console.log(`자체 시험: ${rows.length - bad}/${rows.length} 통과`);
await browser.close();
process.exit(bad ? 1 : 0);
