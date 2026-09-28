/**
 * 이 파일의 책임: web/index.html에 심은 Maze UT 스니펫(round06f 갈래 F, spec §11.2)을
 * "텍스트로" 읽어 네 가지 계약을 잠근다 — ① 존재 ② 삽입 위치 ③ 클래식 인라인
 * (type="module"이 아니다) ④ 키는 플레이스홀더뿐(하드코딩 금지).
 *
 * 왜 렌더가 아닌가 — index.html은 Vite의 빌드 입력이지 React 트리가 아니다. jsdom은 이
 * 파일을 로드하지 않으므로 렌더 테스트로는 한 글자도 관측할 수 없다. src/assets/assets.test.js가
 * fs로 자산 존재를, src/styles/css-contract.test.js가 fs로 CSS 규칙을 잠근 선례를 그대로 따른다.
 *
 * 이 테스트가 말하는 것: "스니펫이 옳은 자리에 옳은 형태로 파일에 있다".
 * 이 테스트가 말하지 못하는 것: "배포된 HTML에 실제 키가 박혔다" → Task 6·7의 서빙 HTML 검증.
 */
import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect } from 'vitest'

const INDEX_HTML = path.resolve(__dirname, '..', 'index.html')
const html = fs.readFileSync(INDEX_HTML, 'utf8')

const LOADER = 'https://snippet.maze.co/maze-universal-loader.js'
const PLACEHOLDER = '%VITE_MAZE_API_KEY%'
// IIFE의 마지막 인자 자리 = 실제 주입 지점. 이 자리를 고정하는 것과 별개로 "정확히 1회"도
// 함께 잠근다 — Vite의 htmlEnvHook 은 정규식 전역 치환이라, 가드 설명 주석이 이 토큰을
// 리터럴로 인용하면 주석 안의 것까지 키로 바뀌어 배포 HTML 에 키가 2회 박힌다. 주석은
// 뜻만 서술하고(퍼센트 기호로 시작하는 원문…) 토큰을 쓰지 않는다는 것이 이 단언의 존재 이유다.
const INJECTION_SITE = `'${LOADER}', '${PLACEHOLDER}');`
// 레이어별 실제 키. 둘 다 레포에 커밋되지 않는다(dev=Vercel 프로젝트 환경변수,
// prod=Node A /home/khk17/museum-app/.env). 부재를 단언해 "급하니 일단 박아두자"를 막는다.
const REAL_KEYS = ['c2ceb3fc-5397-4270-9042-941efd5400d9', '859c27ed-a690-4296-9e0b-b5b47b872484']

describe('Maze 스니펫 — 존재와 형태', () => {
  it('공식 로더 URL과 플레이스홀더가 각각 정확히 1회, 인자 자리에 박혀 있다', () => {
    expect(html.split(LOADER).length - 1).toBe(1)
    expect(html).toContain(INJECTION_SITE)
    // 주석이 토큰을 인용하면 여기서 2가 되고, 배포 HTML 의 키도 2회가 된다.
    expect(html.split(PLACEHOLDER).length - 1).toBe(1)
  })

  it('미주입 가드가 IIFE 진입부에 있다', () => {
    expect(html).toContain("if (!e || e.charAt(0) === '%') return;")
  })

  it('가드가 실제로 스크립트 삽입(appendChild)보다 앞에서 return한다(최종 리뷰 F9)', () => {
    // 위 테스트는 가드 문자열의 "존재"만 본다 — 문자열이 있어도 appendChild 뒤로
    // 옮겨지면(예: 리팩터 중 실수) 가드가 이미 DOM에 꽂힌 스크립트를 막지 못해
    // no-op이 아니게 된다(플레이스홀더 값이 그대로 서빙 HTML의 <script src>에
    // 박히는 사고). 인덱스 비교로 "가드가 appendChild보다 먼저 나온다"는 순서
    // 자체를 잠근다.
    const guardAt = html.indexOf("if (!e || e.charAt(0) === '%') return;")
    const appendAt = html.indexOf('appendChild')
    expect(guardAt).toBeGreaterThan(-1)
    expect(appendAt).toBeGreaterThan(-1)
    expect(guardAt).toBeLessThan(appendAt)
  })

  it('클래식 인라인 스크립트다 — type="module"이 아니다', () => {
    // Vite는 isModule인 스크립트만 JS 번들로 추출한다(buildHtmlPlugin 실측).
    // 이 단언이 깨지면 키가 dist/index.html이 아니라 번들로 새어 검증 대상이 바뀐다.
    const bodyAt = html.indexOf('(function (m, a, z, e)')
    const openAt = html.lastIndexOf('<script', bodyAt)
    expect(html.slice(openAt, html.indexOf('>', openAt) + 1)).toBe('<script>')
  })

  it('실제 API 키가 커밋돼 있지 않다', () => {
    for (const key of REAL_KEYS) expect(html).not.toContain(key)
  })

  it('앱 엔트리 모듈 스크립트는 그대로다(회귀 가드)', () => {
    expect(html).toContain('<script type="module" src="/src/main.jsx"></script>')
  })
})

describe('Maze 스니펫 — 삽입 위치 계약(spec §11.2)', () => {
  it('charset·viewport 뒤, 제목 요소 앞이다', () => {
    const iCharset = html.indexOf('<meta charset=')
    const iViewport = html.indexOf('<meta name="viewport"')
    const iSnippet = html.indexOf(LOADER)
    const iTitle = html.indexOf('<title>')
    expect(iCharset).toBeGreaterThan(-1)
    expect(iCharset).toBeLessThan(iViewport)
    expect(iViewport).toBeLessThan(iSnippet)
    expect(iSnippet).toBeLessThan(iTitle)
  })

  it('인코딩 선언이 문서 첫 1024바이트 안에서 끝난다(HTML 표준)', () => {
    // prod nginx에 charset 지시어가 없어(grep 0건) 이 선언이 한국어 제목의 유일한
    // 인코딩 근거다. head 직후에 스니펫(976B)을 넣으면 끝 오프셋이 1046B가 되어 위반한다.
    const end = html.indexOf('>', html.indexOf('<meta charset=')) + 1
    expect(new TextEncoder().encode(html.slice(0, end)).length).toBeLessThan(1024)
  })

  it('favicon data URI가 그대로 남아 있다(스니펫 삽입이 %-이스케이프를 건드리지 않았다)', () => {
    expect(html).toContain('rel="icon"')
    expect(html).toContain('%3Csvg')
  })
})
