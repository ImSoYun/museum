// 이 파일의 책임: /search(새로운 검색) 화면 — 인트로와 같은 상단 + 최근 검색 기록 목록.
// 상단(히어로 · 검색카드)은 Home과 공용 컴포넌트를 공유한다.
//   근거: 두 파일의 히어로·검색카드가 문자 단위로 같아 퍼블 이식을 두 번 해야 했고,
//         한쪽만 고치면 조용히 어긋난다(round04의 두 트리 수동 동기화와 같은 실패 양상).
// 하단 "최근 검색 기록"은 퍼블이 납품하지 않은 자리다(search_result.html 404).
//   퍼블 근거가 없는 자리를 임의로 디자인하지 않는다 — 현행 디자인을 그대로 둔다.
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import IntroHero from '../components/IntroHero.jsx'
import IntroSearchCard from '../components/IntroSearchCard.jsx'
import { searchHistory } from '../data/searchHistory.js'
import { useScenario } from '../context/ScenarioContext.jsx'

export default function SearchNav() {
  const nav = useNavigate()
  const { setScenarioByQuery } = useScenario()
  const [q, setQ] = useState('')

  const restore = (text) => {
    setScenarioByQuery(text)
    nav('/search/results')
  }

  return (
    // AppShell은 '/'만 .intro_main(가운데 정렬)으로 감싸고 그 밖은 .mng_main이므로
    // 여기서는 좌우 중앙 정렬을 mx-auto로 직접 준다.
    // 현행의 인라인 배경 그라디언트는 제거한다 — 전 화면 공통 배경이 reset 반입분으로 들어와 이중 배경이 된다.
    <div className="intro_content mx-auto">
      <IntroHero />

      <IntroSearchCard value={q} onChange={setQ} onSearch={restore} />

      {searchHistory.length > 0 && (
        // .intro_content는 align-items:center라 자식이 줄어든다 — 목록은 w-full로 폭을 되돌린다.
        <div className="w-full">
          <p className="text-[13px] font-bold text-[#4A5266] mb-[13px]">최근 검색 기록</p>
          <div className="grid grid-cols-1 gap-2">
            {searchHistory.map((h) => (
              <button
                key={h.id}
                type="button"
                onClick={() => restore(h.title)}
                className="w-full flex items-center justify-between bg-white border border-line-soft rounded-xl px-4 py-3 text-left hover:border-primary-300 hover:bg-primary-50 transition-colors"
              >
                <span className="text-sm font-medium text-ink truncate">{h.title}</span>
                <span className="text-xs text-[#8A90A2] ml-4 shrink-0">{h.createdAt}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
