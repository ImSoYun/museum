// 이 파일의 책임: ChatTab.jsx 가 export 하는 순수함수 citedFromText 의 경계값을 직접 잠근다.
// citedFromText 는 답변 본문의 [n]·[n, m] 인용 표기를 citations 매핑과 대조해 칩으로 만들
// 항목만 등장 순서대로(중복 제거) 골라내는 파싱 로직이다(ChatTab.jsx:40 부근). 렌더에서 이
// 파싱을 떼어낸 이유가 테스트성인데, 지금까지는 ChatTab 렌더를 경유해서만(ChatTab.test.jsx의
// 인용칩 테스트들) 간접 검증돼 왔다. 코딩표준(순수/IO 분리 + TDD)에 맞춰 여기서 직접 잠근다.
//
// 실제 구현(정규식 /\[(\d{1,3}(?:\s*,\s*\d{1,3})*)\]/g)을 node로 먼저 실행해 아래 5케이스의
// 동작을 실측 확인한 뒤 단언을 적었다 — 특히 4자리 이상 숫자는 정규식이 애초에 매치하지 않는다
// (\d{1,3}이 최대 3자리까지만 소비하고 남는 자리 뒤에 ']'가 오지 않으면 그 시작 위치 전체가
// 실패하며, 백트래킹으로도 구제되지 않는다) — "인용으로 인식하지 않는다"는 기대와 일치한다.
import { describe, it, expect } from 'vitest'
import { citedFromText } from './ChatTab.jsx'

const cite = (n, name) => ({ n, idnbr: `PS-${n}`, name, image_url: `/images/PS-${n}` })

describe('citedFromText', () => {
  it('(a) 중복 번호 [3, 3]은 칩 1개로 dedup 된다', () => {
    const picked = citedFromText('내용 [3, 3] 참고', [cite(3, '자료삼')])
    expect(picked).toHaveLength(1)
    expect(picked[0].n).toBe(3)
  })

  it('(b) 공백 없는 묶음 [1,2]는 칩 2개로 분해된다', () => {
    const picked = citedFromText('내용 [1,2] 참고', [cite(1, '자료일'), cite(2, '자료이')])
    expect(picked.map((c) => c.n)).toEqual([1, 2])
  })

  it('(c) 4자리 이상([1234])은 인용으로 인식하지 않는다', () => {
    const picked = citedFromText(
      '내용 [1234] 참고',
      [cite(123, '자료백이십삼'), cite(1234, '자료천이백삼십사')],
    )
    expect(picked).toHaveLength(0)
  })

  it('(d) citations 에는 있으나 본문이 인용하지 않은 번호는 칩을 만들지 않는다', () => {
    const picked = citedFromText('내용에 인용 표기가 없다', [cite(5, '자료오')])
    expect(picked).toHaveLength(0)
  })

  it('citations = null 이면 안전하게 빈 배열을 반환한다', () => {
    expect(citedFromText('내용 [1] 참고', null)).toEqual([])
  })
})
