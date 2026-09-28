// 이 파일의 책임: 퍼블 main.html의 .intro_search_card(안내문 + 검색 박스) 2단을 렌더한다.
// 인트로 전용 컴포넌트로 두는 이유: 전환 화면(/)과 미전환 화면(/search/results)이 검색바를
// 공유하면 스타일이 섞인다(round06e Task7 — 옛 공용 SearchBar.jsx는 고아라 제거했다).
import icSparkle from '../assets/icons/ic_sparkle.svg'
import icSearchBtn from '../assets/icons/ic_search_btn.svg'
import SearchModeToggle from './SearchModeToggle.jsx'

export default function IntroSearchCard({
  value,
  onChange,
  onSearch,
  // 기본 placeholder는 안내문("검색어 입력")이다. 예시 질의를 기본값으로 두면 빈 입력창에도
  // 실제 검색어처럼 보여 사용자가 지우고 써야 해 불편하다(round06d 후속 #2). 실제 예시는
  // 아래 추천질문 카드가 담당하므로 placeholder는 순수 안내로 되돌린다.
  placeholder = '검색어 입력',
}) {
  // round10c Task B1 #20 — 빈 값(또는 공백만)을 제출하면 scenarios.js의 matchScenario가
  // 어떤 키워드에도 안 걸려 hit이 없고, hit || getScenario(MAIN_SCENARIO_ID) 폴백이 타
  // 「민주화운동에 관련된 자료 찾아줘.」가 검색창에 자동으로 채워진다(원인 체인은
  // task-B1-brief.md 참조). 그 폴백 자체는 다른 소비처가 기대하는 의도된 동작이라
  // 건드리지 않고, 대신 「빈 질의를 애초에 보내지 않는다」— SearchFlowLayout.jsx의 자체
  // 검색바(`const text = q.trim(); if (text) { … }`)와 같은 관용구를 여기서도 쓴다.
  const canSubmit = Boolean(value.trim())

  // 제출 경로를 하나로 모은다 — Enter와 버튼 클릭이 같은 함수를 부른다. 버튼은 disabled로
  // 막아도 Enter 경로(아래 onKeyDown이 submit()을 직접 부른다)는 버튼과 무관해 그대로
  // 뚫린다 — 그래서 가드를 함수 자신에 둬 두 경로를 한 번에 막는다.
  const submit = () => {
    // trim 한 값으로 판정했으면 trim 한 값을 보낸다 — 본떴다고 적은 SearchFlowLayout.jsx도
    // `const text = q.trim(); if (text) { … }`로 **trim한 text를 넘긴다**. 원본을 넘기면
    // 「  민주화  」의 앞뒤 공백이 그대로 시나리오 키워드 매칭·서버 질의까지 흘러간다
    // (round10c 전브랜치 리뷰 M7).
    const text = value.trim()
    if (!text) return
    onSearch?.(text)
  }

  return (
    <div className="intro_search_card">
      <div className="intro_search_notice">
        <img src={icSparkle} alt="" className="intro_search_notice_icon" />
        <p className="intro_search_notice_txt">생각하고 있는 연구 주제를 문장 형태로 자유롭게 들려주세요!</p>
      </div>
      {/* 퍼블은 form[method=get]이지만 쿼리스트링 키가 정의돼 있지 않다.
          React는 onSubmit으로 처리하므로 input에 name을 임의로 만들어 붙이지 않는다. */}
      <form
        className="intro_search_box"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <SearchModeToggle />
        <label className="sr_only" htmlFor="intro_search_input">검색어 입력</label>
        <input
          type="search"
          id="intro_search_input"
          className="intro_search_input"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          // Enter를 직접 처리하는 이유 둘:
          //   ① jsdom은 브라우저의 암묵 제출을 재현하지 않아 이 핸들러가 없으면 Enter 경로가 테스트되지 않는다.
          //   ② 실브라우저에서는 keydown과 암묵 제출이 겹쳐 onSearch가 두 번 불린다.
          //      preventDefault로 암묵 제출을 막아 어느 환경에서도 정확히 한 번만 불리게 한다.
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return
            e.preventDefault()
            submit()
          }}
        />
        {/* ⚠️ disabled에 회색·흐림 스타일을 새로 달지 않는다(round10a·round10b에서 두 번
            되돌린 지점 — 사용자 지시 「회색으로 하지말고 그대로 하는데 버튼만
            안눌러지는 식으로」). publish-ext.css의 .btn:disabled는 .btn 클래스를
            요구하는데 이 버튼엔 .intro_search_btn 하나뿐이라 걸리지 않아, 아무것도
            안 해도 publish/layout.css의 남색(#283483)이 그대로 유지된다. */}
        <button type="submit" className="intro_search_btn" aria-label="검색" disabled={!canSubmit}>
          <img src={icSearchBtn} alt="" className="intro_search_btn_icon" />
        </button>
      </form>
    </div>
  )
}
