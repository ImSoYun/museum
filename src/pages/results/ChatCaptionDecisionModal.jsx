// 이 파일의 책임: 채팅 폼 턴의 「생성하기」와 실제 생성 사이에 한 단계 끼어드는
// **결정 모달**(피그마 ③ — 화면 중앙 팝업) — **가운데만** 그린다.
//
// 폼 턴(ChatCaptionPanel)과 완료 턴은 대화 **안**의 인라인이고, 이것만 모달이다.
// 그 구분을 흐리면 round07f Task 8이 저지른 실수(산출물생성 페이지 모달을 폼에
// 통째로 베끼기)가 반대 방향으로 되풀이된다.
//
// 위(헤딩·부제)와 아래(타임라인 체크·취소/생성하기)는 CaptionModalShell 이,
// 제목 입력은 CaptionTitleField 가 소유한다 — 산출물생성 모달(CaptionModal)과
// 같은 조각이다. round07f 는 이 둘을 두 벌로 적었고, 그래서 부제 한 줄이
// 「결정하세요.」/「결정해주세요.」로 갈린 채 라이브에 나갔다.
//
// [가운데 순서는 산출물생성과 **다르다**]
// 사용자가 준 피그마 프레임 두 장이 실제로 다르다. 이 화면은
//
//   제목 설정
//   [ 설명문 타이틀 ]
//   선택 자료
//   대화에서 나온 총 N건 자료를 바탕으로 생성하겠습니다.
//   선택 자료는 대화창 상세보기를 통해 수정할 수 있습니다.
//
// 이고 산출물생성은 선택 자료가 먼저이며 그 아래 구분선이 있다. 순서까지 하나로
// 묶으면 프레임과 어긋난다 — 그래서 뼈대는 가운데를 children 으로만 둔다.
//
// [건수 N을 props로 받는 이유]
// 폼에서 ✕로 제외한 것을 **뺀** 남은 건수여야 한다(사용자가 명시적으로 요구했다).
// 제외 상태는 ChatCaptionPanel의 지역 상태라 이 모달이 볼 수 없다 — 그래서 폼이
// 「생성하기」에서 올려 보낸 최종 idnbrs의 길이를 그대로 받는다. 이 모달이 docs를
// 따로 받아 스스로 세면 제외를 모르는 숫자가 되어 20건이라 말하고 17건을 만든다.
import { useEffect } from 'react'
import CaptionModalShell, { useCaptionTitleRule } from './CaptionModalShell.jsx'
import CaptionTitleField from './CaptionTitleField.jsx'
import { defaultOutputTitle } from '../../lib/outputTitles.js'

export default function ChatCaptionDecisionModal({ open, count = 0, onCancel, onConfirm }) {
  // 피그마 기본값은 타임라인 **켜짐**이다(산출물생성은 꺼짐 — 두 모달의 기본값
  // 규칙이 다르다. 뼈대가 상태를 갖지 않는 이유가 이것이다). 제목 기본값도 그
  // 켜짐 상태에 맞춘 값에서 시작한다.
  const { title, setTitle, timeline, changeTimeline, reset } = useCaptionTitleRule({
    defaultTitle: defaultOutputTitle('caption', { timeline: true }),
    defaultTimeline: true,
  })

  // 모달이 열릴 때마다 기본값으로 되돌린다 — 취소하고 다시 열었을 때 지난번 선택이
  // 남아 있으면 「기본 켜짐」이 거짓이 된다. 제목도 함께 되돌린다(날짜가 바뀐 뒤
  // 다시 열면 새 날짜 기준값이어야 한다).
  useEffect(() => {
    if (open) reset(defaultOutputTitle('caption', { timeline: true }), true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const trimmedTitle = title.trim()

  return (
    <CaptionModalShell
      open={open}
      timeline={timeline}
      onTimelineChange={changeTimeline}
      onClose={onCancel}
      submitDisabled={!trimmedTitle}
      onSubmit={() => onConfirm?.({ timeline, title: trimmedTitle })}
    >
      {/* 제목이 먼저다 — 산출물생성과 반대 순서(파일 머리말 참조). */}
      <CaptionTitleField value={title} onChange={setTitle} id="chat-caption-title" />

      <section className="flex flex-col gap-6">
        <p className="text-[13px] font-bold text-ink">선택 자료</p>
        <p className="text-[12.5px] text-[#5A6173]">
          대화에서 나온 총 {count}건 자료를 바탕으로 생성하겠습니다.
        </p>
        {/* 산출물생성처럼 뱃지를 두지 않는다 — 여기서는 자료를 고른 곳이 대화이고,
            고치는 자리도 대화(폼 턴의 「상세보기」)다. */}
        <p className="text-[12.5px] text-[#8A90A2]">
          선택 자료는 대화창 상세보기를 통해 수정할 수 있습니다.
        </p>
      </section>
    </CaptionModalShell>
  )
}
