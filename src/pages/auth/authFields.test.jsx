// 이 파일의 책임: 인증 3화면의 폼 필드 계약(id / name)을 퍼블 원문으로 고정한다.
// round06c의 서버 계약과 미리 맞춰 두기 위한 것이며, 이름이 바뀌면 여기가 먼저 red가 된다.
// (round06d에서 임의로 바꾸면 round06c에서 퍼블·프론트·서버 세 곳을 다시 맞춰야 한다.)
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Login from './Login.jsx'
import Join from './Join.jsx'
import FindAccount from './FindAccount.jsx'

// name 속성으로 필드를 모은다 — 화면 문구가 바뀌어도 서버 계약은 유지돼야 하기 때문이다.
// 문서 순서를 그대로 쓰므로 배치 변경도 함께 잡힌다.
const fieldNames = () =>
  Array.from(document.querySelectorAll('input[name], select[name]')).map((el) => el.name)

test('login 폼 필드명은 퍼블 원문 login_id · login_pw다', () => {
  render(<MemoryRouter><Login /></MemoryRouter>)
  expect(fieldNames()).toEqual(['login_id', 'login_pw'])
  // id도 같은 값이어야 label[for]가 성립한다
  expect(document.getElementById('login_id')).not.toBeNull()
  expect(document.getElementById('login_pw')).not.toBeNull()
})

test('login 아이디 초기값은 빈 문자열이다 (퍼블의 value="admin" 하드코딩 제거)', () => {
  render(<MemoryRouter><Login /></MemoryRouter>)
  // 운영 화면에 관리자 계정 아이디가 박혀 있으면 계정 존재를 노출한다(퍼블 결함 2).
  expect(screen.getByLabelText('아이디')).toHaveValue('')
})

// round10b Task C — 사용자 결정(2026-09-17) "이메일관련은 다 빼": join_email 항목이
// 빠지며 필드 수가 퍼블 원문 7개에서 6개로 준다(round10b가 확정한 편차 — 퍼블 이후
// 결정이라 되돌릴 수 없다).
test('join 폼 필드명은 6개이며 배치 순서도 같다(이메일 항목 제거, round10b)', () => {
  render(<MemoryRouter><Join /></MemoryRouter>)
  expect(fieldNames()).toEqual([
    'join_name',
    'join_dept',
    'join_id',
    'join_pw',
    'join_pw_confirm',
    'join_role',
  ])
})

// round06c-ext D2d(§9.3·R2.4·R2.8): find 화면의 이메일 입력/발송 폼을 전면 제거하고
// "상위 관리자 문의" 안내로 대체했다 — 서버 계약으로 고정할 필드 자체가 더 이상 없다.
// 이 파일의 책임(폼 필드 계약 고정)에 맞춰 "필드가 0개다"를 계약으로 고정한다.
test('find 화면에는 서버로 보낼 폼 필드가 없다(이메일 입력·발송 UI 전면 제거)', () => {
  render(<MemoryRouter><FindAccount /></MemoryRouter>)
  expect(fieldNames()).toEqual([])
})
