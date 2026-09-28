import '@testing-library/jest-dom'

// recharts uses ResizeObserver which is not available in jsdom
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

// react-router의 data router(createMemoryRouter)는 네비게이션마다 내부 Request를
// AbortController.signal과 함께 생성한다. jsdom은 Node 전역 Request와 호환되지 않는
// 자체 AbortController/AbortSignal을 설치하므로, 그대로 두면 모든 네비게이션이
// "Expected signal to be an instance of AbortSignal" 예외로 중단된다.
// 테스트에서는 abort 자체를 검증하지 않으므로, Request 생성 시 호환 불가한 signal만
// 제거해 네비게이션이 정상 커밋되도록 한다.
const NativeRequest = global.Request
if (NativeRequest) {
  global.Request = class extends NativeRequest {
    constructor(input, init) {
      if (init && 'signal' in init) {
        const { signal, ...rest } = init
        super(input, rest)
      } else {
        super(input, init)
      }
    }
  }
}
