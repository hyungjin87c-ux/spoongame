# Codex 독립 검증

Claude Code(개발)와 Codex Desktop(독립 검증)이 이 폴더로 주고받는다. 자동 동기화는 없다.

| 파일 | 작성 | 내용 |
|---|---|---|
| `CX-<번호>-<대상>/request.md` | Claude | 대상 커밋, 요구·합격 기준, 변경 범위, 시험 결과, 질문, 제외 범위, 읽지 않을 경로 |
| `CX-<번호>-<대상>/findings.md` | Codex | 지적(`CX-<번호>-NNN`) 또는 `NO_FINDINGS` — 형식 `TEMPLATE-findings.md` |
| `CX-<번호>-<대상>/resolution.md` | Claude | 지적별 재현 여부·처리·수정 커밋·추가 시험·재검증·남은 위험. Codex 원문은 고치지 않는다 |

## 흐름
1. Claude가 `review/CX-<번호>` 브랜치(대상 커밋 위에 요청서만)를 올린다.
2. Owner가 Codex Desktop에서 그 브랜치를 열어 검증을 맡긴다.
3. Codex는 `findings.md`만 `codex/CX-<번호>` 브랜치로 낸다 — 코드 수정·배포 없음.
4. Claude가 재현·수정하고 `resolution.md`를 쓴다.
