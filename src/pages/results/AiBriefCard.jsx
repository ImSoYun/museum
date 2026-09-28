/**
 * 이 파일의 책임: 검색결과 상단 AI 브리핑 카드(round06f 갈래 B, spec §7.5).
 *
 * 마크업은 퍼블 publish-v2 page/search_result.html L48-90 이식본이다. 두 곳만 다르다.
 *  ① ai_brief_more 의 목적지 — 퍼블은 ai_chat.html, 앱은 라우트 /search/chat.
 *  ② svg.glow_border + rect 12개 — 손으로 옮기지 않고 기존 components/GlowBorder.jsx 를
 *     재사용한다(같은 마크업을 그리고 CSS 도 이미 반입돼 있다, publish-ext.css
 *     [S] glow_border). 두 벌로 적으면 @keyframes 가 파일에 두 번 생겨 조용히 덮어쓴다.
 *
 * round10b B-2(시트 #4, figma-3자대조.md #4) — 제목·태그·설명 세 자리의 문구를
 * 피그마 전용 프레임 `695:92114`(라이브러리 상세 `695:112828`도 같은 문구)로 바꿨다.
 * 예전 코드는 **위치가 뒤바뀌어 있었다** — 설명 자리에 피그마에 없는 검색어 인용문
 * (`'{query}' 검색 결과 요약`)을 스스로 만들어 넣고, 정작 피그마가 그 자리에 두는
 * 고지문(「본 요약은 AI로 생성되었으며, 오류가 있을 수 있습니다.」)은 본문 뒤 하단에
 * 있었다. 중복이 아니라 자리가 바뀐 것이었으므로, 하단 고지를 없애고 그 문구를
 * 설명 자리로 옮긴다 — 새로 만들지 않는다.
 * 필터가 걸렸을 때 설명 자리에 붙던 「· 필터 적용 전 전체 기준」 부기는 없앤다(사용자
 * 결정, 피그마 그대로) — 그래서 이 컴포넌트는 이제 subjects(필터)를 읽지 않는다.
 *
 * 상태 4종은 퍼블에 없는 자체 설계다(§1.4 #5 — 퍼블은 본문이 채워진 완성 상태만 그린다).
 *  · loading → 카드 골격 + 스켈레톤 3줄. 제목·태그·설명(고지문)은 로딩과 무관하게 항상
 *              보인다 — 피그마에서 이 셋은 본문(ai_brief_body)이 아니라 머리글이다.
 *  · ok      → 본문 + 머리글의 고지문
 *  · error   → **렌더하지 않는다**. 브리핑 실패가 검색 결과 화면을 방해하면 안 된다.
 *  · idle    → **렌더하지 않는다**. idle 이 남는 경우는 (a) 검색 전 직접 진입 (b) 새 검색
 *              리셋 직후(이 구간은 SearchResults 의 로딩 스피너가 본문을 덮는다)
 *              (c) 결과 0건이라 트리거가 걸리지 않은 경우이며, 셋 다 카드가 없어야 맞다.
 *
 * 상태를 이 컴포넌트가 갖지 않고 ScenarioContext 에서 읽는 이유는 §7.5 — 탭을 옮겨
 * 언마운트돼도 재호출하면 안 되고(LLM 실비용), 페이지를 넘겨도 유지돼야 하기 때문이다.
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import GlowBorder from '../../components/GlowBorder.jsx'
import { useScenario } from '../../context/ScenarioContext.jsx'
import icAiBriefLogo from '../../assets/icons/ic_ai_brief_logo.svg'
import icInquiry from '../../assets/icons/ic_inquiry.svg'
import icInfoLine from '../../assets/icons/ic_info_line.svg'
import icArrowTop from '../../assets/icons/ic_arrow_top.svg'

const SKELETON_LINES = 3

export default function AiBriefCard() {
  const { brief, briefStatus } = useScenario()
  // 접기 상태는 이 카드 밖에서 쓸 일이 없어 로컬 state 로 둔다(퍼블 기본값도 펼침이다).
  const [expanded, setExpanded] = useState(true)

  if (briefStatus !== 'loading' && briefStatus !== 'ok') return null
  const loading = briefStatus === 'loading'

  return (
    <div className="ai_brief_card">
      <div className="ai_brief_head">
        <div className="ai_brief_logo">
          <img src={icAiBriefLogo} alt="" className="ai_brief_logo_icon" />
        </div>
        <div className="ai_brief_info">
          <p className="ai_brief_tit">SA:I 브리핑
            <span className="ai_brief_tag">검색결과 AI 요약</span>
          </p>
          {/* round10b — 예전엔 하단(ai_brief_notice 자리)에 있던 고지문이다. 피그마는
              이 설명 자리에 둔다(파일 머리 주석 참조) — 아이콘도 문구와 함께 옮겨 왔다. */}
          <p className="ai_brief_desc">
            <img src={icInfoLine} alt="" className="ai_brief_notice_icon" />
            본 요약은 AI로 생성되었으며, 오류가 있을 수 있습니다.
          </p>
        </div>
        <div className="ai_brief_actions">
          <Link to="/search/chat" className="ai_brief_more">
            <GlowBorder />
            <img src={icInquiry} alt="" className="ai_brief_more_icon" />
            SA:I가 더 도와드릴까요?
          </Link>
          <button
            type="button"
            className="ai_brief_toggle"
            aria-expanded={expanded}
            aria-label="SA:I 브리핑 접기/펼치기"
            onClick={() => setExpanded((v) => !v)}
          >
            <img src={icArrowTop} alt="" className="ai_brief_toggle_icon" />
          </button>
        </div>
      </div>

      {expanded && (loading ? (
        // 스켈레톤은 퍼블에 없는 자체 설계라 클래스도 publish-ext.css 소유다.
        // aria-hidden — 읽을 내용이 아직 없으므로 보조기술에 빈 줄 3개를 읽히지 않는다.
        <div className="ai_brief_skeleton" data-testid="ai-brief-skeleton" aria-hidden="true">
          {Array.from({ length: SKELETON_LINES }, (_, i) => <span key={i} />)}
        </div>
      ) : (
        <p className="ai_brief_body">{brief}</p>
      ))}
    </div>
  )
}
