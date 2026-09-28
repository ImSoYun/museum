// 이 파일의 책임: 인트로(홈) 화면 — 히어로 · 검색카드 · 추천질문 3칸 · AI 고지.
// 셸(.intro_wrap > main.intro_main)은 AppShell이 그리므로 여기서는 .intro_content 이하만 그린다.
// .intro_content > * + * { margin-top: 3rem } 이 자식 사이 간격을 일괄 지정하므로
// 개별 자식에 margin-top을 덧붙이지 않는다.
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import IntroHero from '../components/IntroHero.jsx'
import IntroSearchCard from '../components/IntroSearchCard.jsx'
import icChatBot from '../assets/icons/ic_chat_bot.svg'
import icInfo from '../assets/icons/ic_info.svg'
import { useScenario } from '../context/ScenarioContext.jsx'

// round06e §8.1 — publish-v2 예시 질문 3건을 정본 그대로 채택한다(결정 번복 — 이전엔
// 퍼블 문구가 scenarios.js의 keywords에 안 걸려 무매칭 폴백이 되는 실동작 회귀를 막으려고
// scenarios[].query에 바인딩했다). 지금은 economy·independence의 keywords를 보강해
// 같은 문제를 원인에서 막았으므로 카드 문구를 scenarios에 결합할 필요가 없다 — 근거는
// round06e-완료노트.md "Home 추천질문 카드 — scenarios 바인딩 결정 번복" 절 참고.
// Q3는 퍼블 원문이 같은 문장을 2회 반복한 결함이라(§1.4 #4) 1회로 교정했다.
const SUGGESTIONS = [
  { id: 'q-tourism', text: '1970년대 국가 관광 정책에 대해 알려줘' },
  { id: 'q-stalin', text: '이오시프 스탈린 소비에트 연방 총리 기념 케이스의 자료열람과 신청하는 방법을 알려줘.' },
  { id: 'q-democracy', text: '민주화운동에 관련된 자료 찾아줘.' },
]

export default function Home() {
  const nav = useNavigate()
  const { setScenarioByQuery } = useScenario()
  const [q, setQ] = useState('')

  const go = (text) => {
    setScenarioByQuery(text)
    nav('/search/results')
  }

  return (
    <div className="intro_content">
      <IntroHero />

      <IntroSearchCard value={q} onChange={setQ} onSearch={go} />

      <div className="intro_questions">
        <div className="intro_questions_tit">
          <img src={icChatBot} alt="" className="intro_questions_tit_icon" />
          {/* 퍼블은 h2다. 셸의 로고가 h1이므로 페이지 안의 제목은 h2가 맞다(문서 개요 유지). */}
          <h2 className="intro_questions_tit_txt">이런 질문을 할 수 있어요</h2>
        </div>
        <div className="intro_questions_list">
          {/* 퍼블 .intro_question_card에는 강조(활성) 변형이 없다 —
              현행의 hi(=main 시나리오 강조) 분기는 근거가 사라져 함께 걷어낸다. */}
          {SUGGESTIONS.map(({ id, text }) => (
            <button
              key={id}
              type="button"
              className="intro_question_card"
              onClick={() => go(text)}
            >
              {text}
            </button>
          ))}
        </div>
      </div>

      {/* .intro_disclaimer는 일괄 규칙(3rem)을 덮는 margin-top: 4.6rem을 별도로 갖는다(layout.css:132). */}
      <p className="intro_disclaimer">
        <img src={icInfo} alt="" className="intro_disclaimer_icon" />
        AI가 제시하는 정보를 다시 한 번 검증하세요.
      </p>
    </div>
  )
}
