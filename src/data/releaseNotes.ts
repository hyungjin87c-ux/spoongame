/**
 * 새 소식(업데이트 노트) 데이터 (SPEC-005 NT1~NT5, docs/data/release-notes-faq-draft.md 5절 N1~N8). **이 파일이 단일 기준**이다 — 첫 화면 푸터 「새 소식」 링크가 여는 패널(`ui/InfoPanel.tsx`)이 이 목록을 그대로 그린다.
 * 문구는 모두 docs/design/copy.md 13-2절의 확정 글이다(R-124): 글자 그대로 옮겼고 새로 쓴 문장은 없다.
 *
 * 규칙 (NT3 — tests/releaseNotes.test.ts가 잡는다):
 *  - 버전 `0.MINOR.PATCH`(NT1) — 노트의 버전은 `package.json`의 버전과 같은 값이고, **지금 `APP_VERSION`의 노트가 반드시 있다**(버전을 올리고 노트를 안 쓰는 배포를 막는다).
 *  - 최신이 위(버전 단조 감소), 날짜 `YYYY-MM-DD`, 버전당 항목 ≤ 8, 항목 ≤ 70자.
 *  - 서술은 **해요체**(패널 전체가 해요체다 — 한 패널 안에 두 어체를 섞지 않는다, 마스터 N1). 느낌표·이모지·과장 없음.
 *  - 내부 식별자(`SPEC-`·`R-숫자`·`M숫자`·`QI`·`QA`·커밋 해시·파일 경로)·사람 이름·연락처 없음. 다른 게임의 문장·고유 명칭 없음(겹침 점검은 마스터 M17).
 *  - 항목은 사용자 관점에서 **무엇이 달라졌는지**만 쓴다. 커밋 메시지에서 자동으로 만들지 않는다(NT2).
 *
 * v0.2.0의 날짜는 main 배포일(2026-10-26, N5 — TODO 「QI8: 배포일로 고침」 처리됨).
 * v0.2.1(SPEC-005 r4, UXN-1)의 날짜는 main 배포일 2026-10-27이다. 항목 다섯은 copy.md 15-7(다섯째는 형진 님 지시로 「폭 960px 이상」), 여섯째(5세 기록 카드 인용 교체, QI13)와 요약은 developer 제안을 마스터가 2026-10-27 승인(요약은 PC 조건을 밝히도록 「PC에서는」을 더했다 — R-504, 마스터 2026-10-27).
 * v0.3.0(SPEC-004 GM4)의 날짜는 main 배포일 2026-10-28이다. 요약과 항목 여덟은 copy.md 13-2 v0.3.0 확정 문구 그대로다.
 */

/** 항목 종류: 추가 · 개선 · 수정 · 내용 (패널에서는 두 글자 글자 칩 — `NOTE_KIND_TEXT`) */
export const NOTE_KINDS = ['new', 'better', 'fixed', 'content'] as const;
export type NoteKind = (typeof NOTE_KINDS)[number];

/** 항목 종류의 화면 이름 (copy.md 13-1): 두 글자 글자 칩(색 없음) */
export const NOTE_KIND_TEXT: Readonly<Record<NoteKind, string>> = {
  new: '추가',
  better: '개선',
  fixed: '수정',
  content: '내용',
};

export interface ReleaseNoteItem {
  kind: NoteKind;
  text: string;
}

export interface ReleaseNote {
  /** `x.y.z` — `package.json`의 version과 같은 값 */
  version: string;
  /** `YYYY-MM-DD` */
  date: string;
  /** 한 줄 요약 */
  summary: string;
  items: readonly ReleaseNoteItem[];
}

/** 항목 글자 수 상한 (NT3 ①) */
export const NOTE_ITEM_MAX_CHARS = 70;
/** 버전당 항목 수 상한 (NT3 ①) */
export const NOTE_ITEMS_MAX = 8;

/** 최신이 위. 새 배포는 맨 위에 더한다 */
export const RELEASE_NOTES: readonly ReleaseNote[] = [
  {
    version: '0.3.0',
    // main 배포일 (SPEC-004 GM4, copy.md 13-2 v0.3.0)
    date: '2026-10-28',
    summary: '세대와 태어날 시·도를 골라 태어나고, 첫 화면과 아래쪽이 새로워졌어요.',
    items: [
      { kind: 'new', text: '첫 화면에서 「태어날 세상」 대신 세대 일곱과 「랜덤 세대」 중 하나를 골라요. 끝까지 살아본 세대에는 「살아봄」이 붙어요.' },
      { kind: 'new', text: '태어날 시·도를 직접 고르거나, 설정에 둔 「내 출신 시도」를 쓰거나, 룰렛에 맡길 수 있어요.' },
      { kind: 'better', text: '룰렛은 지역과 수저만 돌아요. 시·도를 직접 골랐으면 지역 릴은 멈춰 있고, 태어난 해는 출생신고에서 처음 보여요.' },
      { kind: 'better', text: '첫 화면 오른쪽 통계가 21장이 됐어요. 첫 장은 고른 세대의 출생아 그래프이고, 9초마다 넘어가며 멈춤 단추가 있어요.' },
      { kind: 'better', text: '첫 화면을 정리했어요. 제목이 커지고 설명이 두 줄이 됐고, 일러스트와 가상 인구 숫자, 「한 판 약 30분」은 뺐어요.' },
      { kind: 'new', text: '첫 화면 아래쪽에 소개와 만든 뜻, 개인정보 처리방침·이용 안내(법률 검토 전 초안), 문의, 권장 연령을 두었어요.' },
      { kind: 'better', text: '글꼴이 Noto Sans KR로 바뀌고 바탕색이 조금 밝아졌어요. PC에서는 첫 화면이 내려받는 양이 오히려 조금 줄었어요.' },
      { kind: 'fixed', text: '이전 버전에서 저장한 판은 이어서 할 수 없어요. 첫 화면에 안내가 보이고 새 판으로 시작해요. 설정은 그대로예요.' },
    ],
  },
  {
    version: '0.2.1',
    // main 배포일 (SPEC-005 r4 UXN-1)
    date: '2026-10-27',
    summary: '결정 카드에 질문과 풀이가 생기고, PC에서는 진행·도구 버튼이 한 줄로 모였어요.',
    items: [
      { kind: 'new', text: '결정 카드의 통계·연구 아래에 풀이 한 줄이 생겼어요. 그 숫자가 이 장면에 무엇을 비추는지 짧게 적었어요.' },
      { kind: 'new', text: '결정 카드가 선택지 앞에서 「어떻게 하겠습니까?」 하고 물어요.' },
      { kind: 'better', text: '「카드 접기」는 「잠시 덮어 두기」로 이름을 바꿨어요. 하는 일은 그대로예요.' },
      { kind: 'new', text: '결정 카드 아래에서 바로 자동 모드를 켤 수 있어요. 켠 뒤에는 카드나 도구 줄에서 끌 수 있어요.' },
      { kind: 'better', text: 'PC 화면(폭 960px 이상)에서는 진행·도구 버튼 열두 개가 한 줄에 놓여요.' },
      { kind: 'content', text: '다섯 살에 묻는 생각 남기기 카드의 연구가 어린 시절 기억을 다룬 연구로 바뀌었어요.' },
    ],
  },
  {
    version: '0.2.0',
    // main 배포일 (QI8, N5)
    date: '2026-10-26',
    summary: '어린 시절의 결정, 인생 기록, 첫 화면이 달라졌어요.',
    items: [
      { kind: 'new', text: '어린 시절의 큰 결정은 부모님이 정해요. 열세 살부터는 공부·친구·취미를 직접 골라요.' },
      { kind: 'new', text: '동생이 생기는 일처럼 아이의 반응이 중심인 일은 고르지 않고 「이렇게 흘러갔습니다」로 기록돼요.' },
      { kind: 'new', text: '「무거운 장면 가리기」를 켜면 아픈 일이나 이별 같은 장면의 글만 가려요. 일어나는 일은 같고, 처음에는 꺼져 있어요.' },
      { kind: 'better', text: '인생 기록이 최신순이에요. 가장 최근 일이 맨 위에 보여요. 엔딩 연표는 처음부터 차례로 읽어요.' },
      { kind: 'better', text: '첫 화면에 한반도 일러스트가 들어오고, 통계마다 제목 한 줄과 공식 통계 이름이 붙었어요.' },
      { kind: 'new', text: '앞날을 내다보는 전망 통계 카드가 생겼어요. 예측이 아니라 공식 추계이고 「전망」 표시가 붙어요.' },
      { kind: 'better', text: '첫 화면의 인생 길이 고르기가 작은 칸 두 개로 줄었어요. 「약 1시간」은 아직 준비 중이에요.' },
      { kind: 'new', text: '첫 화면 아래쪽에서 「새 소식」과 「소개」를 볼 수 있어요.' },
    ],
  },
  {
    version: '0.1.0',
    date: '2026-10-20',
    summary: '수저 게임의 첫 공개 버전이에요.',
    items: [
      { kind: 'new', text: '지난·지금·다가올 세상 중 하나를 골라 태어나면, 룰렛이 수저와 지역을 정하고 출생신고 서류가 나와요.' },
      { kind: 'new', text: '0세부터 삶을 마칠 때까지 한 해씩 흘러가고, 사연과 중대 결정이 찾아와요.' },
      { kind: 'new', text: '20세부터 순자산과 연 소득, 부채를 원 단위로 보여 주고, 선택마다 영향을 한 줄로 알려 줘요.' },
      { kind: 'new', text: '중대 결정 카드에 맞는 통계나 연구가 있으면 인용이 붙어요. 인용은 선택을 권하거나 말리지 않아요.' },
      { kind: 'new', text: '첫 화면 통계 카드마다 통계표 이름과 기준 연도, 출처를 적었어요.' },
      { kind: 'new', text: '「생각 남기기」로 한 줄을 적을 수 있어요. 글은 이 기기에만 저장돼요.' },
      { kind: 'new', text: '한 판은 약 30분이에요. 진행은 이 기기에 저장되고, 엔딩에서 출발선과 최종 순자산을 돌아봐요.' },
      { kind: 'new', text: '배속, 자동 모드, 다크 모드, BGM, 의견 보내기를 쓸 수 있어요.' },
    ],
  },
];

/** 지금 버전의 노트(없으면 undefined — 시험이 막는다) */
export function noteOf(version: string, notes: readonly ReleaseNote[] = RELEASE_NOTES): ReleaseNote | undefined {
  return notes.find((n) => n.version === version);
}
