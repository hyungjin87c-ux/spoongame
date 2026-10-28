/** 시대의 창 r3 — 장면 모음: 1970~80년대 12장(일상 6 + 사건 3 + 무거운 3) + 다른 시대 샘플 3(1950 피란 · 1995 삼풍 · 1998 금 모으기) + 1987 둘째 그림(alt) */
import { HEAVY } from './eraR3ScenesHeavy.mjs';
import { DAILY } from './eraR3ScenesDaily.mjs';
import { EVENTS } from './eraR3ScenesEvents.mjs';
const by = (a, b) => a.year - b.year || (a.alt ? 1 : 0) - (b.alt ? 1 : 0);
export const SCENES = [...HEAVY, ...DAILY, ...EVENTS].sort(by);
export const MAIN = SCENES.filter((q) => !q.alt);
export const ALT = SCENES.filter((q) => q.alt);
export const SET_7080 = MAIN.filter((q) => q.year >= 1970 && q.year < 1990);
export const SAMPLES = MAIN.filter((q) => q.year < 1970 || q.year >= 1990);
