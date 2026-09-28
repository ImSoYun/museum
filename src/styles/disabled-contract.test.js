// 이 파일의 책임: 비활성(disabled) 표시의 기본 규칙이 존재하는지 잠근다(round10a T1).
//
// 왜 소스를 읽어 검사하나 — jsdom 은 외부 CSS 를 적용하지 않아 getComputedStyle 로는
// 규칙의 유무를 알 수 없다. css-contract.test.js 가 같은 이유로 같은 방법을 쓴다.
//
// 왜 __dirname 인가(brief 원안은 import.meta.url) — Vite 는 `new URL('./x', import.meta.url)`
// 패턴을 정적 애셋 참조로 특별 취급해 dev 서버 오리진(`http://localhost:3000/...`)으로
// 바꿔치기한다(실측). fs 로 실제 파일을 읽으려던 의도가 깨지므로, 같은 목적을 이미
// 이루고 있는 css-contract.test.js 의 방법(__dirname + path)을 그대로 따른다.
//
// round10a 최종 전브랜치 리뷰 M-9 — 이 파일은 CSS를 "텍스트로" 읽으므로, 규칙 블록을
// 통째로 `/* */`로 감싸도 문자열은 그대로 남아 정규식이 계속 맞는다(세 시험 전부 green
// 이었다 — 무력화를 실제로 재현해 확인했다). 형제 파일 css-contract.test.js가 같은
// 구멍(R1 Minor 3) 때문에 이미 만들어 둔 `live()`(주석 제거) 헬퍼를 재사용한다 — 새로
// 만들면 두 파일의 "주석 무력화 방지"가 서로 다른 구현으로 갈라진다.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

/** css-contract.test.js와 같은 헬퍼(그 파일의 정의·주석 참조) — 규칙을 찾기 전에
 *  주석을 걷어낸다. 그러지 않으면 "규칙이 살아 있다"가 아니라 "그런 글자가 파일에
 *  있다"만 잠그게 된다. */
const live = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '')

const css = live(readFileSync(path.resolve(__dirname, 'publish-ext.css'), 'utf8'))

describe('비활성 표시 기본 규칙 — round10a T1', () => {
  it('.btn:disabled 규칙이 있다', () => {
    expect(css).toMatch(/\.btn:disabled\s*\{/)
  })

  it('.data_pagination_arrow:disabled 규칙이 있다', () => {
    expect(css).toMatch(/\.data_pagination_arrow:disabled\s*\{/)
  })

  it('두 규칙 모두 cursor: not-allowed 를 포함한다', () => {
    for (const sel of ['\\.btn:disabled', '\\.data_pagination_arrow:disabled']) {
      const body = css.match(new RegExp(`${sel}\\s*\\{([^}]*)\\}`))
      expect(body, `${sel} 규칙을 찾지 못했다`).toBeTruthy()
      expect(body[1]).toMatch(/cursor:\s*not-allowed/)
    }
  })
})

// round10a T1 리뷰 Critical 회귀 방지 — CSS 캐스케이드는 규칙이 아니라 속성 단위로
// 승자를 가린다. `.btn:disabled`(0,2,0, color:#999)가 `.data_delete_btn`의 유일한
// color 선언이던 `.btn_primary`(0,1,0, color:#fff)를 이겨, 배경(component.css의
// `.data_toolbar .data_delete_btn:disabled`, #999)과 글자색이 같아져 「선택삭제」
// 글씨가 안 보이는 사고가 실제로 났다(라이브 실측). 재발하면 같은 사고가 반복되므로
// color 를 되찾는 규칙의 존재를 잠근다.
describe('선택삭제 버튼 color 회귀 방지 — round10a T1 리뷰 Critical', () => {
  it('.data_toolbar .data_delete_btn:disabled 규칙이 color: #fff 를 되찾는다', () => {
    const body = css.match(/\.data_toolbar \.data_delete_btn:disabled\s*\{([^}]*)\}/)
    expect(body, '.data_toolbar .data_delete_btn:disabled 규칙을 찾지 못했다').toBeTruthy()
    expect(body[1]).toMatch(/color:\s*#fff/)
  })
})
