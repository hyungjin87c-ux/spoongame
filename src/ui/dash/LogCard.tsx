import { useMemo, useRef, useState } from 'react';
import { formatCount } from '../../core/format';
import { tryVirtualPopulation } from '../../core/population';
import type { HistoryEntry } from '../../core/types';
import { DASH_TEXT } from '../../data/dashText';
import { FitPair } from '../FitPair';
import { Glue } from '../Glue';
import { useEpochMinute, useReducedMotion } from '../hooks';
import { LogList } from './LogList';
import { isAtLogTop, logRows } from './logOrder';

/**
 * 인생 기록 카드 (SPEC-003 DB12·DB14, SPEC-005 LR1~LR7): 가운데 영역에 **한 줄씩 쌓이고** 영역 안에서 스크롤된다. **위가 최신**이다 — 새 줄은 맨 위에 붙는다.
 *  - 저장 순서(`game.history`)는 시간순 그대로이고 화면만 뒤집는다(`logOrder.ts#logRows`). DOM 순서 = 화면 순서 = 읽기 순서(CSS로 겉만 뒤집지 않는다 — 스크린리더·Tab 순서가 갈라진다).
 *  - 맨 위(가장 최근)를 보고 있는 동안은 새 줄이 와도 맨 위에 머문다(= 새 줄이 바로 보인다). 아래로 내려 지난 기록을 읽는 중이면 **보던 줄이 화면에서 움직이지 않게** 스크롤 위치를 직접 보정하고
 *    (`LogList.tsx` — WebKit은 `overflow-anchor`를 구현하지 않는다) 「새 기록 N개 · 맨 위로」 버튼에 개수만 센다. 누르거나 직접 맨 위까지 올리면 개수는 0.
 *  - 줄 형식 「{나이}세 {문장}」, 종류: 단계(출생 포함, 아래 선 — 그 단계의 가장 오래된 줄이 단계 묶음의 맨 아래에 와서 선이 묶음을 가른다) / 사건 / 선택 결과(「선택: …」) / (나의 기록 — 자유 기록 M7c) / 사망. 첫 줄(가장 최근)은 굵게.
 *  - 맨 위 고정 줄(DB14): 「이 세상의 가상 인구 {N}명 · {이름}도 그중 한 사람」 — 쌓이는 기록과 구분되는 띠. N은 첫 화면과 같은 가상 인구 함수(core/population.ts)이고 시각은 UI가 분 단위로 넘긴다.
 *    짧은 쌍이라 `FitPair`(한 줄에 안 들어가면 기호 없이 두 줄). 근거 통계를 읽을 수 없으면 이 줄만 빠진다(R-211).
 *  - 스크롤 영역은 키보드로 닿을 수 있다(tabindex 0 + 이름 + 안내 문구가 설명) — 방향키·PageUp/Down으로 지난 기록을 읽고 Home = 맨 위(가장 최근) · End = 맨 아래(가장 오래된)다.
 *    영역(최대 520px)이 가용 높이(화면 − 고정 머리 − 진행 줄)보다 크면 키보드 포커스를 받을 때 위쪽 변이 머리 밑에 오게 맞춘다(CM10 예외 ②).
 *  - 처음 뜰 때·새로고침 복원 때는 맨 위(가장 최근)에서 시작한다 — 새로 만든 스크롤 영역의 기본 위치다.
 */

export function LogCard({ history, name, live, minute }: { history: readonly HistoryEntry[]; name: string; live: boolean; minute?: number }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const rows = useMemo(() => logRows(history), [history]);
  /** 「맨 위로」를 누른 직후 부드럽게 올라가는 중인가 — 그동안 새 줄이 와도 맨 위로 따라간다 */
  const following = useRef(false);
  const [unread, setUnread] = useState(0);
  const clock = useEpochMinute();
  const reduced = useReducedMotion();
  const population = tryVirtualPopulation(minute ?? clock);

  const onScroll = () => {
    const el = scrollerRef.current;
    if (el === null) return;
    if (isAtLogTop(el.scrollTop)) {
      following.current = false;
      if (unread > 0) setUnread(0);
    }
  };

  const jump = () => {
    following.current = true;
    setUnread(0);
    scrollerRef.current?.scrollTo({ top: 0, behavior: reduced ? 'instant' : 'smooth' });
  };

  return (
    <section className="card log" aria-labelledby="log-t" data-testid="log">
      <div className="card__head card__head--tight">
        <h2 id="log-t" className="card__title">
          {DASH_TEXT.logTitle}
        </h2>
        <span className="t-xs t-faint" id="log-hint" data-testid="log-hint">
          <Glue text={DASH_TEXT.logHint} />
        </span>
      </div>
      {population === null ? null : (
        <p className="log__pin" data-testid="log-pin">
          <FitPair a={DASH_TEXT.logPinA(formatCount(population))} b={DASH_TEXT.logPinB(name)} />
        </p>
      )}
      <LogList
        rows={rows}
        live={live}
        scrollerRef={scrollerRef}
        following={following}
        onScroll={onScroll}
        onUserScroll={() => {
          // 사용자가 직접 스크롤하기 시작하면(휠·터치·포인터·키보드) 「맨 위로」가 시작한 따라가기를 놓는다 — 그 뒤 새 줄은 지금 보는 자리를 지킨다
          following.current = false;
        }}
        onUnread={(added) => setUnread((n) => n + added)}
        onReset={() => setUnread(0)}
      />
      {unread > 0 ? (
        <button type="button" className="btn btn--secondary btn--sm log__jump" onClick={jump} data-testid="log-jump">
          <Glue text={DASH_TEXT.logJump(unread)} />
        </button>
      ) : null}
    </section>
  );
}
