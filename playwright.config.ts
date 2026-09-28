import { defineConfig, devices } from '@playwright/test'
import {
  GOOGLE_API_KEY,
  TEST_MILVUS_COLLECTION,
  TEST_MILVUS_URI,
  TEST_MINIO_ACCESS_KEY,
  TEST_MINIO_ENDPOINT,
  TEST_MINIO_SECRET_KEY,
  TEST_POSTGRES_DSN,
} from './e2e/support/env'

/**
 * 이 파일의 책임: e2e 3-project 격리(round06b 단계1 — 원 round06e 계획 4의 개정 실행)
 * + 백엔드/프론트 최대 5개 프로세스 기동.
 *
 * project 구성(원 계획 §Task 4와 동일한 구조, 값만 개정):
 *  · smoke        — 더미 프론트(5175, 백엔드 없음). round06d 3건.
 *  · scenario     — APP_ENV=local 백엔드(8010) + 프론트(5173). 시나리오 본대.
 *  · env-prod     — APP_ENV=prod 백엔드(8011) + 프론트(5174). R6B-13: 로컬 원안 유지 —
 *                   배포 URL(https://dev.archai-landsoft.co.kr) 검증은 단계4에서
 *                   E2E_BASE_URL로 smoke를 수동 실행한다(아래 smoke baseURL 계약).
 *
 * webServer는 project별로 나뉘지 않는다(Playwright 1.61 실측 — 원 계획 교차검증 D2).
 * E2E_SMOKE_ONLY=1일 때만 scenario/env-prod용 4개를 배열에서 뺀다.
 *
 * 데이터 전제(R6B-12): museum_test는 Node B의 같은 PostgreSQL/Milvus 안 전용
 * DB/컬렉션이다. 접속 좌표는 실행 위치 중립(R6B-15/C-6) — support/env.ts가
 * env 주도 + 로컬 직결 기본값(PG 127.0.0.1:5432 등)으로 조립하므로 노드 내부·
 * 온프레미스에서는 무설정으로 돌고, 개발 PC에서는 C-1의 OpenSSH 터널을 연 뒤
 * TEST_PG_PORT=15432만 지정한다(gcloud compute ssh 금지). globalSetup
 * (support/preflight.ts)이 3좌표를 TCP로 프리플라이트해 연결 부재를 3초 안에 알린다.
 * 자격증명은 하드코딩하지 않는다(C-2) — env.ts가 workspace/app/.env 실값에서
 * 자격증명만 파생하고 DB 이름은 museum_test로 강제한다.
 * 픽스처 코퍼스는 최초 1회 `scripts/e2e_fixture.py`로 시드한다(webServer가 자동
 * 시드하지 않는다 — 픽스처는 결정적이라 재시드가 드물다).
 */

const SMOKE_ONLY = process.env.E2E_SMOKE_ONLY === '1'

const SMOKE_WEB_PORT = Number(process.env.E2E_SMOKE_WEB_PORT || 5175)
const SCENARIO_WEB_PORT = Number(process.env.E2E_SCENARIO_WEB_PORT || 5173)
const SCENARIO_API_PORT = Number(process.env.E2E_SCENARIO_API_PORT || 8010)
const ENV_PROD_WEB_PORT = Number(process.env.E2E_ENV_PROD_WEB_PORT || 5174)
const ENV_PROD_API_PORT = Number(process.env.E2E_ENV_PROD_API_PORT || 8011)

if (!SMOKE_ONLY && !TEST_POSTGRES_DSN) {
  throw new Error(
    'scenario/env-prod에는 POSTGRES_DSN이 필요하다 — workspace/app/.env를 채우거나 ' +
    'E2E_POSTGRES_DSN을 지정하라(C-2). smoke만 돌리려면 E2E_SMOKE_ONLY=1.',
  )
}

export const ROOT_USERNAME = process.env.E2E_ROOT_USERNAME || 'e2e_root'
export const ROOT_PASSWORD = process.env.E2E_ROOT_PASSWORD || 'e2e-root-pw-01'

function backendEnv(appEnv: 'local' | 'prod') {
  return {
    PROFILE: 'cloud',
    APP_ENV: appEnv,
    SEARCH_MODES_ENABLED: 'true',
    POSTGRES_DSN: TEST_POSTGRES_DSN,
    MILVUS_URI: TEST_MILVUS_URI,
    MILVUS_COLLECTION: TEST_MILVUS_COLLECTION,
    MINIO_ENDPOINT: TEST_MINIO_ENDPOINT,
    MINIO_ACCESS_KEY: TEST_MINIO_ACCESS_KEY,
    MINIO_SECRET_KEY: TEST_MINIO_SECRET_KEY,
    // round06c B3 — 로컬 http라 Secure 쿠키를 끈다(기본값 true는 운영 HTTPS 전제).
    SESSION_COOKIE_SECURE: 'false',
    // round06b 단계3-B — 스위트 자신의 트래픽이 앱의 IP당 rate limit을 넘기지 않게 한다.
    //
    // 왜 필요한가: `_check_rate_limit`은 `client_key = request.client.host`로 세는데,
    // Playwright가 띄운 테스트 백엔드에서는 **모든 요청이 127.0.0.1 하나로 수렴**한다.
    // 20여 스펙 × 워커 2가 각자 검색·브리핑·채팅을 내면 기본값 60/min을 쉽게 넘겨
    // `POST /search`가 429를 받고 → 결과 카드 0건 → 후속 단언이 **엉뚱한 증상**
    // (예: `waitForEvent('download')` 60초 타임아웃)으로 위장한다. E-SEARCH-06이
    // 정확히 그렇게 실패했고 merge-base에서도 동일 재현됐다(기존 결함, 회귀 아님 —
    // `.superpowers/sdd/e2e-fix-report.md`).
    //
    // 왜 증상 은폐가 아닌가: 여기는 **테스트 백엔드 전용 환경**이다. 제품 기본값
    // (`config.py: rate_limit_per_min = 60`)과 dev·prod `.env`는 그대로다. 한 IP에서
    // 분당 수백 요청은 실사용 패턴이 아니라 **테스트 하네스의 인공물**이므로, 그것을
    // 제품 한도로 재는 것이 오히려 잘못된 측정이다. rate limit 자체의 검증은 전용
    // 테스트(`tests/test_rate_limit_eviction.py`·`tests/test_nginx_rate_limit.py`)와
    // 라이브 실측(dev에서 인증 세션으로 60×200 + 10×429 확인)이 맡는다.
    RATE_LIMIT_PER_MIN: '600',
    BOOTSTRAP_ADMIN_USERNAME: ROOT_USERNAME,
    BOOTSTRAP_ADMIN_PASSWORD: ROOT_PASSWORD,
    GOOGLE_API_KEY,
    CORS_ORIGINS: '[]',
  }
}

// 구 단일-project 설정(round06d)이 top-level use에 두었던 디버깅 값 — project마다 명시 복원.
const COMMON_USE = { trace: 'on-first-retry' as const, screenshot: 'only-on-failure' as const }

// [리뷰 교정] 백엔드 2종은 port(포트 오픈)가 아니라 **url(/health 2xx)** 로 준비를
// 판정한다 — 포트가 열린 시점과 lifespan(schema.sql 적용·부트스트랩 admin UPSERT·
// 체크포인터 setup, api.py:369-395) 완료 시점 사이의 레이스를 차단한다. 경로는 실측
// /health(api.py:457 — /healthz 아님, 공개 계약이라 인증 불요).
const scenarioApiServer = {
  command: `uv run python scripts/run_api.py --port ${SCENARIO_API_PORT}`,
  cwd: '..',
  url: `http://127.0.0.1:${SCENARIO_API_PORT}/health`,
  reuseExistingServer: !process.env.CI,
  timeout: 30_000,
  env: backendEnv('local'),
}
// 프론트(vite) 2종은 port 판정 유지 — dev 서버는 포트 오픈=준비이고 lifespan이 없다.
const scenarioWebServer = {
  command: 'npm run dev',
  cwd: '.',
  port: SCENARIO_WEB_PORT,
  reuseExistingServer: !process.env.CI,
  timeout: 30_000,
  env: {
    PORT: String(SCENARIO_WEB_PORT),
    VITE_API_BASE_URL: '/api',
    VITE_DEV_API_PROXY: `http://127.0.0.1:${SCENARIO_API_PORT}`,
  },
}
const envProdApiServer = {
  command: `uv run python scripts/run_api.py --port ${ENV_PROD_API_PORT}`,
  cwd: '..',
  url: `http://127.0.0.1:${ENV_PROD_API_PORT}/health`,
  reuseExistingServer: !process.env.CI,
  timeout: 30_000,
  env: backendEnv('prod'),
}
const envProdWebServer = {
  command: 'npm run dev',
  cwd: '.',
  port: ENV_PROD_WEB_PORT,
  reuseExistingServer: !process.env.CI,
  timeout: 30_000,
  env: {
    PORT: String(ENV_PROD_WEB_PORT),
    VITE_API_BASE_URL: '/api',
    VITE_DEV_API_PROXY: `http://127.0.0.1:${ENV_PROD_API_PORT}`,
  },
}
const smokeWebServer = {
  command: 'npm run dev',
  cwd: '.',
  port: SMOKE_WEB_PORT,
  reuseExistingServer: !process.env.CI,
  timeout: 30_000,
  env: { PORT: String(SMOKE_WEB_PORT), VITE_API_BASE_URL: '' },
}

export default defineConfig({
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // round06b 단계1 컨트롤러 승인 오버라이드(2026-07-29) — 기본 workers(CPU16코어→8)에서
  // 스위트 간헐 실패가 실측됐고 workers=2에서 안정 재현됐다. 전역(top-level)으로 캡한다
  // — Playwright의 project별 `workers`는 "이 project 안에서의" 상한일 뿐이고, 자원
  // 경합의 근원(scenario·env-prod가 공유하는 museum_test Postgres/Milvus 커넥션 +
  // 두 project 모두 발화하는 실 Gemini 호출의 rate limit 60/min 합산)은 project 경계와
  // 무관하게 전체 워커 풀 크기에 좌우된다 — scenario만 캡하면 다른 project와 동시
  // 스케줄링될 때 여전히 풀 전체가 커져 경합·rate limit 초과가 재현될 수 있다. 따라서
  // project-level이 아니라 이 top-level workers가 구조적으로 더 정확하다.
  workers: 2,
  reporter: 'list',
  globalSetup: './e2e/support/preflight.ts',
  projects: [
    {
      name: 'smoke',
      testDir: 'e2e/smoke',
      testMatch: '**/*.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        ...COMMON_USE,
        // 기존 E2E_BASE_URL 계약 유지(R6B-13) — 단계4에서 배포 URL 수동 검증에 쓴다.
        // ⚠️ 배포본은 round06c 전면 게이트라 **자격증명이 함께 필요하다**(2026-07-30 실측 —
        // 자격 없이 돌리면 ①② 가 로그인 화면을 보고 실패한다). 자격은 코드에 두지 않고
        // env 로 받으며, 없으면 ①② 는 skip 된다(e2e/smoke/smoke.spec.ts 상단 주석):
        //   E2E_SMOKE_ONLY=1 E2E_BASE_URL=https://dev.archai-landsoft.co.kr \
        //     E2E_DEPLOY_LOGIN_ID=<id> E2E_DEPLOY_LOGIN_PW=<pw> \
        //     npx playwright test --project=smoke
        baseURL: process.env.E2E_BASE_URL || `http://127.0.0.1:${SMOKE_WEB_PORT}`,
      },
    },
    {
      name: 'scenario-setup',
      testDir: 'e2e',
      testMatch: 'auth.setup.ts',
      use: { ...COMMON_USE, baseURL: `http://127.0.0.1:${SCENARIO_WEB_PORT}` },
    },
    {
      name: 'scenario',
      testDir: 'e2e/scenario',
      testMatch: '**/*.spec.ts',
      use: { ...devices['Desktop Chrome'], ...COMMON_USE, baseURL: `http://127.0.0.1:${SCENARIO_WEB_PORT}` },
      dependencies: ['scenario-setup'],
    },
    {
      // 세션 쿠키는 host-only(127.0.0.1, 포트 무관 — RFC 6265)라 scenario-setup의
      // storageState를 재사용한다(같은 museum_test DB라 세션 조회도 유효). 첫 실행에서
      // 실제 로그인 유지 여부를 반드시 실측한다(원본 Task 11 Step 4 유지).
      name: 'env-prod',
      testDir: 'e2e/env-prod',
      testMatch: '**/*.spec.ts',
      use: { ...devices['Desktop Chrome'], ...COMMON_USE, baseURL: `http://127.0.0.1:${ENV_PROD_WEB_PORT}` },
      dependencies: ['scenario-setup'],
    },
  ],
  webServer: [
    // 배포 URL 수동 실행(E2E_BASE_URL 지정) 시 로컬 smoke 서버도 불필요하다.
    ...(process.env.E2E_BASE_URL ? [] : [smokeWebServer]),
    // E2E_SMOKE_ONLY=1 — smoke 순수 격리(원 계획 교차검증 D2). 기본값은 5개 전부.
    ...(SMOKE_ONLY ? [] : [scenarioApiServer, scenarioWebServer, envProdApiServer, envProdWebServer]),
  ],
})
