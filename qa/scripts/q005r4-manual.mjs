// 수동 판정·덮어쓰기 기록(같은 id의 마지막 줄이 이긴다). 사용: node qa/scripts/q005r4-manual.mjs <id> <verdict> <actual...>
import { record } from './q005r4-lib.mjs';
const [id, verdict, ...rest] = process.argv.slice(2);
const spec = JSON.parse(process.env.CASE_JSON || '{}');
record({ id, area: spec.area ?? '수동', title: spec.title ?? id, steps: spec.steps ?? '-', expected: spec.expected ?? '-' }, { verdict, actual: rest.join(' '), ...(spec.shot ? { shot: spec.shot } : {}) });
