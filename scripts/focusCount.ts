import '../src/data/installAll';
import { EVENT_POOL } from '../src/data/events';
import { FOCUS_MIN_EVENTS, FOCUS_SECTIONS, FOCUS_TOPICS } from '../src/data/focusTable';
import { focusChoicesOf, focusSectionRange, focusTaggable, focusTopicCounts, type FocusSection } from '../src/core';

/**
 * 구간 × 주제의 실제 사건 수 (SPEC-018 PL10, 설계 1-5절 「확정 수는 스크립트로 다시 센다」): 풀의 표지 대상 사건 가운데 그 구간·출생 연도에 나올 수 있는 사건을 주제별로 센다
 * (주·보조 합 / 주로만). 구간 시작 나이 13·20·40·65, 목록 기준 `FOCUS_MIN_EVENTS`개 이상. 출생 연도는 대표 연도 몇 개로 보인다(사건의 `yearRange`가 시대마다 달라서).
 * 실행: npm exec -- vite-node scripts/focusCount.ts [-- 1950 1975 1990 2010]
 */
const years = process.argv.slice(2).map(Number).filter((y) => Number.isInteger(y));
const BIRTH_YEARS = years.length > 0 ? years : [1945, 1965, 1985, 1995, 2005, 2015];
const LABEL = ['13~19', '20~39', '40~64', '65+'];

console.log(`# 구간 × 주제 사건 수 — 표지 대상 ${EVENT_POOL.events.filter(focusTaggable).length}개 · 목록 기준 ${FOCUS_MIN_EVENTS}개 이상\n`);
for (const by of BIRTH_YEARS) {
  console.log(`## 출생 ${by}년\n`);
  console.log(`| 구간 | ${FOCUS_TOPICS.map((t) => t).join(' | ')} | 보이는 초점 |`);
  console.log(`|---|${FOCUS_TOPICS.map(() => '---:').join('|')}|---|`);
  for (const s of [0, 1, 2, 3] as FocusSection[]) {
    const c = focusTopicCounts(by, s);
    const [a, b] = focusSectionRange(s);
    console.log(`| ${LABEL[s]} (${a}~${b}) | ${c.all.map((n, i) => `${n} / ${c.primary[i]}`).join(' | ')} | ${focusChoicesOf(by, s).map((i) => FOCUS_TOPICS[i]).join('·') || '(없음)'} |`);
  }
  console.log('');
}
console.log(`(구간 시작 나이: ${FOCUS_SECTIONS.join('·')}. 칸 = 주·보조 합 / 주로만)`);
