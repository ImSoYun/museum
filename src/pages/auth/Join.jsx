// 이 파일의 책임: 회원가입 화면(퍼블 page/join.html의 .card 이하)을 렌더한다.
// 껍데기(.auth_wrap / .auth_inner / 로고 / 푸터)는 AuthLayout이 그린다.
//
// round06c F3(spec §9.3·R2.3): round06d가 미룬 다섯 가지를 여기서 채운다.
//   ① 비밀번호↔확인 일치 ② "8자 이상" 실제 검증 ③(폐기, 아래 참조) ④ 필수 미입력 안내
//   ⑤ 아이디 중복(서버 409)
// 검증 통과 시 POST /auth/join(credentials:'include')로 신청하고, 성공하면 "승인 대기
// 안내" 상태로 전환한다(§9.4 — 이 화면도 별도 라우트가 아니라 가입 흐름 내 상태다).
//
// round10b Task C — 사용자 결정(2026-09-17) "이메일관련은 다 빼": 위 ③ "이메일 형식"
// 검증과 이메일 항목 자체를 걷어냈다. 항목만 빼고 검증만 남기면(또는 그 반대) 죽은
// 코드가 남으므로 폼 상태(join_email)·검증(EMAIL_RE)·입력 UI·서버 전송 필드를 함께
// 뺐다 — 서버 계약(museum/auth/routes.py JoinRequest)도 짝을 맞춰 email을 받지 않는다.
//
// role select는 §0 R2.3에 따라 3옵션(사용자/관리자/통합관리자)이다 — round06d 시점엔
// "승인 주체가 신청 대상이 될 수 없다"며 통합관리자를 뺐으나, 착수 후 사용자가 3단 전부를
// 신청 가능하게 확정했다(§0 R2.2 — 통합관리자 신청은 root가 승인). 저장값=표시문구 한
// 계열은 그대로 유지한다(ROLES는 스키마 CHECK와 정렬된 정본, data/permissions.js).
import { useState } from 'react'
import { Link } from 'react-router-dom'
import icArrowLeft from '../../assets/icons/ic_arrow_left.svg'
import { ROLES } from '../../data/permissions.js'
import { joinRequest } from '../../lib/authApi.js'

// 퍼블이 제공하지 않은 클라 검증 규칙(라운드06d 주석 ①~④의 실제 구현).
// DB 없이도 판단 가능한 형태 검증만 여기서 하고, 중복(⑤)은 서버 409로 넘긴다.
function validate(form) {
  const errors = {}
  if (!form.join_name.trim()) errors.join_name = '이름을 입력하세요'
  if (!form.join_dept.trim()) errors.join_dept = '부서를 입력하세요'
  if (!form.join_id.trim()) errors.join_id = '아이디를 입력하세요'
  if (!form.join_pw) errors.join_pw = '비밀번호를 입력하세요'
  else if (form.join_pw.length < 8) errors.join_pw = '비밀번호는 8자 이상이어야 합니다'
  if (!form.join_pw_confirm) errors.join_pw_confirm = '비밀번호 확인을 입력하세요'
  else if (form.join_pw && form.join_pw !== form.join_pw_confirm) {
    errors.join_pw_confirm = '비밀번호가 일치하지 않습니다'
  }
  if (!form.join_role) errors.join_role = '신청권한을 선택하세요'
  return errors
}

export default function Join() {
  const [form, setForm] = useState({
    join_name: '',
    join_dept: '',
    join_id: '',
    join_pw: '',
    join_pw_confirm: '',
    // 초기값 ''가 disabled인 "선택" 옵션을 잡는다.
    // 퍼블의 selected 속성은 제어 컴포넌트에서 React 경고를 내므로 쓰지 않는다.
    join_role: '',
  })
  const [errors, setErrors] = useState({})
  const [submitError, setSubmitError] = useState(null)
  const [submitted, setSubmitted] = useState(false)

  // 필드명이 곧 서버 계약이므로 name을 키로 그대로 쓴다(매핑표를 만들지 않는다).
  const set = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitError(null)
    const nextErrors = validate(form)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    try {
      const res = await joinRequest({
        username: form.join_id,
        password: form.join_pw,
        display_name: form.join_name,
        dept: form.join_dept,
        role: form.join_role,
      })
      if (res.status === 200) {
        setSubmitted(true)
      } else if (res.status === 409) {
        // round10b Task C — 이메일 항목 자체가 없어져 중복 사유는 아이디 하나뿐이다
        // (서버 메시지도 동일: museum/auth/routes.py "이미 사용 중인 아이디입니다").
        setSubmitError('이미 사용 중인 아이디입니다')
      } else {
        setSubmitError(res.detail || '가입 신청에 실패했습니다')
      }
    } catch {
      setSubmitError('가입 신청에 실패했습니다. 잠시 후 다시 시도하세요.')
    }
  }

  if (submitted) {
    return (
      <div className="card">
        <div className="auth_head">
          <Link to="/login" className="ic_back" aria-label="뒤로가기">
            <img src={icArrowLeft} alt="" className="ic_back_img" />
          </Link>
          <h2 className="auth_head_tit">회원가입</h2>
        </div>
        <p className="notice_box" role="status">
          신청이 접수되었습니다. 관리자 승인 후 이용 가능합니다.
        </p>
        <Link to="/login" className="btn btn_lg btn_primary">로그인 화면으로</Link>
      </div>
    )
  }

  return (
    <div className="card">
      <div className="auth_head">
        {/* img의 alt=""(장식용)를 유지한다 — 라벨은 aria-label이 제공하므로 중복 낭독을 막는다. */}
        <Link to="/login" className="ic_back" aria-label="뒤로가기">
          <img src={icArrowLeft} alt="" className="ic_back_img" />
        </Link>
        <h2 className="auth_head_tit">회원가입</h2>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        <div className="form_section">
          <div className="form_stack">
            <div className="form_group">
              <label className="form_label" htmlFor="join_name">이름</label>
              {/* placeholder의 "예 : "는 콜론 앞뒤에 공백이 하나씩 있는 퍼블 원문이다. 정규화하지 않는다. */}
              <input type="text" className="form_input" id="join_name" name="join_name"
                     placeholder="예 : 박연구" autoComplete="name"
                     aria-invalid={Boolean(errors.join_name)}
                     value={form.join_name} onChange={set} />
              {errors.join_name && <p className="form_error" role="alert">{errors.join_name}</p>}
            </div>

            <div className="form_group">
              <label className="form_label" htmlFor="join_dept">부서</label>
              <input type="text" className="form_input" id="join_dept" name="join_dept"
                     placeholder="예 : 자료관리과" autoComplete="organization"
                     aria-invalid={Boolean(errors.join_dept)}
                     value={form.join_dept} onChange={set} />
              {errors.join_dept && <p className="form_error" role="alert">{errors.join_dept}</p>}
            </div>

            {/* round10b Task C — 사용자 결정(2026-09-17) "이메일관련은 다 빼": 퍼블
                원문의 이메일 입력(join_email)을 제거했다. */}
            <div className="form_group">
              <label className="form_label" htmlFor="join_id">아이디</label>
              <input type="text" className="form_input" id="join_id" name="join_id"
                     placeholder="예 : id" autoComplete="username"
                     aria-invalid={Boolean(errors.join_id)}
                     value={form.join_id} onChange={set} />
              {errors.join_id && <p className="form_error" role="alert">{errors.join_id}</p>}
            </div>

            {/* .form_row_split은 flex + 자식 flex:1 1 0; min-width:0 인 동일 폭 2열이다.
                퍼블에 1열로 떨어뜨리는 미디어쿼리가 없으므로 flex-wrap을 임의로 추가하지 않는다. */}
            <div className="form_row_split">
              <div className="form_group">
                <label className="form_label" htmlFor="join_pw">비밀번호</label>
                <input type="password" className="form_input" id="join_pw" name="join_pw"
                       placeholder="8자 이상" autoComplete="new-password"
                       aria-invalid={Boolean(errors.join_pw)}
                       value={form.join_pw} onChange={set} />
                {errors.join_pw && <p className="form_error" role="alert">{errors.join_pw}</p>}
              </div>
              <div className="form_group">
                <label className="form_label" htmlFor="join_pw_confirm">비밀번호 확인</label>
                <input type="password" className="form_input" id="join_pw_confirm" name="join_pw_confirm"
                       placeholder="8자 이상" autoComplete="new-password"
                       aria-invalid={Boolean(errors.join_pw_confirm)}
                       value={form.join_pw_confirm} onChange={set} />
                {errors.join_pw_confirm && <p className="form_error" role="alert">{errors.join_pw_confirm}</p>}
              </div>
            </div>

            <div className="form_group">
              <label className="form_label" htmlFor="join_role">신청권한</label>
              {/* reset.css의 공용 select_box 컴포넌트 재사용 — 신규 dropdown을 만들지 않는다(퍼블 주석). */}
              <div className="select_box">
                {/* 퍼블 원문은 표시 텍스트와 저장값이 양쪽 다 어긋나 있었다.
                    구→신 매핑은 spec §6.6.3 (ㄱ)·§13 U-2 참조(구 어휘는 D5 게이트상 비테스트 코드에 남기지 않는다).
                    3옵션(사용자/관리자/통합관리자)은 §0 R2.3 — ROLES(schema CHECK와 정렬된 정본)를 그대로
                    옵션으로 편다. 표시 계열과 저장 계열을 분리하지 않아 매핑표가 생기지 않는다. */}
                <select id="join_role" name="join_role" required
                        aria-invalid={Boolean(errors.join_role)}
                        value={form.join_role} onChange={set}>
                  <option value="" disabled>선택</option>
                  {ROLES.map((role) => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                </select>
              </div>
              {errors.join_role && <p className="form_error" role="alert">{errors.join_role}</p>}
            </div>
          </div>

          {submitError && <p className="form_error" role="alert">{submitError}</p>}

          <button type="submit" className="btn btn_lg btn_primary">가입신청</button>
        </div>
      </form>
    </div>
  )
}
