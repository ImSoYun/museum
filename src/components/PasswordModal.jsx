import { useEffect, useState } from 'react'
import { Lock } from 'lucide-react'
import Modal from './Modal.jsx'

/**
 * PasswordModal — 암호로 보호된 라이브러리 프로젝트를 열 때 뜨는 모달(round10 Task5).
 *
 * Props:
 *   open     boolean  — 표시 여부
 *   error    string?  — 있으면 입력칸 아래 빨간 한 줄(예: "암호가 맞지 않습니다")
 *   busy     boolean? — openProject 왕복이 나가 있는 동안 true — 중복 제출을 막는다
 *                       (SaveProjectModal의 busy 계약과 같다).
 *   onCancel fn       — 「아니오」·오버레이·X 클릭 시. **모달을 닫을지는 호출부(부모) 몫이다**
 *                       — 이 컴포넌트는 open prop을 그대로 따를 뿐 스스로 닫지 않는다
 *                       (그래야 부모가 열린 채로 오류만 보여줄 수 있다 — 403이면 모달을
 *                       닫지 않고 error만 채워 다시 시도하게 한다, Library.jsx 참조).
 *   onSubmit fn       — 「네」 클릭 시 입력한 암호 문자열과 함께 호출된다.
 *
 * spec Global Constraints — 암호는 화면에서도 최대 4자(maxLength=4)이고, 암호 통과
 * 상태를 세션·쿠키·localStorage 어디에도 남기지 않는다(열 때마다 묻는다). 이 컴포넌트가
 * 지키는 몫은 "열 때마다 입력을 비운다"다 — 다음 프로젝트를 열 때 이전에 틀렸던 값이
 * 남아 있지 않게 한다.
 *
 * 리뷰 fix — 입력칸을 비운 채 「네」를 누르면 서버가 401(password_required)을 준다.
 * 403(틀림)과 구분해 쓰라는 신호인데, 가장 확실한 처리는 애초에 그 요청이 나가지
 * 않게 막는 것이다(SaveProjectModal이 빈 암호 저장을 막는 것과 같은 관행 —
 * SaveProjectModal.jsx의 passwordPending/canSave 참조). 그래서 입력이 비어 있으면
 * 「네」 버튼 자체를 비활성화한다.
 */
export default function PasswordModal({ open, error, busy = false, onCancel, onSubmit }) {
  const [pw, setPw] = useState('')

  useEffect(() => {
    if (open) setPw('')
  }, [open])

  const canSubmit = pw.length > 0 && !busy

  const handleSubmit = () => {
    if (!canSubmit) return
    onSubmit?.(pw)
  }

  return (
    <Modal
      open={open}
      title="프로젝트 암호 입력"
      onClose={onCancel}
      size="sm"
      footer={
        <>
          {/* round10b Task A — h-11 은 기본 Tailwind 스케일 관용구(2.75rem=44px)다. 이
              프로젝트 spacing은 spacing[N]=Npx라 h-11 그대로는 11px로 렌더된다(SaveProjectModal.jsx와
              같은 실수를 공유하는 자매 컴포넌트 — 저 파일 주석 참조). 의도값 44px로 h-44 를 쓴다. */}
          <button
            onClick={onCancel}
            disabled={busy}
            className="flex-1 h-44 border border-[#DCE0EC] bg-white rounded-[10px] text-[14px] font-semibold text-[#5A6173] hover:bg-canvas transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            아니오
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="flex-1 h-44 border-none bg-primary-600 text-white rounded-[10px] text-[14px] font-bold hover:bg-primary-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            네
          </button>
        </>
      }
    >
      {/* Lock icon tile */}
      <div className="flex flex-col gap-0">
        <div className="w-[50px] h-[50px] rounded-[14px] bg-primary-50 flex items-center justify-center mb-4">
          <Lock size={23} className="text-primary-600" />
        </div>

        {/* Description */}
        <p className="text-[13px] text-[#6B7280] leading-relaxed mb-[18px]">
          이 프로젝트는 암호로 보호되어 있습니다. 열람하려면 암호를 입력하세요.
        </p>

        {/* Password input */}
        <input
          type="password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          placeholder="암호를 입력하세요"
          maxLength={4}
          className="w-full h-[46px] border-[1.5px] border-[#DCE0EC] rounded-[10px] px-[14px] text-[14px] outline-none focus:border-primary-600 transition-colors"
        />
        {error && <p className="mt-2 text-[12px] text-red-600">{error}</p>}
      </div>
    </Modal>
  )
}
