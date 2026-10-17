import { expect, test, type Page } from '@playwright/test';
import { measureWordBreaks } from './lineBreaks';

/**
 * 낱말 끊김 감사기(`measureWordBreaks`, e2e/lineBreaks.ts)의 판정식 자체 시험 — 합성 DOM (SPEC-003 QM3-1 (b), QA-003-M3 기록 12의 측정 도구 결함 재발 방지).
 * 레이아웃(글자 상자·줄)이 필요해 단위 테스트(vitest, DOM 없음)가 아니라 브라우저로 돌린다. 화면 코드는 쓰지 않고 `page.setContent`로 만든 작은 문서를 잰다.
 *
 * QA 기록 12가 적은 측정 결함: ① 공백뿐인 텍스트 노드를 빠뜨려 서로 다른 낱말이 한 낱말로 이어 붙음 ② 구두점 뒤 줄바꿈을 낱말 끊김으로 셈(오탐 50건).
 * 이 시험이 지키는 판정식:
 *  - 요소 경계 너머로 이어진 글자는 한 낱말이다(「다이아<b>몬드</b>수저」)
 *  - 낱말 사이·구두점 앞뒤 줄바꿈은 끊김이 아니다
 *  - 공백 텍스트 노드로 이어 붙인 인라인 요소는 낱말이 둘이다
 *  - `<wbr>` 지점에서만 끊긴 목록 낱말은 `intended`, 목록에 없거나 다른 자리에서 끊기면 `broken`
 *  - 칸이 좁아 끊긴 짧은 낱말은 `broken`(한 줄 전체 = 칸이 아니라 칸을 나눠 쓰는 상자의 폭), 한 줄 전체보다 긴 낱말은 `unavoidable`
 *  - 눈에 보이지 않는 글자는 세지 않는다. 눈에 보이면 `aria-hidden`이라도 센다
 * 글꼴이 환경마다 달라서 폭은 모두 낱말의 **측정한 자연 폭**의 비율로 정한다(고정 px 없음). mobile-360 프로젝트에서만 돈다.
 */

const BASE_STYLE = `
  body { margin: 0; font: 16px/1.5 sans-serif; word-break: keep-all; overflow-wrap: anywhere; }
  .sr-only { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
`;

async function render(page: Page, html: string): Promise<void> {
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>${BASE_STYLE}</style></head><body>${html}</body></html>`);
}

/** 마크업을 한 줄(nowrap)에 놓았을 때의 폭 */
async function natural(page: Page, innerHtml: string, style = ''): Promise<number> {
  return page.evaluate(
    ([html, css]) => {
      const probe = document.createElement('span');
      probe.style.cssText = `position:absolute;visibility:hidden;white-space:nowrap;overflow-wrap:normal;${css}`;
      probe.innerHTML = html;
      document.body.appendChild(probe);
      const w = probe.getBoundingClientRect().width;
      probe.remove();
      return w;
    },
    [innerHtml, style] as const,
  );
}

/** 글자가 얼마나 올라갔다 내려오는 줄에 놓이는지(줄 수)는 감사기가 센다 — 여기서는 판정 결과만 본다 */
test.describe.configure({ mode: 'parallel' });

test.beforeEach(async ({}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-360', 'mobile-360에서만 실행(화면 크기와 무관한 합성 문서)');
});

test('요소 경계 너머로 이어진 글자는 한 낱말이다: 「다이아<b>몬드</b>수저」가 좁은 칸에서 끊기면 낱말 하나가 broken으로 잡힌다(조각 낱말이 아니다)', async ({ page }) => {
  const w = await natural(page, '다이아<b>몬드</b>수저');
  await render(page, `<div style="display:grid;grid-template-columns:${w * 0.55}px 1fr;width:${w * 4}px"><div>다이아<b>몬드</b>수저</div><div>옆 칸</div></div>`);
  const r = await measureWordBreaks(page);
  expect(r.words).toContain('다이아몬드수저');
  expect(r.words).not.toContain('다이아');
  expect(r.words).not.toContain('몬드수저');
  expect(r.broken.map((b) => b.word)).toEqual(['다이아몬드수저']);
  expect(r.broken[0].natural, '자연 폭은 낱말 전체').toBeGreaterThan(w * 0.9);
  expect(r.broken[0].line, '한 줄 전체는 칸이 아니라 격자 폭').toBeGreaterThan(w * 3);
  expect(r.unavoidable).toEqual([]);
  expect(r.intended).toEqual([]);
});

test('낱말 사이 줄바꿈은 끊김이 아니다: 여러 줄로 접힌 「동수저 은수저 금수저 흙수저」는 잰 낱말 4개, 끊김 0', async ({ page }) => {
  const w = await natural(page, '동수저');
  await render(page, `<p style="width:${w * 1.4}px;margin:0">동수저 은수저 금수저 흙수저</p>`);
  const lines = await page.evaluate(() => Math.round(document.querySelector('p')!.getBoundingClientRect().height / 24));
  expect(lines, '실제로 여러 줄로 접혔다(공허 통과 방지)').toBeGreaterThanOrEqual(3);
  const r = await measureWordBreaks(page);
  expect(r.checked).toBe(4);
  expect(r.broken).toEqual([]);
  expect(r.unavoidable).toEqual([]);
  expect(r.intended).toEqual([]);
});

test('구두점 앞뒤 줄바꿈을 낱말 끊김으로 세지 않는다(오탐 방지): 「서울특별시(종로구)」가 여는 괄호 앞에서 줄이 바뀌어도 낱말은 「서울특별시」「종로구」로 따로 센다', async ({ page }) => {
  const w = await natural(page, '서울특별시');
  await render(page, `<p style="width:${w * 1.15}px;margin:0">서울특별시(종로구)</p>`);
  const tops = await page.evaluate(() => {
    const text = document.querySelector('p')!.firstChild as Text;
    const range = document.createRange();
    const set = new Set<number>();
    for (let i = 0; i < text.length; i++) {
      range.setStart(text, i);
      range.setEnd(text, i + 1);
      set.add(Math.round(range.getClientRects()[0].top));
    }
    return set.size;
  });
  expect(tops, '여는 괄호 앞에서 줄이 바뀌었다(공허 통과 방지)').toBeGreaterThanOrEqual(2);
  const r = await measureWordBreaks(page);
  expect(r.words.sort()).toEqual(['서울특별시', '종로구']);
  expect(r.broken).toEqual([]);
  expect(r.unavoidable).toEqual([]);
});

test('공백 텍스트 노드로 이어 붙인 인라인 요소는 낱말이 둘이다(QA 기록 12-1): 「<span>서울특별시</span> <span>종로구</span>」를 한 낱말로 이어 붙이지 않는다', async ({ page }) => {
  const w = await natural(page, '서울특별시');
  await render(page, `<p style="width:${w * 1.3}px;margin:0"><span>서울특별시</span> <span>종로구</span></p>`);
  const r = await measureWordBreaks(page);
  expect(r.words.sort()).toEqual(['서울특별시', '종로구']);
  expect(r.checked).toBe(2);
  expect(r.broken).toEqual([]);
});

test('칸(flex 아이템) 사이는 공백이 없어도 다른 낱말이다: 「<div>서울특별시</div><div>종로구</div>」가 한 낱말로 이어 붙지 않는다', async ({ page }) => {
  await render(page, '<div style="display:flex"><div>서울특별시</div><div>종로구</div></div>');
  const r = await measureWordBreaks(page);
  expect(r.words.sort()).toEqual(['서울특별시', '종로구']);
});

/**
 * 강제 줄바꿈 `<br>`도 등록제다 (REV-003-M3-4 R-300). 예전에는 `<br>`를 항상 낱말 경계로 봐서 낱말 한가운데의 `<br>`가 등록 없이 통과했다(SPEC 「허용은 둘뿐」 밖의 셋째 면제).
 * 지금은 글자 사이에 바로 붙은 `<br>`가 낱말 한가운데를 가르는 것으로 잰다: 등록 낱말(FORCED_BREAKS)이면 `forced`로 따로 보고, 등록 없으면 폭과 상관없이 `broken`.
 */
test.describe('강제 줄바꿈 <br> (등록제, R-300)', () => {
  test('등록 낱말: 「다이아몬드<br>수저」는 낱말 하나이고 forced로 따로 보고된다 — broken·unavoidable·intended는 아니다 (첫 화면 수저 띠의 두 줄 이름표)', async ({ page }) => {
    await render(page, '<p style="margin:0">다이아몬드<br>수저</p>');
    const r = await measureWordBreaks(page);
    expect(r.words).toEqual(['다이아몬드수저']);
    expect(r.forced.map((f) => f.word)).toEqual(['다이아몬드수저']);
    expect(r.broken).toEqual([]);
    expect(r.unavoidable).toEqual([]);
    expect(r.intended).toEqual([]);
    expect(r.forced[0].natural, '자연 폭은 줄(조각)마다 잰 가장 넓은 폭').toBeLessThanOrEqual(r.forced[0].line);
  });

  test('등록 없는 낱말: 폭이 아주 넉넉해도 낱말 한가운데의 `<br>`는 broken이다 — 「서울특별시<br>종로구」', async ({ page }) => {
    await render(page, '<p style="margin:0;width:2000px">서울특별시<br>종로구</p>');
    const r = await measureWordBreaks(page);
    expect(r.words).toEqual(['서울특별시종로구']);
    expect(r.broken.map((b) => b.word)).toEqual(['서울특별시종로구']);
    expect(r.forced).toEqual([]);
    expect(r.unavoidable).toEqual([]);
  });

  test('등록 없는 `<br>`는 좁은 폭에서도 unavoidable로 숨지 못한다: 한 줄보다 긴 낱말의 한가운데 `<br>`도 broken (폭 때문에 면제되지 않는다)', async ({ page }) => {
    const w = await natural(page, '전남광주통합특별시');
    await render(page, `<p style="margin:0;width:${w * 0.4}px">전남광주<br>통합특별시</p>`);
    const r = await measureWordBreaks(page);
    expect(r.broken.map((b) => b.word)).toEqual(['전남광주통합특별시']);
    expect(r.unavoidable).toEqual([]);
    expect(r.forced).toEqual([]);
  });

  test('목록에서 그 낱말을 빼면(`forced: []`) 같은 `<br>`가 broken이다 — 등록이 면제의 유일한 근거', async ({ page }) => {
    await render(page, '<p style="margin:0">다이아몬드<br>수저</p>');
    const r = await measureWordBreaks(page, { forced: [] });
    expect(r.forced).toEqual([]);
    expect(r.broken.map((b) => b.word)).toEqual(['다이아몬드수저']);
  });

  test('등록 낱말이라도 `<br>`가 아닌 자리에서도 끊기면 forced가 아니다 — 「다이아몬드<br>수저」의 앞 조각이 칸보다 넓어 줄이 더 나뉘면 broken(조각이 칸보다 좁을 때) / unavoidable(한 줄보다 길 때)', async ({ page }) => {
    const half = await natural(page, '다이아몬드');
    // 칸 폭이 앞 조각(다이아몬드)보다 좁다 → 「다이아몬드」 안에서도 줄이 나뉜다. 한 줄 전체 = 문단 폭 = 칸 폭이라 조각이 한 줄보다 길다
    await render(page, `<p style="margin:0;width:${half * 0.6}px">다이아몬드<br>수저</p>`);
    const r = await measureWordBreaks(page);
    expect(r.forced).toEqual([]);
    expect(r.unavoidable.map((u) => u.word)).toEqual(['다이아몬드수저']);
    expect(r.broken).toEqual([]);
  });

  test('`<br>` 앞뒤에 공백이나 구두점이 있으면 낱말 사이의 줄바꿈이다: 「안녕 <br>하세요」「안녕.<br>하세요」는 낱말 둘 — 끊김도 forced도 아니다', async ({ page }) => {
    await render(page, '<p style="margin:0">안녕 <br>하세요</p><p style="margin:0">반가워.<br>잘가요</p><p style="margin:0">첫째<br> 둘째</p>');
    const r = await measureWordBreaks(page);
    expect(r.words.sort()).toEqual(['둘째', '반가워', '안녕', '잘가요', '첫째', '하세요'].sort());
    expect(r.broken).toEqual([]);
    expect(r.forced).toEqual([]);
    expect(r.unavoidable).toEqual([]);
  });

  test('`<br>`가 하나도 없으면 forced는 비어 있다 (대조군)', async ({ page }) => {
    await render(page, '<p style="margin:0">다이아몬드수저 흙수저</p>');
    const r = await measureWordBreaks(page);
    expect(r.forced).toEqual([]);
    expect(r.broken).toEqual([]);
  });
});

test('숫자 사이의 점·쉼표는 낱말 안이다: 좁은 칸에서 「1,234명」이 중간에서 끊기면 낱말 하나(1,234명)가 broken이다', async ({ page }) => {
  const w = await natural(page, '1,234명');
  await render(page, `<div style="display:grid;grid-template-columns:${w * 0.5}px 1fr;width:${w * 4}px"><div>1,234명</div><div>옆</div></div>`);
  const r = await measureWordBreaks(page);
  expect(r.words).toContain('1,234명');
  expect(r.broken.map((b) => b.word)).toEqual(['1,234명']);
});

test.describe('<wbr> 지점과 의도된 낱말 목록 (판정식 intended)', () => {
  /** 좁은 칸 + 넓은 격자: 칸 폭 = 「다이아몬드」(5글자)가 겨우 들어가는 폭, 낱말 전체(7글자)는 못 들어간다 */
  async function renderChip(page: Page, inner: string, word: string): Promise<void> {
    const half = await natural(page, word.slice(0, 5));
    const full = await natural(page, word);
    await render(page, `<div style="display:grid;grid-template-columns:${half * 1.1}px 1fr;width:${full * 4}px"><div>${inner}</div><div>옆 칸</div></div>`);
  }

  test('목록의 낱말이 `<wbr>` 바로 뒤에서만 끊기면 intended다 (결함도 불가피도 아니다)', async ({ page }) => {
    await renderChip(page, '다이아몬드<wbr>수저', '다이아몬드수저');
    const r = await measureWordBreaks(page);
    expect(r.intended.map((i) => i.word)).toEqual(['다이아몬드수저']);
    expect(r.broken).toEqual([]);
    expect(r.unavoidable).toEqual([]);
    expect(r.intended[0].natural).toBeLessThanOrEqual(r.intended[0].line);
  });

  test('목록에서 그 낱말을 빼면(`intended: []`) 같은 끊김이 broken이다 — 한 줄 전체(격자)에는 들어갈 낱말이기 때문', async ({ page }) => {
    await renderChip(page, '다이아몬드<wbr>수저', '다이아몬드수저');
    const r = await measureWordBreaks(page, { intended: [] });
    expect(r.intended).toEqual([]);
    expect(r.broken.map((b) => b.word)).toEqual(['다이아몬드수저']);
  });

  test('목록에 없는 낱말에 `<wbr>`를 써도 intended가 아니다 — 목록에 등재해야 한다', async ({ page }) => {
    await renderChip(page, '서울특별시<wbr>종로구', '서울특별시종로구');
    const r = await measureWordBreaks(page);
    expect(r.intended).toEqual([]);
    expect(r.broken.map((b) => b.word)).toEqual(['서울특별시종로구']);
  });

  test('목록의 낱말이라도 `<wbr>`가 아닌 자리에서 끊기면 intended가 아니다 — `<wbr>` 없이 칸이 좁아 끊긴 「다이아몬드수저」는 broken', async ({ page }) => {
    await renderChip(page, '다이아몬드수저', '다이아몬드수저');
    const r = await measureWordBreaks(page);
    expect(r.intended).toEqual([]);
    expect(r.broken.map((b) => b.word)).toEqual(['다이아몬드수저']);
  });

  test('소프트 하이픈(U+00AD)도 의도된 줄바꿈 지점으로 센다 — 목록의 낱말이면 intended', async ({ page }) => {
    await renderChip(page, '다이아몬드\u00AD수저', '다이아몬드수저');
    const r = await measureWordBreaks(page);
    // 소프트 하이픈은 글자 수에 들지 않는다: 낱말은 「다이아몬드수저」다
    expect(r.words).toContain('다이아몬드수저');
    expect(r.intended.map((i) => i.word).concat(r.broken.map((b) => b.word))).toContain('다이아몬드수저');
  });
});

test.describe('한 줄 전체와 판정 (broken ↔ unavoidable)', () => {
  test('칸이 좁아 끊긴 짧은 낱말은 broken이다: 한 줄 전체는 칸이 아니라 칸을 나눠 쓰는 격자의 폭이다 (반쪽 칸의 「단순노무직」)', async ({ page }) => {
    const w = await natural(page, '단순노무직');
    await render(page, `<div style="display:grid;grid-template-columns:1fr 1fr;width:${w * 1.7}px;gap:0"><div>단순노무직</div><div>서비스직</div></div>`);
    const r = await measureWordBreaks(page);
    const labor = r.broken.find((b) => b.word === '단순노무직');
    expect(labor, `broken ${JSON.stringify(r.broken)}`).toBeDefined();
    expect(labor!.natural).toBeLessThanOrEqual(labor!.line);
    expect(labor!.line).toBeGreaterThan(w * 1.6);
    expect(r.unavoidable).toEqual([]);
  });

  test('같은 낱말이 한 줄 전체(문단 폭)보다 길면 unavoidable이다: 끊을 수밖에 없다', async ({ page }) => {
    const w = await natural(page, '전남광주통합특별시');
    await render(page, `<p style="width:${w * 0.6}px;margin:0">전남광주통합특별시</p>`);
    const r = await measureWordBreaks(page);
    expect(r.unavoidable.map((u) => u.word)).toEqual(['전남광주통합특별시']);
    expect(r.unavoidable[0].natural).toBeGreaterThan(r.unavoidable[0].line + 0.5);
    expect(r.broken).toEqual([]);
  });

  test('자연 폭이 한 줄 전체와 같거나 0.5px 안이면 broken이 아니다(경계: 자연 폭 > 한 줄 + 0.5px만 unavoidable)', async ({ page }) => {
    const w = await natural(page, '서울특별시');
    // 문단 폭이 낱말 자연 폭과 같다 → 끊기지 않는다
    await render(page, `<p style="width:${Math.ceil(w) + 1}px;margin:0">서울특별시 부산광역시</p>`);
    const r = await measureWordBreaks(page);
    expect(r.broken).toEqual([]);
    expect(r.unavoidable).toEqual([]);
  });

  test('표 셀: 좁은 칸에서 끊긴 낱말의 한 줄 전체는 표 폭이다 (비교 표 출처 줄의 「초중고사교육비조사」)', async ({ page }) => {
    const w = await natural(page, '초중고사교육비조사');
    await render(
      page,
      `<table style="width:${w * 3}px;border-collapse:collapse;table-layout:fixed"><tr><th style="width:${w * 0.5}px;text-align:left;font-weight:normal">초중고사교육비조사</th><td>값</td></tr></table>`,
    );
    const r = await measureWordBreaks(page);
    const survey = r.broken.find((b) => b.word === '초중고사교육비조사');
    expect(survey, `broken ${JSON.stringify(r.broken)} unavoidable ${JSON.stringify(r.unavoidable)}`).toBeDefined();
    expect(survey!.line).toBeGreaterThan(w * 2.5);
  });

  test('칩(inline-flex 안의 이름)은 칸을 나누지 않는다: 두 릴 안의 릴 칸에서 끊긴 칩 이름의 한 줄 전체는 두 릴 전체 폭이다 (칩 자신의 폭이 아니다)', async ({ page }) => {
    const w = await natural(page, '다이아몬드수저');
    await render(
      page,
      `<div class="reels" style="display:grid;grid-template-columns:1fr 1fr;width:${w * 3}px;gap:0">
         <div style="display:flex;flex-direction:column;min-width:0"><div style="width:${w * 0.5}px;overflow:hidden"><ul style="list-style:none;margin:0;padding:0;display:flex;flex-direction:column"><li style="display:flex;justify-content:center"><span class="grade" style="display:inline-flex;gap:4px;white-space:normal"><svg width="8" height="8"></svg><span>다이아몬드수저</span></span></li></ul></div></div>
         <div style="min-width:0">오른쪽 릴</div>
       </div>`,
    );
    const r = await measureWordBreaks(page);
    const chip = r.broken.find((b) => b.word === '다이아몬드수저');
    expect(chip, `broken ${JSON.stringify(r.broken)} unavoidable ${JSON.stringify(r.unavoidable)}`).toBeDefined();
    expect(chip!.line, '두 릴 전체 폭(= 격자 폭)').toBeGreaterThan(w * 2.8);
  });
});

test.describe('눈에 보이는 글자만 센다', () => {
  test('display:none·visibility:hidden·sr-only·폭 0은 세지 않고, 눈에 보이는 aria-hidden 글자는 센다', async ({ page }) => {
    await render(
      page,
      `<p>보이는글</p>
       <p style="display:none">없는글자</p>
       <p style="visibility:hidden">숨은글자</p>
       <p class="sr-only">스크린리더만</p>
       <p style="width:0;height:0;overflow:hidden">영크기</p>
       <p aria-hidden="true">장식도장</p>`,
    );
    const r = await measureWordBreaks(page);
    expect(r.words.sort()).toEqual(['보이는글', '장식도장']);
  });

  test('조상 overflow가 잘라 낸 글자는 세지 않는다(돌아가는 릴 목록의 화면 밖 칸): 보이는 칸의 글자만 센다', async ({ page }) => {
    await render(
      page,
      `<div style="width:100px;height:40px;overflow:hidden"><ul style="list-style:none;margin:0;padding:0"><li style="height:40px">첫째칸</li><li style="height:40px">둘째칸</li><li style="height:40px">셋째칸</li></ul></div>`,
    );
    const r = await measureWordBreaks(page);
    expect(r.words).toEqual(['첫째칸']);
  });

  test('categories: 선택자 안에서 잰 낱말 수를 센다 (제목·칩·직업 라벨 등이 잰 대상에 들었는지 확인하는 공허 통과 방지용)', async ({ page }) => {
    await render(page, '<h1>제목 하나</h1><p>본문 세 낱말</p><span class="chip">칩</span>');
    const r = await measureWordBreaks(page, { categories: { heading: 'h1', chip: '.chip', none: '.nothing' } });
    expect(r.categories).toEqual({ heading: 2, chip: 1, none: 0 });
    expect(r.checked).toBe(6);
  });

  test('scope: 범위 밖의 글자는 재지 않는다', async ({ page }) => {
    await render(page, '<h1>제목</h1><main>본문 글자</main>');
    const r = await measureWordBreaks(page, { scope: 'main' });
    expect(r.words.sort()).toEqual(['글자', '본문']);
  });
});
