import { useRef } from 'react'

/**
 * 이 파일의 책임: 화면 안에서의 탭 전환(버튼 기반).
 * 라우트를 이동하는 부착형 탭(page_tabs)은 링크 기반이라 별개 컴포넌트다(§6.7.2).
 *
 * variant 3종
 *  - underline(기본)·pill : 기존 화면이 쓰는 Tailwind 표기. 클래스 문자열을 손대지 않는다
 *                           (Tabs.test.jsx 8건이 이 문자열을 정규식으로 검사한다).
 *  - segmented            : 퍼블 find.html의 .tab_seg_menu / .tab_seg_btn.
 *                           활성 표시가 클래스가 아니라 [aria-selected="true"] 셀렉터라
 *                           (component.css:59) 활성/비활성 클래스를 따로 두지 않는다.
 *
 * WAI-ARIA Tabs 패턴(role · roving tabindex · 방향키 자동 활성화)은 퍼블 common.js:78-108을
 * 그대로 옮긴 것이며 3종 모두에 적용한다 — 접근성은 변형별 선택 사항이 아니다.
 */
export default function Tabs({ tabs, active, onChange, variant = 'underline', ariaLabel }) {
  const isPill = variant === 'pill'
  const isSegmented = variant === 'segmented'

  // 방향키 이동 시 focus()를 걸어야 하므로 각 탭 버튼의 DOM 참조를 key로 들고 있는다.
  const refs = useRef({})

  const containerClass = isSegmented
    ? 'tab_seg_menu'
    : isPill
      ? 'flex gap-0'
      : 'flex gap-1 border-b border-line'

  const activeClass = isPill
    ? 'bg-white text-ink font-bold rounded-t-[10px] shadow-[0_-2px_6px_0_rgba(0,0,0,0.08)]'
    : 'border-b-2 border-primary-600 text-ink font-bold'

  const inactiveClass = isPill
    ? 'bg-[#E7EAF4] text-[#8A90A2] rounded-t-[10px]'
    : 'border-b-2 border-transparent text-[#8A90A2]'

  /**
   * ArrowLeft/ArrowRight 순환. (idx + delta + len) % len 으로 끝에서 처음으로 감는다.
   * 이동과 동시에 onChange까지 부르는 자동 활성화(automatic activation) 패턴이며
   * 퍼블 common.js:96-108의 동작과 같다. 수동 활성화로 바꾸면 퍼블과 동작이 달라지므로
   * 바꾸지 않는다. preventDefault는 브라우저 기본 캐럿 이동을 막기 위한 것이다.
   */
  function handleKeyDown(e) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    const idx = tabs.findIndex((t) => t.key === active)
    const delta = e.key === 'ArrowRight' ? 1 : -1
    const next = tabs[(idx + delta + tabs.length) % tabs.length]
    onChange(next.key)
    refs.current[next.key]?.focus()
    e.preventDefault()
  }

  return (
    <div className={containerClass} role="tablist" aria-label={ariaLabel}>
      {tabs.map((t) => {
        const isActive = active === t.key
        return (
          <button
            key={t.key}
            id={t.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-controls={t.panelId}
            // roving tabindex — 탭 그룹 전체가 Tab 키 순회에서 한 칸만 차지한다
            tabIndex={isActive ? 0 : -1}
            ref={(el) => { refs.current[t.key] = el }}
            onClick={() => onChange(t.key)}
            onKeyDown={handleKeyDown}
            className={
              isSegmented
                ? 'tab_seg_btn'
                // round06d 후속 #3: pill 탭 패딩이 ¼(2/4px)로 줄어 조밀했다 → 16/8px로 복원.
                // underline/segmented 분기는 손대지 않는다(Tabs.test.jsx가 문자열로 검사).
                : `px-16 py-8 text-sm font-medium -mb-px ${isActive ? activeClass : inactiveClass}`
            }
          >
            {t.label}
            {t.badge != null && (
              <span className="ml-1 inline-flex items-center justify-center text-xs bg-primary-600 text-white rounded-full px-1.5">
                {t.badge}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

/**
 * TabPanel — role="tabpanel" 짝.
 * 감춤은 조건부 렌더가 아니라 hidden 속성으로 한다. 조건부 렌더로 바꾸면 패널이 DOM에서
 * 사라져 aria-controls가 존재하지 않는 id를 가리키게 되고, .tab_seg_panel[hidden]{display:none}
 * (component.css:60) 규칙도 무의미해진다(§7.3-2).
 * className은 호출부가 준다 — 퍼블 패널은 "tab_seg_panel form_section" 두 클래스를 함께
 * 가져야 gap:1.2rem 세로 리듬이 산다.
 */
export function TabPanel({ id, tabId, active, className, children }) {
  return (
    <div id={id} role="tabpanel" aria-labelledby={tabId} hidden={!active} className={className}>
      {children}
    </div>
  )
}
