// 이 파일의 책임: /search/output/:outputId 라우트 본문의 껍데기(round07f) —
// OutputView.jsx와 같은 3층 분업(셸/래퍼/본문)의 래퍼 층이다. 이 화면은 산출물
// 하나만 보는 **독립 페이지**라 output_banner(chat_welcome 재사용)를 얹지 않는다
// — 그 배너는 「검색 결과를 바탕으로」라는 문맥 안내인데 상세 화면은 이미 특정
// 산출물을 열람 중이라 그 문맥이 필요 없다.
import OutputDetailPage from './results/OutputDetailPage.jsx'

export default function OutputDetail() {
  return (
    <div className="result_wrap">
      <OutputDetailPage />
    </div>
  )
}
