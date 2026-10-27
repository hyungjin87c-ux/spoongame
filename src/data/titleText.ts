import { commaList } from '../core/glue';
import type { LifeLength } from '../core/types';

/**
 * 첫 화면(타이틀)의 문구 — 한 곳에 모았다 (SPEC-003 FS1~FS7, 디자인 검수 REV-003-D-1 R-124·R-131).
 * 최종 문구는 designer가 다듬어 넘길 예정이라 화면 코드에 글자를 흩어 두지 않고 여기만 고치면 되게 했다.
 *
 * 규칙
 *  - 형진 님이 지정한 문구(「N명이 이 시뮬레이션 속에서 각자의 삶을 살고 있어요」)와 버튼 이름(태어나기 등)은 그대로 둔다.
 *  - 다른 게임(80억 분의 1)의 고유 문구와 겹치는 문장은 쓰지 않는다. 「접속자」「동시 접속」 같은 낱말은 어디에도 쓰지 않는다(VP2) — 테스트가 이 파일과 화면 전체를 점검한다.
 *  - 느낌표·이모지·과장 없이 담담하게.
 */

/**
 * 이름 출처 표기 (푸터 맨 아래 줄 — 법원 통계 자료의 이용 조건: 출처를 구체적으로 표시한다). 글자·주소는 `names.json`의 `meta.attribution`과 같고(tests/names.test.ts가 대조한다)
 * 첫 화면이 이름 풀 데이터(수만 자)를 불러오지 않도록 여기에 작게 둔다 — 이름 풀은 「태어나기」 뒤에 쓰인다.
 */
export const NAME_CREDIT = {
  text: '2008년 이후 출생 이름 출처: 대한민국 법원 전자가족관계등록시스템 통계서비스 「상위 출생신고 이름 현황」(등록일 기준 잠정치, 2026-10-13 조회)',
  url: 'https://stfamily.scourt.go.kr/st/StFrrStatcsView.do?pgmId=090000000025',
} as const;

export const TITLE_TEXT = {
  /**
   * 로고 아래 부제 (SPEC-004 N30 — 이름은 「수저 게임」, 세대의 뜻은 부제가 맡는다): 「다른 세대, 다른 삶, 같은 대한민국」. 뒤쪽 `heroTagKeep`은 줄에 안 들어가면 통째로 다음 줄로 내려간다(nowrap).
   * 이전 부제 「태어난 집에 따라 달라지는, 한국인의 한 번의 인생」은 세대 선택이 들어오며 바뀌었다 (형진 님 결정 2026-10-20).
   */
  heroTagLead: '다른 세대, 다른 삶, ',
  heroTagKeep: '같은 대한민국',
  heroTagNoBreak: '같은 대한민국',
  spoonLineupLabel: '수저 다섯 단계: 흙수저, 동수저, 은수저, 금수저, 다이아몬드수저',

  lifeLengthGroup: '인생 길이',
  /**
   * 인생 길이 한 줄 안내 (HS2 ③, copy.md 9-4): 평균 수명까지 걸리는 시간 · 생각을 적는 시간은 뺐다(LD-1 — 「약 30분」이 손목시계와 어긋나지 않게) · 도중에 나가도 이 기기에 저장.
   * SPEC-003 FS5의 세 문장(`평균 수명까지 살아 보는 데 걸리는 시간이에요. 생각을 적는 시간은 넣지 않았어요. 도중에 나가도 진행은 이 기기에 남아요.`)을 한 줄로 줄였다(SPEC-005 QI3).
   * 「이 기기에」는 줄바꿈 묶음(Glue 관형사 묶음)이다.
   */
  lifeLengthHint: '평균 수명까지 사는 시간이에요. 생각을 적는 시간은 뺐고, 나가도 이 기기에 남아요.',

  /**
   * 무거운 장면 가리기 스위치 자리 (HV3·copy.md 9-5, 이름·기본값은 형진 님 답 M12). 동작 연결(설정 v5 `gentle`·가림 UI)은 QI6이고, 지금은 문구와 자리(컴포넌트·CSS)만 있다.
   * 상태 글자 「꺼짐/켜짐」은 보조(aria-hidden — 상태는 `aria-checked`가 전한다). 「순한 맛」「마음 놓고」 같은 은유는 쓰지 않는다.
   */
  gentleName: '무거운 장면 가리기',
  gentleOff: '꺼짐',
  gentleOn: '켜짐',
  gentleDesc: '아픈 일이나 이별 같은 장면의 글만 가려요. 일어나는 일은 같아요.',

  begin: '태어나기',
  /** 「태어나기」 뒤 지연 로드 덩어리(이벤트·출생 연도 표·이름 풀)를 불러오는 동안의 버튼 글자와, 실패했을 때의 안내·다시 시도 (MG8) */
  loading: '불러오는 중',
  loadFailed: '게임 데이터를 불러오지 못했어요. 연결을 확인하고 다시 시도해 주세요.',
  loadRetry: '다시 시도',
  /** 진행 중이던 판을 불러오는 동안의 한 줄 (저장 복원 때 지연 로드 덩어리를 기다린다) */
  restoring: '저장된 판을 불러오는 중이에요.',
  resume: '이어서 살기',
  beginNew: '새로 태어나기',
  confirmNewTitle: '이전 판이 사라집니다. 새로 태어날까요?',
  /**
   * 확인 단계의 확정 버튼 (FS6, QM2-6 마스터 결정 A). 방금 누른 보조 버튼 「새로 태어나기」와 **다른 이름**이고, 이름만 읽어도 결과(이전 판이 지워지고 새로 태어남)가 드러난다.
   * 문구 기준표: docs/design/copy.md 「확인 단계 · 확정 버튼」 행. 화면은 이 한 곳에서만 가져온다.
   */
  confirmNewYes: '이전 판 지우고 태어나기',
  confirmNewNo: '돌아가기',

  /** C6 — 이전 스키마(v4 이하) 저장이 있었을 때 */
  oldSaveNotice: '이전 버전에서 저장된 판은 이어서 할 수 없어 새 게임으로 시작합니다.',

  /**
   * 캐러셀 카드의 제목(`h2.sr-only`) — 눈에 보이는 머리글은 없다(SH4: 「한국 사회 통계」「7초마다 다음 지표」「자동 넘김 멈춤」 삭제). 제목 단계를 건너뛰지 않게(슬라이드 제목 `h3` 위에 `h2`) 읽히는 글자로만 남긴다.
   * 자동 넘김의 상태 표시는 일시정지 버튼의 아이콘·이름이 맡는다(SH6).
   */
  carouselHeading: '한국 사회 통계',
  carouselRegionLabel: '한국 사회 통계 캐러셀',
  // 버튼 이름은 designer의 문구 기준표(docs/design/copy.md, R-124·R-133)를 따른다
  carouselPrev: '이전 지표',
  carouselNext: '다음 지표',
  carouselPause: '자동 넘김 일시정지',
  carouselPlay: '자동 넘김 다시 시작',
  carouselViewport: '통계 슬라이드. 왼쪽·오른쪽 화살표 키로 넘길 수 있습니다.',
  /** 자살률 슬라이드 안전 안내 (SC6·C10) */
  helpLead: '힘든 마음을 혼자 견디지 않아도 됩니다.',

  footerStatsLead: '통계 출처: ',
  footerStatsTail: '(통계표 이름과 기준 연도는 카드마다 적혀 있습니다)',
} as const;

/**
 * 푸터 통계 출처 줄 (FS7, QM2-10 규칙 2): 「통계 출처: 국가데이터처, 행정안전부, 교육부 (통계표 이름과 기준 연도는 카드마다 적혀 있습니다)」.
 * 기관 목록은 데이터(슬라이드 출처)에서 채워 항목 수가 바뀌므로 한 줄을 넘을 수 있다 — 가운뎃점이 아니라 **쉼표 나열**이다(글자 200%에서 「· 교육부」로 줄이 시작하던 것, QA-003-M2 M2-C02).
 * 기관 이름 사이에는 「·」가 없다. 문구 기준표: docs/design/copy.md 「첫 화면 · 푸터 · 통계 출처 줄」 행.
 */
export function footerStatsText(orgs: readonly string[]): string {
  const list = commaList(orgs);
  return `${TITLE_TEXT.footerStatsLead}${list}${list === '' ? '' : ' '}${TITLE_TEXT.footerStatsTail}`;
}

/** 한 줄 설명의 끝 구절을 [앞, 갈라지지 않는 부분(마지막 두 어절 이상), 뒤]로 나눈다 (구절에 그 부분이 없으면 통째로 앞) */
export function heroTagKeepParts(): [string, string, string] {
  const at = TITLE_TEXT.heroTagKeep.indexOf(TITLE_TEXT.heroTagNoBreak);
  if (at < 0) return [TITLE_TEXT.heroTagKeep, '', ''];
  return [TITLE_TEXT.heroTagKeep.slice(0, at), TITLE_TEXT.heroTagNoBreak, TITLE_TEXT.heroTagKeep.slice(at + TITLE_TEXT.heroTagNoBreak.length)];
}

/**
 * 인생 길이 분절 컨트롤의 칸 이름 (FS5 → SPEC-005 HS2). 값 `short30`/`long60`은 저장되고, 실제 시간 모델은 M8에서 정했다.
 * 지금 고를 수 있는 것은 `SELECTABLE_LIFE_LENGTHS`(core/types.ts)뿐이고, 고를 수 없는 칸은 `notReady`(「준비 중」)를 알약으로 보인다 —
 * 이 글자는 칸의 접근 가능한 이름에도 들어가 스크린리더도 비활성 이유를 듣는다(REV-003-M2-1 R-202). 카드의 보조문(「가볍게 한 판」「결정을 더 많이」)은 분절 컨트롤에 자리가 없어 없앴다(diff-005 D5-08).
 */
export const LIFE_LENGTH_TEXT: Record<LifeLength, { title: string }> = {
  short30: { title: '약 30분' },
  long60: { title: '약 1시간' },
};

/** 고를 수 없는 카드의 비활성 이유 표기 */
export const NOT_READY_TEXT = '준비 중';
