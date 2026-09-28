/**
 * 발표자료용 실화면 캡처 전용 설정 (AX 공유회, 2026-09-18).
 *
 * 기존 `playwright.config.ts` 를 건드리지 않는 이유 — 그 설정은 webServer 를 띄우고
 * 테스트 DB·Milvus·MinIO 를 전제한다. 여기서 필요한 것은 «이미 떠 있는 배포본에
 * 브라우저로 접속해 사진만 찍는 것»이라 전제가 전혀 다르다.
 *
 * 실행
 *   cd workspace/app/web
 *   E2E_BASE_URL=https://sai.landsoft.co.kr \
 *   E2E_ROOT_USERNAME=<아이디> E2E_ROOT_PASSWORD=<비밀번호> \
 *   npx playwright test -c playwright.capture.config.ts
 *
 * 비밀번호는 이 파일에도, 스펙에도, 레포 어디에도 쓰지 않는다 — 환경변수로만 받는다.
 */
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  testMatch: 'capture-deck.spec.ts',
  // 사진을 찍는 것이라 병렬·재시도가 의미 없다. 한 번, 순서대로.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 300_000,
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL || 'https://sai.landsoft.co.kr',
    // 발표 슬라이드에 넣을 크기 — 16:10 에 가깝게 잡아 잘라내기 손실을 줄인다.
    viewport: { width: 1600, height: 1000 },
    deviceScaleFactor: 2, // 프로젝터·고해상도 화면에서 글자가 뭉개지지 않게
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
    // 실패해도 추적물을 남기지 않는다 — 스크린샷만 얻으면 된다.
    trace: 'off',
    video: 'off',
    screenshot: 'off',
  },
  projects: [
    {
      name: 'capture',
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chrome',
        // 사람이 직접 로그인해야 하므로 창이 보여야 한다.
        headless: false,
      },
    },
  ],
})
