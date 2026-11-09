/**
 * SPEC-013 T5 r11 — 라이브러리 덧붙임 (designer 2026-11-09). r5b 라이브러리에 **새 토큰 둘**을 더한다(마스터 승인 2026-11-08: 「빨강·금 토큰 두 개」 — 2002 붉은 티셔츠·1998 금반지를 실물처럼 선명하게, 독일 국기·오륜·마스코트에도 쓴다).
 *   red  : 라이트 #c6302b (응원 티셔츠·국기 빨강·오륜 빨강) — 제안 다크 #e2574d
 *   gold : 라이트 #d9a62e (금반지·금띠·국기 금·오륜 노랑·호돌이 몸) — 제안 다크 #e6b63c
 * developer 인계: `src/styles/tokens.css`에 `--c-scene-red`·`--c-scene-gold`(라이트·다크·강제 색상)를 더하고 `tests`의 토큰 수(24 → 26)를 맞춘다. 조각 SVG는 fallback 값을 품고 있어 토큰이 없어도 라이트 색으로 보인다.
 * LIGHT 객체를 불러오는 즉시 고치므로(모듈 평가 순서) 장면 파일은 반드시 이 파일을 먼저 import 한다.
 */
import { LIGHT } from './eraR5bLib.mjs';
export * from './eraR5bLib.mjs';
export const NEW_TOKENS = { red: '#c6302b', gold: '#d9a62e' };
export const NEW_TOKENS_DARK = { red: '#e2574d', gold: '#e6b63c' };
for (const [k, v] of Object.entries(NEW_TOKENS)) if (!(k in LIGHT)) LIGHT[k] = v;
export const TOKEN_COUNT = Object.keys(LIGHT).length;
