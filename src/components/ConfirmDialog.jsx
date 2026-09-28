import Modal from './Modal.jsx'
import Button from './Button.jsx'

export default function ConfirmDialog({
  open,
  title = '확인',
  message,
  confirmLabel,
  cancelLabel = '취소',
  onConfirm,
  onClose,
}) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      size="sm"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose}>
            {cancelLabel}
          </Button>
          <Button variant="primary" size="sm" onClick={onConfirm}>
            {confirmLabel ?? title}
          </Button>
        </>
      }
    >
      <p className="text-sm text-[#4A5266] leading-relaxed">{message}</p>
    </Modal>
  )
}
