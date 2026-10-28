/** 시대의 창 r5 — 장면 모음: 1990년대 12 · 2000년대 13 · 2010년대 13 · 2020년대 11 = 49장(사건 29 · 일상 12 · 계층 변주 8). 승인된 r3 1995·1998은 참고로만 */
let S90 = [], S00 = [], S10 = [], S20 = [];
const load = async (file) => { try { return await import(file); } catch (e) { if (e.code !== 'ERR_MODULE_NOT_FOUND') throw e; return {}; } };
({ S90 = [] } = await load('./eraR5Scenes90.mjs'));
({ S00 = [] } = await load('./eraR5Scenes00.mjs'));
({ S10 = [] } = await load('./eraR5Scenes10.mjs'));
({ S20 = [] } = await load('./eraR5Scenes20.mjs'));
const bandRank = (q) => (q.band === 'low' ? 1 : q.band === 'high' ? 2 : 0);
const by = (a, b) => a.year - b.year || bandRank(a) - bandRank(b) || (a.alt ? 1 : 0) - (b.alt ? 1 : 0);
export const SCENES = [...S90, ...S00, ...S10, ...S20].sort(by);
export const SET90 = SCENES.filter((q) => q.year < 2000);
export const SET00 = SCENES.filter((q) => q.year >= 2000 && q.year < 2010);
export const SET10 = SCENES.filter((q) => q.year >= 2010 && q.year < 2020);
export const SET20 = SCENES.filter((q) => q.year >= 2020);
export const VARIANTS = SCENES.filter((q) => q.band);
export const HEAVY = SCENES.filter((q) => q.heavy);
export const DAILY = SCENES.filter((q) => q.kind === 'daily' && !q.band);
