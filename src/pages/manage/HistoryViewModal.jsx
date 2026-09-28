import Modal from '../../components/Modal.jsx'

/**
 * HistoryViewModal — 학습 반영 이력 읽기전용 조회 모달.
 * Props: row {object|null}, onClose {func}
 */
export default function HistoryViewModal({ row, onClose }) {
  if (!row) return null
  const fields = [
    ['처리 일시', row.processedAt],
    ['자료명', row.name],
    ['레코드', `${row.records}건`],
    ['상태', row.status],
    ['담당자', row.manager],
    ['버전', row.version],
  ]
  return (
    <Modal open title="학습 반영 상세" onClose={onClose} size="sm">
      <dl className="grid grid-cols-2 gap-y-4 text-sm">
        {fields.map(([k, v]) => (
          <div key={k}>
            <dt className="text-[#8A90A2]">{k}</dt>
            <dd className="text-ink font-medium mt-0.5">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-5 text-xs text-[#8A90A2] bg-canvas rounded-lg p-3">
        반영 전후·버전 비교는 읽기 전용입니다. 재처리는 임베딩 단계에서 수행하세요.
      </p>
    </Modal>
  )
}
