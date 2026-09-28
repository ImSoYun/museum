import { useEffect, useId, useState } from 'react'
import Modal from './Modal.jsx'

/**
 * SaveProjectModal — 검색결과·산출물을 라이브러리 프로젝트로 저장하는 입력 모달
 * (피그마 저장 모달 871:16144). round10 Task4에서 설명·암호 필드를 더했다.
 *
 * Props:
 *   open         boolean  — 표시 여부
 *   defaultTitle string   — 프로젝트명 초기값(그 대화의 표시 이름)
 *   busy         boolean  — 저장 요청이 나가 있는 동안 true(중복 제출·중도 취소 방지)
 *   onSave       fn       — 저장 클릭 시 { title, description, password } 로 호출.
 *                           title·description은 trim된 값, 암호 미사용이면 password는 null.
 *   onCancel     fn       — 취소·오버레이·X 닫기 공용
 *
 * 필드 순서(브리프 Step4): 프로젝트명 → 작업 설명 → 암호설정(체크박스) → 암호 입력.
 * 암호 입력칸은 체크했을 때만 렌더한다 — 항상 렌더해 두고 disabled로 가리면
 * "입력했는데 안 보내진다"는 상태가 DOM에 남아 혼란을 준다.
 */
export default function SaveProjectModal({ open, defaultTitle = '', busy = false, onCancel, onSave }) {
  const [title, setTitle] = useState(defaultTitle)
  const [description, setDescription] = useState('')
  const [passwordOn, setPasswordOn] = useState(false)
  const [password, setPassword] = useState('')

  const titleId = useId()
  const descId = useId()
  const pwCheckId = useId()

  // 모달이 열릴 때마다 전부 초기 상태로 리셋 — 이전에 열었을 때 입력한 설명·암호가
  // 다음 항목 저장에 새어 들어가면 안 된다(다른 대화를 저장하는 것이므로).
  useEffect(() => {
    if (open) {
      setTitle(defaultTitle)
      setDescription('')
      setPasswordOn(false)
      setPassword('')
    }
  }, [open, defaultTitle])

  const trimmedTitle = title.trim()
  // round10 결정 — 암호설정을 켰는데 아직 암호를 비워 둔 "중간 상태"에서는 저장을
  // 막는다. 서버(ProjectCreateRequest.password, min_length=1)가 빈 문자열 암호를
  // 422로 거부하기도 하거니와, 사용자가 분명히 "암호를 걸겠다"고 체크했는데 빈 값을
  // 조용히 "암호 없음"으로 되돌리면 그게 더 놀라운 동작이다 — 체크를 끄거나 암호를
  // 채우거나, 의도를 분명히 하게 한다(아래 handleTogglePassword가 체크 해제 시
  // 입력값을 비워 이 상태를 벗어나게 돕는다).
  const passwordPending = passwordOn && password.length === 0
  const canSave = trimmedTitle.length > 0 && !passwordPending && !busy

  const handleTogglePassword = (checked) => {
    setPasswordOn(checked)
    if (!checked) setPassword('')
  }

  const handleSave = () => {
    if (!canSave) return
    onSave({
      title: trimmedTitle,
      description: description.trim(),
      password: passwordOn ? password : null,
    })
  }

  return (
    <Modal
      open={open}
      title="프로젝트로 저장"
      onClose={onCancel}
      size="sm"
      footer={
        <>
          {/* round10b Task A — h-11 은 기본 Tailwind 스케일 관용구(2.75rem=44px)다. 이
              프로젝트 spacing은 spacing[N]=Npx라 h-11 그대로는 11px로 렌더된다(PasswordModal.jsx와
              같은 실수를 공유하는 자매 컴포넌트 — 저 파일 주석 참조). 의도값 44px로 h-44 를 쓴다. */}
          <button
            onClick={onCancel}
            disabled={busy}
            className="flex-1 h-44 border border-[#DCE0EC] bg-white rounded-[10px] text-[14px] font-semibold text-[#5A6173] hover:bg-canvas transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="flex-1 h-44 border-none bg-primary-600 text-white rounded-[10px] text-[14px] font-bold hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? '저장 중…' : '저장'}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-[13px] text-[#6B7280] leading-relaxed">
          현재 검색·산출물을 새 프로젝트로 라이브러리에 저장합니다.
        </p>

        <div>
          <label htmlFor={titleId} className="block text-[13px] font-semibold text-ink-900 mb-1.5">
            프로젝트명
          </label>
          <input
            id={titleId}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="프로젝트 제목"
            className="w-full h-[46px] border-[1.5px] border-[#DCE0EC] rounded-[10px] px-[14px] text-[14px] outline-none focus:border-primary-600 transition-colors"
          />
        </div>

        <div>
          <label htmlFor={descId} className="block text-[13px] font-semibold text-ink-900 mb-1.5">
            작업 설명
          </label>
          <textarea
            id={descId}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="어떤 작업인지 간단히 남겨 두세요(선택)"
            rows={3}
            className="w-full border-[1.5px] border-[#DCE0EC] rounded-[10px] px-[14px] py-[10px] text-[14px] outline-none focus:border-primary-600 transition-colors resize-none"
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            id={pwCheckId}
            type="checkbox"
            checked={passwordOn}
            onChange={(e) => handleTogglePassword(e.target.checked)}
          />
          <label htmlFor={pwCheckId} className="text-[13px] font-semibold text-ink-900">
            암호설정
          </label>
        </div>

        {passwordOn && (
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="암호를 입력하세요"
            maxLength={4}
            className="w-full h-[46px] border-[1.5px] border-[#DCE0EC] rounded-[10px] px-[14px] text-[14px] outline-none focus:border-primary-600 transition-colors"
          />
        )}
      </div>
    </Modal>
  )
}
