// 이 파일의 책임: /search/output 라우트 본문의 껍데기 — 퍼블 output_node.html L46-53의
// result_wrap(ty_chat 아님) 래퍼와 output_banner(챗 안내배너와 동일 컴포넌트 재사용,
// 퍼블 주석 L48)를 소유한다. 본문(node_view·node_select_panel + 산출물 목록 OutputList)은
// results/OutputTab.jsx가 소유한다 — 세 번째 패널이었던 node_result_panel(생성 결과 예시
// 초안)은 피그마 디스크립션에 없던 데모라 round07b-ext task-11이 걷어내고 그 자리를
// 진짜 산출물 목록으로 대신했다(OutputTab.jsx 자체 주석 참조).
//
// 왜 이렇게 쪼개나 — ChatView.jsx가 자기 result_wrap과 chat_welcome을 소유하고 본문(ChatTab)만
// 안에 넣는 것과 동형 패턴이다(D1-6). 같은 결로 두면 셸(SearchFlowLayout)·래퍼(뷰)·본문(탭
// 컴포넌트)의 3층 책임이 화면마다 동일해진다.
//
// output_banner는 chat_welcome을 그대로 재사용한다 — 퍼블이 "챗 안내배너와 동일 컴포넌트
// 재사용"이라 주석으로 명시했고(L48) CSS도 D1-6이 이미 반입해 두었다. 그래서 result_wrap에
// ty_chat을 붙이지 않는다(챗 전용 sticky 입력 도크 패딩 보정은 이 화면에 필요 없다).
import OutputTab from './results/OutputTab.jsx'

export default function OutputView() {
  return (
    <div className="result_wrap">
      <div className="chat_welcome">
        <p className="chat_welcome_tit">학예 산출물 생성</p>
        <p className="chat_welcome_desc">검색 자료를 기반으로 학예 산출물을 작성합니다</p>
      </div>
      <OutputTab />
    </div>
  )
}
