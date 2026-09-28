// 이 파일의 책임: round10b Task A — 공용 `components/Modal.jsx`(헤더·본문·푸터)와 그
// 자매 버튼(SaveProjectModal·PasswordModal)이 **퍼블 정본 스케일**로 서 있는지 잠근다.
//
// 배경 — 이 프로젝트 Tailwind spacing은 기본 스케일(1=0.25rem)이 아니라
// spacing[N]=Npx다(tailwind.config.js 주석). 그런데 Modal.jsx는 기본 스케일 관용구
// (px-6·py-4·p-6·py-3·gap-10)로 쓰여 있어 여백이 전부 의도값의 1/4로 렌더된다.
// 이 사실은 MaterialModal.jsx:22-24가 먼저 발견하고 공용 Modal을 통째로 우회해
// 자기 컴포넌트만 구했다(퍼블 실측값 본문 1.2rem=24px가 그 우회 지점의 근거).
// 이 시험은 그 원인(Modal.jsx 자체)을 잠근다 — 이 셸을 쓰는 화면이 12개라
// 한 곳만 고치면 전부 함께 낫는다(round10b B-4가 ChatExhibitionDecisionModal.jsx를
// 지워 13개에서 줄었다).
//
// ⚠️ css-contract.test.js:484의 live()(주석 제거) 헬퍼를 반드시 재사용한다 —
// round10a의 disabled-contract.test.js가 이걸 안 써서 "규칙(선언)을 주석 처리해도
// 문자열 검색은 계속 통과하는" 구멍이 생겼고 최종 리뷰가 그걸 잡았다. 그 헬퍼는
// export되지 않는 로컬 상수라 import 대신 같은 정의를 복제한다. 이 파일이 읽는
// 대상은 CSS가 아니라 JSX라 라인 주석(//)도 함께 지운다 — 안 지우면 이 라운드처럼
// 주석이 과거 값을 그대로 인용할 때(MaterialModal.jsx:22 "Tailwind `px-6 py-4`는…")
// 그 인용 문자열이 아래 부재(不在) 검사를 오탐시킨다.
import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect } from 'vitest'

const SRC = path.resolve(__dirname, '..')
const read = (rel) => fs.readFileSync(path.join(SRC, rel), 'utf8')

const live = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')

describe('스페이싱 계약 — 공용 Modal.jsx 셸(round10b Task A)', () => {
  const modalSrc = live(read('components/Modal.jsx'))

  it('헤더·본문·푸터 어디에도 기본 스케일 관용구(px-6·py-4·p-6·py-3·gap-10·gap-2)가 남아있지 않다', () => {
    // round10b 재리뷰 M-1 — gap-2(2px)도 이 셸이 데려온 기본 스케일 관용구다(헤더
    // headerRight↔✕ 간격). gap-4와 같은 이유로 여기 금지 목록에 더한다.
    for (const legacy of ['px-6', 'py-4', 'p-6', 'py-3', 'gap-10', 'gap-2']) {
      const re = new RegExp(`\\b${legacy}\\b`)
      expect(modalSrc, `Modal.jsx에 기본 스케일 관용구 "${legacy}"가 남아 있다`).not.toMatch(re)
    }
  })

  it('헤더 padding이 퍼블 정본 24px(가로)·16px(세로)다 — px-24 py-16', () => {
    const header = /<div className="([^"]*justify-between[^"]*)">/.exec(modalSrc)
    expect(header, '헤더 행(justify-between) className을 찾지 못했다').not.toBeNull()
    const classes = header[1].split(/\s+/)
    expect(classes).toContain('px-24')
    expect(classes).toContain('py-16')
  })

  it('본문 padding이 퍼블 정본 24px다(MaterialModal.jsx 실측 1.2rem=24px) — p-24', () => {
    const body = /<div className="([^"]*)">\{children\}<\/div>/.exec(modalSrc)
    expect(body, '본문({children}) wrapper를 찾지 못했다').not.toBeNull()
    expect(body[1].split(/\s+/)).toEqual(['p-24'])
  })

  it('푸터 padding이 24px(가로)·12px(세로)이고, 버튼 gap이 popup_actions(component.css:91) 관행값 8px다', () => {
    // round10b 재리뷰 I-1·I-2 — 이 스케일은 spacing[N]=Npx다(tailwind.config.js:13, ÷20 환산).
    // popup_actions의 0.4rem은 20px 루트에서 8px이지 4px가 아니다(4/20=0.2rem). gap-4는
    // 그 절반으로 잘못 옮긴 값이었다 — gap-8로 고친다.
    const footer = /<div className="([^"]*justify-end[^"]*)">\{footer\}<\/div>/.exec(modalSrc)
    expect(footer, '푸터(justify-end) wrapper를 찾지 못했다').not.toBeNull()
    const classes = footer[1].split(/\s+/)
    expect(classes).toContain('px-24')
    expect(classes).toContain('py-12')
    expect(classes).toContain('gap-8')
  })
})

describe('스페이싱 계약 — 자매 버튼 h-11 → h-44(SaveProjectModal·PasswordModal)', () => {
  it.each([
    ['components/SaveProjectModal.jsx'],
    ['components/PasswordModal.jsx'],
  ])('%s 의 footer 버튼 높이가 기본 스케일 관용구 h-11(11px)이 아니라 h-44(44px)다', (rel) => {
    const src = live(read(rel))
    expect(src, `${rel}에 기본 스케일 관용구 "h-11"이 남아 있다`).not.toMatch(/\bh-11\b/)
    const matches = src.match(/\bh-44\b/g) || []
    expect(matches.length, `${rel}의 취소/저장(또는 아니오/네) 버튼 둘 다 h-44여야 한다`).toBe(2)
  })
})
