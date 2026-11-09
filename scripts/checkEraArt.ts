import { PENDING_ART } from '../tests/helpers/eraEventsTable';

/**
 * 시대의 창 그림 대기 게이트 (SPEC-013 T2): 새 그림 8장·수정 6장이 아직 없어 임시 그림을 쓰는 사건(`tests/helpers/eraEventsTable.ts#PENDING_ART`)이 **하나도 없어야** 통과한다.
 * 배포 전에 실행한다(`npm run check:era-art`) — 부분 배포 금지(SPEC-013 순서와 게이트: 임시 그림이 남은 채 내보내면 사건과 안 맞는 그림이 거짓으로 보인다).
 * 지금은 대기 목록이 있으므로 실패하는 것이 정상이다(designer가 그림을 내고 형진 님이 승인하면 목록이 줄어든다).
 */
const pending = Object.entries(PENDING_ART);
if (pending.length === 0) {
  console.log('통과: 그림 대기 0건 — 새 그림·수정 그림이 모두 들어왔다.');
} else {
  console.error(`실패: 그림 대기 ${pending.length}건 (새 ${pending.filter(([, v]) => v.work === 'new').length} · 수정 ${pending.filter(([, v]) => v.work === 'fix').length}) — 배포 전에 비어야 한다.`);
  for (const [id, v] of pending) console.error(`  ${id} (${v.work === 'new' ? '새' : '수정'}) — 임시 그림 ${v.piece}`);
  process.exit(1);
}
