/** 시대의 창 r4 — 장면 모음: 1940년대 6 · 1950년대 7 · 1960년대 10 · 1970~80년대 계층 변주 4 = 27장 (+ 승인된 r3 1950 피란은 참고로만) */
import { S40 } from './eraR4Scenes40.mjs';
let S50 = [], S60 = [], BAND = [];
try { ({ S50 } = await import('./eraR4Scenes50.mjs')); } catch (e) { if (e.code !== 'ERR_MODULE_NOT_FOUND') throw e; }
try { ({ S60 } = await import('./eraR4Scenes60.mjs')); } catch (e) { if (e.code !== 'ERR_MODULE_NOT_FOUND') throw e; }
try { ({ BAND } = await import('./eraR4ScenesBand.mjs')); } catch (e) { if (e.code !== 'ERR_MODULE_NOT_FOUND') throw e; }
const by = (a, b) => a.year - b.year || (a.band === 'high' ? 1 : 0) - (b.band === 'high' ? 1 : 0);
export const SCENES = [...S40, ...S50, ...S60, ...BAND].sort(by);
export const SET40 = SCENES.filter((q) => q.year < 1950);
export const SET50 = SCENES.filter((q) => q.year >= 1950 && q.year < 1960);
export const SET60 = SCENES.filter((q) => q.year >= 1960 && q.year < 1970);
export const VARIANTS = SCENES.filter((q) => q.band);
export const HEAVY = SCENES.filter((q) => q.heavy);
