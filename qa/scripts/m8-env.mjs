// QA-003 M8(인생 길이 모드·시간 모델·플레이 시간) 1회차: 출력 위치 기본값. 앱 코드는 건드리지 않는다.
// 이 파일을 먼저 import하면 m7c-lib가 스크린샷 접두사 M8, 결과 폴더 qa/results/m8, 케이스 파일 qa/results/m8/cases.jsonl로 동작한다.
import path from 'node:path';
const ROOT = path.resolve(import.meta.dirname, '..', '..');
process.env.QA_SHOT_PREFIX = process.env.QA_SHOT_PREFIX || 'M8';
process.env.QA_OUT = process.env.QA_OUT || path.join(ROOT, 'qa', 'results', 'm8');
process.env.QA_CASES = process.env.QA_CASES || path.join(process.env.QA_OUT, 'cases.jsonl');
