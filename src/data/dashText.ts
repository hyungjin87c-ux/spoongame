import type { StatKey } from '../core/types';
import { longestWordLength } from './birthReportText';

/**
 * 대시보드(인생 화면)의 문구 — 한 곳에 모았다 (SPEC-003 DB1~DB14, M4). 문구 기준은 docs/design/copy.md(대시보드 행)이고, 뜻은 SPEC 본문이다.
 * 규칙: 화면 이름·버튼 이름은 copy.md 그대로, 안내문은 뜻을 지키며 담담하게(느낌표·이모지 없음). 「접속자」 낱말은 쓰지 않는다(VP2).
 * 인생 기록의 줄 문장(사건·선택 결과)은 이벤트 데이터가 정하고(어체는 M7e), 여기에는 화면 틀의 글자만 둔다.
 * 나가기 확인 단계·BGM 볼륨·자산 현황 20세 이후 자리는 designer가 copy.md에 행을 더했고(2026-10-17 M4 후속) 문구는 그 행과 같다. 생각 남기기는 M7c까지 선택할 수 없는 자리(눈에 보이는 「준비 중」, R-326)라 안내 문구가 따로 없다.
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
 * 자산 금액(순자산·연 소득·부채)이 대시보드에 보이는가. **M5(경제 모델)가 금액을 넣는 변경에서 `true`로 켠다** — 켜기 전에는 상태 도움말이 자산을 설명하는 문장을 싣지 않는다
 * (R-333, QM3-3의 정신: 화면 문구는 없는 기능을 가리키지 않는다. `DASHBOARD_PEERS_SHIPPED`와 같은 패턴). 켜면 tests/dashText.test.ts가 문장이 돌아오는 것을 단언한다.
 */
export const ASSETS_AMOUNTS_SHIPPED = false;

const STATUS_HELP_BASE = '0에서 100 사이의 값입니다. 건강은 몸의 상태, 행복은 마음의 만족, 지식은 배우고 익힌 정도, 관계는 가족·친구와의 유대입니다.';
const STATUS_HELP_ASSETS = '자산은 올해 가치 기준의 원 단위입니다.';

/** 상태 카드의 접이식 도움말. 자산 금액이 있을 때만 마지막 문장(자산 단위 설명)이 붙는다 */
export function statusHelpText(assetsShipped: boolean): string {
  return assetsShipped ? `${STATUS_HELP_BASE} ${STATUS_HELP_ASSETS}` : STATUS_HELP_BASE;
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
  /**
   * 생각 남기기는 자유 기록 카드(M7c, FR1~FR9)와 함께 만든다 — M4에서는 **버튼 자리**만 있고 선택할 수 없다(R-326, REV-003-M4-1 마스터 결정). 라디오 카드 「약 1시간」의 「준비 중」과 같은 방식:
   점선 테두리·옅은 글자(GuardedButton의 `data-unavailable`)로 선택 불가처럼 보이고, 눈에 보이는 「준비 중」 표식이 버튼 이름 안에 있어 접근 가능한 이름이 「생각 남기기 준비 중」이다.
   누르면 아무 일도 없다(aria-disabled) — 없는 기능이 동작하는 것처럼 보이지 않게 한다(QM3-3의 정신). 예전의 「눌러서 안내가 나오는 보통 버튼」은 폐기했다.
   */
  toolSoon: '준비 중',

  // ---------- 나가기 확인 단계 (DB8 ▲, copy.md 행 없음) ----------
  exitAsk: '첫 화면으로 나갈까요?',
  exitAskSub: '지금까지의 인생은 일시정지한 채 이 기기에 저장되고, 첫 화면의 「이어서 살기」로 돌아올 수 있습니다.',
  /** 확정 버튼은 방금 누른 도구 이름 「나가기」와 다른 이름이고 결과가 드러난다(QM2-6 규칙) */
  exitYes: '첫 화면으로 나가기',
  exitNo: '돌아가기',

  // ---------- 중대 결정 카드 (M4는 기존 동작·새 틀만 — 세부는 M7b) ----------
  choiceKind: '중대 결정',
  choiceGroup: '선택지',
  autoNote: '자동 모드: 잠시 뒤 성향에 따라 고릅니다.',

  // ---------- 엔딩 (공통 헤더 아래 틀 — 본문 문구는 endingText.ts·lifeText.ts, 개편은 M7e) ----------
  /** 엔딩 h1 = 「{이름}의 인생」 (copy.md 엔딩 헤더 행) */
  endingTitleSuffix: '의 인생',
  endingSummaryLabel: '사망과 선택',
  /** 엔딩 최종 스탯의 재산 줄 이름(스무 살 전에는 endingText.ts#EARLY_WEALTH_LABEL 「집안 형편」) */
  endingWealth: '재산',

  // ---------- 프로필 카드 (DB9) ----------
  profileLabel: '프로필',
  profileBorn: '출생',
  profileLive: '거주',
  profileHome: '출신 가정',
  profileEdu: '학력',
  profileLooks: '외모',

  // ---------- 상태 카드 (DB10) ----------
  statusTitle: '상태',
  statusHelpSummary: '상태 네 가지의 뜻 보기',
  /** 자산 금액이 생기기 전(M5 전)에는 자산 설명 문장을 싣지 않는다 (R-333, `ASSETS_AMOUNTS_SHIPPED`) */
  statusHelp: statusHelpText(ASSETS_AMOUNTS_SHIPPED),

  // ---------- 자산 현황 (DB11 — M4는 자리만) ----------
  assetsTitle: '자산 현황',
  /** 20세 미만 (copy.md): 수저 칩 없음 */
  assetsYoung: '자산은 스무 살부터 셉니다. 지금은 집안 형편을 따릅니다.',
  /** 20세 이후 (copy.md 「자산 현황(20세 이후, M5 전 자리)」 행 — 값은 경제 모델 M5가 채운다. 자리와 이름만 두고 준비 중임을 밝힌다. 「스무 살 이후의」는 군더더기라 뺐다: 쉰 살 화면에서 어색하다, designer 제안) */
  assetsSoon: '순자산, 연 소득, 부채는 아직 준비 중입니다.',

  // ---------- 인생 기록 (DB12·DB14) ----------
  logTitle: '인생 기록',
  logHint: '시간순 · 위로 스크롤하면 지난 기록',
  logJump: (n: number) => `새 기록 ${n}개 · 맨 아래로`,
  logPinA: (n: string) => `이 세상의 가상 인구 ${n}명`,
  logPinB: (name: string) => `${name}도 그중 한 사람`,
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
