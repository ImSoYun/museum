import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

//
// 이 파일의 책임: 모든 퍼블/스타일 CSS의 주석 무결성 회귀 가드.
//
// 배경(round06d 후속): common-kept.css 주석 본문에 "Tailwind m·p" 유틸을 별표 다음에 바로
// 슬래시를 붙여 적어 두었더니, 그 별표-슬래시가 파일 첫 줄에서 연 주석을 조기 종료시켰다.
// 그 뒤 주석 텍스트와 바로 아래 .sr_only 규칙이 깨진 CSS로 취급돼 브라우저가 규칙을 통째로
// 버렸고, 앱 전역의 sr_only(64곳) 접근성 라벨이 화면에 노출됐다(인트로 "검색어 입력검색어 입력").
//
// 눈으로 찾기 어려운 버그라 규칙을 코드로 박는다: 올바른 주석을 비탐욕으로 제거한 뒤
// 주석 여는/닫는 토큰이 남으면 = 본문에서 조기 종료됐거나 열린 채 안 닫힌 것 = 버그.
//
// 파일은 fs로 매번 디스크에서 직접 읽는다 — import.meta.glob('?raw')는 Vite 트랜스폼 캐시가
// 옛 내용을 재사용할 수 있어(실측) 무결성 가드에 부적합하다.
//

// 주석 토큰을 리터럴로 쓰면 이 파일 자신이 같은 함정에 빠지므로 조립해 만든다.
const STAR = '*'
const OPEN = '/' + STAR // 주석 시작 토큰
const CLOSE = STAR + '/' // 주석 종료 토큰
const COMMENT_RE = new RegExp('\\/\\*[\\s\\S]*?\\*\\/', 'g')

const SRC_DIR = join(dirname(fileURLToPath(import.meta.url)), '..') // src/

function cssFilesIn(dir) {
  const out = []
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) out.push(...cssFilesIn(p))
    else if (e.name.endsWith('.css')) out.push(p)
  }
  return out
}

const files = cssFilesIn(SRC_DIR)

describe('CSS 주석 무결성 (sr_only 조기종료 버그 재발 방지)', () => {
  it('스캔 대상 CSS가 존재한다(빈 목록으로 통과하는 위양성 방지)', () => {
    expect(files.length).toBeGreaterThan(5)
  })

  it('어떤 CSS 주석도 본문의 별표-슬래시로 조기 종료되지 않는다', () => {
    const offenders = []
    for (const path of files) {
      const stripped = readFileSync(path, 'utf8').replace(COMMENT_RE, '')
      if (stripped.includes(CLOSE)) offenders.push(path + ': 주석 밖 dangling 종료토큰')
      if (stripped.includes(OPEN)) offenders.push(path + ': 닫히지 않은 시작토큰')
    }
    expect(offenders).toEqual([])
  })
})
