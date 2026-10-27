import { profileLabel } from './birthProfile';
import { LIFE_LENGTH_TEXT } from '../data/titleText';
import type { LifeLength, Phase, ProfileId } from './types';

/**
 * 의견 보내기 주소 (SPEC-003 DB7): GitHub 이슈 작성 화면(`…/issues/new?template=feedback.yml`)으로 보내는 주소를 만든다.
 *
 * **허용 목록 필드만** 채운다 — 빌드 버전, 지금 화면 이름, 세상, 인생 길이. 이 함수의 입력에는 캐릭터 이름·나이·인생 기록·자유 기록·저장 데이터·브라우저 정보가 아예 들어갈 자리가 없다
 * (입력 타입이 화면 단계·세상·인생 길이의 정해진 값과 빌드 표기뿐이다 — 값은 아래 표에서 글자로 바뀐다). 호출하는 쪽도 게임 상태에서 이 네 가지만 꺼내 넘긴다(`feedbackFieldsOf`).
 * 이슈 양식(.github/ISSUE_TEMPLATE/feedback.yml)의 「어떤 화면에서」 칸(id `screen`)에 이 값을 미리 채운다 — 그 밖의 칸(무엇을 했을 때·기대한 것…)은 사용자가 직접 적는다.
 * 저장소 주소는 빌드 설정(package.json repository → vite define, src/buildInfo.ts#REPO_URL)에서 읽는다. 모양이 맞지 않으면 null(링크를 만들지 않는다).
 */

/** 이슈 양식 파일 이름 (.github/ISSUE_TEMPLATE/feedback.yml — tests/feedbackUrl.test.ts가 실제 파일과 대조한다) */
export const FEEDBACK_TEMPLATE = 'feedback.yml';
/** 미리 채우는 양식 칸의 id (feedback.yml의 `id: screen`) */
export const FEEDBACK_SCREEN_FIELD = 'screen';

/** 화면 이름 표 (이슈를 읽는 사람이 어느 화면인지 알 수 있게) */
export const FEEDBACK_SCREEN_LABEL: Record<Phase, string> = {
  title: '첫 화면',
  roulette: '룰렛',
  birth: '출생신고',
  life: '인생 진행 중',
  ending: '엔딩',
};

export interface FeedbackFields {
  /** 저장소 주소 `https://github.com/<주인>/<저장소>` (빌드 설정) */
  repoUrl: string;
  /** 지금 화면 단계 */
  screen: Phase;
  /** 이 판의 세대(첫 화면처럼 판이 없으면 null) — 표시 이름만 싣는다(출생 연도·시도는 싣지 않는다) */
  generation: ProfileId | null;
  /** 이 판의 인생 길이(판이 없으면 null) */
  lifeLength: LifeLength | null;
  /** 빌드 표기 `v0.1.0 (abc1234)` (src/buildInfo.ts#BUILD_LABEL) */
  buildLabel: string;
}

const REPO_PATTERN = /^https:\/\/github\.com\/[A-Za-z0-9][A-Za-z0-9-]{0,38}\/[A-Za-z0-9._-]{1,100}$/;
/** 빌드 표기에 들어갈 수 있는 글자: 영숫자·점·더하기·빼기·공백·괄호·한글(「개발 빌드」) — 이름·기록 같은 자유 글이 끼어들지 못하게 좁게 잡고 길이도 막는다 */
const BUILD_LABEL_PATTERN = /^v[0-9A-Za-z.+-]{1,24} \((?:[0-9a-f]{7}\+?|개발 빌드)\)$/;

/** 이슈 작성 주소. 저장소 주소나 빌드 표기가 어긋나면 null. 화면 글자는 쉼표 나열(가운뎃점 금지, QM2-10). */
export function buildFeedbackUrl(fields: FeedbackFields): string | null {
  if (!REPO_PATTERN.test(fields.repoUrl)) return null;
  const parts = [FEEDBACK_SCREEN_LABEL[fields.screen]];
  if (fields.generation !== null) parts.push(profileLabel(fields.generation));
  if (fields.lifeLength !== null) parts.push(LIFE_LENGTH_TEXT[fields.lifeLength].title);
  if (BUILD_LABEL_PATTERN.test(fields.buildLabel)) parts.push(fields.buildLabel);
  const value = parts.join(', ');
  return `${fields.repoUrl}/issues/new?template=${FEEDBACK_TEMPLATE}&${FEEDBACK_SCREEN_FIELD}=${encodeURIComponent(value)}`;
}

/** 게임 상태에서 허용 목록 네 가지만 꺼낸다 (이름·나이·기록·저장 데이터는 읽지도 않는다) */
export function feedbackFieldsOf(game: { phase: Phase; generation: ProfileId | null; lifeLength: LifeLength | null }, repoUrl: string, buildLabel: string): FeedbackFields {
  return { repoUrl, screen: game.phase, generation: game.generation, lifeLength: game.lifeLength, buildLabel };
}
