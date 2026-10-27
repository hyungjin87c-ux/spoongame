import { R1_PRESENT, type ProfileId, type StatKey } from '../core/types';
import { longestWordLength } from './birthReportText';

/**
 * 대시보드(인생 화면)의 문구 — 한 곳에 모았다 (SPEC-003 DB1~DB14, M4). 문구 기준은 docs/design/copy.md(대시보드 행)이고, 뜻은 SPEC 본문이다.
 * 규칙: 화면 이름·버튼 이름은 copy.md 그대로, 안내문은 뜻을 지키며 담담하게(느낌표·이모지 없음). 「접속자」 낱말은 쓰지 않는다(VP2).
 * 인생 기록의 줄 문장(사건·선택 결과)은 이벤트 데이터가 정하고(어체는 M7e), 여기에는 화면 틀의 글자만 둔다.
 * 나가기 확인 단계·BGM 볼륨·자산 현황 20세 이후 자리는 designer가 copy.md에 행을 더했고(2026-10-17 M4 후속) 문구는 그 행과 같다. 생각 남기기는 M7c부터 보통 버튼이다(누르면 기록 시트가 열린다 — 시트 문구는 data/noteSheetText.ts, copy.md 7절; 「준비 중」 표식 `toolSoon`은 없어졌다).
 */

/** 상태 바 네 가지의 이름. 내부 이름 `education`은 화면에서 「지식」이다(SPEC 규칙표 12, 「학력」은 프로필 카드에 학교 단계로 따로 적는다). 재산은 상태 바에 없다. */
export const STATUS_LABEL: Record<Exclude<StatKey, 'wealth'>, string> = {
  health: '건강',
  happiness: '행복',
  education: '지식',
  relationships: '관계',
};

/** 상태 바를 그리는 순서와 아이콘(스프라이트 ui-icons.svg의 id) */
export const STATUS_ORDER: ReadonlyArray<{ key: Exclude<StatKey, 'wealth'>; icon: string; tone: 'health' | 'happy' | 'knowledge' | 'relation' }> = [
  { key: 'health', icon: 'i-heart', tone: 'health' },
  { key: 'happiness', icon: 'i-smile', tone: 'happy' },
  { key: 'education', icon: 'i-book', tone: 'knowledge' },
  { key: 'relationships', icon: 'i-people', tone: 'relation' },
];

// ---------- 제목(h1) 글자 크기 상한의 칸 수 (R-321, QM3-2) ----------

/**
 * 제목 글자 크기 상한이 줄 폭을 나누는 칸 수 = 제목 문구의 가장 긴 낱말 글자 수 + 여유 1글자 (한글 한 글자 ≈ 글자 크기 1배).
 * 룰렛 제목(`ROULETTE_TITLE_CHARS`)과 같은 규칙이다 — CSS는 `font-size: max(바닥, min(기본, 100cqi ÷ 이 값))`(src/styles/dash.css 「제목 글자 크기 상한」).
 */
export function titleCharsFor(...texts: string[]): number {
  return longestWordLength(texts) + 1;
}

/** 밀린 화면·오류 화면의 메시지(h1) — 고정 문구라 칸 수도 상수다 (docs/design/copy.md 밀린 화면·오류 화면 행) */
export const SYSTEM_TITLE = {
  superseded: '저장된 게임이 이 화면 밖에서 바뀌었습니다.',
  error: '저장된 내용을 불러오는 중 문제가 생겼습니다.',
} as const;
export const SYSTEM_TITLE_CHARS = titleCharsFor(SYSTEM_TITLE.superseded, SYSTEM_TITLE.error);

// ---------- 자산 금액이 화면에 있는가 (M5) ----------

/**
 * 자산 금액(순자산·연 소득·부채)이 대시보드에 보이는가. **M5(경제 모델) 2b가 금액을 넣는 변경에서 `true`로 켰다** — 켜기 전에는 상태 도움말이 자산을 설명하는 문장을 싣지 않았다
 * (R-333, QM3-3의 정신: 화면 문구는 없는 기능을 가리키지 않는다. `DASHBOARD_PEERS_SHIPPED`와 같은 패턴). 켜면 tests/dashText.test.ts가 문장이 돌아오는 것을 단언한다.
 */
export const ASSETS_AMOUNTS_SHIPPED = true;

const STATUS_HELP_BASE = '0에서 100 사이의 값입니다. 건강은 몸의 상태, 행복은 마음의 만족, 지식은 배우고 익힌 정도, 관계는 가족·친구와의 유대입니다.';
/**
 * 자산의 단위 문장 (docs/design/copy.md 4-5절): 시험 전용 R1 프로필(지금 세상)은 올해 가치 기준, 세대 판은 지금 가치로 환산한 원 단위.
 * (당시 화폐 ↔ 「지금 가치로 보기」 전환 문구는 EY10~EY13 — GM10이 이 문장을 바꾼다. 그 전에는 R1 방식: 항상 지금 가치 + 「지금 가치로 환산」 태그, EY12)
 */
const STATUS_HELP_ASSETS = {
  now: '자산은 올해 가치 기준의 원 단위입니다.',
  converted: '자산은 지금 가치로 환산한 원 단위입니다.',
} as const;

/** 금액에 「지금 가치로 환산」 태그가 붙는 판인가: 세대 판은 모두 붙고(GM10 전까지, EY12), 시험 전용 R1 프로필만 올해 가치라 태그가 없다 */
export function amountsConverted(profile: ProfileId | null): boolean {
  return profile !== R1_PRESENT;
}
/** 가구 기준 한 문장 (M-3): 결혼 전에는 나 혼자의 가구임이 드러난다 */
const STATUS_HELP_HOUSEHOLD = '순자산, 연 소득, 부채는 내 가구 기준이며 결혼한 뒤에는 배우자와 자녀의 몫까지 합한 값입니다.';
/** 선택지 아래 표시의 뜻 두 문장 (M7e-3, copy.md 5-2 ②): 선택만의 효과이고 해마다의 소득·생활비는 따로이며, 자산 항목은 3년치 소득·지출 변화를 담는다(economy-model.md 7절) */
const STATUS_HELP_IMPACT = '선택지 아래 표시는 그 선택만으로 생기는 변화이고, 해마다의 소득과 생활비는 따로 더해집니다. 자산의 변화에는 앞으로 3년치 소득·지출 변화가 들어 있습니다.';

/** 상태 카드의 접이식 도움말. 자산 금액이 있을 때만 자산 문장(시대별 단위 + 가구 기준)이 붙는다 */
export function statusHelpText(assetsShipped: boolean, profile: ProfileId | null): string {
  return assetsShipped ? `${STATUS_HELP_BASE} ${STATUS_HELP_ASSETS[amountsConverted(profile) ? 'converted' : 'now']} ${STATUS_HELP_HOUSEHOLD} ${STATUS_HELP_IMPACT}` : STATUS_HELP_BASE;
}

export const DASH_TEXT = {
  // ---------- 머리·진행 줄 ----------
  headName: '인생',
  /** 올해 진행률 바의 접근 가능한 이름 */
  yearProgressLabel: '올해 진행률',
  yearSuffix: '년',
  ageSuffix: '세',
  progressPausedValue: '일시정지 중',
  pause: '일시정지',
  play: '다시 진행',
  skip: '다음 결정으로',
  autoOn: '자동 모드 켜짐',
  autoOff: '자동 모드 꺼짐',
  controlsGroup: '진행 조작',
  speedUnit: '배',
  toolsGroup: '도구',

  // ---------- 도구 줄 (이름은 SPEC·요청 원문 그대로) ----------
  toolBgm: 'BGM',
  toolNote: '생각 남기기',
  toolDark: '다크 모드',
  toolFeedback: '의견 보내기',
  toolExit: '나가기',
  /** 의견 보내기가 새 탭으로 열린다는 읽기 전용 알림(링크 이름 뒤) */
  feedbackNewTab: '(새 탭으로 열립니다)',
  /** 켜짐 상태의 읽기 전용 글자(aria-pressed와 색 반전·막대·아이콘 교체가 함께 알린다 — R-136②) */
  toolOn: '켜짐',
  /** BGM 볼륨 조절 (copy.md 행 없음 — 이름은 도구 이름 「BGM」에 맞춘 「BGM 볼륨」) */
  bgmVolume: 'BGM 볼륨',

  // ---------- 나가기 확인 단계 (DB8 ▲, copy.md 행 없음) ----------
  exitAsk: '첫 화면으로 나갈까요?',
  exitAskSub: '지금까지의 인생은 일시정지한 채 이 기기에 저장되고, 첫 화면의 「이어서 살기」로 돌아올 수 있습니다.',
  /** 확정 버튼은 방금 누른 도구 이름 「나가기」와 다른 이름이고 결과가 드러난다(QM2-6 규칙) */
  exitYes: '첫 화면으로 나가기',
  exitNo: '돌아가기',

  // ---------- 중대 결정 카드 (M7b — 문구 기준 docs/design/copy.md 6-1절) ----------
  choiceKind: '중대 결정',
  /** 선택지 묶음의 옛 이름. SPEC-005 r4(UX10)부터 묶음의 이름은 질문 줄(`choiceAsk`, aria-labelledby)이라 화면에서는 더 쓰지 않는다 — 상수만 남긴다(copy.md 15-1) */
  choiceGroup: '선택지',
  /** 선택지 앞의 공통 질문 한 줄 (SPEC-005 r4 UX10·QI10, copy.md 15-1 — 마스터 승인 「어떻게 하겠습니까?」, 기록 카드 질문과 같은 높임 단계의 합쇼체). 본인이 고르는 카드(시트·인라인)에만 — 부모·흘러감·가린·기록 카드에는 없다 */
  choiceAsk: '어떻게 하겠습니까?',
  /**
   * 머리의 덮기 버튼 (SPEC-005 r4 UX11·QI11, copy.md 15-2 — 이전 이름을 뜻은 그대로 새로 지어 바꿨다). 눈에 보이는 꼬리 「▾」(`foldMark`)는 aria-hidden이라 접근 가능한 이름은 「잠시 덮어 두기」.
   * R-124의 예외가 아니라 형진 님 질문 2의 답 B(뜻만 살려 새로 지음)로 정한 이름이다 — 형진 님 원문의 낱말은 어디에도 쓰지 않는다(copy.md 15-2 「버린 후보」). 내부 식별자(`foldCard`·`FoldState`·`decision-fold-btn`)는 그대로.
   */
  foldCard: '잠시 덮어 두기',
  foldMark: '▾',
  /** 접힌 띠의 다시 열기 버튼. 접근 가능한 이름은 「결정 다시 열기 {제목}」(aria-labelledby로 제목을 잇는다) */
  reopenDecision: '결정 다시 열기',
  /** 접힌 띠의 정지 표시 — 접은 동안 헤더의 진행률 바는 멈춤을 모양으로 보이지 않으므로 글로 한 번 답한다(자동 모드에서도 참: 접힌 동안 자동 선택이 멈춘다) */
  foldNote: '다시 열 때까지 시간은 멈춥니다.',
  /** 자동 모드 안내는 상태에 맞는 문장 하나만(M-13). 콜론 라벨형 「자동 모드: …」은 폐기했다. 「잠시 뒤」 = AUTO_CHOICE_MS — 초를 적지 않는다(접었다 다시 열면 다시 세므로 숫자가 거짓이 된다) */
  autoNoteOn: '자동 모드가 켜져 있습니다. 잠시 뒤 성향에 따라 고릅니다.',
  autoNoteOff: '자동 모드가 꺼져 있습니다. 직접 고를 때까지 시간은 멈춥니다.',
  /**
   * 카드 맨 끝의 자동 고르기 묶음 (SPEC-005 r4 UX12·QI12, copy.md 15-3 — 마스터 결정 M-6 개정: 이 버튼 하나에 한해 시트 → 인라인 전환이 생긴다). 기존 자동 모드(`settings.autoMode`)와 **같은 설정**을 켜고 끄는 또 하나의 길이다.
   * 켜는 버튼은 모달 시트(자동 모드 꺼짐)에, 끄는 버튼은 인라인 카드(자동 모드 켜짐)에 — 가린 카드·부모·흘러감 카드·기록 시트에는 없다(M22). 보조 문구(`aria-describedby`)는 설정으로 남는다는 뜻과 끄는 길을 밝힌다(UX12-7).
   */
  autoOnBtn: '이후 결정을 자동으로 고르게 하기',
  autoOnSub: '이 결정부터 성향에 따라 고릅니다. 설정으로 남아 다음 판에도 이어지며, 카드 아래나 도구 줄에서 끌 수 있습니다.',
  autoOffBtn: '이후 결정을 직접 고르기',
  autoOffSub: '이 결정부터 직접 고릅니다. 도구 줄의 「자동 모드」도 함께 꺼집니다.',
  /** 전환 순간 한 번만 읽히는 상태 문장(role="status", 전환 뒤 비운다 — 자동 선택마다 읽히지 않게, content-M7b 4-3) */
  autoOnStatus: '자동 모드를 켰습니다. 이 결정부터 잠시 뒤 성향에 따라 고릅니다.',
  autoOffStatus: '자동 모드를 껐습니다. 직접 고를 때까지 시간은 멈춥니다.',
  /** 인용 박스의 종류 라벨(U12 — 지표 이름이 아니라 자료의 종류이므로 QM2-11 대상이 아니다). `citations.json`의 kind 값 둘뿐이다 */
  citeKindLabel: { stat: '통계', research: '연구' },
  /** 인용 박스 안 풀이 줄의 라벨 (SPEC-005 r4 UX14·QI14, copy.md 15-4) — 출처 줄 뒤, `.cite__kind`와 같은 규격. 풀이 문장은 `data/citationInsights.ts` */
  citeInsightLabel: '풀이',
  /** 다가올 세상의 모든 인용 머리말 (M-2). `core/citations.ts#FUTURE_PREFIX`와 같은 글자(시험이 대조한다) */
  eraPrefixFuture: '지금 기준으로는',

  // ---------- 엔딩 (공통 헤더 아래 틀 — 본문 문구는 endingText.ts·lifeText.ts, 개편은 M7e) ----------
  /** 엔딩 h1 = 「{이름}의 인생」 (copy.md 엔딩 헤더 행) */
  endingTitleSuffix: '의 인생',
  endingSummaryLabel: '사망과 선택',

  // ---------- 프로필 카드 (DB9) ----------
  profileLabel: '프로필',
  profileBorn: '출생',
  profileLive: '거주',
  profileHome: '출신 가정',
  profileEdu: '학력',
  profileLooks: '외모',

  // ---------- 상태 카드 (DB10) ----------
  statusTitle: '상태',
  /** M5부터 자산 설명이 함께 들어 제목이 바뀌었다 (copy.md 4-5절, r2 마스터 결정 1). 본문은 `statusHelpText(ASSETS_AMOUNTS_SHIPPED, era)` */
  statusHelpSummary: '상태와 자산의 뜻 보기',

  // ---------- 자산 현황 (DB11) ----------
  assetsTitle: '자산 현황',
  /** 20세 미만 (copy.md): 수저 칩 없음 */
  /** M7e-3 (copy.md 5-2 ③, QA-003-M5 O02): 셋째 문장이 선택지의 「집안 살림」 뜻을 푼다 — 「집안 형편」(변하지 않는 5단계)과 「집안 살림」(선택이 쌓는 값)을 가른다 */
  assetsYoung: '자산은 스무 살부터 셉니다. 지금은 집안 형편을 따릅니다. 선택지에 보이는 「집안 살림」은 살림에 보태거나 축낸 몫을 모아 둔 값이고, 스무 살이 되면 내 자산과 부채로 합쳐집니다.',
  /** 20세 이후 (copy.md 4-5절): 이름 셋 — 「(가구)」를 붙이지 않는다(M-3) */
  assetsNet: '순자산',
  assetsIncome: '연 소득',
  assetsDebt: '부채',
  /** 지난·다가올 세상에서만 카드 머리에 붙는 태그 (DB11) */
  assetsBasis: '지금 가치로 환산',
  /** 금액 아래 작은 글: 음수를 「빚」으로 바꿔 쓰지 않고 항목 이름 「부채」로 말한다 */
  assetsNote: '순자산은 가진 것에서 부채를 뺀 값입니다. 0보다 작으면 부채가 가진 것보다 많다는 뜻입니다.',

  // ---------- 인생 기록 (DB12·DB14) ----------
  logTitle: '인생 기록',
  /** 최신순 (SPEC-005 LR2 d, docs/design/copy.md 10절 ①): 「{순서 이름} · {지난 기록을 보는 방법}」 — 옛 「시간순 · 위로 스크롤하면 …」과 같은 꼴. 처음 임시 문구는 「위 · 아래로」가 이어져 「위아래로」로 읽혀 버렸다(R-437) */
  logHint: '최신순 · 아래로 스크롤하면 지난 기록',
  logJump: (n: number) => `새 기록 ${n}개 · 맨 위로`,
  logChoicePrefix: '선택: ',

  // ---------- 식구 (DB13) ----------
  familyTitle: '식구',
  familyMother: '어머니',
  familyFather: '아버지',
  familySiblings: '형제자매',
  familySpouse: '배우자',
  familyChild: '자녀',
  familyNone: '없음',

  // ---------- 또래 (VP4) ----------
  peersTitle: '같은 해 태어난 사람들',
  peersSub: '요즘 모습',
  peersNote: '나이와 수저에 따라 정한 설계값입니다(통계가 아님).',
} as const;
