import { commaList } from '../core/glue';
import { faqHelpLine } from './aboutFaq';
import { TITLE_TEXT } from './titleText';

/**
 * 첫 화면 하단(GS12)의 문구 — docs/design/copy.md 16-12 (a)~(g)의 확정 글 (형진 님 GM3 게이트 ③ 답 3차 4 + 자리표시자 답). 어체는 해요체 하나.
 * 「80억분의 1」은 **이름만** 적고 링크를 달지 않으며 그 게임과 관계없는 개인 프로젝트임을 같은 블록에서 밝힌다(마스터 결정). 하단의 **구조만** 참고했다 — 문장·그림·로고·연락처는 옮기지 않았다(reviewer 판독).
 * 바뀌는 값은 손으로 쓰지 않고 데이터에서 채운다: 통계 출처 기관 = 캐러셀 데이터의 `orgs`(푸터 출처 줄과 같은 쉼표 나열), 상담전화 = `faqHelpLine()`(자살률 지표의 `helpLine`), 설정 이름 = `TITLE_TEXT.gentleName`.
 */
export const FOOT_TEXT = {
  /** (a) 세 칸 */
  what: { h: '이 게임은', p: '태어날 집도, 땅도, 해도 고를 수 없는 한국 인생 시뮬레이션이에요. 룰렛이 정한 집안 형편과 시대 속에서 한 사람의 삶을 해마다 따라가며, 출발선의 차이가 선택과 결과에 어떻게 닿는지 느껴 봐요.' },
  why: { h: '왜 만들었나', p: '「80억분의 1」을 한국 사정에 맞게 다시 만들어 보고 싶었어요. 부모와 자녀, 이웃 세대가 서로의 시절을 살아 보며 이야기 나누고 서로를 이해하길 바라며 만들었어요. 「80억분의 1」과는 관계없는 개인 프로젝트예요.' },
  data: {
    h: '무엇이 실제 자료인가',
    p: (orgs: readonly string[]) =>
      `통계 그래프와 태어날 때의 바탕 수치(출생 월, 체중, 부모님 나이 등)는 ${commaList(orgs)}의 공개 자료에서 옮겼어요. 수저 단계가 나올 확률, 선택지의 효과 같은 게임 속 확률과 수치는 게임을 위해 정한 설계값이에요. 통계가 아니에요. 사연과 인물은 만들어 낸 이야기예요.`,
  },
  /** (b) 무거운 일 + 상담전화 + 권장 연령 */
  heavy: (): string => {
    const help = faqHelpLine();
    const call = help === null ? '' : ` ${help.name} ${help.number}(${help.hours})로 전화할 수 있어요.`;
    return `아픈 일, 이별, 병, 죽음처럼 무거운 일도 일어나요. 자극적으로 그리지 않고 짧게 적어요. 「${TITLE_TEXT.gentleName}」를 켜면 그런 장면의 글만 가려요. 힘든 마음을 혼자 견디지 않아도 돼요.${call} 15세 이상 권장.`;
  },
  /** (c) AI 고지 */
  ai: '한 사람이 기획하고 AI(Anthropic의 Claude)와 함께 만든 시뮬레이션이에요. 숫자는 공개 통계와 게임의 설계값이고, 게임을 하는 동안 AI가 글을 새로 만들지는 않아요.',
  /** (d) 의견 */
  beta: '아직 다듬는 중이에요. 이상한 곳이나 바라는 점을 알려 주시면 살펴보고 고칠게요.',
  feedback: '의견 보내기',
  news: '새 소식',
  /** (f) 가족 한 줄 (designer 초안) */
  family: '가족과 함께라면 부모님이나 자녀의 세대를 골라 살아 보고, 그 시절 이야기를 나눠 보세요.',
  /** (e) 아주 작은 링크 줄 */
  links: { intro: '소개', privacy: '개인정보 처리방침', terms: '이용 안내', feedback: '의견 보내기', contact: '그 밖의 문의' },
  /** 문의 메일 — 글자로 보이고 링크는 `mailto:`만 (형진 님 답: 철자 그대로) */
  email: 'kottonchild@gmail.com',
  /** (g) 운영자 */
  operator: '운영자 cottonchild',
} as const;
