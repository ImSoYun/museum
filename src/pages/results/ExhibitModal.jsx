// 이 파일의 책임: 전시자료 생성 모달(화면 제목 「학예 기획 자료 목록」).
//
// round07b-ext task-8 — 피그마를 보지 않고 만들었던 이전 버전을 전면 재작성한다.
// 바뀐 것 셋:
//   1) 칩은 이제 count 정수 하나가 아니라 `chips: [{ nodeId, label, count }]` 다 —
//      OutputTab의 selection 상태(선택 자료 패널의 칩과 **같은 소스**)를 그대로
//      받아 그린다. 여기서 새 선택 상태를 만들지 않는다 — 병행 상태를 두면 모달의
//      칩과 패널의 칩이 갈릴 수 있다. 제거(✕)도 onRemoveChip으로 부모에 위임한다.
//   2) ~~타임라인 생성 체크박스를 추가했다~~ — **round07e 에서 제거했다**(아래 참조).
//   3) 기본 선택 컬럼을 6개(상세설명 제외)에서 **7개 전부**로 바꿨다 — 피그마
//      목업은 5개만 파랑이지만 그건 목업 상태의 스냅샷일 뿐이다.
//
// [2026-09-01 — 칩을 7개에서 15개로 늘렸다]
// 사용자 결정: 「저 메타를 다 넣을거야, 추후 데이터만 추가하면 되니까」. 표시
// 가치가 있는 메타를 **전부** 고를 수 있게 하고, 지금 비어 있는 열도 데이터가
// 채워지면 그대로 살아나게 둔다.
//
// 그래서 **전체 목록과 기본 선택을 갈랐다.** 여섯(이명칭·재질·국적·크기·사진·
// OCR)은 archive 원천에서 0%다 — 그 원천이 185,073건으로 가장 크므로 켜 두면
// 학예사가 빈 열만 받는다. 고를 수는 있게 두되 **기본은 꺼 둔다.** 꺼진 칩에는
// 어느 원천에서 비는지를 title 로 붙여, 골랐다가 빈 열을 보고 「데이터가 없다」고
// 오해하지 않게 한다(코딩표준 §6 침묵의 실패 금지의 UI 판).
//
// [컬럼 목록을 프론트가 정의하는 이유와, 그럼에도 서버가 다시 검증하는 이유]
// 목록 자체는 표시용이라 여기 둔다. 그러나 **정본은 서버**(outputs/columns.py)이며
// 서버가 알 수 없는 컬럼을 422로 거부한다 — 두 목록이 갈라져도 조용히 빈 열이
// 생기지 않고 사용자에게 사유가 보인다.
// [2026-09-02 round07e — 「타임라인 생성」 체크박스를 제거했다]
// **이 자리는 피그마의 실수였다** — 사용자 확인(2026-09-02). round07b-ext 는 그
// 목업을 정본으로 믿고 체크박스를 그린 뒤 「준비 중입니다」로 막아 두었는데,
// 애초에 있어서는 안 될 항목이었다. 그래서 지운다.
//
// 실수임을 뒷받침하는 것 둘: 엑셀은 자료 한 건이 한 줄인 **표**라 「타임라인」이
// 무엇을 만든다는 것인지 정의된 적이 없고, **신규 피그마(엑셀 생성 모달)에도 그
// 항목이 없다**(1 선택자료 · 2 포함할 세부항목 둘뿐).
//
// 이 라운드가 **설명문 모달의 같은 이름 체크박스를 실제로 동작시키면서** 같은
// 모양의 컨트롤 둘이 한쪽만 되는 상태가 돼 문제가 드러났다. 하지 않는 일을 하는
// 것처럼 보이는 컨트롤은 두지 않는다(코딩표준 §6). 타임라인은 **설명문**에서 만든다.
import { useState } from 'react'
import { X } from 'lucide-react'
import Modal from '../../components/Modal.jsx'

// 서버 EXHIBIT_COLUMNS·DEFAULT_COLUMNS와 **같은 순서·같은 내용**이다 — 근거가 되는
// 원천별 채움율 실측표는 서버 outputs/columns.py 파일 주석에 있다.
// 피그마 칩 라벨(전시유형·소장처·수량)은 목업 상태의 자리표시일 뿐이라 따르지 않는다.
export const EXHIBIT_COLUMNS = [
  '유물명', '시기', '연도', '자료번호', '주제', '분류', '상세설명', '원문링크', '공개여부',
  '이명칭', '재질', '국적', '크기', '사진', 'OCR',
]

// 기본으로 켜 두는 열 — 전 원천 82.9% 이상. 나머지는 고를 수는 있으나 꺼져 있다.
export const DEFAULT_COLUMNS = [
  '유물명', '시기', '연도', '자료번호', '주제', '분류', '상세설명', '원문링크', '공개여부',
]

// 꺼진 칩에 붙는 안내. 「고르면 빈 열이 나올 수 있다」를 고르기 **전에** 말한다.
const SPARSE_NOTE = {
  이명칭: '아카이브 62.9% · 공개 71.6% · 문화유산 49.3%',
  재질: '아카이브에는 없습니다(공개·문화유산 자료만)',
  국적: '아카이브에는 없습니다(공개·문화유산 자료만)',
  크기: '아카이브에는 없습니다(공개 100% · 문화유산 81.9%)',
  사진: '공개 자료에만 있습니다(전체의 19.8%)',
  OCR: '공개 자료에만 있습니다(전체의 19.8%) · 원문 전체 텍스트라 셀이 깁니다',
}

// `total`(중복 제거 건수)을 부모에게서 받는 이유 — chips[].count 를 여기서 더하면
// 한 자료가 노드 두 개에 걸렸을 때 두 번 세어진다(ADR-002 F-02 — 중복 노출은 정상).
// 서버는 _flatten 으로 중복을 합쳐 엑셀을 만들므로, 그렇게 더한 수는 실제 결과보다
// 크다: 화면은 12건을 약속하고 파일은 11행이 나온다. 부모(OutputTab)가 이미 같은
// 규칙(Set)으로 selectedTotal 을 세고 있고 그 주석이 "화면이 정직하게 말하려면"이라
// 밝혀 두었으니, 세는 곳을 늘리지 않고 그 값을 그대로 받는다.
export default function ExhibitModal({
  open, chips = [], total = 0, defaultTitle, busy, onClose, onRemoveChip, onSubmit,
}) {
  const [title, setTitle] = useState(defaultTitle || '')
  const [columns, setColumns] = useState(DEFAULT_COLUMNS)

  if (!open) return null

  // 켤 때 배열 끝에 붙이지 않고 **카탈로그 순서로 다시 정렬**한다 — 안 그러면
  // 껐다 켠 열만 맨 뒤로 밀려, 같은 칩 조합인데 엑셀 열 순서가 조작 이력에 따라
  // 달라진다(서버는 받은 순서를 그대로 열 순서로 쓴다).
  const toggle = (c) =>
    setColumns((prev) => {
      const next = prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]
      return EXHIBIT_COLUMNS.filter((x) => next.includes(x))
    })

  const trimmedTitle = title.trim()
  // 제목이 곧 파일명이고 컬럼·자료가 하나도 없으면 표가 아니다 — 서버도 같은
  // 조건을 422로 막지만, 누를 수 없게 해 두는 편이 왕복 한 번을 아낀다.
  const canSubmit = Boolean(trimmedTitle) && columns.length > 0 && total > 0 && !busy

  return (
    <Modal open={open} onClose={onClose} size="lg" title="학예 기획 자료 목록">
      <div className="flex flex-col gap-6">
        {/* round10b B-3가 exhibit 라벨을 「전시자료」→「학예 기획 자료」로 개명했다
            (outputTitles.js·OutputCard.jsx 등). 이 모달 제목(위 Modal title)은 그때
            같이 바뀌었는데 이 부제만 빠져 「학예 기획 자료 목록」 모달 안에 「전시자료」가
            뜨는 상태로 남아 있었다(재리뷰 M-7) — 같은 이름으로 맞춘다. */}
        <p className="text-[13px] text-[#5A6173]">
          학예 기획 자료 목록 엑셀표 제작을 위해 아래 몇가지 사항을 결정해주세요.
        </p>

        {/* 선택 자료 — OutputTab의 selection을 그대로 반영한 뱃지다(병행 상태 아님).
            피그마 순서: 선택 자료 → 제목 설정 → 포함할 세부항목(라벨엔 번호를
            붙이지 않는다 — 빨간 원은 디스크립션 주석이지 화면 글자가 아니다). */}
        <div>
          <span className="block text-[13px] font-bold text-ink mb-1.5">선택 자료</span>
          {chips.length === 0 ? (
            <p className="text-[12.5px] text-[#8A90A2]">
              선택한 자료가 없습니다 — 노드를 열어 자료를 먼저 고르세요.
            </p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {chips.map((c) => (
                <li
                  key={c.nodeId}
                  className="flex items-center gap-1.5 h-[30px] pl-3 pr-1.5 rounded-full bg-primary-100 text-primary-600 text-[12.5px] font-semibold"
                >
                  <span>{c.label}</span>
                  <span>{c.count}</span>
                  <button
                    type="button"
                    aria-label={`${c.label} 선택 해제`}
                    onClick={() => onRemoveChip?.(c.nodeId)}
                    className="rounded-full p-0.5 hover:bg-primary-500/20"
                  >
                    <X size={12} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <label htmlFor="exhibit-title" className="block text-[13px] font-bold text-ink mb-1.5">
            제목 설정
          </label>
          <input
            id="exhibit-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={100}
            placeholder="학예 기획 자료 타이틀"
            className="w-full h-[38px] rounded-[9px] px-3 text-[13px] bg-white text-[#1A1F2B] border border-[#E2E5EE]"
          />
          <p className="mt-1 text-[11.5px] text-[#8A90A2]">
            제목이 곧 내려받는 파일 이름이 됩니다 — {trimmedTitle || '제목'}.xlsx
          </p>
        </div>

        {/* 포함할 세부항목 — 선택=파랑, 미선택=회색(aria-pressed로 상태 전달).
            컬럼 목록 자체(EXHIBIT_COLUMNS)는 손대지 않는다 — 피그마의 「전시유형·
            소장처·사진·크기·수량」은 목업이고, 실데이터 실측(round07b)으로 뺀
            항목을 되살리면 그 원천 자료가 열에서 통째로 비어 보인다. */}
        <div>
          <span className="block text-[13px] font-bold text-ink mb-1.5">포함할 세부항목</span>
          <div className="flex flex-wrap gap-2">
            {EXHIBIT_COLUMNS.map((c) => {
              const on = columns.includes(c)
              const note = SPARSE_NOTE[c]
              return (
                <button
                  key={c}
                  type="button"
                  aria-pressed={on}
                  title={note}
                  onClick={() => toggle(c)}
                  className={`h-[32px] px-3 rounded-[9px] border text-[12.5px] transition-colors ${
                    on
                      ? 'border-primary-600 bg-primary-100 text-primary-600 font-bold'
                      : 'border-[#E2E5EE] bg-white text-[#5A6173]'
                  }`}
                >
                  {c}
                  {/* 원천 편중이 있는 열에는 표식을 남긴다 — title 은 마우스를
                      올려야 보이므로 그것만으로는 모바일·키보드 사용자에게 닿지
                      않는다. */}
                  {note && <span aria-hidden="true"> *</span>}
                </button>
              )
            })}
          </div>
          {/* 별표의 뜻을 한 번만 설명한다. 칩마다 반복하면 칩이 읽히지 않는다. */}
          <p className="mt-2 text-[11.5px] text-[#8A90A2]">
            * 표시된 항목은 일부 원천에만 있습니다 — 고르면 자료에 따라 빈 칸이 나옵니다.
          </p>
          {columns.length === 0 && (
            <p className="mt-1.5 text-[11.5px] text-red-600">항목을 최소 1개 골라야 합니다.</p>
          )}
        </div>

        <div className="text-[12.5px] text-[#5A6173] bg-[#F7F9FC] rounded-[10px] px-4 py-3">
          선택한 자료 <b>{total}건</b>이 담깁니다.
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn_md btn_outline_dark" onClick={onClose}>
            취소
          </button>
          <button
            type="button"
            className="btn btn_md btn_primary"
            disabled={!canSubmit}
            // timeline은 체크박스가 켜지지 않으므로 늘 false다 — 기능이 생기면 그때
            // 실제 상태를 실어 보낸다.
            onClick={() => onSubmit({ title: trimmedTitle, columns, timeline: false })}
          >
            {busy ? '만드는 중…' : '생성하기'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
