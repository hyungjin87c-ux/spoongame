# 2026-11-07 SPEC-009 dev — CI 시험 제한 시간 조정 (경량)

- 누가: developer
- 무엇을: `.github/workflows/deploy.yml` build 작업의 `timeout-minutes`를 20 → 75로 올리고 옆 주석을 지금 수치(`npm test` 174파일·4,872개, 로컬 약 25분, 2026-11-07)로 고침. main 푸시(6aadd90)의 배포가 「단위 테스트」 단계에서 20분에 취소돼 배포 단계가 건너뛰어졌기 때문.
- 건드리지 않은 것: 다른 단계·동작, 테스트 수·분할, deploy 작업의 `timeout-minutes: 10`. README에는 테스트 시간 수치가 없어 손대지 않음(`.github/workflows/deploy.yml` 머리 주석에도 없음).
- 결과: `tests/pagesDeploy.test.ts`·`tests/buildInfo.test.ts`·`tests/repoHygiene.test.ts` 3파일 63개 통과(워크플로 파일을 읽는 시험은 이 셋뿐, `timeout-minutes`를 검사하는 시험은 없음).
- 다음 단계: 마스터가 커밋·푸시 후 Actions에서 배포가 끝까지 도는지 확인. CI 러너가 75분보다 오래 걸리면 시험 분할·병렬화를 별도 SPEC으로 검토.
