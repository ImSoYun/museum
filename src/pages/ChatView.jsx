// 이 파일의 책임: /search/chat 라우트 본문의 껍데기 — 퍼블 ai_chat.html L43-50 의
// result_wrap.ty_chat 래퍼와 chat_welcome 배너를 소유한다. 대화 본체(chat_body:
// chat_topic_bar · chat_thread · chat_input_dock)는 results/ChatTab.jsx 가 소유한다.
//
// 왜 이렇게 쪼개나 — SearchResults 도 자기 result_wrap 을 소유하고 본문 위젯(ResultsTab)만
// 안에 넣는다(D1-5). 같은 결로 두면 셸(SearchFlowLayout)·래퍼(뷰)·본문(탭 컴포넌트)의
// 3층 책임이 세 화면에서 동일해지고, ChatTab 을 그대로 렌더하던 기존 테스트도 계속 유효하다.
//
// chat_welcome 문구는 퍼블 정본 그대로다(제목 L46 · 설명 L47).
import ChatTab from './results/ChatTab.jsx'

export default function ChatView() {
  return (
    <div className="result_wrap ty_chat">
      <div className="chat_welcome">
        <p className="chat_welcome_tit">SA:I가 더 도와드릴까요?</p>
        <p className="chat_welcome_desc">
          검색 결과를 바탕으로 자유롭게 질문하세요 · 모든 답변에 출처 인용
        </p>
      </div>
      <ChatTab />
    </div>
  )
}
