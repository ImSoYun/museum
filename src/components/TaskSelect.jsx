/**
 * 이 파일의 책임: 채팅 입력 바의 「작업선택」 드롭다운 — 목록을 **위로** 펼친다.
 *
 * 왜 네이티브 <select> 가 아닌가 — 이유는 하나뿐이다. 채팅 입력 바는 화면 맨 아래에
 * 붙어 있어(.chat_input_dock) 아래로 열면 목록이 화면 밖으로 잘린다. 피그마
 * (695-100384)는 패널을 입력 바 **위**에 그리는데, 브라우저는 <select> 의 펼침 방향을
 * 지정하게 해 주지 않는다. 그래서 리스트박스를 손으로 만든다.
 *
 * 손으로 만든다는 것은 네이티브가 공짜로 주던 접근성을 **되사야** 한다는 뜻이다:
 * ↑↓ 이동 · Enter 선택 · Esc 닫기 · Tab 으로 빠져나가면 닫기 · 바깥클릭 닫기 ·
 * 닫힐 때 트리거로 포커스 복귀.
 * 그 처리 방식은 이 레포가 이미 세 번 쓴 관행을 그대로 따른다 — DropdownMenu.jsx ·
 * SearchModeToggle.jsx · DropdownCheckBox.jsx 가 모두 「open 일 때만 document 에
 * mousedown 리스너를 걸어 바깥클릭을 닫고, 패널의 keydown 에서 Escape 를 잡아
 * close() 로 닫으며 triggerRef 로 포커스를 되돌린다」. 새 방식을 만들지 않는다.
 *
 * 바깥클릭에서는 포커스를 되돌리지 **않는다**(Esc·선택에서만 되돌린다). 되돌리면
 * 사용자가 옆의 입력칸을 누른 순간 포커스를 다시 빼앗아 글자를 못 치게 된다 —
 * 세 선례 전부 같은 이유로 Esc 에서만 복귀시킨다.
 *
 * 「위로」를 담보하는 장치는 세 겹이다(수정 R1 에서 ③이 붙었다):
 *   ① 마크업 — 패널을 트리거보다 **앞**에 렌더한다. CSS 가 통째로 죽어도 정상 흐름에서
 *      위에 그려진다(TaskSelect.test.jsx 가 DOM 순서로 잠근다).
 *   ② CSS — .chat_task_select_panel 이 bottom: calc(100% + …) 절대배치다
 *      (styles/css-contract.test.js 가 top 오프셋 부재까지 잠근다).
 *   ③ 픽셀 — 실브라우저에서 「패널 아래끝 ≤ 트리거 위끝」을 잰다
 *      (e2e/smoke/smoke.spec.ts 「스모크 ④」, 백엔드 없이 도는 스모크 project).
 * ①②는 jsdom 이라 실제 픽셀을 못 본다 — 특히 ②는 CSS 파일을 텍스트로 읽을 뿐이라
 * **캐스케이드 패배**(뒤에 더 강한 규칙이 top 을 얹는 경우)를 원리상 못 잡는다. 그 구멍을
 * ③이 막는다(실측: 그 변이는 ①②를 모두 통과하고 ③에서만 red 였다). 반대로 ③은 CSS 가
 * 살아 있는 한 DOM 순서 뒤집기를 못 잡으므로 ①을 대체하지 않는다 — 셋 다 필요하다.
 *
 * 제어 컴포넌트다 — value 의 소유자는 호출부(ChatTab)다.
 */
import { useEffect, useId, useRef, useState } from 'react'
import icArrowDown from '../assets/icons/ic_arrow_down.svg'
import { CHAT_TASKS, CHAT_TASK_ORDER } from '../pages/results/chatTasks.js'

/** 고르기 전 닫힌 라벨. */
export const TASK_SELECT_PLACEHOLDER = '작업선택'

/** 리스트박스 자신의 접근명 — **항목 이름 어느 것과도 달라야 한다**.
 *
 *  placeholder 와 같은 「작업선택」을 쓰고 있었는데, 두 번째 항목의 이름이 바로 그
 *  「작업선택」이라 스크린리더가 열자마자 "작업선택 목록상자 … 작업선택"을 읽었다.
 *  같은 말이 연달아 나오면 방금 읽힌 것이 **목록의 이름인지 항목의 이름인지**가
 *  사라진다. 역할 낱말(「목록」·「목록상자」)도 넣지 않는다 — 역할은 리더가 스스로
 *  읽으므로 이름에 또 넣으면 "작업 목록 목록상자"가 된다. */
export const TASK_SELECT_LIST_LABEL = '수행할 작업'

/** 목록 항목. **문구의 출처는 chatTasks.js 한 곳**이다(round07k) — 여기에 다시
 *  적으면 종류를 더할 때 두 곳을 고쳐야 하고, 한쪽만 고치면 드롭다운과 대화 턴이
 *  다른 이름을 말한다.
 *
 *  **「생성」과 「작성」이 다른 것은 오타가 아니다** — 열린 목록은 「…생성」,
 *  닫힌 트리거는 「…작성」이고 사용자가 「피그마 그대로 둘 다」로 결정했다.
 *  통일하지 말 것 — 아래 테스트가 양방향으로 잠근다.
 *
 *  순서도 피그마 순서다: 실제 항목이 먼저, placeholder 로 되돌리는 항목이 뒤. */
export const TASK_SELECT_OPTIONS = [
  ...CHAT_TASK_ORDER.map((key) => ({
    value: CHAT_TASKS[key].value,
    label: CHAT_TASKS[key].optionLabel,
    closedLabel: CHAT_TASKS[key].closedLabel,
  })),
  { value: '', label: TASK_SELECT_PLACEHOLDER, closedLabel: TASK_SELECT_PLACEHOLDER },
]

export default function TaskSelect({ value = '', onChange, disabled = false }) {
  const [open, setOpen] = useState(false)
  // 활성 항목(aria-activedescendant) — 포커스는 목록 자신이 갖고, 「지금 어느 항목이냐」는
  // 이 인덱스가 말한다. ARIA 리스트박스의 표준 방식이다.
  const [activeIndex, setActiveIndex] = useState(0)
  const uid = useId()
  const listId = `${uid}-list`
  const optionId = (i) => `${uid}-opt-${i}`
  const rootRef = useRef(null)
  const triggerRef = useRef(null)
  const listRef = useRef(null)

  /** 닫는 유일한 길 — 닫고, 포커스를 트리거로 되돌린다. 되돌리지 않으면 포커스가
   *  사라진 목록과 함께 <body> 로 떨어져 키보드 사용자가 자리를 잃는다. */
  const close = () => {
    setOpen(false)
    triggerRef.current?.focus()
  }

  useEffect(() => {
    if (!open) return undefined
    function onDocMouseDown(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [open])

  // 열리면 목록으로 포커스를 옮긴다 — 그래야 ↑↓·Enter·Esc 가 목록의 keydown 에 걸린다.
  useEffect(() => {
    if (open) listRef.current?.focus()
  }, [open])

  // 여는 동안 답변이 사라져 disabled 가 되면(대화 초기화) 열린 패널을 남기지 않는다.
  //
  // 닫는 길은 하나뿐이어야 한다 — 그래서 여기서도 close() 를 쓴다. 다만 **이 경로에서는
  // 포커스가 실제로 트리거로 돌아가지 않는다**: 이 effect 가 도는 시점의 트리거는 이미
  // disabled 라 focus() 가 무동작이고, 포커스를 쥐고 있던 목록이 사라지므로 포커스는
  // <body> 로 떨어진다. 그것이 네이티브 <select> 가 포커스를 쥔 채 disabled 될 때의
  // 동작과 같아서 여기서 더 손대지 않는다(억지로 다른 곳에 포커스를 주면 이 위젯이
  // 남의 화면 순서에 개입하게 된다). close() 를 쓰는 이유는 「닫기」의 정의를 한 자리에
  // 모아 두기 위해서다 — 나중에 닫기 처리가 늘어도 이 경로가 빠지지 않는다.
  useEffect(() => {
    if (disabled) close()
  }, [disabled])

  const openWith = () => {
    if (disabled) return
    // 열 때의 활성 항목은 「지금 고른 것」이다. 아직 고른 게 없으면(value '') 첫 항목 —
    // 빈 값도 placeholder 항목의 값이라 findIndex 로는 그 줄이 잡히지만, 「아무것도 안
    // 골랐다」에서 커서가 되돌리기 줄에 서 있으면 ↑↓ 없이 Enter 만 눌렀을 때 아무 일도
    // 일어나지 않는다(ARIA APG 도 미선택이면 첫 항목을 활성으로 둔다).
    const at = value ? TASK_SELECT_OPTIONS.findIndex((o) => o.value === value) : 0
    setActiveIndex(at >= 0 ? at : 0)
    setOpen(true)
  }

  // 같은 값을 다시 골라도 onChange 를 부른다 — 네이티브 <select> 시절 value 를 늘 ''
  // 로 되돌려 얻던 「같은 작업을 몇 번이고 다시 고른다」를 여기서 대신 보장한다.
  const select = (next) => {
    close()
    onChange?.(next)
  }

  const onListKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => Math.min(TASK_SELECT_OPTIONS.length - 1, i + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(0, i - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      select(TASK_SELECT_OPTIONS[activeIndex].value)
    } else if (e.key === 'Escape') {
      close()
    } else if (e.key === 'Tab') {
      // 네이티브 <select> 는 Tab 으로 빠져나가면 닫힌다. 손으로 만든 리스트박스는
      // 그것도 되사야 한다 — 안 그러면 사용자는 이미 떠난 위젯의 목록을 화면에
      // 남기고, 트리거의 aria-expanded 는 true 로 굳어 스크린리더가 「펼쳐짐」이라
      // 계속 말한다.
      //
      // preventDefault 하지 않는다 — **닫고 트리거로 포커스를 되돌린 뒤** 브라우저의
      // 기본 탭 이동이 그 자리에서 이어지게 둔다. 되돌리는 것이 필수다: 패널은 DOM
      // 에서 트리거보다 **앞**이라(위로 열기 위한 마크업 층) 목록에서 그냥 Tab 하면
      // 다음 초점이 바로 그 트리거가 되어 포커스가 위젯 안에 갇힌다. 트리거에서
      // 출발하면 네이티브 <select> 와 같이 「위젯 다음 컨트롤」로 나간다.
      close()
    }
  }

  const closedLabel =
    TASK_SELECT_OPTIONS.find((o) => o.value === value)?.closedLabel ?? TASK_SELECT_PLACEHOLDER

  return (
    <div className="chat_task_select" ref={rootRef}>
      {/* 패널이 트리거보다 **먼저** 온다 — 위로 여는 두 겹 중 마크업 층이다(머리주석 ①). */}
      {open && (
        <ul
          id={listId}
          ref={listRef}
          role="listbox"
          tabIndex={-1}
          aria-label={TASK_SELECT_LIST_LABEL}
          aria-activedescendant={optionId(activeIndex)}
          className="chat_task_select_panel"
          onKeyDown={onListKeyDown}
        >
          {TASK_SELECT_OPTIONS.map((opt, i) => (
            <li
              key={opt.value || '__none__'}
              id={optionId(i)}
              role="option"
              aria-selected={opt.value === value}
              className={`chat_task_select_option${i === activeIndex ? ' is_active' : ''}`}
              onMouseEnter={() => setActiveIndex(i)}
              onClick={() => select(opt.value)}
            >
              {opt.label}
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        ref={triggerRef}
        className="chat_task_select_btn"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => (open ? close() : openWith())}
        onKeyDown={(e) => {
          if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
            e.preventDefault()
            openWith()
          }
        }}
      >
        {/* 버튼의 접근명은 눈에 보이는 라벨 그 자체다 — 보이는 글자와 접근명이 갈리면
            음성 안내가 화면과 다른 말을 한다(WCAG 2.5.3). 화살표는 장식이라 alt="". */}
        <span className="chat_task_select_label">{closedLabel}</span>
        <img src={icArrowDown} alt="" className="chat_task_select_arrow" />
      </button>
    </div>
  )
}
