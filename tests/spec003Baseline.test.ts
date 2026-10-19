import { describe, expect, it } from 'vitest';
import baselineDoc from '../docs/data/spec-003-baseline.md?raw';
import basisDoc from '../docs/data/events-stats-basis.md?raw';
import sourcesDoc from '../docs/data/korea-stats-sources.md?raw';
import csvRaw from '../docs/data/korea-life-data-sources.csv?raw';
import readme from '../README.md?raw';
import { EVENT_POOL } from '../src/data/events';
import { eventCounts, possibleEventsAt } from '../scripts/spec003BaselineLib';
import { findLocalPathLeaks, localAccountNames } from './helpers/localPathLeaks';

/**
 * SPEC-003 M0 기준선 V1 기록(docs/data/spec-003-baseline.md)과 M6a 자료 표(docs/data/korea-life-data-sources.csv) 점검.
 * 기준선 문서는 「SPEC-001 완료 시점의 스냅숏」이다. 이벤트가 늘어나는 M7 이후에도 이 테스트가 깨지지 않도록,
 * 이벤트 풀이 기준선(112개)일 때만 문서 숫자를 풀의 실제 값과 맞대어 보고, 그 뒤에는 「기준선 이벤트가 지워지지 않았다」만 본다.
 */

const BASELINE_TOTAL = 112;
const AT_BASELINE = EVENT_POOL.events.length === BASELINE_TOTAL;
const INFANT_BASELINE_IDS = [
  'infant-first-word',
  'infant-care',
  'infant-fever',
  'infant-stories',
  'infant-screen',
  'infant-new-sibling',
  'infant-village',
  'infant-grandparent-song',
  'infant-neglect-night',
  'infant-hovering',
  'infant-free-play',
];

describe('기준선 문서 — 이벤트 수·영유아 빈틈 (스냅숏)', () => {
  it('문서에 이벤트 112개(선택지 78 + 서술 34), 영유아 11개(서술 6 + 선택지 5), 0세·7세 0개가 적혀 있다', () => {
    expect(baselineDoc).toContain('112개');
    expect(baselineDoc).toContain('선택지 78');
    expect(baselineDoc).toContain('서술 34');
    expect(baselineDoc).toContain('영유아 11개');
    expect(baselineDoc).toMatch(/\|\s*0세\s*\|\s*0\s*\|\s*0\s*\|\s*0\s*\|/);
    expect(baselineDoc).toMatch(/\|\s*7세\s*\|\s*0\s*\|\s*0\s*\|\s*0\s*\|/);
  });

  it('문서에 번들 크기(JS·CSS·HTML gzip)와 400KB 예산이 적혀 있다', () => {
    for (const s of ['335,969', '101,429', '6,925', '1,955', '103,668', '400KB']) expect(baselineDoc, s).toContain(s);
  });

  it('문서에 시뮬레이션 수치(0~7세 사건 없는 해 평균, 영유아 선택지, 판당 선택지, 1배속 분, 6000판 위반 0)가 적혀 있다', () => {
    for (const s of ['5.43', '5.62', '5.61', '1.45', '22.6', '23.4', '23.8', '6000판', '위반이 있는 판 0']) expect(baselineDoc, s).toContain(s);
  });

  it('문서에 SPEC-003의 목표값(IN1·IN2)과 현재의 격차가 같이 있다: 영유아 40개, 각 나이 4개, 사건 없는 해 ≤ 1.0, 인생 기록 줄 ≥ 10, 선택지 ≥ 4', () => {
    for (const s of ['IN1', 'IN2', '40개', '4개', '1.0', '10줄', '4개']) expect(baselineDoc, s).toContain(s);
  });

  it('기준선의 영유아 이벤트 11개는 지금도 이벤트 풀에 남아 있다 (id 삭제 금지)', () => {
    const ids = new Set(EVENT_POOL.events.map((e) => e.id));
    for (const id of INFANT_BASELINE_IDS) {
      expect(ids.has(id), id).toBe(true);
      expect(baselineDoc, id).toContain(id);
    }
  });

  it('이벤트 수 계산 함수: 전체 = 선택지 + 서술이고 기준선(112) 아래로 줄지 않는다', () => {
    const c = eventCounts();
    expect(c.total).toBe(c.choice + c.narrative);
    expect(c.total).toBe(EVENT_POOL.events.length);
    expect(c.total).toBeGreaterThanOrEqual(BASELINE_TOTAL);
    for (const stage of ['infant', 'school', 'youth', 'middle', 'senior']) expect(c.byStage[stage].total, stage).toBeGreaterThanOrEqual(c.byStage[stage].choice);
  });

  it.runIf(AT_BASELINE)('이벤트 풀이 기준선일 때 문서의 숫자가 실제 값과 같다: 112 = 78 + 34, 영유아 11 (5/6), 0세·7세 0개(세 시대)', () => {
    const c = eventCounts();
    expect(c.choice).toBe(78);
    expect(c.narrative).toBe(34);
    expect(c.byStage.infant).toEqual({ total: 11, choice: 5, narrative: 6 });
    for (const era of ['past', 'present', 'future'] as const) {
      expect(possibleEventsAt(0, era), `0세 ${era}`).toBe(0);
      expect(possibleEventsAt(7, era), `7세 ${era}`).toBe(0);
    }
    expect(possibleEventsAt(2, 'present')).toBe(10);
    expect(possibleEventsAt(1, 'past')).toBe(7);
    expect(possibleEventsAt(1, 'present')).toBe(6);
  });

  it('나이별 가능 이벤트 수는 항상 이벤트 풀 크기를 넘지 못하고, 영유아 단계 밖 나이에는 영유아 이벤트가 포함되지 않는다', () => {
    for (let age = 0; age <= 100; age += 5) for (const era of ['past', 'present', 'future'] as const) expect(possibleEventsAt(age, era)).toBeLessThanOrEqual(EVENT_POOL.events.length);
    const infantOnly = EVENT_POOL.events.filter((e) => e.stages.length === 1 && e.stages[0] === 'infant');
    expect(infantOnly.length).toBeGreaterThan(0);
    expect(possibleEventsAt(30, 'present')).toBeGreaterThan(0);
  });
});

describe('README (DP1: 비공식 학습 프로젝트·라이선스 한 줄)', () => {
  it('「비공식 학습 프로젝트」, 「다른 게임·서비스와 무관」 문구가 있다', () => {
    expect(readme).toContain('비공식 학습 프로젝트');
    expect(readme).toMatch(/다른 게임.{0,12}무관/);
  });

  it('라이선스 한 줄이 있다: All rights reserved — 공개 열람만, 재사용 불가', () => {
    expect(readme).toContain('## 라이선스');
    expect(readme).toContain('All rights reserved — 공개 열람만, 재사용 불가');
  });

  it('통계 데이터 출처 안내가 korea-stats-sources.md를 가리키고 문서 지도에 docs/data/가 있다', () => {
    expect(readme).toContain('docs/data/korea-stats-sources.md');
    expect(readme).toContain('docs/data/');
  });
});

/** 간단한 CSV 파서(따옴표·줄바꿈 포함 필드 지원) */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const t = text.replace(/^﻿/, '');
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (quoted) {
      if (c === '"') {
        if (t[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\r') {
      // 줄 끝 CR은 무시
    } else if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

const HEADER = ['단계', '순번', '데이터_소스', '작성기관', '핵심_지표', '게임_활용처', '패널_여부', '관련_링크', '공식_사이트', '비고', '기준연도', '잠정/확정', '접근방식', '이용조건', '원문대조', '게임_마일스톤', '근거_basisId', '정정_내역', '원본_순번', '대응_메모', '미대조_값'];
const TABLE = parseCsv(csvRaw);
const ROWS = TABLE.slice(1).filter((r) => r.length > 1);
const col = (r: string[], name: string): string => r[HEADER.indexOf(name)];
const rowOf = (needle: string): string[] => {
  const r = ROWS.find((x) => col(x, '데이터_소스').includes(needle));
  if (!r) throw new Error(`CSV 행 없음: ${needle}`);
  return r;
};
const NEWS = /(mk\.co\.kr|yna\.co\.kr|korea\.kr\/briefing|chosun|donga|hani\.co\.kr|joongang|hankyung|mt\.co\.kr|newsis|nate\.com|news1|edaily|sedaily|segye|khan\.co\.kr|ytn|sbs|kbs|mbc|jtbc)/;

describe('인생 단계별 데이터 소스 표 (korea-life-data-sources.csv, 형진 님 CSV 31행을 정리·보완)', () => {
  it('머리글은 형진 님 CSV의 10개 열 + 8개 열(기준연도·잠정/확정·접근방식·이용조건·원문대조·게임_마일스톤·근거_basisId·정정_내역) + 3개 열(원본_순번·대응_메모·미대조_값)이고 모든 행이 21칸이다', () => {
    expect(TABLE[0]).toEqual(HEADER);
    for (const r of ROWS) expect(r.length, `${r[0]} ${r[2]}`).toBe(21);
  });

  it('원본 CSV 31행이 모두 대응된다: 원본_순번 1~31이 빠짐없이 있고(분리 2건은 두 행), 나머지 40행은 마스터 보완 20행과 M7b 준비 추가 20행(영유아 8·청년·학창·일·노년 등)이다 — 31→73 대응(R-155)', () => {
    const origin = ROWS.map((r) => col(r, '원본_순번'));
    const numbers = origin.filter((v) => v !== '추가').map((v) => Number.parseInt(v, 10));
    expect([...new Set(numbers)].sort((a, b) => a - b)).toEqual(Array.from({ length: 31 }, (_, k) => k + 1));
    expect(origin.filter((v) => v === '추가')).toHaveLength(40);
    expect(origin.filter((v) => v === '4(분리)')).toHaveLength(2);
    expect(origin.filter((v) => v === '23(분리)')).toHaveLength(2);
    expect(ROWS).toHaveLength(31 + 2 + 20 + 20);
    for (const r of ROWS) expect(col(r, '대응_메모').length, `${col(r, '데이터_소스')} 대응 메모`).toBeGreaterThan(5);
    expect(col(rowOf('예방접종'), '대응_메모')).toContain('둘로 나눔');
    expect(col(rowOf('생명표'), '원본_순번')).toBe('23(분리)');
    expect(col(rowOf('결혼 비용'), '원본_순번')).toBe('추가');
  });

  it('원문에서 추적하지 못한 값(65세 기대여명 21.7년·15~29세 실업률 6.1%)은 핵심_지표에 [미대조] 표시가 있고 미대조_값 열에 사유가 있다 — 그 밖 행의 미대조_값은 비어 있다(R-155)', () => {
    const flagged = ROWS.filter((r) => col(r, '미대조_값') !== '');
    expect(flagged.map((r) => col(r, '데이터_소스'))).toEqual(['경제활동인구조사(청년 고용률)·청년층 부가조사', '고령자통계']);
    expect(col(rowOf('고령자통계'), '핵심_지표')).toContain('65세 기대여명 21.7년[미대조]');
    expect(col(rowOf('경제활동인구조사'), '핵심_지표')).toContain('15~29세 실업률 6.1%[미대조]');
    for (const r of flagged) expect(col(r, '미대조_값')).toMatch(/추적하지 못/);
  });

  it('문서에 내 컴퓨터 경로(사용자 이름이 든 절대 경로)가 없다: 원본 CSV는 파일 이름만 적는다(R-155). 저장소 전체 검사는 tests/repoHygiene.test.ts(R-188)', async () => {
    // 계정 이름은 글자로 적지 않고 실행 환경에서 읽는다(저장소에 이름이 남지 않게) — 흔한 이름(CI의 runner 등)이면 일반 경로 패턴만 본다
    const accountNames = await localAccountNames();
    for (const [name, text] of [['sources', sourcesDoc], ['basis', basisDoc], ['csv', csvRaw]] as const) {
      expect(findLocalPathLeaks(text, accountNames), name).toEqual([]);
    }
    expect(sourcesDoc).toContain('한국인생단계별_데이터소스_활용처.csv');
  });

  it('73행이고(원래 31행 + 분리 2행 + 마스터 보완 20행 + M7b 준비 추가 20행) 원문대조는 완료·부분완료·미완료뿐이다', () => {
    expect(ROWS).toHaveLength(73);
    const counts: Record<string, number> = {};
    for (const r of ROWS) {
      const v = col(r, '원문대조');
      expect(['완료', '부분완료', '미완료'], `${col(r, '데이터_소스')}`).toContain(v);
      counts[v] = (counts[v] ?? 0) + 1;
    }
    expect(counts['완료']).toBeGreaterThanOrEqual(19);
    expect(counts['미완료']).toBeGreaterThan(0);
    expect((counts['완료'] ?? 0) + (counts['부분완료'] ?? 0) + (counts['미완료'] ?? 0)).toBe(ROWS.length);
  });

  it('형진 님 CSV의 단계(출생·영유아·학창·청년·청년(군대)·결혼·출산·돈·주거·일·건강·노년·법원·삶의 질)가 모두 남아 있고 단계가 추가됐다(소득·계층·미래·과거·안전)', () => {
    const stages = new Set(ROWS.map((r) => col(r, '단계')));
    for (const s of ['출생', '영유아', '학창', '청년', '청년(군대)', '결혼·출산', '돈·주거', '일', '건강', '노년', '법원', '삶의 질']) expect(stages.has(s), s).toBe(true);
    for (const s of ['소득·계층', '미래(다가올 세상)', '과거(지난 세상)', '안전']) expect(stages.has(s), s).toBe(true);
  });

  it('링크 칸은 https 주소이거나 (미확보)이고, 뉴스·보도 사이트 링크는 없다 (1차 자료로 교체, 못 바꾼 것은 미완료)', () => {
    for (const r of ROWS) {
      for (const name of ['관련_링크', '공식_사이트']) {
        const v = col(r, name);
        expect(v === '(미확보)' || /^https:\/\/[^\s"<>]+$/.test(v), `${col(r, '데이터_소스')} ${name}: ${v}`).toBe(true);
        expect(v, `${col(r, '데이터_소스')} ${name}`).not.toMatch(NEWS);
      }
      if (col(r, '관련_링크') === '(미확보)') expect(col(r, '원문대조'), col(r, '데이터_소스')).toBe('미완료');
    }
  });

  it('원문대조 「완료」인 행은 https 링크와 근거 행(basisId)이 있다(이름 통계 한 행은 SPEC-001 수집 문서가 근거)', () => {
    for (const r of ROWS.filter((x) => col(x, '원문대조') === '완료')) {
      expect(col(r, '관련_링크'), col(r, '데이터_소스')).toMatch(/^https:\/\//);
      if (col(r, '근거_basisId') === '-') expect(col(r, '데이터_소스'), '근거 행이 없는 완료 행').toContain('출생신고 이름');
    }
  });

  it('근거_basisId에 적힌 모든 행(s-###, 범위는 ~)이 events-stats-basis.md에 있다', () => {
    for (const r of ROWS) {
      const v = col(r, '근거_basisId');
      if (v === '-') continue;
      for (const part of v.split(',')) {
        const m = part.trim().match(/^s-(\d{3})(?:~s-(\d{3}))?$/);
        expect(m, `${col(r, '데이터_소스')} 근거 형식 ${part}`).not.toBeNull();
        const from = Number(m![1]);
        const to = m![2] ? Number(m![2]) : from;
        for (let n = from; n <= to; n++) expect(basisDoc, `s-${String(n).padStart(3, '0')}`).toContain(`### s-${String(n).padStart(3, '0')} `);
      }
    }
  });

  it('모든 행에 게임 마일스톤·접근방식·이용조건·기준연도 칸이 비어 있지 않다', () => {
    for (const r of ROWS) for (const name of ['게임_마일스톤', '접근방식', '이용조건', '기준연도', '잠정/확정']) expect(col(r, name).trim(), `${col(r, '데이터_소스')} ${name}`).not.toBe('');
  });

  it('패널 자료(한국아동패널·KCYPS·YP·KLIPS·KLoSA·KOWEPS) 6행: 원자료가 가입·신청·인증키 필요 → 사용 안 함(C4), 접근방식에 그 사실이 적혀 있고 원문대조는 완료가 아니다', () => {
    const panels = ROWS.filter((r) => col(r, '패널_여부').startsWith('패널'));
    expect(panels).toHaveLength(6);
    for (const r of panels) {
      expect(col(r, '접근방식'), col(r, '데이터_소스')).toMatch(/C4|사용 안 함|열람 제외/);
      expect(col(r, '원문대조'), col(r, '데이터_소스')).not.toBe('완료');
    }
    for (const n of ['한국아동패널', 'KCYPS', '청년패널조사', 'KLIPS', 'KLoSA', 'KOWEPS']) expect(panels.some((r) => col(r, '데이터_소스').includes(n)), n).toBe(true);
  });

  it('마스터 정정 반영: 가계금융복지조사(국가데이터처·한국은행·금융감독원 공동), 보육통계(보건복지부), 예방접종(질병관리청), 영유아 건강검진(국민건강보험공단), 대학 등록금(한국대학교육협의회·대학알리미), 학자금대출(한국장학재단), 국민 삶의 질 보고서(통계개발원)', () => {
    for (const w of ['국가데이터처', '한국은행', '금융감독원']) expect(col(rowOf('가계금융복지조사'), '작성기관')).toContain(w);
    expect(col(rowOf('보육통계'), '작성기관')).toBe('보건복지부');
    expect(col(rowOf('예방접종'), '작성기관')).toContain('질병관리청');
    expect(col(rowOf('영유아 건강검진'), '작성기관')).toContain('국민건강보험공단');
    expect(col(rowOf('대학 등록금'), '작성기관')).toContain('한국대학교육협의회');
    expect(col(rowOf('대학 등록금'), '데이터_소스')).toContain('대학정보공시');
    expect(col(rowOf('학자금대출'), '작성기관')).toBe('한국장학재단');
    expect(col(rowOf('국민 삶의 질'), '작성기관')).toContain('통계개발원');
  });

  it('생명표는 최신 연도(2024)이고 2021년 값을 쓰지 않는다', () => {
    const r = rowOf('생명표');
    expect(col(r, '기준연도')).toBe('2024');
    expect(col(r, '핵심_지표')).toContain('83.7');
    expect(col(r, '핵심_지표')).not.toContain('2021');
  });

  it('기관 명칭: 통계청이 나오면 현 국가데이터처가 병기되고, 2025년 10월 1일 이후 발표분은 국가데이터처로 쓴다', () => {
    for (const r of ROWS) {
      const org = col(r, '작성기관');
      if (org.includes('통계청')) expect(org, col(r, '데이터_소스')).toMatch(/현 국가데이터처|구 통계청/);
    }
    expect(col(rowOf('인구동향조사'), '작성기관')).toContain('국가데이터처');
    expect(col(rowOf('장래인구추계'), '작성기관')).toContain('통계청(현 국가데이터처)');
  });

  it('보완한 지표가 모두 있다: 노인빈곤율(고령자통계), 자살률+109, 지역별 인구수(행정안전부 주민등록), 출생 체중 분포(출생통계 행)', () => {
    expect(col(rowOf('고령자통계'), '핵심_지표')).toContain('37.7');
    const s = rowOf('자살률');
    expect(col(s, '핵심_지표')).toContain('109');
    expect(col(s, '핵심_지표')).toContain('27.8');
    expect(col(s, '작성기관')).toContain('한국생명존중희망재단');
    expect(col(rowOf('주민등록 인구통계'), '작성기관')).toBe('행정안전부');
    expect(col(rowOf('인구동향조사'), '핵심_지표')).toContain('체중');
  });

  it('추천 자료가 모두 행으로 있다: 소득이동통계, 국민이전계정, 육아휴직, 가족과 출산 조사, 청소년건강행태조사, 학교폭력 실태조사, 임금근로일자리 소득·가계동향조사, 산업재해, 범죄피해조사, 장래인구추계, KOSIS 장기 시계열', () => {
    for (const n of ['소득이동통계', '국민이전계정', '육아휴직', '가족과 출산 조사', '청소년건강행태조사', '학교폭력 실태조사', '임금근로일자리 소득', '산업재해', '범죄피해조사', '장래인구추계', 'KOSIS 장기 시계열']) expect(rowOf(n), n).toBeTruthy();
  });

  it('공식 통계가 없는 결혼 비용은 민간 조사임을 밝히고, 수치를 쓰지 않으며 원문대조가 미완료다', () => {
    const r = rowOf('결혼 비용');
    expect(col(r, '작성기관')).toContain('공식 통계 없음');
    expect(col(r, '접근방식')).toContain('민간 조사');
    expect(col(r, '핵심_지표')).toBe('(공식 값 없음)');
    expect(col(r, '원문대조')).toBe('미완료');
  });

  it('국가데이터처 승격(2025-10-01)과 시도 17→16 변화가 표에 적혀 있다', () => {
    expect(col(rowOf('인구동향조사'), '작성기관')).toContain('2025-10-01');
    expect(col(rowOf('주민등록 인구통계'), '핵심_지표')).toContain('16개 시도');
  });

  it('표를 korea-stats-sources.md가 가리키고 건수(행 수 73, 완료 35·부분완료 16·미완료 22)를 적어 둔다', () => {
    expect(sourcesDoc).toContain('korea-life-data-sources.csv');
    expect(sourcesDoc).toContain(`행 수 ${ROWS.length}`);
    const done = ROWS.filter((r) => col(r, '원문대조') === '완료').length;
    const part = ROWS.filter((r) => col(r, '원문대조') === '부분완료').length;
    const none = ROWS.filter((r) => col(r, '원문대조') === '미완료').length;
    expect(sourcesDoc).toContain(`완료 ${done}`);
    expect(sourcesDoc).toContain(`부분완료 ${part}`);
    expect(sourcesDoc).toContain(`미완료 ${none}`);
  });
});
