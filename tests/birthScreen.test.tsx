import birthScreenSrc from '../src/screens/BirthScreen.tsx?raw';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ERAS, PARENT_WEALTHS, beginBirth, birthSentence, createInitialState, enterBirth, peersOf, type Era } from '../src/core';
import { BIRTH_TEXT, DASHBOARD_PEERS_SHIPPED, GRADE_NAME, REPORT_NOTES, genderLabel, housingText, orderText, peersNoteText, yearMonthText } from '../src/data/birthReportText';
import { lifeGapLine } from '../src/data/birthCompare';
import { DASH_TEXT } from '../src/data/dashText';
import { placeLabel } from '../src/data/regionNames';
import { OCCUPATION_LABEL } from '../src/data/birthReportTable';
import { getRegionFootnote } from '../src/data/koreaStatsAccess';
import { startBandOf } from '../src/core/ending';
import { bandLabel } from '../src/data/endingText';
import { BirthScreen } from '../src/screens/BirthScreen';
import { reportPlaceLabel } from '../src/core/birthReport';
import { codeOnly } from './helpers/code';

/** vitest는 CSS의 ?raw 가져오기를 빈 문자열로 돌려주므로 CSS는 파일 시스템으로 읽는다(tests/barRelease.test.ts와 같은 방법) */
async function readText(relative: string): Promise<string> {
  const spec = 'node:fs';
  const fs = (await import(/* @vite-ignore */ spec)) as { readFileSync(path: URL, encoding: 'utf-8'): string };
  return fs.readFileSync(new URL(relative, import.meta.url), 'utf-8');
}
const docCss = await readText('../src/styles/doc.css');

/**
 * 출생신고 화면 (SPEC-003 BR1~BR7, VP3, 완료 기준 4). 서버 렌더로 마크업을 읽는다. 값은 저장된 출생 결과에서 그대로 나오는지(화면은 계산하지 않는다) 본다.
 */

function render(era: Era, seed: number) {
  const born = enterBirth(beginBirth(createInitialState(seed), era));
  const c = born.character!;
  const r = born.birthReport!;
  const html = renderToStaticMarkup(<BirthScreen era={era} character={c} report={r} peerSeed={born.peerSeed!} onNext={() => {}} />);
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const field = (id: string): string => {
    const m = new RegExp(`data-testid="birth-field-${id}"><dt>[^<]*</dt><dd data-testid="[^"]*">([^]*?)</dd>`).exec(html);
    expect(m, id).not.toBeNull();
    return m![1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  };
  return { born, c, r, html, text, field };
}

describe('출생신고 문서 구성과 값 (BR1·BR2)', () => {
  for (const era of ERAS) {
    it(`${era}: 헤더 「출생 신고」, 큰 이름, 한 줄 서술문, 정보 격자 11칸이 저장된 출생 결과 그대로 보인다`, () => {
      for (let seed = 1; seed <= 20; seed++) {
        const { c, r, html, text, field } = render(era, seed * 101);
        expect(html).toContain('data-testid="site-head"'); // 게임명 로고가 헤더에 있다(DS1)
        expect(html).toContain('data-testid="header-logo"');
        expect(text).toContain(BIRTH_TEXT.docTitle);
        expect(html).toContain(`data-testid="birth-name">${c.name}<`);
        expect(html.replace(/<[^>]+>/g, '')).toContain(birthSentence(c, r, era));
        // 격자 11칸: 성별·출생 연월·태어난 곳·집안 형편·어머니·아버지·사는 집·출생 체중·형제 순서·외모·교육방식
        expect(html.match(/data-testid="birth-field-/g)).toHaveLength(11);
        expect(field('gender')).toBe(genderLabel(c.gender));
        expect(field('month')).toBe(yearMonthText(c.birthYear, r.month));
        expect(field('place')).toBe(reportPlaceLabel(r, era));
        expect(field('mother')).toBe(`${r.mother.age}세 · ${OCCUPATION_LABEL[r.mother.job]}`);
        expect(field('father')).toBe(`${r.father.age}세 · ${OCCUPATION_LABEL[r.father.job]}`);
        expect(field('housing')).toBe(housingText(r.housing));
        expect(field('weight')).toContain(`${r.birthWeightKg.toFixed(1)}kg`);
        expect(field('order')).toBe(orderText(r.birthOrder));
        expect(field('parenting')).toMatch(/^(방임|자유|헬리콥터|엄격) .+습니다\.$/);
      }
    });
  }

  it('지금 세상은 모든 판이 2026년생이다 (1000판): 출생 연월 칸이 「2026년 N월」이다', () => {
    for (let seed = 1; seed <= 1000; seed++) {
      const born = beginBirth(createInitialState(seed * 3571), 'present');
      expect(born.character!.birthYear).toBe(2026);
      expect(yearMonthText(born.character!.birthYear, born.birthReport!.month)).toMatch(/^2026년 (1[0-2]|[1-9])월$/);
    }
  });

  it('집안 형편 = 수저 칩(이름 + 점) + bandLabel(startBandOf()) — 「흙수저(하위 25% 안쪽)」 형식, 점 5개 중 N개가 켜진다 (R-170)', () => {
    for (const era of ERAS) {
      for (let seed = 1; seed <= 40; seed++) {
        const { c, html, field } = render(era, seed * 17);
        const text = field('wealth').replace(/\s+/g, '');
        expect(text).toBe(`${GRADE_NAME[c.parentWealth]}(${bandLabel(startBandOf(era, c.parentWealth))})`.replace(/\s+/g, ''));
        const dots = new RegExp(`data-testid="birth-field-wealth"[^]*?aria-label="5단계 중 ${c.parentWealth}단계">([^]*?)</span>`).exec(html);
        expect(dots, `${era} ${c.parentWealth}`).not.toBeNull();
        expect(dots![1].match(/<i class="on">/g) ?? []).toHaveLength(c.parentWealth);
        expect(dots![1].match(/<i/g)).toHaveLength(5);
        expect(html).toContain(`href="#sp-${c.parentWealth}"`); // 칩 변형(실루엣) 아이콘 — 이름·점과 함께
      }
    }
  });

  it('외모는 점수가 아니라 「상위/하위 약 N%」(또래 사이에서)뿐이다 — 「N점」·「소득 N분위」가 화면 어디에도 없다 (R-135, 완료 기준 4)', () => {
    for (const era of ERAS) {
      for (let seed = 1; seed <= 60; seed++) {
        const { field, text } = render(era, seed * 29);
        expect(field('looks')).toMatch(/^(상위 약 \d+%|하위 약 \d+%|상위 1% 안쪽|하위 1% 안쪽|딱 중간쯤) 또래 사이에서$/);
        expect(text).not.toMatch(/외모\s*\d+\s*점/);
        expect(text).not.toMatch(/소득\s*\d\s*분위/);
        expect(text).not.toMatch(/접속자|!/);
      }
    }
  });
});

describe('같은 해 태어난 사람들 (VP3)', () => {
  it('또래 4명: 이름·장소·성별·수저 칩이 peersOf의 결과 그대로이고, 안내 문구가 있다', () => {
    for (const era of ERAS) {
      const { born, c, r, html, text } = render(era, 77);
      const peers = peersOf(born.peerSeed!, c.birthYear, r.month, c.name);
      expect(html.match(/data-testid="peer"/g)).toHaveLength(4);
      for (const p of peers) {
        expect(text).toContain(p.name);
        expect(text).toContain(GRADE_NAME[p.wealth]);
      }
      expect(text).toContain(BIRTH_TEXT.peersTitle);
      expect(text).toContain(BIRTH_TEXT.peersNote);
    }
  });

  it('QM3-3 (c): 대시보드 또래 칸(VP4)이 배포됐다(M4) — 안내가 둘째 문장으로 그 칸을 가리키고, 「대시보드」·「오른쪽 칸」은 화면에 한 곳도 없다 (세 세상 × 40판). 바뀐 기대: M3에서는 첫 문장 하나뿐이었다', () => {
    expect(DASHBOARD_PEERS_SHIPPED, 'M4가 VP4(대시보드 또래 칸, ui/dash/Cards.tsx#PeersNowCard)를 넣는 변경에서 켰다').toBe(true);
    const full = '네 사람도 같은 세상에서 나이를 먹습니다. 살아가기를 누르면 「같은 해 태어난 사람들」 칸에서 요즘 모습을 볼 수 있습니다.';
    expect(BIRTH_TEXT.peersNote).toBe(full);
    // 안내가 가리키는 칸의 이름은 대시보드 칸 제목과 같은 글자이고, 누를 버튼 이름은 출생신고 하단 띠의 「살아가기」다
    expect(full).toContain(`「${DASH_TEXT.peersTitle}」`);
    expect(full).toContain(`${BIRTH_TEXT.next}를 누르면`);
    for (const era of ERAS) {
      for (let seed = 1; seed <= 40; seed++) {
        const { html, text } = render(era, seed * 47);
        // 좁은 화면(1열)에서는 그 칸이 맨 아래라 「오른쪽 칸」은 틀린 위치 서술이고, 「대시보드」는 화면에 적히지 않는 내부 이름이다(M4 착수 결정 3)
        expect(text, `${era} ${seed}`).not.toMatch(/대시보드|오른쪽 칸/);
        expect(html).not.toMatch(/대시보드|오른쪽 칸/); // 보이지 않는 속성(aria-label 등)에도 없다
        const note = /<p class="t-sm t-muted card__note">([^]*?)<\/p>/.exec(html);
        expect(note, '또래 안내 문단').not.toBeNull();
        expect(note![1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(), '또래 안내는 두 문장').toBe(full);
      }
    }
  });

  it('QM3-3: 켜는 방법 — `peersNoteText(true)`는 둘째 문장(「같은 해 태어난 사람들」 칸 안내)을 더하고 `false`는 첫 문장뿐이다', () => {
    expect(peersNoteText(false)).toBe('네 사람도 같은 세상에서 나이를 먹습니다.');
    expect(peersNoteText(true)).toBe('네 사람도 같은 세상에서 나이를 먹습니다. 살아가기를 누르면 「같은 해 태어난 사람들」 칸에서 요즘 모습을 볼 수 있습니다.');
    expect(BIRTH_TEXT.peersNote).toBe(peersNoteText(DASHBOARD_PEERS_SHIPPED));
  });

  it('R-269: 성별은 「여성/남성」으로 이름 옆에 있고, 장소 줄에는 장소 이름뿐이다(「· 여」·「· 남」 한 글자가 줄 끝에 혼자 남을 일이 없다)', () => {
    for (const era of ERAS) {
      for (let seed = 1; seed <= 25; seed++) {
        const { born, c, r, html } = render(era, seed * 53);
        const peers = peersOf(born.peerSeed!, c.birthYear, r.month, c.name);
        const items = [...html.matchAll(/<li data-testid="peer">([^]*?)<\/li>/g)].map((m) => m[1]);
        expect(items).toHaveLength(4);
        const textOf = (itemHtml: string, id: string) => {
          const m = new RegExp(`data-testid="${id}">([^]*?)</(?:span|div)>`).exec(itemHtml);
          expect(m, id).not.toBeNull();
          return m![1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
        };
        peers.forEach((p, i) => {
          expect(textOf(items[i], 'peer-name')).toBe(p.name);
          expect(textOf(items[i], 'peer-gender')).toBe(genderLabel(p.gender)); // 「남성」/「여성」
          expect(textOf(items[i], 'peer-place')).toBe(placeLabel(p, era)); // 장소만 — 가운뎃점·성별 한 글자 없음
          expect(textOf(items[i], 'peer-place')).not.toMatch(/ · |[남여]$/);
        });
      }
    }
  });

  it('R-269: 칩을 이름 아래로 내리는 CSS 규칙이 있다 — 줄바꿈을 허용하는 flex이고 이름 묶음의 최소 폭(14rem)을 넘지 못하면 칩이 다음 줄로 간다', () => {
    const li = /\.people li \{([^}]*)\}/.exec(docCss)![1];
    expect(li).toMatch(/display:\s*flex/);
    expect(li).toMatch(/flex-wrap:\s*wrap/);
    expect(/\.people__who \{([^}]*)\}/.exec(docCss)![1]).toMatch(/flex:\s*1 1 14rem/);
  });
});

describe('서류 격자 — 「태어난 곳」은 두 칸을 쓴다 (R-281)', () => {
  it('「태어난 곳」 칸에만 span-2 표시가 있고(수저·교육방식은 wide 한 줄), CSS는 그 칸이 두 칸(좁은 화면 2열에서는 한 줄 전체, 넓은 화면 3열에서는 3분의 2)을 쓰게 한다', () => {
    for (const era of ERAS) {
      const { html } = render(era, 29);
      const classOf = (id: string) => new RegExp(`<div(?: class="([^"]*)")? data-testid="birth-field-${id}">`).exec(html)?.[1];
      expect(classOf('place'), `${era}: 태어난 곳`).toBe('span-2');
      expect(classOf('wealth')).toBe('wide');
      expect(classOf('parenting')).toBe('wide');
      for (const id of ['gender', 'month', 'mother', 'father', 'housing', 'weight', 'order', 'looks']) expect(classOf(id), `${era}: ${id}`).toBeUndefined();
    }
    const css = docCss.replace(/\/\*[^]*?\*\//g, '');
    expect(/\.doc__grid \.span-2 \{([^}]*)\}/.exec(css)![1]).toMatch(/grid-column:\s*span 2/);
    // 3열 격자(≥ 640px)로 바뀐 뒤에도 이 칸이 한 칸으로 되돌아가지 않는다: 주석을 뺀 CSS에서 .span-2를 다시 적는 곳은 **1열 규칙**(@container docbody (max-width: 11.5rem), QM3-1)뿐이다 —
    // 1열에서는 span 2가 보이지 않는 둘째 열을 만들므로 `1 / -1`(한 줄 전체)로 바꾼다. 미디어 규칙(3열)·2열 안에서는 덮어쓰지 않는다. (QM3-1 이전에는 이 규칙이 하나뿐이었다)
    expect(css.match(/\.span-2/g), '.span-2 규칙: 기본 span 2 + 1열 규칙의 1 / -1').toHaveLength(2);
    const single = /@container docbody \(max-width: 11\.5rem\) \{([^]*?)\n\}/.exec(css);
    expect(single, '1열 컨테이너 규칙').not.toBeNull();
    expect(/\.doc__grid \.span-2 \{([^}]*)\}/.exec(single![1])![1]).toMatch(/grid-column:\s*1 \/ -1/);
    expect(single![1]).toMatch(/\.doc__grid \{\s*grid-template-columns:\s*minmax\(0, 1fr\)/);
  });
});

describe('비교 표 (BR5)는 지금 세상에서만 보인다 (R-263)', () => {
  it('지금 세상: 행 3개, 열 이름 「항목·전체 평균·이 가정 형편」, 각 행에 출처(기관, 조사 이름 (연도))가 있고, 평균이 올해 출생아 평균이 아님을 밝힌다', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const { html, text, c } = render('present', seed * 13);
      expect(html.match(/data-testid="compare-row"/g), `${c.parentWealth}단계`).toHaveLength(3);
      expect(html).toContain('data-testid="compare-card"');
      expect(text).toContain(BIRTH_TEXT.compareTitle);
      for (const col of [BIRTH_TEXT.compareColItem, BIRTH_TEXT.compareColAll, BIRTH_TEXT.compareColThis]) expect(text).toContain(col);
      expect(text).not.toContain('올해 출생아 평균'); // 통계가 학생·가구 전체의 평균이라 출생아 평균이라고 쓰지 않는다
      expect(text).toContain(BIRTH_TEXT.compareNote);
      expect(html).toContain('role="table"'); // 좁은 화면에서 display를 바꿔도 표 의미가 남는다
      // 출처 줄은 Glue가 구절별 span으로 나눠 그리므로 태그를 지운 글자로 센다
      expect(html.replace(/<[^>]+>/g, '').match(/\(\d{4}년\)/g)!.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('R-280: 비교 표 안내의 전체 대상은 「(학생, 가구)」다 — 표의 세 행(학생 2개·가구 1개)에 없는 「인구」가 없고, 화면에 이 문장 그대로 나온다', () => {
    // 어체는 QM3-4가 합쇼체로 통일했다(「…설계값이에요.」 → 「…설계값입니다.」): 이 문장 단언은 뜻·범위(학생, 가구)를 그대로 지키고 끝맺음만 바뀐다
    const expected = '평균은 각 통계의 전체 대상(학생, 가구) 기준이고, 이 가정 열은 수저 단계에 맞춘 소득 구간의 값입니다. 단계와 소득 구간의 대응은 게임의 설계값입니다.';
    expect(BIRTH_TEXT.compareNote).toBe(expected);
    expect(BIRTH_TEXT.compareNote).not.toContain('인구');
    for (let seed = 1; seed <= 10; seed++) {
      const { html, text } = render('present', seed * 19);
      expect(text, `seed ${seed * 19}`).toContain(expected);
      const note = /data-testid="compare-note">([^]*?)<\/p>/.exec(html);
      expect(note, '안내 문단').not.toBeNull();
      expect(note![1].replace(/<[^>]+>/g, '')).not.toContain('인구');
    }
  });

  it('QM3-4: 비교 표 안내 문단은 서류 본문이라 모든 문장이 합쇼체다 — 문구 전체 단언이고 해요체 종결(「…요.」)이 하나도 없다 (이전 구현은 「…설계값이에요.」로 끝났다)', () => {
    const note = '평균은 각 통계의 전체 대상(학생, 가구) 기준이고, 이 가정 열은 수저 단계에 맞춘 소득 구간의 값입니다. 단계와 소득 구간의 대응은 게임의 설계값입니다.';
    expect(BIRTH_TEXT.compareNote).toBe(note);
    const sentences = note.split(/(?<=\.)\s+/);
    expect(sentences, '두 문장').toHaveLength(2);
    for (const s of sentences) {
      expect(s, `합쇼체 종결: ${s}`).toMatch(/(입니다|합니다|됩니다|습니다)\.$/);
      expect(s, `해요체 종결 없음: ${s}`).not.toMatch(/요\.$/);
    }
    expect(note).not.toMatch(/요[.!?]?(\s|$)/); // 문단 어디에도 해요체 어미가 없다
    for (let seed = 1; seed <= 10; seed++) {
      const { html, text } = render('present', seed * 23);
      const shown = /data-testid="compare-note">([^]*?)<\/p>/.exec(html);
      expect(shown, '안내 문단').not.toBeNull();
      expect(shown![1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(), `seed ${seed * 23}: 화면 문단 = 문구 그대로`).toBe(note);
      expect(text).not.toContain('설계값이에요');
    }
  });

  it('R-260: 「같은 소득 분위 유지」 행이 어느 수저 단계 화면에도 없다 (분위·소득 이동 글자 0)', () => {
    for (const w of PARENT_WEALTHS) {
      let found = false;
      for (let seed = 1; seed <= 400 && !found; seed++) {
        const { born, html, text } = render('present', seed * 7);
        if (born.character!.parentWealth !== w) continue;
        found = true;
        expect(html).not.toContain('data-row-id="income-persistence"');
        expect(text).not.toMatch(/소득 분위|같은 소득|분위/);
      }
      expect(found, `공허 통과 방지: ${w}단계 화면을 찾았다`).toBe(true);
    }
  });

  it('R-261: 기대수명 소득 격차는 표 칸이 아니라 모든 수저 단계에 같은 한 줄 서술이다 — 이 가정을 겨냥하지 않는다', () => {
    const lines = new Set<string>();
    for (const w of PARENT_WEALTHS) {
      let found = false;
      for (let seed = 1; seed <= 400 && !found; seed++) {
        const { born, html, text } = render('present', seed * 11);
        if (born.character!.parentWealth !== w) continue;
        found = true;
        const m = /data-testid="life-gap">([^]*?)<\/p>/.exec(html);
        expect(m, `${w}단계`).not.toBeNull();
        const line = m![1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
        lines.add(line);
        expect(line).toBe(lifeGapLine()!.text);
        expect(html).not.toContain('data-row-id="life-expectancy-gap"');
        expect(text).not.toMatch(/짧음|긺|하위 20%는|상위 20%는/);
      }
      expect(found, `${w}단계 화면을 찾았다`).toBe(true);
    }
    expect(lines.size, '다섯 단계가 같은 글').toBe(1);
    expect([...lines][0]).toBe('소득 상위 20%와 하위 20%의 기대수명 차이는 6.48세입니다(2017년). 집단의 평균 차이입니다.');
  });

  it('지난·다가올 세상은 비교 표(카드·행·열 이름·안내·기대수명 서술)가 화면에 없다 — 2024~2025년 통계를 그 시대 가정과 견주지 않는다', () => {
    for (const era of ['past', 'future'] as const) {
      for (let seed = 1; seed <= 25; seed++) {
        const { html, text } = render(era, seed * 17);
        expect(html, `${era} ${seed}`).not.toContain('data-testid="compare-card"');
        expect(html).not.toContain('data-testid="compare-row"');
        expect(html).not.toContain('data-testid="compare-table"');
        expect(html).not.toContain('data-testid="life-gap"');
        expect(text).not.toContain(BIRTH_TEXT.compareTitle);
        expect(text).not.toContain(BIRTH_TEXT.compareNote);
        expect(text).not.toContain('기대수명');
        expect(text).not.toContain('초중고사교육비조사');
        // 같은 화면의 나머지(서류·또래·하단 표기)는 그대로 있다 — 비교 표만 빠진다
        expect(html).toContain('data-testid="birth-grid"');
        expect(html).toContain('data-testid="peers-card"');
        expect(html).toContain('data-testid="page-foot"');
      }
    }
    // 대조군: 지금 세상은 같은 조건에서 비교 표가 있다
    expect(render('present', 17).html).toContain('data-testid="compare-card"');
  });
});

describe('하단 표기 (BR4): 어떤 값이 통계이고 어떤 값이 설계값인가', () => {
  /** 줄바꿈 묶음(Glue)이 같은 글자를 span으로 감싸므로, 태그를 공백 없이 걷어 낸 글자로 본다 */
  const footText = (era: Era, seed: number) => {
    const { html } = render(era, seed);
    return html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ');
  };

  it('세 시대 모두: 통계 출처·설계 보정·주거 한계가 있고, 지난·다가올 세상은 시대 보정 한 줄이 더 있다', () => {
    for (const era of ERAS) {
      const text = footText(era, 5);
      expect(text).toContain(REPORT_NOTES.stats);
      expect(text).toContain(REPORT_NOTES.design);
      expect(text).toContain(REPORT_NOTES.housing);
      expect(text.includes(REPORT_NOTES.eraPast)).toBe(era === 'past');
      expect(text.includes(REPORT_NOTES.eraFuture)).toBe(era === 'future');
    }
  });

  it('R-264: 지역 표기 — 지금·다가올 세상은 2026년 개편 설계값 한 줄, 지난 세상은 「시·군·구 이름은 지금(2025년) 행정구역 이름이며 당시와 다를 수 있습니다」(2026 개편 문구는 쓰지 않는다)', () => {
    expect(REPORT_NOTES.regionPast).toBe('시·군·구 이름은 지금(2025년) 행정구역 이름이며 당시와 다를 수 있습니다.');
    for (const era of ERAS) {
      const { html } = render(era, 9);
      const m = /data-testid="report-footnote-region">([^]*?)<\/p>/.exec(html);
      expect(m, era).not.toBeNull();
      const regionText = m![1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      if (era === 'past') {
        expect(regionText).toBe(REPORT_NOTES.regionPast);
        expect(regionText).not.toContain('2026년에 바뀐');
        expect(regionText).not.toContain('설계값');
      } else {
        expect(regionText).toBe(getRegionFootnote());
        expect(regionText).toContain('2026년에 바뀐 시·도와 시·군·구는 인구 비례로 옮긴 설계값');
      }
    }
  });

  it('R-263: 시대 보정 문구의 범위는 이 서류 격자의 항목(출생 월·출생 체중·부모의 나이와 직업·형제 순서·사는 집)이다 — 비교 표나 「모든 항목」을 말하지 않는다', () => {
    for (const note of [REPORT_NOTES.eraPast, REPORT_NOTES.eraFuture]) {
      for (const item of ['출생 월', '출생 체중', '부모의 나이와 직업', '형제 순서', '사는 집']) expect(note, item).toContain(item);
      expect(note).not.toMatch(/비교|통계표|사교육|항목은/);
      expect(note).toMatch(/설계값/);
      expect(note).not.toMatch(/[!！]/);
    }
    expect(REPORT_NOTES.eraPast).toContain('지금(2025년) 통계를 바탕으로 한 설계값이며 실제 당시 통계가 아닙니다');
    expect(REPORT_NOTES.eraPast).toContain('그 시대에 맞게 조정했습니다');
    expect(REPORT_NOTES.eraFuture).toContain('예측이 아닙니다');
  });
});

describe('안전한 이동 (BR7)와 접근성', () => {
  it('「살아가기」 버튼이 하단 고정 띠에 있고 입력 가드(GuardedButton)를 쓰며, 화면 제목(h1)이 포커스를 받을 수 있다(tabIndex -1)', () => {
    const { html } = render('present', 3);
    expect(html).toContain('data-testid="next-life"');
    expect(html).toMatch(/<div class="bottom-bar" data-testid="bottom-bar">/);
    expect(html).toContain('data-testid="birth-heading"');
    expect(html).toContain('tabindex="-1"');
    expect(birthScreenSrc).toContain('<GuardedButton');
    expect(birthScreenSrc).toContain('useBottomBar(barRef)');
    expect(birthScreenSrc).toContain('useFocusOnChange');
  });

  it('외부 이미지·링크가 없고(CM3) 원시 HTML 삽입이 없다', () => {
    const { html } = render('future', 9);
    // 로고 SVG의 xmlns 선언(XML 이름공간 이름이지 주소로 내려받는 것이 아니다)만 빼고 http(s) 주소가 없다
    expect(html.replace(/xmlns="http:\/\/www\.w3\.org\/2000\/svg"/g, '')).not.toMatch(/https?:\/\//);
    expect(birthScreenSrc).not.toContain('dangerouslySetInnerHTML');
    expect(codeOnly(birthScreenSrc)).not.toContain('Math.random');
  });
});
