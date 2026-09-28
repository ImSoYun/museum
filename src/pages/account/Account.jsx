import { useState } from 'react'
import Button from '../../components/Button.jsx'
import Modal from '../../components/Modal.jsx'
import ManagePageHeader from '../../components/manage/ManagePageHeader.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { changePasswordRequest } from '../../lib/authApi.js'

// round06e §9.2 — 셀프 비밀번호 변경 폼. 퍼블 원본 account.html에는 이 폼이 없다(앱 고유
// 신설 화면). p-7·rounded-[14px]·#5A6173·bg-canvas 등 시각 배치는 확정 디자인 사양이
// 아니라 위 "내 계정" 카드의 기존 관행을 참고해 맞춘 자체 설계 초안이다 — 이 컴포넌트의
// 테스트는 role·aria-label·문구만 잠그고 시각 스타일은 단언하지 않는다.
function PasswordSection() {
  const [form, setForm] = useState({ current: '', next: '', confirm: '' })
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const set = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    if (form.next.length < 8) {
      setError('새 비밀번호는 8자 이상이어야 합니다')
      return
    }
    if (form.next !== form.confirm) {
      setError('새 비밀번호가 일치하지 않습니다')
      return
    }
    setSubmitting(true)
    try {
      const res = await changePasswordRequest({
        current_password: form.current,
        new_password: form.next,
      })
      // round06e-finishing Critical #1 — HTTP 200이라도 detail(에러 사유)이 함께 실려
      // 있으면 성공으로 오판하지 않는다. authApi.js가 status를 body보다 나중에 스프레드해
      // 숫자가 이기게 고쳤지만(그 파일 참고), 여기서도 status 단일 필드만 믿지 않고
      // detail 부재까지 함께 확인해 이중으로 안전하게 판정한다.
      if (res.status === 200 && !res.detail) {
        setSuccess(true)
        setForm({ current: '', next: '', confirm: '' })
      } else {
        setError(res.detail || '비밀번호 변경에 실패했습니다')
      }
    } catch {
      setError('비밀번호 변경에 실패했습니다. 잠시 후 다시 시도하세요.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-[760px] mx-auto bg-white border border-line rounded-[14px] p-7 mt-6">
      <h2 className="text-[16px] font-extrabold text-ink mb-1.5">비밀번호 변경</h2>
      <form onSubmit={submit} noValidate className="space-y-3 mt-4">
        <label className="block text-sm">
          <span className="text-[#5A6173] block mb-1">현재 비밀번호</span>
          <input
            type="password" aria-label="현재 비밀번호" autoComplete="current-password"
            value={form.current} onChange={set('current')}
            className="border border-line rounded-lg text-sm px-3 py-2 w-full bg-canvas outline-none"
          />
        </label>
        <label className="block text-sm">
          <span className="text-[#5A6173] block mb-1">새 비밀번호</span>
          <input
            type="password" aria-label="새 비밀번호" autoComplete="new-password"
            value={form.next} onChange={set('next')}
            className="border border-line rounded-lg text-sm px-3 py-2 w-full bg-canvas outline-none"
          />
        </label>
        <label className="block text-sm">
          <span className="text-[#5A6173] block mb-1">새 비밀번호 확인</span>
          <input
            type="password" aria-label="새 비밀번호 확인" autoComplete="new-password"
            value={form.confirm} onChange={set('confirm')}
            className="border border-line rounded-lg text-sm px-3 py-2 w-full bg-canvas outline-none"
          />
        </label>
        {error && <p role="alert" className="text-bad text-xs">{error}</p>}
        {success && <p role="status" className="text-ok text-xs">비밀번호가 변경되었습니다</p>}
        <Button type="submit" variant="primary" size="sm" disabled={submitting}>비밀번호 변경</Button>
      </form>
    </div>
  )
}

export default function Account() {
  const { user } = useAuth()
  const [profile, setProfile] = useState({
    // 세션 사용자 요약 필드는 display_name이다(museum/auth/routes.py:_summarize 계약).
    name: user?.display_name ?? '',
    role: user?.role ?? '',
    // round10a — 부서도 세션에서 읽는다. 전에는 '학예연구실' 리터럴이 박혀 있었고 그 옆
    // 주석은 「세션에 아직 없는 필드」라고 적었는데, **그 사이 생겼다** —
    // museum/auth/routes.py:77 이 `"dept": user.dept` 를 내려 준다(_summarize 계약).
    // 낡은 주석 탓에 어느 계정으로 봐도 부서가 학예연구실이었다(라이브 실측: admin 은
    // /auth/me 가 dept:null 인데 화면은 학예연구실이라고 말했다). 모르는 값을 지어내지 않는다.
    // round10b Task C — 사용자 결정(2026-09-17) "이메일관련은 다 빼": email 필드를
    // 뺐다(세션 응답 자체에 더 이상 그 키가 없다 — auth/routes.py:_summarize).
    dept: user?.dept ?? '',
  })
  const [editOpen, setEditOpen] = useState(false)
  const [draft, setDraft] = useState(profile)

  const openEdit = () => { setDraft(profile); setEditOpen(true) }
  const save = () => { setProfile(draft); setEditOpen(false) }

  return (
    <div>
      {/* round06c-ext 시각 검증 fix — SystemTabs 를 렌더하지 않는다.
          구 IA 에서는 AdminTabs 의 '계정관리' 탭이 /account 를 가리켰기 때문에 이 화면에
          그 탭바가 있는 것이 의미가 있었다. 그런데 D1-2·D2b 로 그 탭이 '계정·권한 →
          /system/accounts' 로 대체돼(이월 Minor D1-2-M5 해소) SystemTabs 4탭 중 어느
          것도 /account 를 가리키지 않는다. 그 상태로 남겨 두면 "내 계정" 화면에 거대한
          h2 "시스템관리" + 활성 탭 없는 탭바가 얹히고(제목 3중복), 사용자 role 로는
          canAccess 가 전부 false 라 빈 탭바 껍데기만 남는다(Playwright 실측 확인).
          /account 는 account area 이지 system area 가 아니다. */}
      <ManagePageHeader title="내 계정" />

      <div className="p-8 min-h-0 flex-1">
        <div className="max-w-[760px] mx-auto bg-white border border-line rounded-[14px] p-7">
          <h2 className="text-[20px] font-extrabold text-ink mb-1.5">내 계정</h2>
          <p className="text-[13.5px] text-[#6B7280] mb-[22px]">
            {profile.role} 계정 정보를 관리합니다.
          </p>

          <div className="flex items-center gap-4 px-[18px] py-[18px] bg-offwhite rounded-xl">
            {/* round10b Task C — w-14 h-14(14px, 이 레포 spacing 스케일은 N=Npx다,
                tailwind.config.js 참고)는 그 안의 text-[20px] 이니셜 글자 자체보다도
                작아 반드시 넘친다(20>14 — 별도 렌더 없이도 수치로 확정, 정적 HTML로도
                대조 확인). w-44 h-44(44px)로 키워 20px 글자가 여유 있게 들어가게 한다
                (LNB 프로필 아바타 2rem=40px과 비슷한 눈높이, layout.css:125). 이메일
                제거와는 무관한 별건 수리다(브리프 지시). */}
            <div
              className="w-44 h-44 rounded-full bg-primary-600 text-white flex items-center justify-center text-[20px] font-bold shrink-0"
              aria-label="아바타"
            >
              {profile.name[0]}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[16px] font-bold text-ink">{profile.name}</span>
                <span className="text-[12px] font-semibold text-primary-600 bg-primary-100 rounded-md px-2 py-0.5">
                  {profile.role}
                </span>
              </div>
              {/* round10b Task C — 사용자 결정(2026-09-17) "이메일관련은 다 빼": 이 줄은
                  원래 이메일과 부서를 " · "로 이었다. 이메일이 없어지며 그 구분점 로직
                  자체가 필요 없어졌다 — 부서만 남기고, 없으면 빈 줄로 둔다(레이아웃 유지,
                  꼬리 문자 없음). */}
              <p className="text-[12.5px] text-[#8A90A2] mt-[3px]" data-testid="account_contact_line">
                {profile.dept}
              </p>
            </div>

            <Button variant="outline" size="sm" onClick={openEdit}>
              정보 수정
            </Button>
          </div>
        </div>

        <PasswordSection />
      </div>

      <Modal
        open={editOpen}
        title="정보 수정"
        onClose={() => setEditOpen(false)}
        size="sm"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setEditOpen(false)}>취소</Button>
            <Button variant="primary" size="sm" onClick={save}>저장</Button>
          </>
        }
      >
        <div className="space-y-3">
          <label className="block text-sm">
            <span className="text-[#5A6173] block mb-1">이름</span>
            <input
              aria-label="이름"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              className="border border-line rounded-lg text-sm px-3 py-2 w-full bg-canvas outline-none"
            />
          </label>
          <label className="block text-sm">
            <span className="text-[#5A6173] block mb-1">부서</span>
            <input
              aria-label="부서"
              value={draft.dept}
              onChange={(e) => setDraft({ ...draft, dept: e.target.value })}
              className="border border-line rounded-lg text-sm px-3 py-2 w-full bg-canvas outline-none"
            />
          </label>
        </div>
      </Modal>
    </div>
  )
}
