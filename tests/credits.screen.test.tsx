import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { eventPool, heavyEvents, playToEnd, type EndingGame, type EraWindow, type HistoryEntry, type ProfileId } from '../src/core';
import { CreditsScreen } from '../src/credits/CreditsScreen';
import { isCreditsDecision } from '../src/credits/allowlist';
import { creditsDecadesOf } from '../src/credits/loader';
import { CREDITS_TEXT } from '../src/credits/text';
import { loadEraDecade } from '../src/data/familyArtLoader';
import { CREDITS_ENTRY_TEXT } from '../src/data/endingText';
import { VEIL_TEXT } from '../src/data/gentleText';
import { TITLE_TEXT } from '../src/data/titleText';
import { EndingScreen } from '../src/screens/EndingScreen';
import { chooserFor, startLife } from '../scripts/simulateLib';

/**
 * 「이 삶의 이름들」 화면 마크업(서버 렌더 — vitest는 node 환경이라 jsdom이 없다): 진입부의 자리·구조, 열린 화면의 구조·접근성·가림, 고정 문구가 copy.md 22절과 같은지 (SPEC-022 EC1 · 완료 기준 12·17·18).
 * 펼침·초점·Escape·재렌더·오류 경계·자동 이동은 e2e/ending-credits.spec.ts가 본다.
 */

const fsSpec = 'node:fs';
const fs = (await import(/* @vite-ignore */ fsSpec)) as { readFileSync(path: URL, encoding: 'utf-8'): string };
const read = (p: string): string => fs.readFileSync(new URL(p, import.meta.url), 'utf-8');

const endedOf = (seed: number, era: ProfileId): EndingGame => playToEnd(startLife(seed, era), chooserFor('random', seed)).state as EndingGame;
const textOf = (html: string): string => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const ref = { current: null } as { current: (() => void) | null };

async function windowsOf(g: EndingGame): Promise<EraWindow[]> {
  const parts = await Promise.all(creditsDecadesOf(g.character.birthYear, g.death.age, g.birthReport !== null).map(loadEraDecade));
  return parts.flatMap((p) => [...p.windows]);
}
const renderCredits = (game: EndingGame, windows: readonly EraWindow[], gentle = false): string => renderToStaticMarkup(<CreditsScreen game={game} gentle={gentle} windows={windows} onClosed={() => {}} closeRef={ref} />);

describe('진입부 (완료 기준 12)', () => {
  const game = endedOf(2024, 'alpha');
  const html = renderToStaticMarkup(<EndingScreen game={game} onRebirth={() => {}} />);

  it('사망·선택 카드 바로 아래, 최종 스탯 위에 제목 → 설명 → 버튼 순서로 있다', () => {
    const marks = ['data-testid="ending-death"', 'data-testid="ending-choices"', 'aria-labelledby="ending-names-title"', 'class="ending__names-title"', CREDITS_ENTRY_TEXT.note, 'data-testid="ending-credits-open"', 'data-testid="ending-stats"'];
    const at = marks.map((m) => html.indexOf(m));
    for (let i = 0; i < marks.length; i++) expect(at[i], marks[i]).toBeGreaterThan(-1);
    expect(at).toEqual([...at].sort((a, b) => a - b));
    expect(textOf(html.match(/<h2[^>]*class="ending__names-title"[^>]*>([^]*?)<\/h2>/)![1])).toBe('이 삶의 이름들');
  });

  it('버튼은 하나뿐이고 GuardedButton(첫 렌더 aria-disabled)이며, 보이는 글자가 접근성 이름이다(자리잡이 글자는 aria-hidden)', () => {
    expect((html.match(/data-testid="ending-credits-open"/g) ?? []).length).toBe(1);
    const button = html.match(/<button[^>]*data-testid="ending-credits-open"[^>]*>[^]*?<\/button>/)![0];
    expect(button).toContain('aria-disabled="true"'); // 화면 전환 직후 입력 가드
    expect(button).not.toContain('aria-busy');
    expect(button).toMatch(/<span aria-hidden="true">이 삶의 이름들 보기<\/span><span>이 삶의 이름들 보기<\/span>/);
  });

  it('누르기 전에는 크레딧이 시작하지 않는다 — 열린 화면·오류 문구·크레딧 덩어리 표지가 없고 회고 본문은 hidden이 아니다', () => {
    expect(html).not.toContain('data-testid="credits-screen"');
    expect(html).not.toContain(CREDITS_ENTRY_TEXT.fail);
    expect(html).not.toContain(CREDITS_TEXT.familyTitle);
    expect(html).toMatch(/<main class="ending">/);
    expect(html).toContain(`<span class="site-head__name">엔딩</span>`);
  });

  it('진입부는 조작 요소가 버튼 하나뿐이다(제목·설명은 조작이 아니다) — 같은 구역 안 버튼 1', () => {
    const section = html.match(/<section class="ending__names"[^]*?<\/section>/)![0];
    expect((section.match(/<button/g) ?? []).length).toBe(1);
    expect(section).not.toMatch(/<a[\s>]/);
  });
});

describe('열린 화면 (완료 기준 17·22)', () => {
  const game = endedOf(2, 'millennial');
  it('한 개의 안정된 문서: h1 하나(이름) · 장 제목 h2 · 줄마다 aria-live 없음 · 시각용 복제 글 없음 · 수저 장면·등급명 없음 · 오류 경계 화면 없음', async () => {
    const windows = await windowsOf(game);
    const html = renderCredits(game, windows);
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html).toMatch(new RegExp(`<h1[^>]*tabindex="-1"[^>]*data-testid="credits-name"[^>]*>${game.character.name}</h1>`));
    const h2 = [...html.matchAll(/<h2[^>]*>([^]*?)<\/h2>/g)].map((m) => textOf(m[1]));
    expect(h2.at(-1)).toBe('생애 기록');
    expect(new Set(h2).size).toBe(h2.length); // 같은 제목이 두 번 나오지 않는다
    expect(html).not.toMatch(/aria-live|role="alert"|role="status"/);
    expect(html).not.toContain('credits-spoon');
    expect(html).not.toContain('data-testid="credits-fail"');
    expect(textOf(html)).not.toMatch(/(흙|동|은|금|다이아)\s*수저|다이아/);
    expect(html).toContain('data-testid="credits-screen"');
    // 끝 장에 주 단추와 보조 「처음부터 보기」가 문서 흐름 안에 있다
    const end = html.match(/<section class="credits-end"[^]*?<\/section>/)![0];
    expect(textOf(end.match(/data-testid="credits-end-close"[^>]*>([^<]*)</)![1])).toBe('기록으로 돌아가기');
    expect(textOf(end.match(/data-testid="credits-end-restart"[^>]*>([^<]*)</)![1])).toBe('처음부터 보기');
    expect(html).toContain('class="credits-end-space" aria-hidden="true"');
  });

  it('조작 띠가 문서 앞(DOM 첫 자리)에 있고 닫기가 맨 끝이다. 자동 흐름 여부는 진입 뒤에 정해지므로 첫 렌더에는 흐름 단추가 없다', async () => {
    const html = renderCredits(game, await windowsOf(game));
    expect(html.indexOf('credits-bar')).toBeLessThan(html.indexOf('credits-frame'));
    const bar = html.match(/<div class="credits-bar"[^]*?<div class="credits-frame"/)![0];
    expect(bar).not.toContain('data-testid="credits-toggle"');
    expect(bar.indexOf('data-testid="credits-restart"')).toBeLessThan(bar.indexOf('data-testid="credits-close"'));
  });

  it('가림: 닫힌 heavy 선택의 제목·질문·고른 길·결과가 마크업에 없고(VeiledText·hidden 원문 없음), 단추 이름에는 나이·분류만 있다', async () => {
    const heavy = [...heavyEvents()].find(([id]) => isCreditsDecision(id));
    expect(heavy).toBeDefined();
    const [id] = heavy!;
    const stages = eventPool().byId.get(id)!.stages;
    const age = stages.includes('senior') ? 70 : stages.includes('middle') ? 50 : 30;
    const entry: HistoryEntry = { age, kind: 'choice', eventId: id, title: '가려질제목', question: '가려질질문?', choice: '가려질선택', text: '가려질결과문장입니다.' };
    const g = { ...game, history: [entry], death: { age: 80, cause: '노환' } } as EndingGame;
    const html = renderCredits(g, [], true);
    expect(html).not.toMatch(/가려질/);
    expect(html).not.toMatch(/veil__|data-testid="veil-body"/);
    expect(html).toContain('data-veiled="true"');
    expect(html).toContain(`${VEIL_TEXT.rowLead}`);
    const btn = html.match(/<button[^>]*data-testid="credits-veil-btn"[^>]*>/)![0];
    expect(btn).toContain('aria-expanded="false"');
    expect(btn).not.toContain('aria-controls');
    expect(btn).toMatch(/aria-label="펼쳐 보기 \d+세 [^"]+"/);
    expect(btn).not.toMatch(/title=/);
    // 가림을 끄면 같은 기록이 원문으로 나온다
    expect(renderCredits(g, [], false)).toContain('가려질결과문장입니다.');
  });
});

describe('고정 문구가 docs/design/copy.md 22절과 같다 (완료 기준 18 — 문서 대조)', () => {
  const doc = read('../docs/design/copy.md');
  const section = doc.slice(doc.indexOf('## 22. SPEC-022'), doc.indexOf('## 23. SPEC-018'));
  const quoted = new Set([...section.matchAll(/「([^」]+)」/g)].map((m) => m[1]));
  const inSection = (text: string): boolean => [...quoted].some((q) => q === text || q.includes(text));

  it('진입부·머리 띠·오류 문구·장 제목·줄 라벨·단추 글자가 22절의 글자와 같다', () => {
    expect(section.length).toBeGreaterThan(2000);
    for (const text of Object.values(CREDITS_ENTRY_TEXT)) expect(inSection(text), `copy.md 22절에 「${text}」`).toBe(true);
    for (const text of Object.values(CREDITS_TEXT)) expect(inSection(text), `copy.md 22절에 「${text}」`).toBe(true);
    expect(CREDITS_ENTRY_TEXT.title).toBe('이 삶의 이름들');
    expect(CREDITS_ENTRY_TEXT.headName).toBe('이름과 시간');
    expect(TITLE_TEXT.loading).toBe('불러오는 중'); // 받는 중·다시 시도는 첫 화면과 같은 기존 글자
    expect(TITLE_TEXT.loadRetry).toBe('다시 시도');
  });

  it('쓰지 않는 말(22-6)이 코드·화면 문구 상수에 없다: 「회고」·평가어·수저 이름·느낌표', () => {
    const all = [...Object.values(CREDITS_ENTRY_TEXT), ...Object.values(CREDITS_TEXT)].join('\n');
    expect(all).not.toMatch(/회고|성공|실패|역전|몰락|잘 살았|수고하셨|안타깝게도|못다 한|피우지 못한|건너뛰기|멈추기|일시 정지|처음으로|[!！…]|\p{Extended_Pictographic}/u);
    expect(all).not.toMatch(/수저/);
  });
});
