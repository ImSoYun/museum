// 이 파일의 책임: 채팅 탭(AI 학예 도우미) 안 「설명문 캡션 생성」 폼 턴의 본문 —
// 피그마 695:100384 프레임의 `Frame 2087328269`(반짝이 + 설명문 캡션 생성 + 참고자료
// 카드 + 생성하기).
//
// ── round07f 연장 — 폼에서 세 컨트롤을 걷어냈다 ─────────────────────────────
// round07f Task 8은 이 폼을 산출물생성 페이지 모달(CaptionModal)에서 그대로 베껴
// 제목 입력 · 타임라인 체크박스 · 파일형식 라디오 3종을 그렸다. **피그마에는 셋 다
// 없다.** 대신 「생성하기」를 누르면 결정 모달(ChatCaptionDecisionModal)이 한 단계
// 더 뜨고, 거기서 타임라인만 정한다. 제목과 파일형식은 코드가 정한다(ChatTab.jsx).
// 그래서 이 컴포넌트는 이제 「참고자료를 보여 주고, 뺄 것을 빼고, 생성을 요청한다」
// 하나만 한다.
//
// [산출물생성 탭 모달과 재료가 다르다]
// CaptionModal은 노드에서 고른 「선택 자료」를 받는다. 이 패널은 그게 아니라
// **대화 이력의 출처자료 전부**를 받는다(상한 없음 — 결정 9, spec §2). 같은 자료가
// 여러 턴에 걸쳐 인용되는 것은 정상이므로 idnbr로 중복을 제거한다(등장 순서 보존,
// 첫 등장만 남긴다) — 배선(ChatTab.jsx)은 중복 제거를 하지 않고 그대로 모아 넘기고,
// 이 컴포넌트가 유일하게 중복을 제거하는 자리다.
//
// [✕ 제외를 저장하지 않는 이유]
// 제외는 **이번 생성 요청에만** 반영된다(결정 10). useState(Set)로만 두고 어디에도
// 저장하지 않는다 — 대화 기록(grounded_docs) 자체를 건드리면, 이미 나간 답변이
// 본문에서 인용한 [2]번 같은 번호가 가리키는 자료가 사라져 인용이 깨진다. 그건
// 되돌릴 수 없는 손상이라, 제외는 항상 지역 상태로만 존재하고 패널이 다시
// 마운트되면(대화 탭을 떠났다 돌아오는 등) 자연히 초기화된다.
//
// [제외한 줄을 취소선으로 남기지 않고 목록에서 빼는 이유]
// 피그마 목록에는 제외된 줄이 없고, 각 줄에 1부터의 번호 뱃지가 붙는다. 취소선으로
// 남기면 번호가 「3, 5, 6…」처럼 비고, 「총 N건」과 목록 길이도 어긋난다. 그래서
// 제외 = 목록에서 빠짐이고, 번호는 남은 것 기준으로 다시 매긴다.
//
// [round07k — 이 패널은 이제 설명문 전용이 아니다]
// 작업 종류를 `task` prop 으로 받아 제목·빈 상태 문구를 거기서 읽는다. 종류별
// 문구의 출처는 pages/results/chatTasks.js 한 곳이다. **파일명은 그대로 두었다**
// — 개명하면 이 변경의 diff 가 「이동 + 수정」으로 섞여 읽기 어려워진다. 개명이
// 필요해지면 별도 커밋으로 한다.
import { useMemo, useState } from 'react'
import { ChevronDown, FileText, X } from 'lucide-react'
import icSparkle from '../../assets/icons/ic_sparkle.svg'

/** docs를 idnbr 기준으로 중복 제거한다 — 첫 등장 순서를 그대로 유지한다. */
function dedupeByIdnbr(docs) {
  const seen = new Set()
  const out = []
  for (const d of docs || []) {
    if (!d || !d.idnbr || seen.has(d.idnbr)) continue
    seen.add(d.idnbr)
    out.push(d)
  }
  return out
}

/**
 * ChatCaptionPanel — 폼 턴 본문.
 *
 * props
 *   task              ChatTask         필수. 제목·빈 상태 문구의 출처(chatTasks.js)
 *   docs              [{idnbr, name}]  대화 이력의 출처자료(중복 포함)
 *   busy              boolean          생성 요청이 도는 중
 *   readOnly          boolean          이 폼으로 이미 만들었다 — 다시 만들 수 없다
 *   onRequestGenerate ({idnbrs}) => {} 「생성하기」 — **바로 만들지 않는다.**
 *                                      결정 모달을 여는 요청이다(피그마 ③).
 *   onOpenDetail      (doc) => {}      자료명 클릭 → 자료상세
 *
 * [onSubmit이 아니라 onRequestGenerate인 이유]
 * 이 버튼은 이제 생성을 **시작하지 않는다** — 결정 모달을 띄우고, 실제 생성은 그
 * 모달의 「생성하기」가 한다. 이름이 onSubmit이면 읽는 사람이 여기서 POST가 나간다고
 * 오해한다.
 */
export default function ChatCaptionPanel({
  task, docs = [], busy, readOnly = false, onRequestGenerate, onOpenDetail,
}) {
  const uniqueDocs = useMemo(() => dedupeByIdnbr(docs), [docs])
  const [expanded, setExpanded] = useState(false)
  // ✕ 제외 — 위 파일 주석 참조. 저장하지 않는 지역 상태다.
  const [excludedIds, setExcludedIds] = useState(() => new Set())

  // 화면에 그리는 목록도, 「총 N건」도, 요청에 싣는 idnbrs도 전부 이 하나에서 나온다.
  // 셋이 갈리면 모달이 20건이라 말하고 17건을 만드는 일이 생긴다.
  const remainingDocs = uniqueDocs.filter((d) => !excludedIds.has(d.idnbr))
  const canSubmit = remainingDocs.length > 0 && !busy && !readOnly

  const exclude = (idnbr) =>
    setExcludedIds((prev) => {
      const next = new Set(prev)
      next.add(idnbr)
      return next
    })

  const requestGenerate = () => {
    if (!canSubmit) return
    onRequestGenerate?.({ idnbrs: remainingDocs.map((d) => d.idnbr) })
  }

  return (
    <section className="flex w-full flex-col gap-12">
      <p className="flex items-center gap-6 text-[13px] font-bold text-ink">
        <img src={icSparkle} alt="" className="w-16 h-16 shrink-0" />
        {task.panelTitle}
      </p>

      <div className="flex flex-col gap-8 rounded-[12px] border border-[#E2E5EE] bg-white p-12">
        <p className="text-[12.5px] font-bold text-ink">참고자료</p>

        {/* 피그마 원문 그대로의 건수 문구. **0건일 때만** 다른 말을 한다 —
            「총 0건 자료를 바탕으로 생성하겠습니다」는 생성이 되지 않는데도 되는 것처럼
            말하고, 그 아래 「생성하기」는 사유 없이 비활성이라 사용자가 왜 못 만드는지
            알 길이 없었다(round07g 최종 리뷰 Minor-4). 이 레포의 빈 상태 관행대로
            「사실 — 다음 행동」으로 적고, 두 사유를 가른다: 인용이 애초에 없었는가,
            내가 전부 뺐는가. 둘의 다음 행동이 서로 다르다. */}
        <p className="flex items-start gap-6 text-[12.5px] text-[#5A6173]">
          <FileText size={14} aria-hidden="true" className="mt-1 shrink-0" />
          {remainingDocs.length > 0
            ? `대화에서 나온 총 ${remainingDocs.length}건 자료를 바탕으로 생성하겠습니다.`
            : uniqueDocs.length === 0
              ? task.emptyNoCitation
              : task.emptyAllExcluded}
        </p>

        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
          className="flex w-full items-center justify-center gap-4 rounded-[9px] border border-[#E2E5EE] bg-white py-8 text-[12.5px] text-[#5A6173]"
        >
          상세보기
          <ChevronDown size={14} aria-hidden="true" className={expanded ? 'rotate-180' : ''} />
        </button>

        {expanded && (
          // 피그마에 스크롤바가 그려져 있다 — 대화 이력이 길면 자료가 수십 건이다.
          <ul className="flex flex-col gap-6 max-h-[240px] overflow-y-auto">
            {remainingDocs.map((d, i) => (
              <li
                key={d.idnbr}
                className="flex items-center gap-8 rounded-[9px] bg-[#F7F9FC] px-10 py-8 text-[12.5px]"
              >
                {/* 번호 뱃지 — 남은 것 기준 1부터. 제외하면 뒤 번호가 당겨진다. */}
                <span className="flex h-18 w-18 shrink-0 items-center justify-center rounded-full bg-[#E2E8F8] text-[11px] font-bold text-[#3B5BDB]">
                  {i + 1}
                </span>
                {/* round07f — 자료명을 누르면 자료상세를 연다(대조표 §4).
                    같은 화면의 인용칩이 이미 MaterialModal을 연다(ChatTab.handleChip) —
                    한 화면에서 자료를 여는 길이 둘로 갈리지 않도록 기존 동작에 맞춘다.
                    idnbr을 보조 텍스트로 함께 그리는 이유: 이 아카이브의 자료명은
                    「사진」·「포스터」처럼 일반적이라(spec §4.2 실측) 동명 자료 두 건이
                    인용되면 idnbr 없이는 구분할 수 없다. */}
                <span className="flex min-w-0 flex-1 flex-wrap items-center gap-6 text-[#1A1F2B]">
                  <button
                    type="button"
                    className="hover:underline"
                    onClick={() => onOpenDetail?.({ id: d.idnbr, title: d.name, image: null })}
                  >
                    {d.name}
                  </button>
                  <span className="text-[#8A90A2]">{d.idnbr}</span>
                </span>
                <button
                  type="button"
                  aria-label={`${d.name} ${d.idnbr} 제외`}
                  disabled={readOnly}
                  onClick={() => exclude(d.idnbr)}
                  className="shrink-0 rounded-full p-2 hover:bg-[#E2E5EE] disabled:opacity-40"
                >
                  <X size={12} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 피그마의 전폭 파랑 버튼. 여기서 생성이 시작되지 않는다 — 결정 모달이 뜬다. */}
      <button
        type="button"
        className="btn btn_md btn_primary w-full"
        disabled={!canSubmit}
        onClick={requestGenerate}
      >
        {busy ? '만드는 중…' : '생성하기'}
      </button>
    </section>
  )
}
