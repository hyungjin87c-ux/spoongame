// 수작업(셸) 실행 결과를 결과 파일에 등록: node add-case.mjs <group> '<json>'
import fs from 'node:fs';
import { resultFile } from './lib.mjs';
const [group, json] = process.argv.slice(2);
const rec = JSON.parse(json);
rec.console = rec.console || [];
rec.at = new Date().toISOString();
fs.appendFileSync(resultFile(group), JSON.stringify(rec) + '\n');
console.log('added', rec.id);
