// 이 파일의 책임: 특별전시 생성 모달(피그마 「교육 자료 생성」 — 제목만 바꿔 쓴다).
//
// round07i T7 — ExhibitModal.jsx 의 골격을 그대로 따르되 컬럼 관련 상태·UI 를
// 통째로 뺀다. 피그마 프레임 구조 자체가 "선택 자료 뱃지 → 제목 설정" 뿐이고 그
// 이상이 없다 — 특별전시는 docx 고정·컬럼이라는 개념이 없다(T6 라우트 계약: 서버
// model_validator가 columns·format을 실으면 422로 거부한다)는 사실이 화면에도
// 그대로 반영된 것이다. 라벨은 목업이 아니라 이 프로젝트 규칙대로 「특별전시
// 자료 생성」으로 바꿔 쓴다(구조는 피그마, 문구는 실제 산출물 이름).
//
// [제출을 여기서 fetch 하지 않는 이유]
// ExhibitModal·CaptionModal과 같은 이유다 — 실제 POST /outputs 호출·완료 모달
// 노출·목록 갱신·에러 토스트는 부모(OutputTab.submitExhibition)가 쥔다. 이 모달이
// 스스로 fetch를 부르면 세 산출물 중 하나만 다른 코드 경로로 서버와 통신하게 되고,
// 학예사는 그 차이를 "왜 여기만 반응이 다르지"로 겪는다(코딩표준 §6 침묵의
// 불일치 금지 — 같은 화면 안에서 같은 모양의 버튼이 다르게 동작하면 안 된다).
// 그래서 submit은 그대로 onSubmit({ title })을 부모에 위임한다 — kind='exhibition'·
// query·conversation_id는 부모가 붙인다(submitExhibit가 kind='exhibit'을 붙이는
// 것과 같은 자리).
import { useState } from 'react'
import { X } from 'lucide-react'
import Modal from '../../components/Modal.jsx'

// 특별전시 한 건에 담을 수 있는 자료 상한. 서버(outputs/routes.py
// `_MAX_EXHIBITION_ARTIFACTS`)와 같은 값이고 근거도 그쪽에 있다 — 특별전시만
// 자료 1건마다 MinIO GET + PIL 리사이즈가 **직렬로** 붙어, 넘기면 프록시
// 타임아웃으로 조용히 죽는 대신 422가 난다.
//
// round07i 감사 C — 화면에는 그 상한이 아예 없어서 학예사가 40건을 고르고
// 「생성하기」를 눌러야 비로소 알 수 있었다. 서버 사유가 토스트까지 오기는 하지만
// (submitExhibition → showToast(created.notice)) 그건 **눌러 본 뒤**다.
// ExhibitModal이 「서버도 같은 조건을 422로 막지만, 누를 수 없게 해 두는 편이
// 왕복 한 번을 아낀다」며 자기 상한(제목·컬럼·자료 유무)을 미리 막아 둔 선례를
// 그대로 따른다. 숫자를 여기서 새로 정하지 않는다 — 서버 값을 그대로 옮겨 적고,
// 어긋나면 서버가 정본이다.
export const MAX_EXHIBITION_ARTIFACTS = 30

// `total`(중복 제거 건수)을 부모에게서 받는 이유는 ExhibitModal과 같다 —
// chips[].count를 여기서 더하면 한 자료가 노드 두 개에 걸렸을 때 두 번 세어진다
// (ADR-002 F-02). 세는 곳을 부모(OutputTab.selectedTotal) 하나로 둔다.
export default function ExhibitionModal({
  open, chips = [], total = 0, defaultTitle, busy, onClose, onRemoveChip, onSubmit,
}) {
  const [title, setTitle] = useState(defaultTitle || '')

  if (!open) return null

  const trimmedTitle = title.trim()
  const overLimit = total > MAX_EXHIBITION_ARTIFACTS
  // ExhibitModal의 canSubmit에서 columns.length > 0 조건만 뺀 것이다 — 이 모달은
  // 고를 컬럼이 없으므로 제목과 선택 자료 건수만 본다(상한은 위 상수 주석 참조).
  const canSubmit = Boolean(trimmedTitle) && total > 0 && !overLimit && !busy

  return (
    // round07i 리뷰 반영 — size="lg" 는 오타가 아니라 피그마와 맞춘 것이다.
    // 실측 결과 이 모달·ExhibitModal(전시자료 엑셀) 포함 프레임 속 네 모달이
    // 전부 폭 480px 로 동일하다 — 두 모달이 "결과가 다르니 크기도 다르다"가
    // 아니라 애초에 같은 크기로 설계된 것이므로 ExhibitModal과 같은 size 를 쓴다.
    <Modal open={open} onClose={onClose} size="lg" title="특별전시 자료 생성">
      <div className="flex flex-col gap-6">
        <p className="text-[13px] text-[#5A6173]">
          특별전시 자료 제작을 위해 아래 사항을 결정해주세요.
        </p>

        {/* 선택 자료 — OutputTab의 selection을 그대로 반영한 뱃지다(병행 상태
            아님). ExhibitModal·CaptionModal과 같은 소스를 그대로 물려받는다. */}
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

        {/* 제목 설정 — 이 모달에 남는 유일한 입력이다. 피그마 구조상 컬럼
            체크박스도 타임라인 체크박스도 없다(위 파일 머리말 참조). */}
        <div>
          <label htmlFor="exhibition-title" className="block text-[13px] font-bold text-ink mb-1.5">
            제목 설정
          </label>
          <input
            id="exhibition-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={100}
            placeholder="특별전시 타이틀"
            className="w-full h-[38px] rounded-[9px] px-3 text-[13px] bg-white text-[#1A1F2B] border border-[#E2E5EE]"
          />
          <p className="mt-1 text-[11.5px] text-[#8A90A2]">
            제목이 곧 내려받는 파일 이름이 됩니다 — {trimmedTitle || '제목'}.docx
          </p>
        </div>

        <div className="text-[12.5px] text-[#5A6173] bg-[#F7F9FC] rounded-[10px] px-4 py-3">
          선택한 자료 <b>{total}건</b>이 담깁니다.
          {/* 상한을 넘겼으면 **누르기 전에** 말한다 — 몇 건을 덜어야 하는지까지
              함께 준다. 「30건까지입니다」만으로는 학예사가 칩을 하나씩 지우며
              세어 봐야 한다. */}
          {overLimit && (
            <p className="mt-1 text-[12.5px] text-red-600">
              특별전시는 한 번에 자료 {MAX_EXHIBITION_ARTIFACTS}건까지 담을 수 있습니다 —
              {' '}<b>{total - MAX_EXHIBITION_ARTIFACTS}건</b>을 덜어 주세요.
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn_md btn_outline_dark" onClick={onClose}>
            취소
          </button>
          <button
            type="button"
            className="btn btn_md btn_primary"
            disabled={!canSubmit}
            onClick={() => onSubmit({ title: trimmedTitle })}
          >
            {busy ? '만드는 중…' : '생성하기'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
