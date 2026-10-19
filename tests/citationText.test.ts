import { describe, expect, it } from 'vitest';
import { CITATION_TABLE, getCitation, type CitationRecord } from '../src/data/citationsAccess';
import { DASH_TEXT } from '../src/data/dashText';
import { EVENT_POOL } from '../src/data/events';
import { FUTURE_PREFIX, authorSurnames, dominantLang, latinRuns, citationFor, citationIdFor, citationText, citationValidAt, citationValidRange, eraPrefixOf, formatSourceLine, sourceWho, splitSourceLine } from '../src/core/citations';

/**
 * 인용 표시 순수 함수 (SPEC-003 MD2·EV6, M7b — docs/design/copy.md 6-3절): 출처 줄 변환 표, 시대 머리말, 게임 속 연도 거르기, 카드 × 세상 × 연도 → 보일 인용.
 * 표의 기대값은 copy.md 6-3 「변환 예」를 사람이 옮겨 적은 글자다(구현의 규칙을 다시 계산하지 않는다).
 */

const cite = (id: string): CitationRecord => {
  const c = CITATION_TABLE.find((x) => x.id === id);
  if (c === undefined) throw new Error(`인용 없음: ${id}`);
  return c;
};

/** 합성 인용 (규칙만 시험한다 — 실제 데이터가 바뀌어도 이 표는 바뀌지 않는다) */
function synth(over: Partial<CitationRecord> & { id: string }): CitationRecord {
  return {
    kind: 'stat',
    text: '2025년 어떤 값은 10%였습니다.',
    source: { org: '국가데이터처', title: '어떤 통계 결과', year: 2026 },
    basisId: 's-001',
    eras: ['present'],
    verified: true,
    usable: true,
    ...over,
  };
}

describe('출처 줄 formatSourceLine (copy.md 6-3 변환 예)', () => {
  it('통계는 기관 그대로: 「국가데이터처(2026), 2025년 초중고사교육비조사 결과」', () => {
    expect(formatSourceLine(cite('c-006').source, 'stat')).toBe('국가데이터처(2026), 2025년 초중고사교육비조사 결과');
  });

  it('연구는 저자 성만 — 1명 「Volling」, 3명 이상 「첫 저자 외」 (Teti 5명, Felitti 8명)', () => {
    expect(formatSourceLine(cite('c-032').source, 'research')).toBe("Volling(2012), Family transitions following the birth of a sibling: an empirical review of changes in the firstborn's adjustment");
    expect(formatSourceLine(cite('c-033').source, 'research')).toBe('Teti 외(1996), And baby makes four: predictors of attachment security among preschool-age firstborns during the transition to siblinghood');
    expect(formatSourceLine(cite('c-038').source, 'research').startsWith('Felitti 외(1998), ')).toBe(true);
  });

  it('연구 저자 2명은 「A·B」 한 묶음 (Shonkoff·Garner)', () => {
    expect(formatSourceLine(cite('c-036').source, 'research').startsWith('Shonkoff·Garner(2012), ')).toBe(true);
    expect(splitSourceLine(cite('c-036').source, 'research').head).toBe('Shonkoff·Garner(2012),');
  });

  it('저자 목록 꼴이 아닌 연구 출처는 기관 그대로: 「질병관리청」·「세계보건기구(WHO)」·연구 그룹 이름', () => {
    expect(formatSourceLine(cite('c-040').source, 'research').startsWith('질병관리청(2025), ')).toBe(true);
    expect(formatSourceLine(cite('c-034').source, 'research').startsWith('WHO Multicentre Growth Reference Study Group(2006), ')).toBe(true);
  });

  it('「누가」가 괄호로 끝나면 연도 괄호 앞에 한 칸: 「세계보건기구(WHO) (2019), Guidelines on …」 — 「(WHO)(2019)」로 붙지 않는다', () => {
    expect(formatSourceLine(cite('c-035').source, 'research')).toBe('세계보건기구(WHO) (2019), Guidelines on physical activity, sedentary behaviour and sleep for children under 5 years of age');
    const withParen = formatSourceLine(cite('c-042').source, 'research');
    expect(withParen).toMatch(/국가데이터연구원\) \(2019\), /);
    expect(withParen).not.toContain(')(');
  });

  it('열람 연도(yearKind: accessed)는 「N년 열람」: 「질병관리청(2026년 열람), 예방접종도우미 — …」', () => {
    expect(formatSourceLine(cite('c-039').source, 'research').startsWith('질병관리청(2026년 열람), 예방접종도우미 — ')).toBe(true);
    expect(splitSourceLine(cite('c-066').source, 'stat').head).toBe('한국환경공단 층간소음 이웃사이센터(2026년 열람),');
  });

  it('source.authors(저자 성 배열)가 있으면 org를 파싱하지 않고 그것을 먼저 읽는다 (D-53)', () => {
    const src = { org: '어느 저자 목록 꼴이 아닌 글자', title: 'Some Title', year: 2001, authors: ['Kim', 'Lee', 'Park'] };
    expect(formatSourceLine(src, 'research')).toBe('Kim 외(2001), Some Title');
    expect(formatSourceLine({ ...src, authors: ['Kim', 'Lee'] }, 'research')).toBe('Kim·Lee(2001), Some Title');
    expect(formatSourceLine({ ...src, authors: ['Kim'] }, 'research')).toBe('Kim(2001), Some Title');
    // 통계는 authors가 있어도 기관 그대로
    expect(formatSourceLine(src, 'stat')).toBe('어느 저자 목록 꼴이 아닌 글자(2001), Some Title');
  });

  it('authorSurnames: 저자 목록 꼴만 성을 돌려주고 나머지는 null', () => {
    expect(authorSurnames('Volling, B. L.')).toEqual(['Volling']);
    expect(authorSurnames('Shonkoff, J. P., & Garner, A. S.')).toEqual(['Shonkoff', 'Garner']);
    expect(authorSurnames('Kim, J.-M., Lee, S. H., & van der Berg, A.')).toEqual(['Kim', 'Lee', 'van der Berg']);
    for (const org of ['질병관리청', '세계보건기구(WHO)', 'WHO Multicentre Growth Reference Study Group', '교육부, 한국교육개발원', 'A, B, C']) expect(authorSurnames(org), org).toBeNull();
  });

  it('sourceWho: 통계는 authors가 있어도 기관, 연구는 저자 성', () => {
    expect(sourceWho({ org: '교육부·한국교육개발원', title: 't', year: 2025 }, 'stat')).toBe('교육부, 한국교육개발원'); // 통계 기관 사이의 가운뎃점은 쉼표 나열로 보인다
    expect(sourceWho({ org: 'Volling, B. L.', title: 't', year: 2012 }, 'research')).toBe('Volling');
  });

  it('통계의 기관이 둘 이상이면 쉼표 나열(「국가데이터처, 교육부」), 자료 이름의 띄어 쓴 줄표(「 — 」)는 쌍점(「: 」)으로 — 연구의 원제는 줄표도 그대로 (QM2-5·QM2-10)', () => {
    const src = { org: '국가데이터처·교육부', title: '초중고사교육비조사 — 초등 방과후·돌봄 교육 이용률', year: 2026 };
    expect(formatSourceLine(src, 'stat')).toBe('국가데이터처, 교육부(2026), 초중고사교육비조사: 초등 방과후·돌봄 교육 이용률');
    expect(splitSourceLine(src, 'stat').head).toBe('국가데이터처, 교육부(2026),');
    // 연구는 원제 그대로 — 질병관리청 안내 페이지의 줄표도 지우지 않는다
    expect(formatSourceLine(cite('c-039').source, 'research')).toContain('예방접종도우미 — ');
    // 통계 인용 어디에도 줄 끝·첫머리에 남을 수 있는 「 — 」·기관 사이 「·」가 출처 줄에 없다
    for (const c of CITATION_TABLE.filter((x) => x.kind === 'stat')) {
      const line = formatSourceLine(c.source, 'stat');
      expect(line, c.id).not.toMatch(/ — /);
      expect(splitSourceLine(c.source, 'stat').head, c.id).not.toContain('·');
    }
  });

  it('원제 그대로(번역·줄임 없음)이고 링크·DOI·URL·PMID·학술지 서지는 어떤 인용의 출처 줄에도 없다 (EV6) — 통계의 줄표만 쌍점으로 보인다', () => {
    for (const c of CITATION_TABLE) {
      const line = formatSourceLine(c.source, c.kind);
      expect(line.endsWith(c.kind === 'stat' ? c.source.title.replace(/ — /g, ': ') : c.source.title), c.id).toBe(true);
      expect(line, c.id).not.toMatch(/https?:|www\.|doi|pmid|10\.\d{4}\//i);
      if (c.source.venue !== undefined) expect(line, c.id).not.toContain(c.source.venue);
      if (c.source.url !== undefined) expect(line, c.id).not.toContain(c.source.url);
    }
  });
});

describe('시대 머리말 eraPrefixOf · citationText', () => {
  it('지금 세상은 머리말이 없다: 요약 그대로', () => {
    expect(eraPrefixOf(cite('c-033'), 'present')).toBe('');
    expect(citationText(cite('c-033'), 'present')).toBe(cite('c-033').text);
  });

  it('지난 세상의 시대 무관 연구는 「지금의 연구로는」, 다가올 세상의 지금 통계·연구는 「지금 기준으로는」 — 한 칸 띄운 같은 글자 안의 머리말이다 (꾸미지 않는다)', () => {
    expect(citationText(cite('c-033'), 'past')).toBe(`지금의 연구로는 ${cite('c-033').text}`);
    expect(citationText(cite('c-033'), 'future')).toBe(`지금 기준으로는 ${cite('c-033').text}`);
    expect(citationText(cite('c-006'), 'future')).toBe(`지금 기준으로는 ${cite('c-006').text}`);
    expect(FUTURE_PREFIX).toBe(DASH_TEXT.eraPrefixFuture);
  });

  it('머리말 데이터가 없어도 안전한 기본값: 다가올 세상은 present를 가진 인용에만 상수 머리말, 지난 세상은 데이터가 정한 것만, 다가올 세상 전용 전망에는 붙이지 않는다', () => {
    expect(eraPrefixOf(synth({ id: 'c-900', eras: ['present', 'future'] }), 'future')).toBe('지금 기준으로는');
    expect(eraPrefixOf(synth({ id: 'c-901', eras: ['future'] }), 'future')).toBe('');
    expect(eraPrefixOf(synth({ id: 'c-902', eras: ['past', 'present'] }), 'past')).toBe('');
    expect(eraPrefixOf(synth({ id: 'c-903', eras: ['past'], eraPrefix: { past: '지금의 연구로는' } }), 'past')).toBe('지금의 연구로는');
    expect(eraPrefixOf(synth({ id: 'c-904', eras: ['present', 'future'], eraPrefix: { future: '지금 기준으로는' } }), 'future')).toBe('지금 기준으로는');
  });

  it('표시 문자열(머리말 + 한 칸 + 요약)은 모든 인용 × 모든 세상에서 100자 이하다', () => {
    for (const c of CITATION_TABLE) for (const era of c.eras) expect(citationText(c, era).length, `${c.id} ${era}`).toBeLessThanOrEqual(100);
  });
});

describe('게임 속 연도 거르기 citationValidAt (R-182)', () => {
  it('validFromYear가 있으면 그 해부터 보인다(경계 포함), 없으면 통계는 refs 연도의 최댓값부터, 연구는 한계 없음', () => {
    const withField = synth({ id: 'c-910', validFromYear: 1989, refs: [{ indicator: 'x', year: 1970, value: 1 }] });
    expect(citationValidAt(withField, 1988)).toBe(false);
    expect(citationValidAt(withField, 1989)).toBe(true);
    const derived = synth({ id: 'c-911', refs: [{ indicator: 'x', year: 1970, value: 1 }, { indicator: 'x', year: 1983, value: 2 }] });
    expect(citationValidRange(derived).from).toBe(1983);
    expect(citationValidAt(derived, 1982)).toBe(false);
    expect(citationValidAt(derived, 1983)).toBe(true);
    const research = synth({ id: 'c-912', kind: 'research', refs: [] });
    expect(citationValidRange(research).from).toBe(Number.NEGATIVE_INFINITY);
    expect(citationValidAt(research, 1950)).toBe(true);
  });

  it('연도가 없는 참조(표 행·키 참조)는 건너뛴다 — 모두 없으면 한계 없음', () => {
    const noYear = synth({ id: 'c-913', refs: [{ indicator: 'x', value: 1 } as never] });
    expect(citationValidRange(noYear).from).toBe(Number.NEGATIVE_INFINITY);
  });

  it('validUntilYear(전망 인용)는 그 해까지만 보인다', () => {
    const projection = synth({ id: 'c-914', eras: ['future'], kind: 'research', validUntilYear: 2049 });
    expect(citationValidAt(projection, 2049)).toBe(true);
    expect(citationValidAt(projection, 2050)).toBe(false);
  });

  it('실제 데이터: 지난 세상 통계 15건은 모두 validFromYear가 있고 문장에 나오는 가장 늦은 해이다 — 1989년 값이 든 인용은 1988년에 보이지 않는다', () => {
    const past = CITATION_TABLE.filter((c) => c.eras.includes('past') && c.kind === 'stat');
    expect(past).toHaveLength(15);
    for (const c of past) {
      expect(c.validFromYear, c.id).toBeDefined();
      const years = [...c.text.matchAll(/(19[5-9]\d|20\d\d)년/g)].map((m) => Number(m[1]));
      expect(c.validFromYear, c.id).toBe(Math.max(...years));
    }
    expect(citationValidAt(cite('c-053'), 1988)).toBe(false);
    expect(citationValidAt(cite('c-053'), 1989)).toBe(true);
    expect(citationValidAt(cite('c-097'), 1969)).toBe(false); // 짧은 변형: 1970년 값만
    expect(citationValidAt(cite('c-097'), 1970)).toBe(true);
    // 1980년 값만 쓰는 변형(R-396): 1989년 값이 든 c-089는 1988년에 보이지 않지만 c-100은 1980년부터 보인다
    expect(citationValidAt(cite('c-089'), 1988)).toBe(false);
    expect(citationValidAt(cite('c-100'), 1979)).toBe(false);
    expect(citationValidAt(cite('c-100'), 1980)).toBe(true);
    expect(citationValidAt(cite('c-101'), 1980)).toBe(true);
  });
});

describe('citationFor — 카드 × 세상 × 게임 속 연도 → 보일 인용', () => {
  it('citation 필드: 문자열은 모든 세상 같은 인용, 객체는 세상별(적히지 않은 세상은 없음)', () => {
    expect(citationIdFor({ citation: 'c-006' }, 'past')).toBe('c-006');
    expect(citationIdFor({ citation: { present: 'c-006', future: 'c-013' } }, 'present')).toBe('c-006');
    expect(citationIdFor({ citation: { present: 'c-006', future: 'c-013' } }, 'future')).toBe('c-013');
    expect(citationIdFor({ citation: { present: 'c-006' } }, 'past')).toBeNull();
    expect(citationIdFor({}, 'present')).toBeNull();
  });

  it('보일 인용을 {id, 종류, 표시 문자열, 출처 줄}로 돌려준다 (합성 표)', () => {
    const table = [synth({ id: 'c-920', eras: ['present', 'future'], text: '2025년 값은 7%였습니다.' })];
    const present = citationFor({ citation: 'c-920' }, 'present', 2040, table)!;
    expect(present).toEqual({ id: 'c-920', kind: 'stat', text: '2025년 값은 7%였습니다.', sourceWho: '국가데이터처(2026),', sourceTitle: '어떤 통계 결과', sourceLine: '국가데이터처(2026), 어떤 통계 결과' });
    expect(citationFor({ citation: 'c-920' }, 'future', 2040, table)!.text).toBe('지금 기준으로는 2025년 값은 7%였습니다.');
  });

  it('null이 되는 경우: 연결 없음 · 없는 id · 확인되지 않은(unverified)·쓸 수 없는(usable false) 인용 · 인용의 eras에 그 세상이 없음 · 연도 범위 밖', () => {
    const table = [
      synth({ id: 'c-930' }),
      synth({ id: 'c-931', verified: false, usable: false }),
      synth({ id: 'c-932', eras: ['past'], validFromYear: 1980 }),
    ];
    expect(citationFor({}, 'present', 2030, table)).toBeNull();
    expect(citationFor({ citation: 'c-999' }, 'present', 2030, table)).toBeNull();
    expect(citationFor({ citation: 'c-931' }, 'present', 2030, table)).toBeNull();
    // 지금 통계(eras: present만)를 다가올 세상 카드에 연결해도 데이터가 future를 허용하기 전에는 보이지 않는다 — 머리말 없는 지금 통계를 다가올 세상에서 보이지 않는다
    expect(citationFor({ citation: 'c-930' }, 'future', 2040, table)).toBeNull();
    expect(citationFor({ citation: 'c-930' }, 'past', 1975, table)).toBeNull();
    expect(citationFor({ citation: 'c-932' }, 'past', 1979, table)).toBeNull();
    expect(citationFor({ citation: 'c-932' }, 'past', 1980, table)).not.toBeNull();
  });

  it('실제 카드: 사교육 카드(school-tutoring)는 지금 세상에서 c-006 통계, 다가올 세상에서 「지금 기준으로는」 머리말, 지난 세상에서는 인용이 없다', () => {
    const ev = EVENT_POOL.byId.get('school-tutoring')!;
    const present = citationFor(ev, 'present', 2038)!;
    expect(present.id).toBe('c-006');
    expect(present.text).toBe(cite('c-006').text);
    expect(present.sourceLine).toBe('국가데이터처(2026), 2025년 초중고사교육비조사 결과');
    expect(citationFor(ev, 'future', 2045)!.text.startsWith('지금 기준으로는 2025년 초·중·고 학생의 75.7%')).toBe(true);
    expect(citationFor(ev, 'past', 1975)).toBeNull();
  });

  it('실제 카드: 동생 맞이(infant-new-sibling)는 세 세상 모두 연구 c-033이고 머리말이 세상마다 다르다 (지금: 없음 · 지난: 지금의 연구로는 · 다가올: 지금 기준으로는)', () => {
    const ev = EVENT_POOL.byId.get('infant-new-sibling')!;
    expect(citationFor(ev, 'present', 2029)!.text).toBe(cite('c-033').text);
    expect(citationFor(ev, 'past', 1962)!.text).toBe(`지금의 연구로는 ${cite('c-033').text}`);
    expect(citationFor(ev, 'future', 2045)!.text).toBe(`지금 기준으로는 ${cite('c-033').text}`);
    expect(citationFor(ev, 'present', 2029)!.sourceWho).toBe('Teti 외(1996),');
  });

  it('실제 카드: 지난 세상의 통계 인용은 게임 속 연도 이전 값이 새지 않는다 — 가정 형편 때문에 학교를 쉬는 카드(school-family-priority, c-097 1970년 값)는 1969년에 보이지 않고 1970년부터 보인다', () => {
    const ev = EVENT_POOL.byId.get('school-family-priority')!;
    expect(citationFor(ev, 'past', 1969)).toBeNull();
    expect(citationFor(ev, 'past', 1970)!.id).toBe('c-097');
  });

  it('인용이 없는 카드(무인용 사유가 있는 카드)는 어떤 세상·연도에도 null이다', () => {
    for (const id of ['infant-fever', 'middle-health-check', 'youth-reunion']) {
      const ev = EVENT_POOL.byId.get(id)!;
      expect(ev.noCitation, id).toBeDefined();
      for (const era of ['past', 'present', 'future'] as const) expect(citationFor(ev, era, 2040), `${id} ${era}`).toBeNull();
    }
  });

  it('getCitation은 verified·usable인 인용만 돌려준다', () => {
    expect(getCitation('c-006')?.id).toBe('c-006');
    expect(getCitation('c-999')).toBeUndefined();
    expect(getCitation('c-931', [synth({ id: 'c-931', verified: false, usable: false })])).toBeUndefined();
  });
});

describe('줄바꿈 안전: 카드에 연결된 인용의 표시 문자열 (QM2-10, D-66 — REV-003-M7b-2 R-398)', () => {
  /**
   * 추정 폭(em) — designer 규격(D-66): 한글 1em · 숫자·라틴 0.55em · 「·」「.」「,」「:」 0.25em · 괄호 0.3em(실측값). 그 밖의 기호는 0.6em으로 넉넉히 잡는다.
   * 요약(.cite__text)은 글자 200%에서 28px, 출처(.cite__src)는 24px. 가장 좁은 한 줄(폭 320 인라인 · 글자 200%)은 223px.
   */
  const EM = (ch: string): number => (/[가-힣]/.test(ch) ? 1 : /[0-9A-Za-z]/.test(ch) ? 0.55 : /[·.,:]/.test(ch) ? 0.25 : /[()]/.test(ch) ? 0.3 : 0.6);
  const em = (token: string): number => [...token].reduce((sum, ch) => sum + EM(ch), 0);
  const SUMMARY_PX = 28;
  const SOURCE_PX = 24;
  const LINE_PX = 223;
  /** 요약 사슬 ≤ 203px(한글 7자 + 마침표) · 출처 사슬 ≤ 216px(한글 9자 상당) */
  const SUMMARY_CHAIN_MAX = 203;
  const SOURCE_CHAIN_MAX = 216;
  const CHAIN = /[·/—]/;
  const EPS = 0.0001;
  const connected = CITATION_TABLE.filter((c) => (c.usedBy ?? []).length > 0);

  /** 연결된 인용이 어느 세상에서든 화면에 그리는 문자열: 요약(머리말 포함)과 출처 줄의 앞머리·자료 이름 */
  const displays = connected.flatMap((c) =>
    c.eras.map((era) => ({ id: c.id, era, summary: citationText(c, era), ...splitSourceLine(c.source, c.kind) })),
  );

  it('구분 기호(가운뎃점·빗금·줄표)로 이은 낱말(붙은 괄호·구두점 포함)은 요약 ≤ 203px, 출처 앞머리·자료 이름 ≤ 216px다 — 한 줄(223px)보다 긴 사슬은 어디서 끊어도 기호가 줄 끝·첫머리에 남는다 (D-66)', () => {
    expect(displays.length, '연결된 인용 × 세상').toBeGreaterThanOrEqual(80);
    let chains = 0;
    for (const d of displays) {
      for (const token of d.summary.split(/\s+/)) {
        if (!CHAIN.test(token)) continue;
        chains++;
        expect(em(token) * SUMMARY_PX, `${d.id}(${d.era}) 요약 「${token}」`).toBeLessThanOrEqual(SUMMARY_CHAIN_MAX + EPS);
      }
      for (const [part, text] of [['앞머리', d.head], ['자료 이름', d.title]] as const) {
        for (const token of text.split(/\s+/)) {
          if (!CHAIN.test(token)) continue;
          chains++;
          expect(em(token) * SOURCE_PX, `${d.id}(${d.era}) 출처 ${part} 「${token}」`).toBeLessThanOrEqual(SOURCE_CHAIN_MAX + EPS);
        }
      }
    }
    expect(chains, '검사한 구분 기호 낱말(공허 통과 방지)').toBeGreaterThanOrEqual(3);
  });

  it('요약 끝의 「숫자+단위+서술어+.」 덩어리는 추정 폭이 216~223px 창에 들지 않는다 — 들면 마침표가 다음 줄 첫머리에 혼자 남는다(c-097 「4.53명이었습니다.」 226.5px의 꼴)', () => {
    let tails = 0;
    for (const d of displays) {
      const last = d.summary.split(/\s+/).at(-1)!;
      if (!/^\d/.test(last) || !last.endsWith('.')) continue;
      tails++;
      const withoutPeriod = em(last.slice(0, -1)) * SUMMARY_PX;
      const inWindow = withoutPeriod > SOURCE_CHAIN_MAX && withoutPeriod <= LINE_PX;
      expect(inWindow, `${d.id}(${d.era}) 요약 끝 「${last}」 추정 ${withoutPeriod.toFixed(1)}px — 216~223px 창(마침표 고아)`).toBe(false);
    }
    expect(tails, '검사한 문장 끝 덩어리(공허 통과 방지)').toBeGreaterThanOrEqual(3);
  });

  it('이 시험이 실제로 잡는다(공허 통과 방지): 고치기 전 꼴 — 출처 「출생아수·합계출산율(1970~)」 사슬 · 요약 끝 「4.53명이었습니다.」 · 「권고사직·명예퇴직·정리해고로」 — 은 규격을 어긴다', () => {
    expect(em('출생아수·합계출산율(1970~)') * SOURCE_PX, '출처 사슬(옛 c-097·c-099)').toBeGreaterThan(SOURCE_CHAIN_MAX);
    expect(em('혼인건수·조혼인율(1970~)') * SOURCE_PX, '출처 사슬(옛 c-098)').toBeGreaterThan(SOURCE_CHAIN_MAX);
    const tail = em('4.53명이었습니다') * SUMMARY_PX;
    expect(tail > SOURCE_CHAIN_MAX && tail <= LINE_PX, `옛 c-097 요약 끝 ${tail.toFixed(1)}px`).toBe(true);
    expect(em('권고사직·명예퇴직·정리해고로') * SUMMARY_PX, '옛 c-083 요약 사슬').toBeGreaterThan(SUMMARY_CHAIN_MAX);
    expect(em('방과후학교·돌봄(늘봄학교)에') * SUMMARY_PX, '옛 c-063 요약 사슬').toBeGreaterThan(SUMMARY_CHAIN_MAX);
  });
});

describe('접근성: 영문 표기에 lang (QA-003-M7b K11)', () => {
  it('latinRuns: 영문 덩어리만 가른다 — 「Teti 외(1996),」 → 「Teti」, 「Shonkoff·Garner」 → 둘, 한글·괄호·연도는 아니다, 영문 원제는 통째로', () => {
    expect(latinRuns('Teti 외(1996),')).toEqual([{ text: 'Teti', latin: true }, { text: ' 외(1996),', latin: false }]);
    expect(latinRuns('Shonkoff·Garner(2000),').filter((r) => r.latin).map((r) => r.text)).toEqual(['Shonkoff', 'Garner']);
    expect(latinRuns('세계보건기구(WHO) (2019),').filter((r) => r.latin).map((r) => r.text)).toEqual(['WHO']);
    expect(latinRuns('국가데이터처(2026),')).toEqual([{ text: '국가데이터처(2026),', latin: false }]);
    expect(latinRuns("And baby makes four: Sibling's arrival").map((r) => r.latin)).toEqual([true]);
    // 덩어리를 이어 붙이면 원문 그대로다(글자를 바꾸지 않는다)
    for (const s of ['Teti 외(1996),', 'Shonkoff·Garner(2000),', '세계보건기구(WHO) (2019),', 'Guidelines on physical activity: 5세 미만']) expect(latinRuns(s).map((r) => r.text).join('')).toBe(s);
  });

  it('dominantLang: 영문이 한글보다 많은 자료 이름만 en — 한국어 통계 이름·한글이 많은 혼합은 아니다', () => {
    expect(dominantLang('And baby makes four: Sibling')).toBe('en');
    expect(dominantLang('Guidelines on physical activity, sedentary behaviour and sleep for children under 5 years of age')).toBe('en');
    expect(dominantLang('초중고사교육비조사: 초중고 사교육비 총액')).toBeUndefined();
    expect(dominantLang('세계보건기구(WHO) 지침')).toBeUndefined();
    expect(dominantLang('')).toBeUndefined();
  });

  it('실제 연결된 연구 인용(c-033)의 출처: 앞머리의 영문 성과 영문 원제가 en으로 갈린다', () => {
    const c = cite('c-033');
    const { head, title } = splitSourceLine(c.source, c.kind);
    expect(latinRuns(head).filter((r) => r.latin).map((r) => r.text)).toEqual(['Teti']);
    expect(dominantLang(title)).toBe('en');
  });
});
