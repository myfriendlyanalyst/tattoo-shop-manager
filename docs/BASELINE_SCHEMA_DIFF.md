# FND-01 — 실제 DB 기준 비교 기록

상태: **FND-01 완료 — 빈 로컬 Supabase 재현 성공, 캡처 범위 내 모든 차이 검토 완료**

## 비교 근거

사용자가 Supabase SQL Editor에서 조회한 `Supabase Snippet Untitled query.csv`를 JSON으로 변환하여 `supabase/snapshots/production-catalog-20261123.json`에 보존했다. 파일 생성 시각은 2026-11-24 00:27 KST (2026-11-23 15:27 UTC)다. 이 시각은 export 파일 시각이며 DB 변경 시각이나 migration 적용 시각을 뜻하지 않는다. 원본 파일 ID와 정규화된 JSON checksum은 `supabase/legacy-inventory.json`에 기록했다.

| 메타데이터 | 개수 |
| --- | ---: |
| public 테이블 | 25 |
| public view | 1 |
| 컬럼 (view 포함) | 318 |
| 제약조건 | 110 |
| 인덱스 | 82 |
| public 함수 (extension 소속 제외) | 11 |
| trigger | 18 |
| public 및 앱 Storage 정책 | 65 |
| ACL 항목 | 707 |
| enum label | 48 |
| sequence | 1 |
| extension | 5 |
| 앱 Storage bucket | 1 |

이는 schema-only catalog이며 고객, 세션, 결제 등 운영 데이터는 포함하지 않는다. 적용 이력 테이블은 export 범위 밖이므로 과거 SQL 실행 여부를 증명하지 않는다.

## 발견한 차이와 후보 수정

| 항목 | 수정 전 후보 | 실제 DB | 반영 |
| --- | --- | --- | --- |
| `project_status` | `booked`부터 시작 | 앞에 `lead`, `consultation` 유지 | 미적용 baseline 후보에서 label과 순서 복원 |
| `request_status` | `consultation` 없음 | `client_replied` 다음에 존재 | 미적용 baseline 후보에서 순서 복원 |
| `calendar_feed_tokens` RLS | 활성화 SQL 없음 | 활성화, client policy 없음 | migration 8에 RLS 활성화 추가 |
| Accounting timestamp trigger | `set_accounting_users_updated_at`와 `accounting_users_updated_at` 두 개 생성 | `accounting_users_updated_at` 하나 | migration 8에서 후보가 생성한 중복 trigger 제거 |
| Staff duration check | baseline 자동 이름 + 후속 migration의 명시적 이름으로 중복 가능 | `staff_default_session_duration_check` | baseline에서 배포된 이름 사용 |
| Staff feed token uniqueness | baseline UNIQUE 제약 + 후속 UNIQUE INDEX로 중복 가능 | `staff_calendar_feed_token_key` UNIQUE INDEX, 별도 UNIQUE 제약 없음 | baseline의 UNIQUE 제약 제외, 기존 feed migration으로 생성 |
| pgcrypto schema | schema 지정 없음 | `extensions` | baseline에 schema 지정 |
| client/service ACL | 과거 grant 조각과 환경 기본 grant에 의존 | 실제 ACL 707개 확보 | migration 8에서 PUBLIC/anon/authenticated/service_role의 public 객체 권한을 캡처대로 명시 |

변경한 첫 baseline은 아직 배포하지 않은 후보다. 배포된 migration을 재작성한 것이 아니다. 모든 기존 `docs/*.sql`과 앱 동작은 유지한다. 옛 enum label 보존은 옛 제품 workflow의 재도입이 아니다.

권한 정렬은 캡처된 현상을 재구성한다. 새로운 권한 설계를 승인한 것으로 해석하지 않는다. 이 export에는 anon/authenticated 등의 `TRUNCATE`, `REFERENCES`, `TRIGGER`, `MAINTAIN`도 관찰된다. FND-01에서 임의로 권한을 축소하거나 승인된 권한이라고 단정하지 않는다. 권한 정책 검토는 FND-04에 남긴다. Owner/engine 소유권과 default privileges는 별도 검증 범위다.

## 정적 비교 결과

`node scripts/db/audit-reconstruction.mjs` 통과:

- 25개 table 및 1개 view의 **이름** 일치
- RLS 활성 table 목록 일치
- enum label과 순서 일치
- 순서대로 CREATE/DROP을 반영한 최종 policy/trigger **이름** 일치
- 함수 **이름** 일치
- public table 컬럼 **이름** 일치 (view 필드 제외)
- 문서화한 missing-column fallback 대상이 캡처 DB에 모두 존재

이 검사는 알려진 SQL 형태에서 이름을 추출하는 정적 검사다. SQL parser나 PostgreSQL 실행을 대체하지 않는다. 컬럼 type/default/not-null/물리 순서, 제약조건/인덱스 정의, view와 policy 표현식, 함수 security/search_path/body, effective privilege의 전체 일치까지 통과했다고 주장하지 않는다.

## 빈 DB 실행 및 전체 catalog 비교 결과

사용자가 Docker Desktop과 CLI 3.3.0으로 `verify-local.ps1`을 실행했다. migration 1~8은 빈 로컬 Supabase에서 성공했다. 최초 비교 도구는 같은 객체의 before/after를 각각 세어 **178개 unmatched row**를 출력했다. 이는 누락 178건이 아니라 **89개 객체의 90개 필드 차이**였다. 결과 JSON을 직접 읽고 모든 차이를 검토했다.

| 차이 분류 | 필드 수 | 판단 |
| --- | ---: | --- |
| 컬럼 물리 순서(position) | 81 | 병합 baseline과 배포의 과거 ALTER 순서 차이. 컬럼 이름/type/nullability는 일치. JSON 필드 이름을 사용하는 앱 흐름 유지. 순서에 의존하는 외부 CSV/row import는 별도 매핑 필요 |
| pgcrypto default의 schema qualification | 2 | 양쪽 모두 extensions의 같은 gen_random_bytes(24) 호출. local은 schema를 명시해서 deparse |
| 함수 CRLF/LF | 4 | 줄바꿈을 제외한 함수 전체가 동일 |
| Accounting helper의 동등한 SQL 표현 | 2 | 같은 SECURITY DEFINER/STABLE/search_path와 조건 유지. 부작용 없는 EXISTS의 OR 순서와 IN 상수 순서·공백만 다름 |
| supabase_vault 버전 | 1 | hosted 0.3.1 / local 0.3.2. src에서 Vault 사용 없음. 명시적으로 기록한 플랫폼 patch 버전 차이 |

Table/view 정의, 컬럼 추가·누락·type·nullability, 제약조건 110개, 인덱스 82개, trigger 18개, policy 65개, enum, ACL 707개, sequence, bucket 설정에는 위에 기록하지 않은 차이가 없다. 캡처 밖 column ACL/default privileges/소유권·다른 schema·다른 이름의 Storage 정책은 이 결론에 포함하지 않는다. 앱 운영 데이터/금액 계산/실제 권한별 UI 테스트도 FND-01의 catalog 비교 결과로 주장하지 않는다.

검토 근거:

- `supabase/snapshots/local-catalog-20261124.json` — 실행된 로컬 DB 메타데이터
- `supabase/reviewed-differences.json` — 각 section/object/field의 정확한 expected/actual 값과 검토 사유
- `supabase/snapshots/comparison-20261124.json` — 재비교 결과: **unreviewed 0, reviewed fields 90, reviewed objects 89**

비교 도구는 필드를 통째로 무시하거나 SQL 문자열을 일반적으로 정규화하지 않는다. 현재 캡처 checksum과 각 필드의 정확한 양쪽 값이 일치할 때만 해당 차이를 설명된 것으로 인정한다. 같은 함수의 새 변경, 다른 extension 버전, 새 position 변경은 다시 실패한다. 이 동작을 포함한 비교 회귀 테스트 6개가 통과했다.

Migration SQL은 성공한 재현 이후 변경하지 않았다. 따라서 비교 도구 보완을 위해 Docker reset을 다시 실행할 필요가 없었다. 앞으로 SQL이 바뀌면 새 migration을 추가하고 빈 DB 재현부터 반복한다.

## 기존 운영 환경에 적용할 때의 별도 조건

운영 DB에 migration을 실행하거나 migration history를 repair한 사실은 없다. `legacy-inventory.json`의 applied는 **로컬 재구성에 포함된 내용의 실행 성공**을 뜻한다. 원격에서 과거 SQL 파일을 실행한 이력은 unknown이다. 운영 환경 도입 시 원격 history/백업/차이를 별도로 확인하고 필요한 forward migration만 적용한다. 현재 8개 baseline을 기존 운영 DB에 다시 실행하지 않는다.
