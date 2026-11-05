import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createInitialState, generateBirthFromSeed, type GameState } from '../src/core';
import { ERA_LAST_YEAR, isForecastYear, type EraForesight, type EraRow, type EraWindow } from '../src/core/eraWindow';
import { sceneInputOf } from '../src/core/scene';
import { loadFamilyArt } from '../src/data/familyArtLoader';
import type { FamilyArt } from '../src/data/sceneTables';
import { SPRITE_SVG } from '../src/ui/brandAssets';
import { EraLogRow } from '../src/ui/dash/EraRow';
import { SceneCard } from '../src/ui/scene/SceneCard';
import { mergeEraData, type SceneArt } from '../src/ui/scene/useFamilyArt';
import { ERA_DECADE as D2020 } from '../src/data/eraWindows/d2020';
import { ERA_DECADE as D2030 } from '../src/data/eraWindows/d2030';
import { ERA_DECADE as D2010 } from '../src/data/eraWindows/d2010';

/**
 * SPEC-010 FU3 「예측」 칩 · 미래 톤 · FU11 예측 근거 보기 — 화면 시험 (서버 렌더 + CSS 원문). 실제 폭·접기 동작·가로 넘침·강제 색상은 `e2e/era-chip.spec.ts`가 본다.
 *  - 인생 기록의 시대 줄(`EraLogRow`): 2027년부터 칩(색·글자·아이콘 세 겹)과 근거 종류 글자, 2026년 줄과 끝 줄에는 없다. 칩은 해로 정한다.
 *  - 시대의 창 칸(`SceneCard`): 2027년부터 작은 「예측」 표(안 B)와 `data-future`, 접근 이름 「예측: …」. 2026년 이하는 그대로. `data-dec`은 그해의 10년대(2026년 뒤를 모두 2020년대로 두던 것을 고쳤다).
 *  - R-601: 2111년부터 줄이 없는 창은 링크가 아니라 그림만이다.
 */

const art: FamilyArt = await loadFamilyArt();
const noop = () => undefined;
const scene = (era: SceneArt['era']): SceneArt => ({ art, status: 'ready', retry: noop, era });
const html = (g: GameState, era: SceneArt['era'], gentle = false): string =>
  renderToStaticMarkup(<SceneCard game={g} gentle={gentle} fold={false} onFold={noop} scene={scene(era)} animate={false} />);

/** 달력 연도가 `calYear`, 나이가 `age`인 알파 판 (출생 연도를 맞춰 쓴다) */
function lifeAt(calYear: number, age: number, seed = 5): GameState {
  const b = generateBirthFromSeed(seed, 'alpha');
  const base = { ...createInitialState(seed), phase: 'life', generation: 'alpha', character: { ...b.character, birthYear: calYear - age }, birthReport: b.report, peerSeed: b.peerSeed, family: b.family } as GameState;
  return { ...base, age, assets: age >= 20 ? { net: 0, income: 0, debt: 0, incomeAdj: 0, dwelling: 'family' } : null } as GameState;
}
const EARLY = mergeEraData([D2010, D2020, D2030]);

const row = (over: Partial<EraRow> = {}): EraRow => ({ age: 14, year: 2030, line: '시험 한 줄입니다.', heavy: false, veiled: false, forecast: true, basis: 'scenario', ...over });
const rowHtml = (r: EraRow, open = false): string => renderToStaticMarkup(<EraLogRow row={r} open={open} onToggle={noop} />);
const FORESIGHT: EraForesight = {
  notes: [
    { who: '가나다', role: '교수', work: '논문 「시험」', year: 2024, said: '내다봤습니다.', gap: '발언은 2029년, 게임은 2030년입니다.' },
    { who: '라마바', role: '기관', work: '보도', year: 2025, said: '분석했습니다.', reported: true, counter: true },
  ],
  byBand: true,
};

describe('인생 기록 줄의 「예측」 칩 (FU3)', () => {
  it('2027년부터의 줄(forecast)에는 표지 오른쪽에 칩(아이콘 #i-ahead + 「예측」)과 근거 종류 글자가 같은 줄(.log__tlrow)에 선다 · 칩과 근거 종류 글자는 시각용(aria-hidden), 읽기 이름은 숨은 글 「예측, <근거 종류>.」', () => {
    for (const [basis, label] of [['official', '공식 전망 바탕'], ['expert', '전문가 전망 바탕'], ['scenario', '가상 시나리오']] as const) {
      const out = rowHtml(row({ basis }));
      expect(out).toMatch(/<span class="log__tlrow"><span class="log__tl">[\s\S]*<span>시대의 창<\/span><\/span><span class="chip--fc" data-testid="chip-fc" aria-hidden="true">[\s\S]*<use href="#i-ahead"><\/use><\/svg>예측<\/span>/);
      expect(out).toContain(`<span class="log__basis" data-testid="chip-basis" aria-hidden="true">${label}</span>`);
      expect(out).toContain(`<span class="sr-only">예측, ${label}.</span>`);
      expect(out).toContain('<span class="log__sent">시험 한 줄입니다.</span>');
    }
  });

  it('칩은 해로 정한다: 2026년 줄(forecast false)과 끝 줄에는 칩도 근거 종류 글자도 없고 줄 모양은 이전과 같다 (.log__tlrow 없음)', () => {
    const out = rowHtml(row({ year: 2026, age: 10, forecast: false, basis: undefined }));
    expect(out).not.toContain('chip--fc');
    expect(out).not.toContain('log__basis');
    expect(out).not.toContain('log__tlrow');
    expect(out).not.toContain('i-ahead');
    expect(out).toMatch(/<span class="log__tl"><svg class="icon" aria-hidden="true" focusable="false"><use href="#i-era"><\/use><\/svg><span>시대의 창<\/span><\/span><span class="log__sent">/);
  });

  it('근거 종류를 모르는 예측 줄(데이터 사이)은 칩만 있고 읽기 이름은 「예측.」이다', () => {
    const out = rowHtml(row({ basis: undefined }));
    expect(out).toContain('chip--fc');
    expect(out).not.toContain('log__basis');
    expect(out).toContain('<span class="sr-only">예측.</span>');
  });

  it('가려진 줄에서도 칩은 가리지 않는다(표지·겹선과 같은 규칙): 가림 안내와 함께 칩·근거 종류 글자가 보인다 · 문장은 hidden', () => {
    const out = rowHtml(row({ veiled: true, heavy: true, line: '무거운 일입니다.', basis: 'official' }));
    expect(out).toContain('data-veiled="true"');
    expect(out).toContain('chip--fc');
    expect(out).toContain('공식 전망 바탕');
    expect(out).toMatch(/class="veil__body log__sent" id="veil-era-2030" hidden=""/);
  });
});

describe('예측 근거 보기 (FU11)', () => {
  it('근거 글이 있는 줄: 근거 종류 글자가 단추다 — 기본 닫힘(aria-expanded=false), 접근 이름 「예측, <근거 종류>. 근거 보기」, aria-controls가 칸을 가리키고 칸은 hidden', () => {
    const out = rowHtml(row({ basis: 'scenario', foresight: FORESIGHT }));
    expect(out).toContain('<button type="button" class="log__basis log__basis--btn" aria-expanded="false" aria-controls="why-era-2030" aria-label="예측, 가상 시나리오. 근거 보기" data-testid="why-btn">가상 시나리오</button>');
    expect(out).toMatch(/<div class="log__why" id="why-era-2030" hidden="" data-testid="why-body">/);
    expect(out, '근거 종류 글자가 단추일 때는 숨은 글을 따로 두지 않는다(단추 이름이 맡는다)').not.toContain('<span class="sr-only">예측');
    // 칩 글자는 단추 이름에 들어 있으므로 시각용
    expect(out).toContain('class="chip--fc" data-testid="chip-fc" aria-hidden="true"');
  });

  it('칸의 글: 소개 한 줄 + 근거 건마다 한 줄(사람, 직함, 자료, 연도: 요약 어긋남), 보도 기준 표시, 반대 근거 표시, 수저별 설정 안내 한 줄', () => {
    const out = rowHtml(row({ basis: 'scenario', foresight: FORESIGHT }));
    const body = out.slice(out.indexOf('data-testid="why-body"'));
    expect(body).toContain('<p class="log__why-intro">이 장면과 관련된 말과 자료입니다.</p>');
    expect(body).toContain('가나다, 교수, 논문 「시험」, 2024년: 내다봤습니다. 발언은 2029년, 게임은 2030년입니다.</li>');
    expect(body).toContain('<li data-counter="true"><strong class="log__why-tag">반대 근거</strong> 라마바, 기관, 보도, 2025년, 보도 기준: 분석했습니다.</li>');
    expect(body).toContain('<li>수저별 차이는 게임의 설정입니다.</li>');
    expect((body.match(/<li/g) ?? []).length).toBe(3);
  });

  it('근거 글이 없는 수저별 「먼저」 줄(U12·U20)은 notes 0건 + byBand인 칸 — 단추는 있고 칸에는 소개 문장 없이 「수저별 차이는 게임의 설정입니다.」 한 줄만 있다 (마스터 2026-11-04)', () => {
    const only: EraForesight = { notes: [], byBand: true };
    const out = rowHtml(row({ basis: 'expert', foresight: only }));
    expect(out).toContain('aria-label="예측, 전문가 전망 바탕. 근거 보기"');
    const body = out.slice(out.indexOf('data-testid="why-body"'));
    expect(body).not.toContain('log__why-intro');
    expect(body).toContain('<li>수저별 차이는 게임의 설정입니다.</li>');
    expect((body.match(/<li/g) ?? []).length).toBe(1);
    expect(body).not.toContain('log__why-tag');
  });

  it('근거 글이 없는 예측 줄(후보 없는 줄)은 단추도 칸도 없다 — 근거 종류 글자만', () => {
    const out = rowHtml(row({ basis: 'expert' }));
    expect(out).not.toContain('<button');
    expect(out).not.toContain('log__why');
    expect(out).not.toContain('aria-expanded');
  });

  it('가려진 줄은 가림을 펼치기 전에는 근거 단추를 내지 않는다(근거가 가린 장면의 내용을 먼저 말하지 않게) — 펼치면 단추가 선다', () => {
    const veiled = row({ veiled: true, heavy: true, basis: 'official', foresight: FORESIGHT });
    const closed = rowHtml(veiled, false);
    expect(closed).not.toContain('why-btn');
    expect(closed).toMatch(/<div class="log__why" id="why-era-2030" hidden=""/);
    expect(closed).toContain('<span class="sr-only">예측, 공식 전망 바탕.</span>');
    const opened = rowHtml(veiled, true);
    expect(opened).toContain('data-testid="why-btn"');
  });

  it('근거 글은 예측 줄에만 오른다: forecast가 거짓인 줄(2026년·끝 줄)에 근거 글이 실려 와도 그리지 않는다', () => {
    const out = rowHtml(row({ forecast: false, year: 2026, basis: undefined, foresight: FORESIGHT }));
    expect(out).not.toContain('log__why');
    expect(out).not.toContain('<button');
  });
});

describe('시대의 창 칸의 「예측」 표 · 미래 톤 · 접근 이름 (FU3 안 B, 구현 규칙 7)', () => {
  it('2030년: 링크 하나에 data-future="true"·data-dec="2030"(2020년대가 아니다) · 그림 상자 뒤의 형제로 작은 「예측」 표(아이콘 #i-ahead + 글자, 시각용 aria-hidden) · 접근 이름·툴팁 「시대의 창 · 예측: <문장> …」', () => {
    const g = lifeAt(2030, 14);
    expect(sceneInputOf(g).state.calYear).toBe(2030);
    const out = html(g, EARLY);
    expect(out).toContain('<a class="era" id="scene-era" href="#log-y2030"');
    expect(out).toContain('data-future="true"');
    expect(out).toContain('data-dec="2030"');
    const a = out.slice(out.indexOf('<a class="era"'), out.indexOf('</a>') + 4);
    const line = /title="시대의 창 · 예측: ([^"]+)"/.exec(a)![1];
    expect(['AI가 일을 맡자 재교육이 붐볐습니다.', 'AI를 가진 쪽에 투자가 몰렸습니다.', '기본소득 시범에 신청 줄이 길었습니다.']).toContain(line);
    expect(a).toContain(`<span class="sr-only">시대의 창 · 예측: ${line} 그해 기록으로</span>`);
    expect(a).toMatch(/<\/span><span class="era__fc" data-testid="era-fc" aria-hidden="true"><svg class="icon" aria-hidden="true" focusable="false"><use href="#i-ahead"><\/use><\/svg>예측<\/span><span class="sr-only">/);
    // 표는 그림 상자(.era__pic) 안이 아니라 형제다 — 그림 모서리 잘림·필터에서 벗어난다
    expect(a.indexOf('era__fc')).toBeGreaterThan(a.indexOf('</svg></span>'));
    expect((out.match(/<a /g) ?? []).length, '초점 정지점 1').toBe(1);
  });

  it('2027·2028·2029년도 예측이다(표 · data-future) · 2026년은 사실이라 표도 data-future도 없고 data-dec는 2020 · 2025년 이하도 그대로', () => {
    for (const y of [2027, 2028, 2029]) {
      const out = html(lifeAt(y, 12), EARLY);
      expect(out, `${y}`).toContain('data-future="true"');
      expect(out, `${y}`).toContain('data-testid="era-fc"');
      expect(out, `${y}`).toContain('data-dec="2020"');
      expect(out, `${y}`).toContain('시대의 창 · 예측: ');
    }
    const y26 = html(lifeAt(2026, 12), EARLY);
    expect(y26).toContain('data-dec="2020"');
    expect(y26).not.toContain('data-future');
    expect(y26).not.toContain('era__fc');
    expect(y26).toContain('title="시대의 창 · ');
    expect(y26).not.toContain('예측');
    const y25 = html(lifeAt(2025, 12), EARLY);
    expect(y25).toContain('data-dec="2020"');
    expect(y25).not.toContain('data-future');
    expect(y25).not.toContain('era__fc');
  });

  it('data-dec는 그해의 10년대다: 2030년대는 2030, 표 끝(2109)은 2100 — 필터가 있는 10년대(1940~2000)와 달리 톤 규칙이 없다', () => {
    const wins: EraWindow[] = [
      { id: '삼십', years: [2039, 2039], kind: 'event', topic: '시험', line: '삼십 한 줄입니다.', heavy: false, approved: true, draw: '삼십', basis: 'official' },
      { id: '백', years: [2109, 2109], kind: 'event', topic: '시험', line: '백 한 줄입니다.', heavy: false, approved: true, draw: '백', basis: 'official' },
    ];
    const MARK = '<rect x="0" y="0" width="40" height="32" fill="var(--c-scene-sky,#dfe6ed)"/>';
    const era = { windows: wins, art: { 삼십: MARK, 백: MARK } };
    expect(html(lifeAt(2039, 14), era)).toContain('data-dec="2030"');
    const y2109 = html(lifeAt(2109, 60), era);
    expect(y2109).toContain('data-dec="2100"');
    expect(y2109).toContain('data-future="true"');
    expect(isForecastYear(2109)).toBe(true);
    expect(isForecastYear(2110)).toBe(false);
  });
});

describe('표 끝 뒤의 창: 줄이 없는 칸은 링크가 아니라 그림만 (REV-010-CORE-1 R-601)', () => {
  const END: EraWindow = { id: '끝', years: [ERA_LAST_YEAR + 1, ERA_LAST_YEAR + 21], kind: 'base', topic: '안내', line: '여기서부터는 그려진 연표가 없습니다.', heavy: false, approved: true, draw: '끝' };
  const MARK = '<rect x="0" y="0" width="40" height="32" fill="var(--c-scene-sky,#dfe6ed)"/>';
  const era = { windows: [END], art: { 끝: MARK } };

  it('2111년: 링크(<a>)가 0이다 — 눌러도 갈 줄이 없다. 그림만 role=img로 있고 「그해 기록으로」를 읽지 않으며, 예측 표·미래 톤도 없다', () => {
    const out = html(lifeAt(2111, 90), era);
    expect(out).toMatch(/<div class="era" id="scene-era" data-end="true" data-era="끝" data-kind="base" data-hidden="false" data-dec="2100" role="img" aria-label="시대의 창 · 여기서부터는 그려진 연표가 없습니다\." title="시대의 창 · 여기서부터는 그려진 연표가 없습니다\.">/);
    expect((out.match(/<a /g) ?? []).length, '이 카드의 링크 0').toBe(0);
    expect(out).not.toContain('#log-y');
    expect(out).not.toContain('그해 기록으로');
    expect(out).not.toContain('era__fc');
    expect(out).not.toContain('data-future');
    expect(out).toMatch(/<span class="era__pic" aria-hidden="true">[\s\S]*<svg viewBox="0 0 40 32"/);
  });

  it('2110년: 끝 줄이 있는 해라 링크가 된다(href="#log-y2110") — 칩도 표도 없다(예측이 아니라 안내)', () => {
    const out = html(lifeAt(2110, 90), era);
    expect(out).toContain('<a class="era" id="scene-era" href="#log-y2110"');
    expect(out).not.toContain('era__fc');
    expect(out).not.toContain('data-future');
    expect((out.match(/<a /g) ?? []).length).toBe(1);
  });

  it('2112~2130년도 링크 0 · 끝 장면의 해 범위 밖(2131~)은 빈 틀이다', () => {
    for (const y of [2112, 2120, 2130]) expect((html(lifeAt(y, 95), era).match(/<a /g) ?? []).length, `${y}`).toBe(0);
    expect(html(lifeAt(2131, 95), era)).toContain('data-empty="true"');
  });
});

describe('CSS 원문과 아이콘 (FU3·FU6, 시안 인계 원문 그대로)', () => {
  const css = async (): Promise<string> => {
    const spec = 'node:fs';
    const mod = (await import(/* @vite-ignore */ spec)) as { readFileSync(path: URL, encoding: 'utf-8'): string };
    return mod.readFileSync(new URL('../src/styles/family.css', import.meta.url), 'utf-8');
  };

  it('칩 CSS: 꼬리표 6px(--r-sm) + 1px 오디 테두리 + 오디 연한 면 + 굵은 xs 글자, 한 줄 flex-wrap, 아이콘 14px — 새 토큰 0 · 하드코딩 색 0', async () => {
    const c = await css();
    expect(c).toContain('.log__tlrow { display: flex; flex-wrap: wrap; align-items: center; gap: var(--sp-1) var(--sp-2); min-width: 0; }');
    expect(c).toContain('.chip--fc { display: inline-flex; align-items: center; gap: 4px; padding: 0 6px; border-radius: var(--r-sm); border: 1px solid var(--c-era); background: var(--c-era-soft); color: var(--c-era); font-size: var(--fs-xs); font-weight: var(--fw-bold); line-height: 1.7; white-space: nowrap; }');
    expect(c).toContain('.chip--fc .icon { width: 14px; height: 14px; stroke-width: 2.4; }');
    expect(c).toContain('.log__basis { font-size: var(--fs-xs); line-height: 1.7; color: var(--c-text-2); }');
    // 「전망」 칩(알약 --r-pill, 놋쇠 --c-accent)과 다르다
    const chip = /\.chip--fc \{[^}]*\}/.exec(c)![0];
    expect(chip).not.toContain('--r-pill');
    expect(chip).not.toContain('--c-accent');
  });

  it('창 표 CSS: 창 칸의 왼쪽 위 카드 면 꼬리표 + 휴대폰 띠(카드 ≤ 480px)에서는 그림 옆 띠 바탕 위(left: 100px + 간격) · .era는 position: relative', async () => {
    const c = await css();
    expect(c).toMatch(/\.era \{ position: relative; display: block;/);
    expect(c).toContain('.era__fc { position: absolute; top: var(--sp-1); left: var(--sp-1); display: inline-flex; align-items: center; gap: 3px; padding: 0 5px; border-radius: var(--r-sm); background: var(--c-surface); color: var(--c-era); font-size: var(--fs-xs); font-weight: var(--fw-bold); line-height: 1.6; white-space: nowrap; }');
    expect(c).toContain('.era__fc .icon { width: 12px; height: 12px; stroke-width: 2.6; }');
    const q = /@container scene \(max-width: 480px\) \{[\s\S]*?\n\}/.exec(c)![0];
    expect(q).toContain('.era__fc { top: var(--sp-2); left: calc(100px + var(--sp-2)); }');
  });

  it('미래 톤 「밑그림」: 라이트 saturate(.5) contrast(.92) brightness(1.06), 다크 saturate(.55) brightness(.94) — 해(data-future)로 정하고 2026년 이하에는 닿지 않으며 그림 상자 안 svg에만 걸린다(창 표 아이콘은 제외)', async () => {
    const c = await css();
    expect(c).toContain(".era[data-future='true'] .era__pic svg { filter: saturate(.5) contrast(.92) brightness(1.06); }");
    expect(c).toContain(":root[data-theme='dark'] .era[data-future='true'] .era__pic svg { filter: saturate(.55) brightness(.94); }");
    expect(c).toContain(":root:not([data-theme='light']) .era[data-future='true'] .era__pic svg { filter: saturate(.55) brightness(.94); }");
    expect(c).not.toMatch(/\.era\[data-future[^\]]*\] svg \{/); // 아이콘까지 걸리는 넓은 선택자 금지
  });

  it('강제 색상: 칩은 Canvas/CanvasText + CanvasText 테두리, 창 표는 Canvas/CanvasText + 1px 테두리 — 글자 「예측」과 아이콘이 남는다', async () => {
    const c = await css();
    const forced = c.slice(c.lastIndexOf('@media (forced-colors: active)'));
    expect(forced).toContain('.chip--fc { background: Canvas; color: CanvasText; border-color: CanvasText; }');
    expect(forced).toContain('.era__fc { background: Canvas; color: CanvasText; border: 1px solid CanvasText; }');
  });

  it('근거 보기 CSS: 단추는 44px 누르는 영역(::before, --hit)을 줄 여백 안에서 늘리고 꺾쇠(::after)가 펼침 상태를 돌린다 · 칸은 hidden이면 display none · 초점 링 3px', async () => {
    const c = await css();
    expect(c).toContain(".log__basis--btn::before { content: ''; position: absolute; left: -4px; right: -4px; top: min(0px, calc((100% - var(--hit)) / 2)); bottom: min(0px, calc((100% - var(--hit)) / 2)); }");
    expect(c).toContain(".log__basis--btn[aria-expanded='true']::after");
    expect(c).toContain('.log__basis--btn:focus-visible { outline: 3px solid var(--c-focus);');
    expect(c).toContain('.log__why[hidden] { display: none; }');
  });

  it('아이콘 #i-ahead: 스프라이트에 한 번, 24×24 선 아이콘 규칙(점 하나만 fill="currentColor", 색 속성·style 없음), 「전망」 아이콘(#i-proj)과 다르다', () => {
    expect((SPRITE_SVG.match(/id="i-ahead"/g) ?? []).length).toBe(1);
    const sym = /<symbol id="i-ahead"[\s\S]*?<\/symbol>/.exec(SPRITE_SVG)![0];
    expect(sym).toContain('viewBox="0 0 24 24"');
    expect((sym.match(/fill="currentColor"/g) ?? []).length).toBe(1);
    expect(sym).not.toMatch(/(?:fill|stroke)="(?!currentColor|none)|style=|#[0-9a-f]{3,6}/i);
    expect((sym.match(/<circle/g) ?? []).length).toBe(2);
    const proj = /<symbol id="i-proj"[\s\S]*?<\/symbol>/.exec(SPRITE_SVG)![0];
    expect(sym).not.toBe(proj);
    expect(proj).toContain('stroke-dasharray');
    expect(sym).not.toContain('stroke-dasharray');
  });
});
