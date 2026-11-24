# FND-01 — DB 기준선과 migration 운영

상태: **완료 — 빈 로컬 Supabase 재현 성공, 캡처 범위의 미설명 schema 차이 0건**

## 검증된 기준선

- 사용자가 제공한 Supabase SQL Editor export를 production-catalog-20261123.json에 보존했다.
- Docker Desktop / Supabase CLI 3.3.0에서 migration 1~8을 빈 로컬 Supabase에 실행했다. 모든 migration이 성공했다.
- 로컬 실행 결과는 supabase/snapshots/local-catalog-20261124.json, 비교 결과는 comparison-20261124.json에 보존했다.
- 첫 비교의 178 unmatched row는 89개 객체의 90개 필드 차이였다. 전부 검토했으며 미설명 차이는 0건이다. 상세 근거는 docs/BASELINE_SCHEMA_DIFF.md에 있다.
- 운영 DB 변경, 원격 migration history repair, 앱 기능 변경은 하지 않았다.

## 단일 변경 경로

이후 DB 변경은 supabase/migrations/<14자리 버전>_<설명>.sql만 사용한다. 실행 검증된 migration 1~8은 수정하지 않고 후속 migration을 추가한다. 새 migration 버전과 정규화된 SHA-256을 legacy-inventory.json에 등록하고 검증을 반복한다.

기존 docs/*.sql 51개는 출처/참고 자료다. SQL Editor에서 순서 없이 재실행하지 않는다. 후보 내부의 과거 “Run in Supabase SQL Editor” 주석도 출처이며 운영 실행 지시가 아니다. IF NOT EXISTS는 기존 객체 정의가 같다는 보장이 아니므로 현재 baseline을 기존 운영 DB에 실행하지 않는다.

## 적용 순서

| 순서 | 파일 접미사 | 내용 |
| --- | --- | --- |
| 1 | repository_baseline | 샘플 Artist seed를 제외한 schema, 배포 enum/제약조건 반영 |
| 2 | operational_support | Customer, Staff, Calendar, Appointment email 지원 |
| 3 | inquiry_support | 폼, 메시지, 요청 번호, action token, Storage 정책 |
| 4 | session_and_deposit | Split Payment, payment grid, Deposit application/disposition |
| 5 | payout_support | Artist Rate, adjustment, snapshot, 중복 방지 |
| 6 | access_alignment | 기존 Accounting/Artist 정책 및 grant 복원 |
| 7 | email_template_support | 앱에 필요한 template 테이블/기본값/grant |
| 8 | deployed_catalog_alignment | 캡처된 RLS·ACL 복원 및 중복 Accounting trigger 정리 |

이 순서는 과거 배포 순서가 아니라 새 환경 재현 순서다. capability 재설계 등 후속 기능을 도입하지 않는다. Template brand/zip 콘텐츠 덮어쓰기는 pending으로 남겼고 자동 재현에서 제외했다. 계정 bootstrap, 운영 데이터 삭제, 데모 seed도 제외한다.

## 기존 SQL 상태의 의미

legacy-inventory.json의 51개 항목은 applied 34개, pending 2개, superseded 8개, excluded 7개다.

- applied: 매핑된 migration에 포함한 내용이 **disposable 로컬 재구성에서 실행 성공**했다는 뜻이다. 원격의 과거 파일 실행 이력은 unknown이며 appliedTo/evidence로 구분한다. 부분 반영이나 후속 정책 대체는 각 항목의 note를 읽는다.
- pending: template brand/zip 콘텐츠 변경. 실제 운영 콘텐츠를 덮어써야 한다는 근거가 없으므로 자동 적용하지 않는다.
- superseded: 통합 baseline/후속 정책이 대체한 과거 조각이다.
- excluded: demo seed, 파괴적 정리, 계정 bootstrap, read-only 진단 등 자동 migration 대상이 아니다.

현재 파일 목록과 각 출처 checksum은 검사 스크립트가 검증한다. 운영 적용 이력을 이 목록만으로 repair하지 않는다.

## 검증 명령

Docker Desktop을 실행한 뒤 프로젝트 폴더에서:

```powershell
powershell -NoProfile -File .\scripts\db\verify-local.ps1
```

스크립트는 npm 로컬 Supabase CLI와 per-user Docker 설치 경로를 찾는다. 새 환경에서는 이미지를 내려받고, 로컬 stack만 시작/reset하고, 로컬 DB 컨테이너의 psql로 catalog를 추출한다. 원격 link/push/repair를 호출하지 않는다. reset 대상은 이 프로젝트의 disposable 로컬 DB이므로 여기에 보존해야 할 데이터를 넣지 않는다.

agent 터미널은 Docker 설치 폴더 접근이 제한되어 실제 Docker 실행은 사용자의 PowerShell에서 수행했다. 동일한 제한이 있으면 사용자 터미널로 실행한다. 검증 출력과 snapshot은 Temp 폴더에 남는다.

이미 생성한 catalog만 다시 비교하려면:

```powershell
node scripts/db/check-migrations.mjs
node scripts/db/audit-reconstruction.mjs
node --test scripts/db/catalog-diff.test.mjs
node scripts/db/compare-snapshots.mjs supabase/snapshots/production-catalog-20261123.json supabase/snapshots/local-catalog-20261124.json --reviewed supabase/reviewed-differences.json
```

reviewed 옵션을 생략하면 설명된 차이도 실패로 남기는 strict 비교다. reviewed 옵션은 production snapshot checksum 및 개별 section/object/field의 정확한 expected/actual 값에만 매칭한다. 모든 컬럼 순서나 SQL 공백을 통째로 무시하지 않는다. 새 함수/정책/type/extension 버전 변경은 다시 실패한다.

## 차이 및 검증 범위

정확한 before/after와 사유는 supabase/reviewed-differences.json에 있다. 물리 컬럼 순서 81개, 동일 pgcrypto default의 schema 표기 2개, 함수 CRLF/LF 4개, 동등한 Accounting helper 표현 2개, 앱이 사용하지 않는 Vault extension patch 버전 1개를 기록했다.

검증 대상은 public relation/column/default/constraint/index/function/trigger/enum/RLS/policy/grant/sequence, extension 목록, request-references bucket 설정과 request_references_* 정책이다. 고객·계정·token·template 본문·sequence 현재값은 추출하지 않았다. column ACL/default privileges/객체 소유권/다른 schema 및 다른 이름의 Storage 정책, 운영 데이터 무결성, 금액 계산 및 UI 동작은 이 catalog 검증의 범위 밖이다.

## 배포 schema를 다시 추출할 때

SQL Editor에서는 supabase/schema-snapshot-editor.sql을 사용한다. psql에서는 read-only transaction으로 감싸진 supabase/schema-snapshot.sql을 사용한다. 두 파일의 SELECT는 같아야 한다. 전체 DDL이나 캡처 밖 ACL 확인이 필요하면 schema-only dump로 보완한다.

DB 비밀번호를 파일/명령 인자/채팅에 붙여 넣지 않는다. 로컬 PGSERVICE/password file과 SSL 등으로 접속 설정을 준비한 후 대상 호스트를 확인한다.

```powershell
pg_dump --schema-only --schema=public --no-owner --no-privileges --file=live-public.sql
psql -X -qAt -v ON_ERROR_STOP=1 -f supabase/schema-snapshot.sql -o live-catalog.json
```

## 기존 운영 환경 도입

1. 대상 프로젝트, DB 버전, 현재 migration history와 백업/복구 절차를 확인한다.
2. 캡처가 오래됐다면 read-only 재추출하고 새 차이를 검토한다.
3. 실제 필요한 변경만 forward migration으로 작성한다. 현재 baseline 8개를 운영 DB에 재실행하지 않는다.
4. 기존 정의가 동등함을 확인한 migration에 대해서만 원격 적용 이력 정렬을 검토한다. 로컬 applied 상태를 원격으로 복사하지 않는다.
5. 운영 데이터 backfill/충돌을 확인한 뒤 필요한 migration만 배포한다.

## 완료 근거

| 확인 | 결과 |
| --- | --- |
| 출처 51개/순서 8개/hash | 통과 |
| 빈 로컬 Supabase 전체 재현 | 성공 — 사용자 PowerShell 실행, CLI 3.3.0 |
| production/local catalog 차이 | 미설명 0, 89개 객체/90개 필드에 정확한 검토 규칙 |
| 비교 도구 회귀 테스트 | 6개 통과 — 새 정책/type/누락/함수/버전/position 변경 검출 |
| 이후 DB 변경 경로 | supabase/migrations로 통일 |

참고: https://supabase.com/docs/guides/deployment/database-migrations
