// 이 파일의 책임: 설명문 생성 모달의 **뼈대** — 두 모달이 공유해야 하는 위(헤딩·
// 부제)와 아래(타임라인 체크·취소/생성하기)를 소유한다.
//
// [왜 뼈대를 따로 두는가]
// 설명문을 만드는 자리가 둘이다 — 산출물생성 페이지(CaptionModal)와 AI 학예 도우미
// 채팅(ChatCaptionDecisionModal). round07f 가 채팅 폼을 만들 때 피그마 대신 옆 화면을
// 베꼈고, 그래서 부제 한 줄이 「결정하세요.」/「결정해주세요.」로 갈린 채 라이브에
// 나갔다. 두 벌로 두면 또 갈라진다.
//
// [뼈대가 소유하지 **않는** 것 — 가운데]
// 사용자가 준 피그마 프레임 두 장은 가운데 순서가 **서로 다르다**:
//
//   [채팅]                     [산출물생성]
//   설명문 생성                 설명문 생성          ← 뼈대
//   설명문 캡션 제작을 위해…     설명문 캡션 제작을…   ← 뼈대
//   제목 설정                   선택 자료 [뱃지][뱃지]
//   [ 설명문 타이틀 ]           ─────────────────    ← 구분선(산출물생성에만)
//   선택 자료                   제목 설정
//   대화에서 나온 총 N건…        [ 설명문 타이틀 ]
//   ☑ 타임라인 생성             ☑ 타임라인 생성       ← 뼈대
//   [취소] [생성하기]           [취소] [생성하기]     ← 뼈대
//
// 그래서 가운데는 children 슬롯이다. 여기서 순서를 정해 버리면 두 프레임 중
// 하나와 반드시 어긋난다.
//
// [뼈대가 상태를 갖지 않는 이유]
// 제목·타임라인의 **기본값 규칙**이 두 모달에서 다르다(산출물생성=타임라인 꺼짐으로
// 시작, 채팅=켜짐으로 시작하고 다시 열 때마다 되돌린다). 뼈대가 상태를 쥐면 그
// 차이를 prop 분기로 흡수해야 하고, 분기가 늘면 결국 두 벌이 된다. 뼈대는 그리기만
// 하고 값과 변경은 위에서 내려온다.
import { useRef, useState } from 'react'
import Modal from '../../components/Modal.jsx'
import { defaultOutputTitle } from '../../lib/outputTitles.js'

// round10a T2-B — 설명문 자료 상한. 라이브 실측:
//   40건(설명문)              15초  201
//   175건(설명문+타임라인)     73초  502 Proxy Error  ← 노드 「전체 선택」 한 번으로도 나온다
// 특별전시는 MAX_EXHIBITION_ARTIFACTS(30, ExhibitionModal.jsx)로 막는데 설명문은 상한이
// 없어 언제든 다시 걸린다. 측정이 거의 선형이라 60초 선이 약 150건 — 여유를 두어
// 100건에서 막는다. 경고 문구·판정은 ExhibitionModal.jsx:120-125 와 같은 자리·같은
// 어휘로 맞춘다.
//
// 뼈대(CaptionModalShell)에 두는 이유 — 이 상한은 **두 제출 경로가 함께 지켜야 하는
// 규칙**이라서다(파일 머리말 「뼈대를 따로 두는 이유」와 같은 논리: 두 벌로 적으면
// 언젠가 갈라진다). 채팅 모달(ChatCaptionDecisionModal)은 아직 total을 넘기지 않는다
// (기본값 0 = 상한 걱정 없음) — 그 경로의 건수는 이번 라이브 실측(노드 「전체 선택」)의
// 대상이 아니었다.
export const MAX_CAPTION_ARTIFACTS = 100

export default function CaptionModalShell({
  open,
  busy = false,
  timeline = false,
  onTimelineChange,
  onClose,
  onSubmit,
  // 부모만 아는 사정(제목이 비었다 / 산출물생성의 선택 자료 0건)을 뼈대에 알리는
  // 통로. 뼈대는 제목을 갖지 않으므로 스스로 판정할 수 없다.
  submitDisabled = false,
  // round10a T2-B — 자료 총건수(중복 제외, 부모의 selectedTotal). 상한 경고·제출
  // 잠금 판정에만 쓴다.
  total = 0,
  children,
}) {
  const overLimit = total > MAX_CAPTION_ARTIFACTS

  return (
    <Modal
      open={open}
      title="설명문 생성"
      onClose={onClose}
      size="sm"
      footer={
        <>
          {/* 취소는 **모달만** 닫는다 — 채팅에서는 폼 턴이 대화에 그대로 남아
              다시 누를 수 있어야 한다. */}
          <button type="button" onClick={onClose} className="btn btn_md btn_gray flex-1">
            취소
          </button>
          <button
            type="button"
            disabled={submitDisabled || busy || overLimit}
            onClick={() => onSubmit?.()}
            className="btn btn_md btn_primary flex-1"
          >
            {busy ? '만드는 중…' : '생성하기'}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-16">
        <p className="text-[13px] text-[#5A6173]">
          설명문 캡션 제작을 위해 아래 몇가지 사항을 결정해주세요.
        </p>

        {/* 가운데 — 순서는 각 모달이 정한다(파일 머리말의 두 프레임 그림 참조). */}
        {children}

        <section className="flex flex-col gap-6">
          <label className="flex items-center gap-8 text-[13px] font-bold text-ink cursor-pointer">
            <input
              type="checkbox"
              checked={timeline}
              onChange={(e) => onTimelineChange?.(e.target.checked)}
            />
            타임라인 생성
          </label>
          <p className="text-[12.5px] text-[#5A6173]">선택된 자료들로 타임라인이 생성됩니다.</p>
        </section>

        {/* round10a T2-B — 누르고 나서가 아니라 **미리** 말한다(라이브 실측: 502가 난
            뒤에야 서버 사유가 토스트로 왔다). ExhibitionModal.jsx:120-125 와 같은
            자리(입력 아래·버튼 위)·같은 어투다. */}
        {overLimit && (
          <p className="text-[12.5px] text-red-600">
            설명문은 한 번에 자료 <b>{MAX_CAPTION_ARTIFACTS}건</b>까지 담을 수 있습니다 —{' '}
            {total - MAX_CAPTION_ARTIFACTS}건을 덜어 주세요.
          </p>
        )}
      </div>
    </Modal>
  )
}

/** 제목·타임라인 상태와, **두 모달이 똑같이 지켜야 하는 연동 규칙**(round07f I10).
 *
 * 규칙: 타임라인 체크를 켜고 끄면 제목이 `defaultOutputTitle('caption',{timeline})`을
 * 따라간다. 단 **지금 화면의 제목이 우리가 마지막으로 자동으로 채워 넣은 값과 같을
 * 때만**이다 — 학예사가 이미 고쳐 놓은 제목을 체크박스 하나로 덮어쓰면 입력을
 * 빼앗는 셈이라 spec §2 결정 4(「입력 유지 + 기본값만 개선」)와 어긋난다.
 *
 * `autoTitleRef` 가 그 「마지막 자동값」이고, 시작값은 부모가 준 `defaultTitle` 이다.
 * (round07f 리뷰 Minor 1 — 예전에는 `defaultOutputTitle('caption')`을 매번 다시
 * 계산해 비교했다. 그러면 다른 defaultTitle 을 넘긴 호출부에서 규칙이 아무 신호
 * 없이 죽는다. 진실 원천을 defaultTitle 하나로 합친 것이 이 ref 다.)
 *
 * [왜 뼈대 파일에 있나]
 * 이 연동을 일으키는 컨트롤(타임라인 체크박스)이 뼈대의 것이기 때문이다. 규칙 자체는
 * 두 모달이 **같아야** 하는 것이라, 각 모달에 열 줄씩 두 벌로 적으면 이 파일이
 * 막으려는 바로 그 갈라짐이 다시 난다. 상태 자체는 훅을 부르는 부모에 남으므로
 * 위 「뼈대가 상태를 갖지 않는다」와 어긋나지 않는다.
 */
export function useCaptionTitleRule({ defaultTitle = '', defaultTimeline = false } = {}) {
  const [title, setTitle] = useState(defaultTitle)
  const [timeline, setTimeline] = useState(defaultTimeline)
  const autoTitleRef = useRef(defaultTitle)

  const changeTimeline = (next) => {
    setTimeline(next)
    // 판정과 ref 갱신을 setTitle **바깥**에서 한다. round07f 원본은 이 둘을
    // setTitle 의 updater 안에서 했는데, updater 는 순수해야 한다 — React 는 그것을
    // **한 번만** 부른다고 보장하지 않는다(같은 dispatch 를 eager 계산과 렌더에서
    // 두 번 실행할 수 있다). 두 번째 실행은 이미 바뀐 autoTitleRef 를 보고 「학예사가
    // 고쳤다」로 오판해 제목을 그대로 두었다.
    //
    // 산출물생성 모달만 있던 동안에는 드러나지 않았다. 채팅 모달이 「다시 열면
    // 기본값으로 되돌린다」 효과(reset)를 더하자 곧바로 재현됐다 — 타임라인을 꺼도
    // 제목이 「설명문 캡션 + 타임라인_YYMMDD」에 그대로 붙어 있었다.
    // (실측 로그: updater 가 두 번 불렸고 두 번째의 ref 가 이미 새 값이었다.)
    //
    // 동작은 그대로다. `title` 은 이 렌더의 값이고, 체크박스 한 번에 핸들러가 한 번
    // 도므로 updater 안에서 보던 `cur` 과 같은 값이다.
    if (title !== autoTitleRef.current) return // 학예사가 이미 고쳤다 — 건드리지 않는다.
    const nextDefault = defaultOutputTitle('caption', { timeline: next })
    autoTitleRef.current = nextDefault
    setTitle(nextDefault)
  }

  /** 모달을 다시 열 때 기본값으로 되돌린다(채팅 모달이 쓴다) — 「기본 켜짐」이
   *  지난번 선택 때문에 거짓이 되지 않게. 자동값 기준도 함께 되돌려야 그 뒤의
   *  연동이 새 제목을 기준으로 판정한다. */
  const reset = (nextTitle = defaultTitle, nextTimeline = defaultTimeline) => {
    setTitle(nextTitle)
    setTimeline(nextTimeline)
    autoTitleRef.current = nextTitle
  }

  return { title, setTitle, timeline, changeTimeline, reset }
}
