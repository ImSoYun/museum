import { render, screen } from '@testing-library/react'
import { describe, it, expect, test } from 'vitest'
import StatusBadge from './StatusBadge.jsx'

// 퍼블은 warn(주의) 계열이 없다. '처리 대기'·'미완료'·'미등록'은 실패도 완료도 아닌
// 진행 계열이므로 ty_review로 흡수한다(spec §8.0.4 (B) 채택).
// 각 항목: [상태 문자열, 기대 퍼블 토큰]
const STATUS_CASES = [
  ['완료',          'ty_done'],
  ['반영 완료',     'ty_done'],
  ['도움됨',        'ty_done'],
  ['검수중',        'ty_review'],
  ['반영 중',       'ty_review'],
  ['처리중',        'ty_review'],
  ['학습중',        'ty_review'],
  ['처리 대기',     'ty_review'],
  ['미완료',        'ty_review'],
  ['미등록',        'ty_review'],
  ['등록',          'ty_review'],
  ['실패',          'ty_fail'],
  ['반영 실패',     'ty_fail'],
]

describe('StatusBadge', () => {
  test.each(STATUS_CASES)('"%s"는 알약형 status_tag / 텍스트형 data_status_text 양쪽에서 %s 토큰을 쓴다', (status, tone) => {
    const tag = render(<StatusBadge status={status} />)
    expect(screen.getByText(status)).toBeInTheDocument()
    expect(tag.container.firstChild.className).toBe(`status_tag ${tone}`)
    tag.unmount()

    const txt = render(<StatusBadge status={status} variant="text" />)
    expect(txt.container.firstChild.className).toBe(`data_status_text ${tone}`)
    txt.unmount()
  })

  it('알 수 없는 상태는 토큰 없이 기본 클래스만 붙는다', () => {
    const { container, unmount } = render(<StatusBadge status="기타상태" />)
    expect(screen.getByText('기타상태')).toBeInTheDocument()
    expect(container.firstChild.className).toBe('status_tag')
    unmount()
    const t = render(<StatusBadge status="기타상태" variant="text" />)
    expect(t.container.firstChild.className).toBe('data_status_text')
  })
})
