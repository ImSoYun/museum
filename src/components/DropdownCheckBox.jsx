/**
 * 이 파일의 책임: 퍼블 dropdown_box ty_check(publish-v2 page/search_result.html L120-154)를
 * React로 옮긴 다중선택 드롭다운(round06f 갈래 D, spec §9.4.1).
 *
 * 상태를 갖지 않는 **제어 컴포넌트**다 — 선택값의 소유자는 ScenarioContext 이고(필터를 바꾸면
 * 서버 재조회가 따라야 하므로), 이 컴포넌트는 열림 여부만 로컬로 들고 있다.
 *
 * 옵션 어휘는 퍼블과 다르다(§1.4 #8). 퍼블은 매체형식 축 4종(이미지·도서·웹콘텐츠·영상)을
 * 예시로 박아 두었지만 앱 실데이터의 분류는 그보다 세분화된 축이라, 4종에 접으면 상당수가
 * 폴백되거나 특정 항목이 0건으로 사라진다(R6F-18). 그래서 옵션은 서버가 준 facets(round07d부터
 * facets.subject — 고정 6개, 0건 포함)를 값+건수 그대로 그린다 — 마크업·CSS·상호작용만 퍼블을
 * 따른다. 이 컴포넌트 자신은 어느 축인지 모른다 — label·options는 호출부가 정한다.
 *
 * 체크박스는 이미 반입된 form_check.ty_02 자산을 그대로 쓴다. 다만 **label 에만**
 * form_check_label 클래스를 붙인다(§9.4 예외 1건) — 이번에 이식하는 퍼블 규칙
 * .dropdown_box_list.ty_check .form_check .form_check_label 이 이 클래스를 요구하는데
 * 앱의 .form_check.ty_02 에는 폰트 규칙이 없기 때문이다. input 에는 클래스를 붙이지 않는다 —
 * 앱 CSS 가 input[type=checkbox]:checked + label:before 라는 인접 형제 결합자로 동작하며
 * 클래스 없이도 그대로 걸린다(요소 선택자 유지 관행).
 *
 * 닫힘 처리(바깥클릭 mousedown · Esc + 포커스 복귀)는 DropdownMenu.jsx·SearchModeToggle.jsx가
 * 이미 쓰는 패턴을 그대로 따른다 — 새 방식을 만들지 않는다.
 */
import { Fragment, useEffect, useId, useRef, useState } from 'react'
import icArrowDownWhite from '../assets/icons/ic_arrow_down_white.svg'
import icArrowTop from '../assets/icons/ic_arrow_top.svg'

export default function DropdownCheckBox({ label, options, selected, onChange }) {
  const [open, setOpen] = useState(false)
  const uid = useId()
  const panelId = `${uid}-panel`
  const rootRef = useRef(null)
  const triggerRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    function onDocMouseDown(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [open])

  const close = () => {
    setOpen(false)
    triggerRef.current?.focus()
  }

  const chosen = options.filter((o) => selected.includes(o.value))

  // round07k ② — 트리거 문구. 규칙은 spec §2 표가 정본이다:
  //   0개  전체
  //   1개  정치행정         ← 건수 없이
  //   2개+ 정치행정 외 3개  ← 건수 없이
  //
  // 피그마 일관성(사용자 확정 2026-09-10). 접힌 상태(2개+)에 건수가 없으므로
  // 펼친 상태(1개)에서도 건수를 뺀다. 그 결과 화면과 접근명이 동일 규칙을 따르게 된다.
  //
  // 접근명에는 고른 값을 **전부** 남긴다 — 접는 것은 폭 문제이지 정보를 버리자는
  // 것이 아니다. 화면만 줄이고 스크린리더는 전체를 읽게 한다.
  const collapsed = chosen.length >= 2
  const triggerAriaLabel = chosen.length === 0
    ? `${label} 전체`
    : `${label} ${chosen.map((o) => o.value).join(', ')}`

  const toggleOne = (value, checked) => {
    onChange(checked ? [...selected, value] : selected.filter((v) => v !== value))
  }

  return (
    <div className="dropdown_box ty_labeled ty_filled" ref={rootRef}>
      <button
        type="button"
        ref={triggerRef}
        data-testid="dropdown-trigger"
        className="dropdown_box_trigger"
        aria-expanded={open}
        aria-haspopup="true"
        aria-controls={panelId}
        aria-label={triggerAriaLabel}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="dropdown_box_label">{label}</span>
        <span className="dropdown_box_value">
          {chosen.length === 0 ? '전체' : collapsed ? (
            <>
              <b className="dropdown_box_value_group">{chosen[0].value}</b>{' '}
              외 {chosen.length - 1}개
            </>
          ) : (
            <b className="dropdown_box_value_group">{chosen[0].value}</b>
          )}
        </span>
        <img src={icArrowDownWhite} alt="" className="dropdown_box_arrow" />
      </button>

      {/* 패널은 항상 DOM 에 두고 hidden 으로만 감춘다 — 퍼블이 그렇고
          (.dropdown_box_panel[hidden] { display: none }), 조건부 렌더로 바꾸면 그 규칙이
          죽은 CSS 가 된다. Esc 는 패널 안 어디서 눌러도 잡히도록 여기에 건다. */}
      <div
        id={panelId}
        data-testid="dropdown-panel"
        className="dropdown_box_panel"
        hidden={!open}
        onKeyDown={(e) => { if (e.key === 'Escape') close() }}
      >
        <button
          type="button"
          data-testid="dropdown-panel-head"
          className="dropdown_box_panel_head"
          onClick={close}
        >
          <span className="dropdown_box_label">{label}</span>
          <img src={icArrowTop} alt="" className="dropdown_box_arrow" />
        </button>

        <div className="dropdown_box_list ty_check" role="group" aria-label={`${label}(다중 선택 가능)`}>
          {/* '전체'는 별도 값이 아니라 "개별 선택 없음"의 표현이다 — 체크 상태는 파생이고
              누르면 선택을 통째로 비운다(spec §9.4.1(d)의 의도적 결정). 퍼블 js/common.js 의
              '전체'는 반대로 마스터 select-all 토글(전 항목 체크)이지만, 필터 의미론에서는
              "전 항목(주제 축, round07d부터 6종) 전부 선택"과 "무필터"의 결과가 같으므로
              spec 이 단순한 쪽(비우기=무필터)을 택했다 — 마크업(퍼블 L133-135)만 따르고
              동작은 따르지 않는 예외다.
              이미 비어 있으면 그대로 [] 를 보내 무해하게 끝난다(불필요한 재조회는 부모가
              판단할 몫이 아니다 — 서버 랭킹 캐시가 적중하므로 비용이 사실상 0이다). */}
          <div className="form_check ty_02">
            <input
              type="checkbox"
              id={`${uid}-all`}
              checked={selected.length === 0}
              onChange={() => onChange([])}
            />
            <label className="form_check_label" htmlFor={`${uid}-all`}>전체</label>
          </div>

          {options.map((o, i) => (
            <div className="form_check ty_02" key={o.value}>
              <input
                type="checkbox"
                id={`${uid}-opt-${i}`}
                aria-label={o.value}
                checked={selected.includes(o.value)}
                onChange={(e) => toggleOne(o.value, e.target.checked)}
              />
              <label className="form_check_label" htmlFor={`${uid}-opt-${i}`}>
                {o.value} {o.count}
              </label>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
