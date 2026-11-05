/**
 * SPEC-010 줄 문장 시험의 금지어 목록 (코어 회차, 2026-11-03) — 시험 데이터다. 게임 문구에는 쓰지 않는다.
 *
 * 1. **회사·제품·서비스 이름** (마스터 M11). 출처는 `docs/data/future-timeline-sources.md`의 「게임 문구 금지」 표시 둘레다. 그 문서의 표시는 **한 곳**(4-7절 뇌-컴퓨터 항목, 「한 미국 업체」)이고
 *    표시 자리에는 이름이 지워져 있어, 같은 항목의 출처 행(E9)과 4-7절 끝의 「회사명 금지」 문장이 가리키는 업체 이름을 뽑았다. 같은 문서를 처음부터 끝까지 훑어 이름이 나오는 다른 회사·제품·서비스도
 *    더했다(줄 번호는 아래 주석). **원문 기사 제목과 링크는 넣지 않았다.** reviewer가 목록을 확인한다(M11).
 * 2. 마스터 지정 평가·공포어 (SPEC-010 「그림 수위」 6).
 * 3. 정당 이름 — SPEC-010 「줄 규칙」의 「실존 인물·정당 0」을 시험이 잡도록 developer가 더한 최소 목록이다(인물 이름은 열거할 수 없어 시험하지 않는다).
 */

/** 문서에서 뽑은 회사·제품·서비스 이름 (영문은 대소문자 무시로 견준다) */
export const COMPANY_NAMES_FROM_DOC: readonly string[] = [
  'Neuralink', '뉴럴링크', // 4-7절 「게임 문구 금지」 표시가 가리키는 미국 업체 (E9 출처 행, 433행)
  'Neuracle', '뉴라클', // E9의 중국 승인 보도 속 업체 (433행)
  'ChatGPT', '챗GPT', '챗지피티', // 99행 (청년 채용 해설) — 제품 이름
  'PwC', // 60·220·370·438행 (인도 부상 전망의 출처) — 회사 이름
  'Goldman', '골드만삭스', '골드만', // 370행
  'Metaculus', // 42·335·426·443행 — 예측 시장 서비스 이름
  'MassDevice', // 433행 — 보도 매체 이름
];

/** 문서에는 이름이 없지만 이번 연표의 주제(반도체 호황·AI·자율주행·뇌-컴퓨터)에서 줄에 새어 들어오기 쉬운 회사·제품 이름 — developer가 더한 보강이다 */
export const COMPANY_NAMES_EXTRA: readonly string[] = [
  '삼성', 'Samsung', 'SK하이닉스', '하이닉스', 'hynix', '엔비디아', 'NVIDIA', '오픈AI', 'OpenAI', '구글', 'Google', '애플', 'Apple', '마이크로소프트', 'Microsoft', '아마존', 'Amazon',
  '테슬라', 'Tesla', '웨이모', 'Waymo', '네이버', '카카오', '쿠팡', '현대차', '메타', 'Anthropic', '앤트로픽', '딥마인드', 'DeepMind', '제미나이', 'Gemini', 'GPT', '클로드',
];

/** 마스터 지정 평가·공포어 — 줄에 낱말로 0 (SPEC-010 「그림 수위」 6) */
export const ALARM_WORDS: readonly string[] = ['종말', '붕괴', '멸망', '재앙', '파국', '참사', '위기'];

/** 정당 이름 (실존 정당 0) */
export const PARTY_NAMES: readonly string[] = ['더불어민주당', '국민의힘', '정의당', '개혁신당', '조국혁신당', '민주당', '기본소득당', '진보당'];

/**
 * 나라 이름 — 줄에 나와도 되는 곳은 경제·인구·국제 질서 **사실 문장**뿐이다 (SPEC-010 「줄 규칙」 · 그림 수위 5, r2 반영 2026-11-04: 일본·독일·인도·한국·미국·중국).
 * 줄임말 「미·중」(미국·중국, U38 「미·중 두 진영으로 세계가 갈렸습니다.」)과 「한국」(U43)도 건다 — 이 목록에는 R-608 전에 둘이 없어 허용 줄 밖에 나와도 시험이 멈추지 않았다.
 * 허용 줄은 아래 `COUNTRY_ALLOWED`가 따로 적는다(다른 줄에 나라 이름이 나오면 시험이 멈춘다).
 */
export const COUNTRY_NAMES: readonly string[] = ['미국', '중국', '일본', '독일', '인도', '한국', '미·중', '미중', '러시아', '북한', '영국', '프랑스', '대만', '이란', '이스라엘', '우크라이나', '캐나다', '호주', '브라질'];

/**
 * 나라 이름이 줄에 있어도 되는 번호와 그 낱말 (SPEC-010 「줄 규칙」: U02 일본·독일 · U24 인도 · U38 미·중 · U43 한국 — 넷뿐).
 * 나라 이름이 있어도 전쟁·충돌·정권·군사를 말하지 않는다(U38은 진영의 갈림만 말하고 가상 전쟁은 없다 — 형진 님 답 2026-11-04). 허용 줄에도 평가·공포어는 `lineViolations`가 막는다.
 */
export const COUNTRY_ALLOWED: Readonly<Record<string, readonly string[]>> = { U02: ['일본', '독일'], U24: ['인도'], U38: ['미·중'], U43: ['한국'] };
/** 나라 이름과 함께 있으면 안 되는 낱말(전쟁·충돌·정권·군사) — 허용 줄에도 건다 */
export const COUNTRY_WAR_WORDS: readonly string[] = ['전쟁', '침공', '충돌', '정권', '군사', '군대', '병력', '무기', '미사일', '쿠데타', '분쟁'];

/**
 * 주인공 행동 낱말 (SPEC-010 구현 규칙 6): 2027년 이후 줄에 주인공이 한 일처럼 읽히는 낱말이 0이다. 마스터 목록 「갔|탔|샀|받았|일했|출근|퇴근|배웠|먹었|마셨」을 그대로 고정한다.
 * 견주는 방식: 낱말 **어디에 있든** 건다 — 「나갔습니다」·「갈아탔습니다」·「돌려받았습니다」 같은 합성어도 걸린다. 주어가 사물이라 사람이 확인한 줄만 문장 통째로 `ACTION_ALLOW_LINES`에 적어 풀어 준다(지금은 0줄 — 아래 주석).
 * 「먼저 받는」·「일하지 않아도」처럼 사람을 꾸미는 말은 어간이 다르므로(「받는」·「일하지」) 걸리지 않는다(U15·U22·U32·U36).
 */
export const ACTION_STEMS: readonly string[] = ['갔', '탔', '샀', '받았', '일했', '배웠', '먹었', '마셨'];
export const ACTION_ANYWHERE: readonly string[] = ['출근', '퇴근'];
/** 어간이 들어 있지만 주어가 사회·사물임을 사람이 확인한 줄 (문장 통째로 견준다 — 새 줄은 시험이 멈춰 세우고 사람이 판단한다) */
export const ACTION_ALLOW_LINES: ReadonlySet<string> = new Set<string>(); // 지금 0줄 — 옛 U23 「…올라갔습니다.」는 형진 님 묶음 B 승인(2026-11-03)에서 「사과밭이 북쪽 산자락에만 남았습니다.」로 바뀌어 예외를 뺐다(R-608)

/** 줄 하나에서 걸리는 주인공 행동 낱말 (없으면 빈 목록) */
export function actionWordsIn(line: string): string[] {
  if (ACTION_ALLOW_LINES.has(line)) return [];
  const hits: string[] = [];
  for (const token of line.split(/\s+/)) {
    for (const w of [...ACTION_STEMS, ...ACTION_ANYWHERE]) if (token.includes(w)) hits.push(token);
  }
  return hits;
}

/** 줄 문장 하나의 규칙 위반 (없으면 빈 목록): 길이 · 합쇼체 · 숫자 · 알파벳 · 금지어 */
export function lineViolations(line: string, maxLen: number): string[] {
  const out: string[] = [];
  if (line.length > maxLen) out.push(`${line.length}자 > ${maxLen}`);
  if (!line.endsWith('습니다.')) out.push('「…습니다.」로 끝나지 않음');
  if ((line.match(/[.?!。]/g) ?? []).length !== 1) out.push('문장이 하나가 아님(마침표 하나만, 물음표·느낌표 0)');
  if (/[0-9０-９]/.test(line)) out.push('숫자');
  for (const word of line.match(/[A-Za-z]+/g) ?? []) if (word !== 'AI' && word !== 'AGI') out.push(`알파벳 ${word}`);
  const lower = line.replace(/\s/g, '').toLowerCase(); // 「오픈 AI」처럼 띄어 써도 잡는다
  for (const name of [...COMPANY_NAMES_FROM_DOC, ...COMPANY_NAMES_EXTRA]) if (lower.includes(name.toLowerCase())) out.push(`회사·제품 이름 ${name}`);
  for (const word of ALARM_WORDS) if (line.includes(word)) out.push(`평가·공포어 ${word}`);
  for (const name of PARTY_NAMES) if (line.includes(name)) out.push(`정당 이름 ${name}`);
  return out;
}
