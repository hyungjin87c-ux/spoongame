// QA 도구 점검: 줄바꿈 감사기(m4-audit-sep.mjs의 SEP_AUDIT)가 합성 DOM에서 줄 끝 「·」·숫자/단위 갈라짐을 실제로 잡는지.
import fs from 'node:fs';
import path from 'node:path';
import { launch, OUT } from './m4-lib.mjs';

const src = fs.readFileSync(path.join(import.meta.dirname, 'm4-audit-sep.mjs'), 'utf8');
const a = src.indexOf('const SEP_AUDIT = () => {');
const b = src.indexOf('const browser = await launch();');
const fnSrc = src.slice(a, b).replace('const SEP_AUDIT =', 'globalThis.__SEP =');
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 400, height: 300 } });
await page.setContent(`<body style="font:16px sans-serif;margin:0">
<div id="a" style="width:84px;word-break:keep-all">가나다라 · 마바사아</div>
<div id="b" style="width:60px;word-break:break-all">총 12345 명입니다</div>
<div id="c" style="width:300px">줄이 바뀌지 않는 문장 · 입니다 12,345명</div>
</body>`);
await page.evaluate(fnSrc);
const r = await page.evaluate(() => globalThis.__SEP());
console.log(JSON.stringify(r, null, 1));
const kinds = r.issues.map((i) => i.kind);
const okSep = kinds.includes('줄끝 기호') || kinds.includes('줄머리 기호');
const okUnit = kinds.includes('숫자·단위 갈라짐');
console.log(okSep && okUnit ? 'SELFTEST PASS (줄 끝/머리 기호·숫자 단위 갈라짐 모두 잡음)' : `SELFTEST FAIL sep=${okSep} unit=${okUnit}`);
fs.writeFileSync(path.join(OUT, 'sep-selftest.json'), JSON.stringify({ okSep, okUnit, issues: r.issues }));
await browser.close();
