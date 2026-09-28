// 이 파일의 책임: 로그인 화면(퍼블 page/login.html의 .card 이하)을 렌더한다.
// 껍데기(.auth_wrap / .auth_inner / 로고 / 푸터)는 AuthLayout이 그린다 —
// 세 인증 화면의 카드 머리가 서로 달라(.card_tit vs .auth_head) 카드는 각 페이지가 갖는다.
// round06c F3(spec §9.3): 제출 시 useAuth().login()을 호출한다. F1 계약 — 성공 시 authed로
// 전환(홈으로 이동), 실패 시 throw(err.status/err.detail)한다. 여기서 그 throw를 잡아
//   401(자격 불일치)      → 안내 문구 한 줄.
//   403(pending)         → "승인 대기 안내"(§9.4 — 별도 라우트가 아니라 로그인 흐름 내 상태).
//   403(rejected/disabled) → 각각의 사유 문구.
// 로 분기한다.
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'

// 백엔드 _STATUS_REASONS(museum/auth/routes.py)가 내려주는 detail 문자열에서 세 상태를
// 구분한다. 완전일치 대신 부분일치(포함)로 판정해 어미가 미세하게 바뀌어도 분기가 깨지지
// 않게 한다 — 매칭이 하나도 안 걸리면 detail을 그대로 보여주는 것으로 폴백한다(브리프 주석).
function reasonKeyOf(detail) {
  const text = String(detail || '')
  if (text.includes('대기')) return 'pending'
  if (text.includes('거절') || text.includes('거부')) return 'rejected'
  if (text.includes('비활성')) return 'disabled'
  return null
}

const REASON_MESSAGES = {
  pending: '승인 대기 중입니다',
  rejected: '가입이 거부되었습니다',
  disabled: '계정이 비활성화되었습니다',
}

export default function Login() {
  const [loginId, setLoginId] = useState('')
  const [loginPw, setLoginPw] = useState('')
  // type · aria-pressed · aria-label 세 값을 하나의 state에서 파생시킨다.
  // 퍼블 common.js:5-17은 DOM을 직접 만져 셋을 각각 갱신하는데, 명령형 코드를 그대로 옮기면
  // 세 값이 어긋날 여지가 남는다. 단일 state 파생이 그 여지를 없앤다.
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState(null)
  const [pending, setPending] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setPending(false)
    try {
      await login(loginId, loginPw)
      navigate('/')
    } catch (err) {
      if (err?.status === 401) {
        setError('아이디 또는 비밀번호를 확인하세요')
      } else if (err?.status === 403) {
        const key = reasonKeyOf(err.detail)
        if (key === 'pending') {
          setPending(true)
        } else {
          setError(REASON_MESSAGES[key] || err.detail || '로그인할 수 없는 계정입니다')
        }
      } else {
        setError('로그인에 실패했습니다. 잠시 후 다시 시도하세요.')
      }
    }
  }

  return (
    <div className="card">
      <h2 className="card_tit">로그인</h2>

      {/* pending은 별도 라우트가 아니라 이 로그인 흐름 안의 상태다(spec §9.4).
          rejected/disabled/401은 일반 오류 문구로 함께 취급한다. */}
      {pending && (
        <p className="notice_box" role="status">{REASON_MESSAGES.pending}</p>
      )}
      {error && (
        <p className="form_error" role="alert">{error}</p>
      )}

      <form onSubmit={handleSubmit}>
        <div className="form_section">
          <div className="form_stack">
            <div className="form_group">
              <label className="form_label" htmlFor="login_id">아이디</label>
              {/* 퍼블 원본의 value="admin"은 제거한다 — 운영 화면에 관리자 계정 아이디가 박혀 있으면
                  계정 존재를 노출한다. defaultValue로 옮기지 않고 제어 state의 초기값을 빈 문자열로 둔다.
                  퍼블에 아이디 placeholder는 없다 — 대칭을 맞추려고 임의로 넣지 않는다. */}
              <input
                type="text"
                className="form_input"
                id="login_id"
                name="login_id"
                autoComplete="username"
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
              />
            </div>

            <div className="form_group">
              <label className="form_label" htmlFor="login_pw">비밀번호</label>
              <div className="form_input_box">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="form_input"
                  id="login_pw"
                  name="login_pw"
                  placeholder="비밀번호"
                  autoComplete="current-password"
                  value={loginPw}
                  onChange={(e) => setLoginPw(e.target.value)}
                />
                <button
                  type="button"
                  className="ic_toggle"
                  aria-pressed={showPassword}
                  aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 표시'}
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {/* 두 svg를 모두 DOM에 남기고 component.css가 고르게 한다.
                      .ic_toggle svg{display:none} → .ic_eye_on{display:block} →
                      [aria-pressed="true"]에서 뒤바뀌고 색까지 var(--primary)로 바뀐다.
                      조건부 렌더로 바꾸면 이 CSS 5줄이 통째로 죽고 색 전환을 JS로 다시 짜야 한다. */}
                  <svg className="ic_eye_on" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                    <path d="M11.998 5.7002C16.5175 5.7002 20.584 8.18238 21.8545 11.5576C21.9789 11.8885 21.9969 12.2598 21.8848 12.6143C21.1099 15.0622 18.0558 18.2998 11.998 18.2998C5.91669 18.2996 2.92064 14.7467 2.13477 12.6416C2.00672 12.2985 2.00536 11.9315 2.11133 11.5986C2.66321 9.86509 4.03948 8.39152 5.7832 7.36133C7.535 6.32641 9.71843 5.70028 11.998 5.7002ZM11.998 7.2998C10.0025 7.29989 8.10004 7.85013 6.59668 8.73828C5.0852 9.63127 4.03661 10.8282 3.63672 12.084C3.6364 12.085 3.63591 12.0862 3.63574 12.0869C4.20492 13.6042 6.62802 16.7 11.998 16.7002C17.4324 16.7002 19.8162 13.8465 20.3594 12.1328C20.3593 12.1313 20.3588 12.1273 20.3564 12.1211C19.3771 9.51951 16.0275 7.2998 11.998 7.2998ZM11.999 8.2002C14.0976 8.2002 15.7987 9.90141 15.7988 12C15.7988 14.0987 14.0977 15.7998 11.999 15.7998C9.90043 15.7997 8.19922 14.0986 8.19922 12C8.19932 9.90147 9.9005 8.2003 11.999 8.2002ZM11.999 9.7998C10.7842 9.79991 9.79893 10.7851 9.79883 12C9.79883 13.215 10.7841 14.2001 11.999 14.2002C13.214 14.2002 14.1992 13.215 14.1992 12C14.1991 10.7851 13.214 9.7998 11.999 9.7998Z" fill="currentColor" />
                  </svg>
                  <svg className="ic_eye_off" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                    <path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.42-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78 3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z" fill="currentColor" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <button type="submit" className="btn btn_lg btn_primary">로그인</button>

          {/* .auth_link_row_link:first-child(layout.css:41)의 오른쪽 테두리가 가운데
              구분선이다 — 두 링크의 순서를 바꾸면 선이 반대편에 생긴다. 순서 고정.
              (d836fe2가 .auth_link_row a 대신 .auth_link_row_link 명시 클래스를 붙였다 —
              선택자 표기 갱신, 동작은 동일.) */}
          <div className="auth_link_row">
            <Link to="/join" className="auth_link_row_link">회원가입</Link>
            <Link to="/find" className="auth_link_row_link">아이디·비밀번호 찾기</Link>
          </div>
        </div>
      </form>
    </div>
  )
}
