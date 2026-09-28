// 이 파일의 책임: AI 학예 도우미(대화)에서 만들 수 있는 **작업 종류별 문구**를
// 한 곳에 모은다.
//
// [왜 레지스트리인가]
// round07k 이전에는 설명문 하나뿐이라 문구가 세 파일에 흩어져 있어도 티가 나지
// 않았다 — TaskSelect 의 옵션 라벨, ChatCaptionTurn 의 사용자 버블과 완료 문장,
// ChatCaptionPanel 의 제목과 빈 상태. 특별전시를 더하며 그 셋을 복사하면 종류마다
// 문구가 여섯 벌이 되고, 한쪽만 고치는 사고가 열린다. 이 프로젝트가 반복해서
// 밟은 「같은 산출물이 두 가지를 말한다」가 바로 그것이다.
//
// [「생성」과 「작성」이 다른 것은 오타가 아니다]
// 피그마가 열린 목록 항목은 「…생성」으로, 고른 뒤 닫힌 트리거는 「…작성」으로
// 그려 두었고 사용자가 「피그마 그대로 둘 다」로 결정했다(round07f spec 결정 9).
// 통일하지 말 것 — TaskSelect.test.jsx 가 양방향으로 잠근다.
//
// [빈 상태 문구를 종류마다 따로 쓰는 이유]
// 설명문 문구를 그대로 옮기면 다른 종류 화면이 「설명문은 답변이 근거로 든
// 자료로만 만듭니다」라고 말한다. 문구를 지어내지 않되, 종류 이름은 제 것을 쓴다.
//
// [round10b B-4(시트 #11) — exhibition을 빼고 exhibit을 넣는다]
// 채팅에서 만드는 두 번째 산출물이 바뀌었다 — 사용자 결정(triage #11)으로 「특별
// 전시 자료 작성」(exhibition, docx)을 채팅 작업선택에서 없애고 「학예 기획 자료
// 생성」(exhibit, xlsx)을 그 자리에 넣는다. 서버는 이미 kind='exhibit'을 범용으로
// 처리한다(outputs/routes.py:304) — 새 엔드포인트가 필요 없다. 다만 exhibit는
// columns(엑셀 열 선택)를 요구하므로(routes.py validate_columns), 그 선택 UI는
// 새로 만들지 않고 산출물생성 탭의 ExhibitModal.jsx(같은 컬럼 선택 모달)를
// ChatTab.jsx가 그대로 재사용한다(사용자 결정 — "산출물 생성처럼 똑같이 할거야").
// exhibition(docx, 산출물생성 탭의 ExhibitionModal.jsx가 만드는 특별전시)은 채팅
// 밖에서는 그대로 남는다 — 없어지는 것은 "채팅에서 만드는 경로"뿐이다.

/** @typedef {{
 *   value: string, optionLabel: string, closedLabel: string,
 *   userBubble: string, panelTitle: string,
 *   doneSummary: (count: number) => string,
 *   emptyNoCitation: string, emptyAllExcluded: string,
 * }} ChatTask */

/** 드롭다운·턴이 그리는 순서. 피그마 순서다. */
export const CHAT_TASK_ORDER = ['caption', 'exhibit']

/** @type {Record<string, ChatTask>} */
export const CHAT_TASKS = {
  caption: {
    value: 'caption',
    optionLabel: '설명문 캡션 생성',
    closedLabel: '설명문 캡션 작성',
    userBubble: '설명문 캡션 만들어줘',
    panelTitle: '설명문 캡션 생성',
    doneSummary: (count) => `대화에서 나온 총 ${count}건의 자료를 바탕으로 설명문 캡션 생성`,
    emptyNoCitation:
      '이 대화에는 아직 인용된 자료가 없습니다 — 설명문은 답변이 근거로 든 자료로만 만듭니다. 자료를 인용한 답변이 나온 뒤에 다시 열어 주세요.',
    emptyAllExcluded:
      '참고자료를 모두 제외했습니다 — 한 건이라도 남아야 만들 수 있습니다. 「작업선택」에서 다시 열면 처음 목록으로 시작합니다.',
  },
  // round10b — 라벨은 OutputCard.jsx의 KIND_LABEL.exhibit(「학예 기획 자료」,
  // round10b 개명)과 맞춘다. 「생성」/「작성」이 갈리는 것은 오타가 아니다(파일
  // 머리 주석 참조) — caption과 같은 규칙을 그대로 적용한다.
  exhibit: {
    value: 'exhibit',
    optionLabel: '학예 기획 자료 생성',
    closedLabel: '학예 기획 자료 작성',
    userBubble: '학예 기획 자료 만들어줘',
    panelTitle: '학예 기획 자료 생성',
    doneSummary: (count) => `대화에서 나온 총 ${count}건의 자료를 바탕으로 학예 기획 자료 생성`,
    emptyNoCitation:
      '이 대화에는 아직 인용된 자료가 없습니다 — 학예 기획 자료는 답변이 근거로 든 자료로만 만듭니다. 자료를 인용한 답변이 나온 뒤에 다시 열어 주세요.',
    emptyAllExcluded:
      '참고자료를 모두 제외했습니다 — 한 건이라도 남아야 만들 수 있습니다. 「작업선택」에서 다시 열면 처음 목록으로 시작합니다.',
  },
}
