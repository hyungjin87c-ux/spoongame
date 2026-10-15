// 지난 M3 QA 스크립트(a-*.mjs)를 최종 QA용으로 옮겨 쓰기 위한 호환 층: f-lib와 같은 이름 + 옛 runCase(group, c, fn) 시그니처
import { runCase as _run, FIN } from './f-lib.mjs';
export * from './f-lib.mjs';
export const RES_DIR = FIN;
export const SCREEN_IDS = ['title-screen', 'era-screen', 'birth-screen', 'life-screen', 'ending-screen', 'superseded-screen', 'error-screen'];
export async function runCase(group, c, fn) {
  return _run({ ...c, ts: c.ts ?? !!c.timescale, group }, fn);
}
