import { writeFileSync } from 'node:fs';
import { buildBirthYearData, renderBirthYearData } from './birthYearDataLib';

/** `src/data/birthYearData.json`을 DC2·DC7 자료에서 다시 만든다 (생성기 본체는 birthYearDataLib.ts). 실행: `./node_modules/.bin/vite-node scripts/genBirthYearData.ts` */
const data = buildBirthYearData();
writeFileSync('src/data/birthYearData.json', renderBirthYearData(data), 'utf-8');
console.log(`src/data/birthYearData.json: 출생아 수 ${Object.keys(data.births).length}해 · 시·도 비율 ${Object.keys(data.regions).length}해`);
