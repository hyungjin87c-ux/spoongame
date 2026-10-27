import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { parseStandardIds, parseYearRangeTable, yearRangeJson } from './eventConversionLib';

/**
 * 기존 이벤트 140개 변환 (SPEC-004 MG2, `docs/data/event-conversion.md`): `eras` 태그를 `yearRange`(달력 연도, 닫힌 구간)로 바꾸고 모든 이벤트에 `track`을 단다. `eras` 필드는 지운다.
 * 이벤트 id·선택지 id·본문은 건드리지 않는다(SPEC-003 규칙 23) — 이벤트 객체의 `stages` 줄 바로 뒤에 두 줄을 끼우고 `eras` 줄을 지우는 **줄 단위 편집**이라 나머지 글자는 그대로다.
 * 이미 변환된 파일(eras 없음·`track` 있음)을 다시 돌리면 아무것도 바꾸지 않는다. 실행: `./node_modules/.bin/vite-node scripts/convertEventsMg2.ts`
 */
const DIR = 'src/data/events';
const md = readFileSync('docs/data/event-conversion.md', 'utf-8');
const ranges = new Map(parseYearRangeTable(md).map((r) => [r.id, r]));
const standard = new Set(parseStandardIds(md));
let converted = 0;
let touched = 0;

for (const file of readdirSync(DIR).filter((f) => f.endsWith('.json'))) {
  const lines = readFileSync(`${DIR}/${file}`, 'utf-8').replace(/\r\n/g, '\n').split('\n');
  const out: string[] = [];
  let id: string | null = null;
  let hasTrack = false;
  // 이벤트 객체 단위로 줄을 모은다: 이벤트 시작(`    {`) ~ 끝(`    }`)
  let i = 0;
  while (i < lines.length) {
    if (lines[i] === '    {') {
      let j = i;
      while (lines[j] !== '    },' && lines[j] !== '    }') j++;
      const block = lines.slice(i, j + 1);
      id = null;
      for (const l of block) {
        const m = /^      "id": "([^"]+)",?$/.exec(l);
        if (m !== null) {
          id = m[1];
          break;
        }
      }
      if (id === null) throw new Error(`${file}: 이벤트 id를 찾지 못했다 (줄 ${i + 1})`);
      hasTrack = block.some((l) => /^      "track": /.test(l));
      const hadEras = block.some((l) => /^      "eras": /.test(l));
      if (!hasTrack) {
        const row = ranges.get(id);
        if (hadEras !== (row !== undefined)) throw new Error(`${file} ${id}: eras ${hadEras ? '있음' : '없음'} ↔ 변환표 ${row !== undefined ? '있음' : '없음'}이 어긋난다`);
        const next: string[] = [];
        for (const l of block) {
          if (/^      "eras": /.test(l)) continue;
          next.push(l);
          if (/^      "stages": /.test(l)) {
            if (row !== undefined) next.push(`      "yearRange": ${yearRangeJson(row)},`);
            next.push(`      "track": "${standard.has(id) ? 'standard' : 'common'}",`);
          }
        }
        out.push(...next);
        converted++;
      } else out.push(...block);
      touched++;
      i = j + 1;
    } else {
      out.push(lines[i]);
      i++;
    }
  }
  writeFileSync(`${DIR}/${file}`, out.join('\n'), 'utf-8');
}
console.log(`이벤트 ${touched}개 확인, ${converted}개 변환 (yearRange 표 ${ranges.size}줄, standard ${standard.size}개)`);
