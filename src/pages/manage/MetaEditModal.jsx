import { useState } from 'react'
import Modal from '../../components/Modal.jsx'
import Button from '../../components/Button.jsx'

/**
 * MetaEditModal — 메타 파일 행 편집 모달.
 * Props: row {object}, onSave {func(patch)}, onClose {func}
 */
export default function MetaEditModal({ row, onSave, onClose }) {
  const [name, setName] = useState(row.name)
  const [records, setRecords] = useState(row.records)

  function handleSave() {
    onSave({ name, records: Number(records) })
  }

  return (
    <Modal
      open
      title="메타 정보 편집"
      onClose={onClose}
      size="sm"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose}>취소</Button>
          <Button variant="primary" size="sm" onClick={handleSave}>저장</Button>
        </>
      }
    >
      <div className="space-y-4">
        <label className="block text-sm">
          <span className="text-[#5A6173] font-medium">파일명</span>
          <input
            aria-label="파일명"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full border border-line-soft rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-primary-400"
          />
        </label>
        <label className="block text-sm">
          <span className="text-[#5A6173] font-medium">레코드 수</span>
          <input
            aria-label="레코드 수"
            type="number"
            value={records}
            onChange={(e) => setRecords(e.target.value)}
            className="mt-1 w-full border border-line-soft rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-primary-400"
          />
        </label>
        <p className="text-xs text-[#8A90A2]">
          업로드 일시: {row.uploadedAt} · 매핑: {row.mapping}
        </p>
      </div>
    </Modal>
  )
}
