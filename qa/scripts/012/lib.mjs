// SPEC-012 v0.4.1 QA 공용 도구 (저장소 루트에서 `node qa/scripts/012/<파일>`, QA_BASE=개발 서버 주소)
export * from '../010/lib.mjs';
import { evalCore } from '../010/lib.mjs';
export { evalCore };
export const SHOT = 'qa/screenshots/SPEC-012';
