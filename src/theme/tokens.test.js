// 이 파일의 책임: 디자인 토큰의 단일 출처 계약을 지킨다.
//  (1) :root 정의가 tokens.css 한 곳뿐인가 (D8)
//  (2) 값이 §5.3 최종 토큰표(충돌 3건·교정 4건 반영)와 일치하는가
//  (3) tailwind.config.js 가 hex 를 다시 적지 않고 var(--*) 만 참조하는가 (D8)
// 값을 두 곳에 적으면 반드시 갈라진다. 갈라짐을 사람 눈이 아니라 테스트가 잡게 한다.
import fs from 'node:fs'
import path from 'node:path'
import { test, expect } from 'vitest'
import { NODE_COLORS } from './tokens.js'
import tailwindConfig from '../../tailwind.config.js'

const SRC_DIR = path.join(__dirname, '..')                       // <web>/src
const TOKENS_CSS = path.join(SRC_DIR, 'styles', 'tokens.css')

/**
 * :root 블록에서 `--토큰: 값` 쌍을 뽑는다.
 * 순수 함수 — 파일 IO 는 호출부가 한다(MOK-STD-002 순수로직/IO 분리).
 * @param {string} css CSS 원문
 * @returns {Record<string, string>}
 */
function parseRootTokens(css) {
  const block = css.match(/:root\s*\{([\s\S]*?)\}/)
  if (!block) return {}
  const out = {}
  for (const line of block[1].split('\n')) {
    const m = line.match(/(--[\w-]+)\s*:\s*([^;]+);/)
    if (m) out[m[1]] = m[2].trim()
  }
  return out
}

/** src/ 아래 .css 파일 경로를 재귀로 모은다. */
function collectCssFiles(dir) {
  const out = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...collectCssFiles(p))
    else if (entry.name.endsWith('.css')) out.push(p)
  }
  return out
}

test('노드 컬러맵에 핵심 카테고리가 있다', () => {
  expect(NODE_COLORS['민주화']).toBe('#3D5AE0')
  expect(NODE_COLORS['군사']).toBe('#DB2777')
  expect(Object.keys(NODE_COLORS).length).toBeGreaterThanOrEqual(10)
})

test(':root 정의는 tokens.css 한 곳뿐이다 (D8)', () => {
  // 퍼블 원본은 :root 가 reset.css·common.css 두 곳에 있었고 값이 3건 충돌했다.
  // 반입 CSS 에 :root 를 남기면 그 충돌이 그대로 따라온다 — 여기서 막는다.
  const withRoot = collectCssFiles(SRC_DIR).filter((f) => /:root\s*\{/.test(fs.readFileSync(f, 'utf8')))
  expect(withRoot).toEqual([TOKENS_CSS])
})

test('토큰 값이 §5.3 최종 표와 일치한다 (충돌 3건·교정 4건)', () => {
  const t = parseRootTokens(fs.readFileSync(TOKENS_CSS, 'utf8'))
  expect(t['--primary']).toBe('#1B6FFF')
  expect(t['--navy']).toBe('#283483')
  expect(t['--status-done']).toBe('#0CA85E')
  expect(t['--status-review']).toBe('#0056B5')
  expect(t['--status-fail']).toBe('#E02020')            // 교정 1: 원본 `red` 키워드 → hex 고정
  expect(t['--black']).toBe('#1A1A1A')                  // 충돌: reset #000000 vs common #1A1A1A → 후행 승
  expect(t['--primary10']).toBe('rgba(27, 111, 255, .1)') // 충돌: reset #D8ECFF 폐기
  // round06c-ext: 「교정 4」 철회 — 정본 복귀. publish-v2 에서 #256ef4 는 6곳 전부 focus outline
  // 전용이고(common:115 · component:254·289·485 · reset:247·256) #1B6FFF 는 --primary·--role-super
  // 뿐이다. 퍼블은 포커스링을 브랜드색과 의도적으로 다르게 뒀다(디자인 정본 우선).
  expect(t['--focus-ring']).toBe('#256ef4')
  expect(t['--bg-fallback']).toBe('#F5F8FF')            // --body 대체(참조 0회라 토큰 자체는 삭제)

  // 사문(死文) 토큰은 반입하지 않는다 — D7
  // R6c-ext A1: --primary30을 이 목록에서 뺐다 — v2 :root 정본에 실재하는 신규 토큰이라
  // "사문"이 아니라 "소비 화면이 아직 오지 않은 토큰"이다(tokens.css 주석 참조, D·E가 소비 예정).
  // D7 예외 조건은 "정본에 있는가"이지 "지금 이 라운드가 쓰는가"가 아니다.
  for (const dead of ['--body', '--blue', '--red', '--gray5', '--gray10', '--gray20',
                      '--gray30', '--gray60', '--gray90']) {
    expect(t[dead], `사문 토큰이 반입됐다: ${dead}`).toBeUndefined()
  }
})

test('tailwind.config 의 퍼블 색 키는 hex 가 아니라 var(--*) 를 참조한다 (D8)', () => {
  const c = tailwindConfig.theme.extend.colors
  const refs = [
    c.pub.primary, c.pub.primary5, c.pub.primary10, c.pub.primary20,
    c.pub.navy, c.pub.black, c.pub.white,
    c.pub.gray40, c.pub.gray50, c.pub.gray70, c.pub.gray80,
    c.status.done, c.status.review, c.status.fail,
    c.gra.from, c.gra.to, c.focusring,
  ]
  for (const v of refs) expect(v).toMatch(/^var\(--[\w-]+\)$/)

  // 참조하는 변수명이 tokens.css 에 실제로 정의돼 있어야 한다.
  // CSS 변수 오타는 브라우저가 조용히 무효 처리해 화면에서만 드러난다.
  const t = parseRootTokens(fs.readFileSync(TOKENS_CSS, 'utf8'))
  for (const v of refs) expect(t[v.slice(4, -1)], `tokens.css 에 없는 변수: ${v}`).toBeDefined()

  // 기존 키는 개명·삭제하지 않는다 — 실사용 162건(primary-*)·85건(ok/prog/warn/bad)의 회귀 가드.
  expect(c.primary[600]).toBe('#0B50D0')
  expect(c.ok.DEFAULT).toBe('#1E8E5A')
  expect(c.canvas).toBe('#F4F5F8')
})
