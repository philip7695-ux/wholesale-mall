# biibws — B2B 도매몰

한국 아동복 도매(B2B) 몰. 바이어가 라인시트로 주문하면 관리자가 창고 재고를
확인·조정하고, 확정 후 인보이스를 발행해 결제·출하까지 진행한다.

주문 흐름: **주문접수 → 수량조정(창고↔바이어) → 확정 → 인보이스 발행 → 입금확인 → 출하**

## 기술 스택

- **Next.js 16** (App Router, `force-dynamic`) · React · TypeScript
- **Prisma 7** + `@prisma/adapter-pg` + `pg` — PostgreSQL(Neon), `mall` 스키마
- **NextAuth v5**(Credentials) — 이메일/비밀번호 로그인
- **next-intl** — 한국어/영어/일본어/중국어
- **Cloudinary** — 이미지·PDF(룩북) 저장/전송
- **Resend** — 주문·인보이스·출하 알림 메일
- **exceljs**(스타일 xlsx), **@react-pdf/renderer**(인보이스 PDF)
- 배포: **Vercel**

## 요구 사항

- Node.js 20+ (권장 22)
- PostgreSQL 접속 정보 (Neon 등)
- Cloudinary 계정, Resend 계정(메일 사용 시)

## 환경 변수

`.env.local`(로컬) 또는 배포 플랫폼(Vercel) 환경 변수에 설정한다.

| 변수 | 필수 | 설명 |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL 접속 문자열. 앱·Prisma 가 사용한다. |
| `DATABASE_SSL` | – | 알리클라우드 RDS 등 SSL 처리가 필요할 때 `true`. Neon 은 URL 에 `sslmode=require` 로 처리하므로 보통 불필요. |
| `AUTH_SECRET` | ✅(운영) | NextAuth 세션 서명 키. `openssl rand -base64 32` 로 생성. |
| `CLOUDINARY_CLOUD_NAME` | ✅ | Cloudinary 클라우드 이름. |
| `CLOUDINARY_API_KEY` | ✅ | Cloudinary API 키. |
| `CLOUDINARY_API_SECRET` | ✅ | Cloudinary API 시크릿(서버 전용). |
| `RESEND_API_KEY` | –(메일 사용 시 ✅) | Resend API 키. 없으면 메일 발송을 건너뛴다(에러는 아님). |
| `EMAIL_FROM` | – | 발신 주소(예: `noreply@yourdomain.com`). 도메인 인증 필요. 미설정 시 `onboarding@resend.dev`. |
| `WISE_API_TOKEN` | – | Wise 결제 연동 사용 시. |
| `WISE_WEBHOOK_PUBLIC_KEY` | – | Wise 웹훅 서명 검증용 공개키. |

> 시크릿은 저장소에 커밋하지 않는다. Vercel 에서는 대시보드 → Settings → Environment Variables 에 넣는다.

## 로컬 개발

```bash
# 1) 의존성 설치 (반드시 잠금 파일 기준으로)
npm ci

# 2) DB 스키마 반영 + Prisma 클라이언트 생성
npm run db:push
npm run db:generate

# 3) 초기 데이터(관리자 계정 + 기본 카테고리) 시드
npm run db:seed

# 4) 개발 서버
npm run dev        # http://localhost:3000
```

### 초기 관리자 계정

`npm run db:seed` 가 아래 계정을 생성한다(`prisma/seed.ts`).

- 이메일: `admin@wholesale.com`
- 비밀번호: `admin123`

> **운영 배포 전에 반드시 비밀번호를 변경**한다. 관리자 → 회원 관리 → 해당 계정 →
> 수정 → "비밀번호 재설정"에서 바꾼다. 이메일도 실제 운영 주소로 바꾸는 것을 권장.

## 빌드 · 실행 · 검사

```bash
npm run build      # prisma generate + next build
npm start          # 프로덕션 서버
npm run lint       # ESLint (에러 0 기준. any 등은 warn 으로 추적)
npx tsc --noEmit   # 타입 검사
```

## 데이터베이스

- 스키마: `prisma/schema.prisma` (단일 `mall` 스키마, multiSchema).
- 마이그레이션 방식: 현재는 **`prisma db push`**(마이그레이션 히스토리 미사용).
  스키마를 바꾸면 `npm run db:push` 로 반영하고 `npm run db:generate` 로 클라이언트를 재생성한다.
- 접속은 `@prisma/adapter-pg` + `pg.Pool`(`DATABASE_URL`).

## 배포 (Vercel)

1. GitHub 저장소를 Vercel 프로젝트에 연결한다.
2. 위 환경 변수를 Production/Preview 에 등록한다(특히 `DATABASE_URL`, `AUTH_SECRET`, `CLOUDINARY_*`).
3. 빌드 커맨드는 `npm run build`(= `prisma generate && next build`), 기본값 그대로.
4. 스키마를 바꾼 배포에서는 **DB 반영(`db push`)을 먼저** 수행한 뒤 앱을 배포한다.

> git 연동 배포가 도메인 별칭(alias)에 즉시 반영되지 않는 경우
> `vercel deploy --prod --yes` 로 강제 승격한다.

## 프로젝트 구조 (요약)

```
src/
  app/[locale]/            로케일별 페이지 (shop / admin / auth)
  app/api/                 API 라우트 (orders, products, admin, ...)
  components/              UI 컴포넌트 (shop / admin / ui / order)
  lib/                     도메인 로직
    order-status.ts        상태 흐름·전이 규칙
    order-revision.ts      수량 조정·재고 예약/확정
    trade.ts               거래유형·부가세(applyVat)
    pricing.ts / *.server  도매가 계산
    currency.ts            통화 변환/포맷
  hooks/                   클라이언트 훅
prisma/
  schema.prisma            데이터 모델
  seed.ts                  초기 관리자·카테고리
scripts/                   일회성 데이터 적재 스크립트(.cjs)
```

## 도메인 규칙 메모

- **가격**: `variant.price` 는 한국 정상가(택가). 도매가 = 택가 × (1−시즌−등급) × (1−특가).
  상품 상세의 "권장 최소 판매가(신상)"는 택가를 바이어 통화로 환산한 하한선 안내.
- **재고**: 주문 시 `reserved` 만 올리고, **확정 시** 실재고에서 차감한다. 취소하면 예약만 푼다.
- **인보이스(모듈형)**: 발행 시 부가세(포함/세율)·결제수단(원화/외화 계좌·알리페이·위챗)·
  결제 통화(KRW/USD/CNY)를 고른다. 주문의 base 금액은 그대로 두고 인보이스만 환산해 표시한다.
- **거래유형(국내/수출)**: 통화 기준과 인보이스 기본값을 제공한다(발행 시 변경 가능).
