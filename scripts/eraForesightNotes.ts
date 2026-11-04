import type { EraForesight } from '../src/core/eraWindow';

/**
 * 시대의 창 「예측 근거 보기」 글 (SPEC-010 FU11, 2026-11-03): 미래 줄마다 누가 어디서 이렇게 내다봤는지 한두 건. `scripts/genEraWindows.ts`가 이 표를 읽어 10년 덩어리(`d<10년대>.ts`)의 장면 `foresight`에 싣는다 —
 * 근거 글은 초기 로드에 들어가지 않는다. 키는 designer 조각 id(장면 id)다.
 *
 * 출처는 `docs/data/future-foresight-quotes.md`(확인일 2026-11-03)의 1절 표다. 이 파일의 사람·기관·자료·연도는 그 표에 있는 것만 쓰고(`tests/eraForesight.test.ts`가 문서 표를 직접 읽어 대조한다),
 * 요약은 표의 「게임에 쓸 요약」을 따르되 앞의 이름은 칸의 앞머리가 말하므로 뺐다. 규칙(SPEC-010 「예측 근거 규칙」):
 *  - 실제로 한 말만. 「원문」 행을 먼저, 「2차」 행은 `reported`(칸에 「보도 기준」). 직접 인용은 넣지 않는다 — 자기 말 요약뿐이고 인용부호가 없다.
 *  - 기관 글은 기관 이름으로. 정치인·정당 인사의 발언은 쓰지 않는다.
 *  - 게임의 해와 발언의 해가 다르면 `gap`에 그 차이를 적는다. 예측이 아니라 분석·집계인 자료는 「내다봤습니다」가 아니라 「분석했습니다」「집계했습니다」로 쓴다.
 *  - 후보가 없는 줄(U11·U12·U20·U26)은 키를 두지 않는다 — 근거 종류 글자만 보인다. 2026년 줄(U01·U02)은 칩이 없어 근거 칸도 없다.
 *  - 수저별 「먼저」 줄(U15·U22·U28)은 `byBand: true`로 「수저별 차이는 게임의 설정입니다.」를 덧붙인다. 노화(U21·U22)·의식 이전(U27·U28)에는 `counter: true` 반대 근거가 한 건 있어야 한다(묶음 B·C).
 * 이번 묶음 A(U03~U12)의 글만 있다. 묶음 B·C는 같은 모양으로 이 표에 더한다.
 */
export const FORESIGHT_NOTES: Readonly<Record<string, EraForesight>> = {
  // U03 2027 참여소득 시범사업 (가상 시나리오) — 2차 한 건뿐
  'era-2027-participation-income-desk': {
    notes: [
      {
        who: '보건복지부',
        role: '정부 부처',
        work: '기사 「정부, 기본소득 제도화 착수…2027년 시범사업」(아시아경제)',
        year: 2026,
        said: '2027년 참여소득 시범사업을 위한 기초작업에 들어갔다고 보도됐습니다.',
        reported: true,
        gap: '계획 단계였고 전국 단위 도입은 기사에서 확인되지 않았습니다.',
      },
    ],
  },
  // U04 2028 학급 수가 줄어드는 학교 (공식 전망 바탕)
  'era-2028-school-fewer-classes': {
    notes: [
      {
        who: '통계청',
        role: '정부 통계기관',
        work: '정책브리핑 「장래인구추계: 2022~2072년」 부처 브리핑',
        year: 2023,
        said: '초등 연령 인구(6~11세)가 2028년 200만 명 밑으로 내려간다고 전망했습니다.',
        gap: '학급 수가 아니라 인구 전망이고, 2023년 추계라 새 추계가 나오면 해가 바뀔 수 있습니다.',
      },
      {
        who: '조영태',
        role: '서울대 보건대학원 교수',
        work: '서울신문 인구포럼 기조강연 보도',
        year: 2023,
        said: '학령인구 감소가 이미 정해진 미래라고 강조했습니다.',
        reported: true,
        gap: '2028년을 특정한 발언은 아닙니다.',
      },
    ],
  },
  // U05 2029 무더위쉼터 (공식 전망 바탕) — 둘 다 지금의 상황을 분석·집계한 자료
  'era-2029-heat-shelter-fans': {
    notes: [
      {
        who: '이화여대 연구팀',
        role: '대학 연구팀',
        work: '서울 무더위쉼터 입지 연구 보도(뉴시스)',
        year: 2025,
        said: '서울의 무더위쉼터가 노인 밀집 지역에 충분하지 않다고 분석했습니다.',
        reported: true,
        gap: '지금의 서울을 분석한 것이며 2029년을 내다본 것은 아닙니다.',
      },
      {
        who: '기상청',
        role: '정부 기관',
        work: '2025년 기후 분석 보도(헤럴드경제)',
        year: 2026,
        said: '2025년 서울의 열대야가 46일로 관측 이래 가장 많았다고 집계했습니다.',
        reported: true,
        gap: '지난 기록이며 전망은 아닙니다.',
      },
    ],
  },
  // U06 2030 기본소득 시범 · 어려운 쪽 (가상 시나리오)
  'era-2030-basic-income-queue-rain': {
    notes: [
      {
        who: '샘 올트먼',
        role: 'OpenAI CEO',
        work: '에세이 「Moore\'s Law for Everything」',
        year: 2021,
        said: 'AI로 힘이 노동에서 자본으로 옮겨 가니 그 부를 시민에게 나누자고 제안했습니다.',
        gap: '기본소득 시범의 해를 말한 글은 아닙니다. 2030년은 게임이 정한 시나리오입니다.',
      },
      {
        who: '에바 비발트 외',
        role: '논문 첫 저자',
        work: '논문 「The Employment Effects of a Guaranteed Income」(NBER 워킹페이퍼)',
        year: 2024,
        said: '미국 두 주 실험에서 월 현금 지급이 근로 참여를 소폭 줄였다고 보고했습니다.',
        gap: '미국 실험 결과이며 한국의 시범이나 2030년을 내다본 것이 아닙니다.',
      },
    ],
  },
  // U07 2030 재교육 · 가운데 (가상 시나리오) — AGI 시점은 2029와 2047로 갈린다
  'era-2030-reskill-evening-class': {
    notes: [
      {
        who: '레이 커즈와일',
        role: '미래학자·발명가',
        work: 'BBC Science Focus 인터뷰',
        year: 2024,
        said: '인간 수준의 AI(AGI)가 2029년까지 나온다고 내다봤습니다.',
        gap: '발언은 2029년, 게임은 2030년입니다.',
      },
      {
        who: 'AI Impacts 연구진',
        role: '연구자 2,778명 설문',
        work: '논문 「Thousands of AI Authors on the Future of AI」(arXiv)',
        year: 2024,
        said: 'AI 연구자 설문은 모든 과제에서 기계가 사람을 앞서는 시점을 2047년경으로 내다봤습니다.',
        gap: '설문은 2047년경, 게임은 2030년이라 17년 차이가 납니다.',
      },
    ],
  },
  // U08 2030 AI 투자 · 부유한 쪽 (가상 시나리오)
  'era-2030-ai-capital-night-office': {
    notes: [
      {
        who: '스탠퍼드 HAI',
        role: '대학 연구소',
        work: '연례 보고서 『AI Index 2025』',
        year: 2025,
        said: '2024년 미국 민간 AI 투자가 크게 늘었다고 집계했습니다.',
        gap: '지난 투자액이며 앞으로의 몰림을 내다본 것은 아닙니다.',
      },
      {
        who: '국제통화기금(IMF)',
        role: '국제기구',
        work: '블로그 글 「AI Will Transform the Global Economy」',
        year: 2024,
        said: '대부분의 시나리오에서 AI가 전체 불평등을 키울 것으로 내다봤습니다.',
        gap: '불평등 일반론이며 투자가 AI를 가진 쪽에 몰린다는 직접 전망은 아닙니다.',
      },
    ],
  },
  // U09 2030년대 자율주행 셔틀 (가상 시나리오) — 찾은 근거는 유보 쪽 한 건
  'era-2030s-driverless-shuttle-stop': {
    notes: [
      {
        who: 'S&P Global Mobility',
        role: '시장조사 기관',
        work: '보도자료 「Autonomous Vehicle Reality Check」',
        year: 2023,
        said: '자율주행 대중화가 앞으로도 10년 넘게 걸릴 것으로 내다봤습니다.',
        gap: '시범 운행을 부정하는 것은 아니지만 동네를 도는 셔틀이 흔해진다는 근거는 아닙니다.',
        counter: true,
      },
    ],
  },
  // U10 2030년대 돌봄 일손 (전문가 전망 바탕)
  'era-2030s-care-intake-empty-chairs': {
    notes: [
      {
        who: '한국개발연구원(KDI)',
        role: '정부 출연 연구기관',
        work: '『노인돌봄 인력의 전망과 정책 대응』 보고서 보도(베이비뉴스)',
        year: 2026,
        said: '요양 인력이 2035년 약 50만 명 더 필요할 것으로 추산했습니다.',
        reported: true,
        gap: '업무 부담이 지금과 같다고 놓은 추산이며 일손을 못 구한 집을 직접 센 것은 아닙니다.',
      },
    ],
  },
  // U11 (식구 돌봄) · U12 (유료 돌봄 인력): 직접 전망한 자료를 찾지 못해 근거 칸이 없다 — 근거 종류 글자만 보인다
};
