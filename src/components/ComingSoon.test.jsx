import { render, screen } from '@testing-library/react'
import ComingSoon from './ComingSoon.jsx'

test('ComingSoon: 기존 표현(액션 토스트·AlertPopup wip)과 글자 그대로 같은 문구를 보여준다(R6E-7 — 세 번째 표현 금지)', () => {
  render(<ComingSoon />)
  expect(screen.getByText('준비 중입니다')).toBeInTheDocument()
  expect(screen.getByText('빠른 시일 내에 서비스할 예정입니다.')).toBeInTheDocument()
})

test('ComingSoon: AlertPopup과 달리 모달이 아니다 — dialog 역할도 확인 버튼도 없다', () => {
  render(<ComingSoon />)
  expect(screen.queryByRole('alertdialog')).toBeNull()
  expect(screen.queryByRole('button')).toBeNull()
})
