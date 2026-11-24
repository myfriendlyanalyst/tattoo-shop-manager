# Missing-column fallback 목록

FND-01 조사 기준. 이 티켓에서는 호환 동작을 제거하지 않는다.

추가 확인: 수령한 배포 catalog에는 아래 표의 모든 대상 컬럼이 존재한다. `scripts/db/audit-reconstruction.mjs`로 재확인한다. 현재 DB에 존재한다는 사실만으로 다른 환경의 호환성을 보장하거나 fallback을 삭제하지 않는다.

| 위치 | 누락 감지 대상 | 현재 동작 | DB 출처 |
| --- | --- | --- | --- |
| `src/app/accounting/deposits/page.tsx:88` | `disposition`, `used_session_entry_id` | 해당 필드 없이 기본 select 재시도 | repository baseline, deposit disposition |
| `src/app/accounting/payouts/page.tsx:168` | `adjustment_amount`, `adjustment_note`, `calculation_snapshot`, `snapshot_at`, `artist_earnings`, `settlement_amount` | 기본 select로 재시도하고 adjustment는 0/null, snapshot/earnings는 null로 취급 | accounting Section 5, payout settlement |
| `src/app/api/projects/route.ts:191` | Customer `phone_normalized` | 정규화 전화번호 조회 오류를 무시하고 후속 matching 계속 | customer phone normalization |
| `src/app/api/projects/route.ts:208` | Customer `address` | insert payload에서 address 제거 후 재시도 | customer address |
| `src/app/api/projects/route.ts:232` | Customer `address` | update patch에서 address 제거 후 재시도 | customer address |
| `src/app/api/requests/[id]/book/route.ts:336` | Customer `phone_normalized` | 해당 컬럼 오류는 즉시 실패시키지 않고 후속 matching 계속 | customer phone normalization |

UI 외에도 server route가 포함된다. 현재 오류 감지는 주로 message substring이며 엄격한 PostgreSQL 에러코드 검사가 아니다. Payout/Deposit 기본 select가 성공하더라도 전체 재무 schema가 갖춰졌다는 뜻이 아니다.

추가로 `src/lib/email-templates/template-store.ts`는 조회 실패 시 코드의 기본 template을 사용한다. missing-column 전용 fallback은 아니지만 DB 문제를 가릴 수 있어 함께 확인한다. React Suspense fallback, 기본 Staff schedule 및 Google event-not-found 처리는 DB 컬럼 호환 fallback과 구분한다.

실제 스키마 diff에서 위 필드가 존재하는지 확인한 뒤, 제거가 허용된 후속 티켓에서만 fallback을 제거한다.
