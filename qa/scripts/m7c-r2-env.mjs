// QA-003 M7c 2회차: 1회차 스크립트·2회차 스크립트가 출력을 1회차 결과 위에 덮지 않도록 환경 기본값을 r2로 둔다.
// 사용: node --import ./qa/scripts/m7c-r2-env.mjs qa/scripts/m7c-attack.mjs   (또는 m7c-r2-*.mjs가 이 파일을 먼저 import)
import path from 'node:path';
const ROOT = path.resolve(import.meta.dirname, '..', '..');
process.env.QA_SHOT_PREFIX = process.env.QA_SHOT_PREFIX || 'M7c-r2';
process.env.QA_OUT = process.env.QA_OUT || path.join(ROOT, 'qa', 'results', 'm7c', 'r2');
process.env.QA_CASES = process.env.QA_CASES || path.join(process.env.QA_OUT, 'cases.jsonl');
