// 이 파일의 책임: 산출물생성 페이지의 설명문 생성 모달 — **가운데만** 그린다.
//
// 위(헤딩·부제)와 아래(타임라인 체크·취소/생성하기)는 CaptionModalShell 이,
// 제목 입력은 CaptionTitleField 가 소유한다. 채팅의 ChatCaptionDecisionModal 과
// 그 두 조각을 함께 쓴다 — round07f 가 두 벌로 적어 문구가 갈렸던 자리다.
//
// [그런데 가운데는 왜 공유하지 않나]
// 사용자가 준 피그마 프레임 두 장의 **가운데 순서가 서로 다르다.** 이 화면은
//
//   선택 자료  [노드명 80 ✕] [노드명 12 ✕]   ← 라벨과 뱃지가 같은 줄
//   ─────────────────────────────────────   ← 구분선(채팅에는 없다)
//   제목 설정
//   [ 설명문 타이틀 ]
//
// 이고 채팅은 제목이 먼저다. 순서까지 하나로 묶으면 프레임과 어긋난다.
//
// [칩을 여기서 만들지 않는 이유]
// 부모(OutputTab)의 selection 을 그대로 받아 그린다. 병행 상태를 두면 모달의 칩과
// 패널의 칩이 갈릴 수 있다 — ExhibitModal 이 같은 이유로 같은 선택을 했다.
//
// [total 을 부모에게서 받는 이유]
// chips[].count 를 여기서 더하면 한 자료가 두 노드에 걸렸을 때 두 번 세어진다
// (ADR-002 F-02 — 중복 노출은 정상). 서버는 중복을 합쳐 만들므로 세는 곳을 부모
// (OutputTab.selectedTotal = new Set(...).size) 하나로 둔다. 이 값은 **생성 가능
// 여부**와 뱃지 줄 끝의 건수 문구, 두 곳에 쓴다.
//
// [건수 문구를 뱃지 줄 끝에 되살린 이유 — 사용자 결정 2026-09-03]
// 이 라운드가 피그마 프레임에 없던 「선택한 자료 N건으로 만듭니다」 배너를 뗐는데,
// 그 N 이 이 화면에서 **유일하게 정직한 숫자**였다. 뱃지 숫자는 노드별 건수라
// 합치면(80 + 12 = 92) 두 노드에 걸친 자료가 두 번 세어지고, 실제로 담기는 것은
// 85건이다. 볼 곳이 사라지면 학예사는 92건을 약속받고 85건을 받는다.
// 그래서 **옛 배너(독립 블록)로 되돌리지 않고** 뱃지 줄 끝에 작게 얹는다 —
// 헤딩·부제·선택 자료·구분선·제목 설정·타임라인·버튼이라는 프레임 순서는 그대로다.
// 문구는 전시자료 모달(ExhibitModal 「선택한 자료 85건이 담깁니다」)과 결을 맞췄고,
// 「(중복 제외)」한 마디로 뱃지 합과 다른 이유를 드러낸다(자세한 사정은 title).
//
// [파일 형식 라디오가 사라진 이유]
// 사용자 결정 2026-09-03 — 설명문은 어디서 만들든 DOCX 다. **화면에서만** 감춘 것이며
// 서버 CreateOutputRequest.format 은 그대로다(호출부 OutputTab 이 'docx' 를 보낸다).
// (round11a — 서버의 hwpx·pdf 렌더러는 이제 **없다**: 사용자 확정으로 DOCX 만
//  남기고 지웠다. 화면은 그 전부터 docx 하나만 보내고 있었으므로 바뀐 것이 없다.)
import { X } from 'lucide-react'
import CaptionModalShell, { useCaptionTitleRule } from './CaptionModalShell.jsx'
import CaptionTitleField from './CaptionTitleField.jsx'

export default function CaptionModal({
  open, chips = [], total = 0, defaultTitle, busy, onClose, onRemoveChip, onOpenChip, onSubmit,
}) {
  // 타임라인 ↔ 제목 연동(round07f I10)은 채팅 모달과 **같은 규칙**이라 뼈대 파일의
  // 훅이 소유한다. 이 화면은 타임라인 **꺼짐**으로 시작한다(채팅은 켜짐).
  const { title, setTitle, timeline, changeTimeline } = useCaptionTitleRule({
    defaultTitle: defaultTitle || '',
  })

  const trimmedTitle = title.trim()

  return (
    <CaptionModalShell
      open={open}
      busy={busy}
      timeline={timeline}
      onTimelineChange={changeTimeline}
      onClose={onClose}
      // round10a T2-B — 뼈대의 100건 상한 판정에 쓴다(부모 selectedTotal 그대로,
      // 중복 제외 — 위 total 선언부 주석 참조). 뼈대는 제목도 선택 자료도 모른다 —
      // 「왜 못 누르는가」는 부모만 안다.
      total={total}
      submitDisabled={!trimmedTitle || total === 0}
      onSubmit={() => onSubmit({ title: trimmedTitle, timeline })}
    >
      {/* 선택 자료 — 라벨과 뱃지가 같은 줄이다(피그마). 부모의 selection 을 그대로
          반영한다. 라벨에 번호를 붙이지 않는다 — 피그마의 빨간 원은 디스크립션
          주석이지 화면 글자가 아니다. */}
      <section className="flex flex-wrap items-center gap-8">
        <p className="text-[13px] font-bold text-ink shrink-0">선택 자료</p>
        {chips.length === 0 ? (
          <p className="text-[12.5px] text-[#8A90A2]">
            선택한 자료가 없습니다 — 노드를 열어 자료를 먼저 고르세요.
          </p>
        ) : (
          <ul className="flex flex-wrap gap-6">
            {chips.map((c) => (
              // 디스크립션 1 「더블 클릭 시 상세모달 오픈, 수정 가능」 — 여는 것은
              // **이 화면이 이미 쓰는 길**(부모의 setSelectedNode → NodeModal)이다.
              // 새 길을 내면 한 화면에서 자료를 여는 방법이 둘로 갈린다(round07f R1).
              // 더블클릭은 마우스 전용이라 Enter/Space 도 같은 자리에 붙인다 —
              // 패널의 node_select_tag 가 쓰는 관행 그대로다(li[role=button] 안의 ✕ 버튼).
              <li
                key={c.nodeId}
                role="button"
                tabIndex={0}
                aria-label={`${c.label} 자료 상세보기`}
                onDoubleClick={() => onOpenChip?.(c.nodeId)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onOpenChip?.(c.nodeId)
                  }
                }}
                className="flex items-center gap-6 h-[30px] pl-3 pr-1.5 rounded-full bg-primary-100 text-primary-600 text-[12.5px] font-semibold cursor-pointer"
              >
                <span>{c.label}</span>
                <span>{c.count}</span>
                <button
                  type="button"
                  aria-label={`${c.label} 선택 해제`}
                  onClick={(e) => {
                    e.stopPropagation()
                    onRemoveChip?.(c.nodeId)
                  }}
                  className="rounded-full p-0.5 hover:bg-primary-500/20"
                >
                  <X size={12} />
                </button>
              </li>
            ))}
          </ul>
        )}
        {/* 실제로 담기는 건수 — 뱃지 합이 아니라 부모가 중복을 합쳐 센 total 이다.
            뱃지 줄 **끝**에 작게 붙여 프레임의 블록 순서를 건드리지 않는다.
            0건일 때는 왼쪽의 「선택한 자료가 없습니다」가 이미 같은 말을 하므로 접는다.
            「(중복 제외)」는 「80 + 12 인데 왜 85지?」를 그 자리에서 푼다 — title 은
            마우스를 올려야 보이므로 그것만 두면 키보드·모바일에 닿지 않는다
            (ExhibitModal 의 별표 + 한 줄 설명과 같은 관행). */}
        {total > 0 && (
          <p
            className="text-[12px] text-[#5A6173] shrink-0"
            title="한 자료가 여러 노드에 걸리면 뱃지에는 노드마다 세어지지만, 실제로는 한 번만 담깁니다."
          >
            선택한 자료 <b className="text-ink">{total}건</b>으로 만듭니다
            <span className="text-[#8A90A2]"> (중복 제외)</span>
          </p>
        )}
      </section>

      {/* 구분선 — 이 화면에만 있다(채팅 프레임에는 없다). */}
      <hr className="border-0 border-t border-line" />

      <CaptionTitleField value={title} onChange={setTitle} />
    </CaptionModalShell>
  )
}
