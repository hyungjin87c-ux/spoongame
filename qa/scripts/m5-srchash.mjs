// src/ 전체(경로+내용)의 sha256과 파일 수. 시작과 끝에 같은 값이면 QA가 코드를 안 건드렸다는 근거.
import path from 'node:path';
import { hashFiles, ROOT } from './m5-lib.mjs';
const r = await hashFiles(path.join(ROOT, 'src'));
console.log(`src sha256 ${r.sha.slice(0, 16)} (files ${r.count})`);
