import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { configDefaults } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    // round06b(원 round06e 계획 4) — e2e가 scenario(5173)·env-prod(5174)·smoke(5175)
    // 세 프론트 인스턴스를 동시에 띄워야 해서 포트를 env로 받는다. 기본값 5173 유지.
    port: Number(process.env.PORT) || 5173,
    watch: { usePolling: true },
    // .env.development의 VITE_API_BASE_URL=/api 를 실제로 성립시키는 프록시.
    // API를 호스트에 직접 띄웠을 때(uvicorn --port 8000) /api 요청을 그리로 넘긴다.
    // 프리픽스 제거는 nginx.conf의 `proxy_pass http://api:8000/`(끝 슬래시)와 같은 동작 —
    // 백엔드 라우트가 /search·/artifacts 처럼 루트에 있기 때문이다.
    // docker compose 경로에서는 nginx가 같은 일을 하므로 이 설정은 쓰이지 않는다.
    proxy: {
      '/api': {
        // 대상은 반드시 IPv4 리터럴로 고정한다(recurring-gotchas §2).
        // 'localhost'로 두면 Node가 ::1을 먼저 고르는데, 호스트 uvicorn은 보통
        // 127.0.0.1에만 바인드한다. 게다가 이 개발 머신에서는 Docker Desktop이
        // 0.0.0.0:8000을 점유하고 있어(com.docker.backend.exe) localhost:8000이
        // 백엔드가 아니라 Docker로 가서 전 API가 404가 됐다(round06c G1 실측).
        // 127.0.0.1은 더 구체적인 바인드라 항상 호스트 uvicorn으로 간다.
        target: process.env.VITE_DEV_API_PROXY || 'http://127.0.0.1:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
	base: '/museum/',
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './vitest.setup.js',
    // e2e/ 는 Playwright 전용 스위트(round4 T22) — Playwright의 test/expect는 vitest와 계약이 달라
    // vitest가 주워 실행하면 깨진다. vitest 기본 exclude에 e2e/**만 더해 명시적으로 뺀다.
    //
    // serverOutputKinds.test.js(round07i 최종 리뷰 F5) — `OutputList.test.jsx`·
    // `OutputDetailPage.test.jsx`가 함께 import하는 공유 헬퍼다. 이 파일에 test()를
    // 두면(다른 *.test.js 관행처럼) vitest가 파일마다 모듈을 새로 평가하는 탓에
    // 그 두 파일이 import할 때마다 이 파일의 test()가 **그 파일의 스위트에 끼어들어
    // 3중 실행**된다(실측: "OutputDetailPage.test.jsx > parseServerOutputKinds: …").
    // 그래서 test()는 두지 않는 대신, 이 파일을 vitest의 독립 실행 대상에서 아예
    // 뺀다 — 그래야 "test()가 0개인 test 파일"이어도 "No test suite found"로
    // 죽지 않는다. 이름은 여전히 `.test.js`다(coverage.exclude가 이름으로
    // 걸러 주는 보호는 이 설정과 무관하게 그대로 받는다 — serverOutputKinds.test.js
    // 자체 주석 참조).
    exclude: [
      ...configDefaults.exclude, 'e2e/**',
      'src/pages/results/serverOutputKinds.test.js',
    ],
    // round06b — 커버리지 계측(옵트인: npm run coverage). provider v8은
    // 계측 오버헤드가 작아 기본 실행(npm test)에는 걸지 않는다.
    coverage: {
      provider: 'v8',
      // json-summary 는 `coverage/coverage-summary.json`(총계 + 파일별)을 남긴다 —
      // 사람이 읽는 text·html 과 별개로 **기계가 읽을 수 있는 한 벌**이 필요하다.
      // scripts/test/make_test_report.py 가 이 파일을 읽어 보고서 수치를 채운다.
      // text·html 을 지우지 않는 이유: 터미널 확인과 브라우저 열람은 여전히 쓰인다.
      reporter: ['text', 'html', 'json-summary'],
      reportsDirectory: './coverage',
      include: ['src/**'],
    },
  },
})
