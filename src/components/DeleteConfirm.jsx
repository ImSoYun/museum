import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import useBodyScrollLock from './useBodyScrollLock.js'
import useIsBottomOverlay from './useOverlayStack.js'

export default function DeleteConfirm({
	open,
	title = '삭제 완료',
	quote,
	confirmLabel = '확인',
	desc = '삭제하였습니다!',
	onConfirm,
	onCancel,
}) {
	const uid = useId()
	const dialogRef = useRef(null)
	const confirmRef = useRef(null)

	useEffect(() => {
		if (!open) return

		confirmRef.current?.focus()
	}, [open])

	useEffect(() => {
		if (!open) return

		const handleKeyDown = (e) => {
			if (e.key === 'Escape') {
				e.preventDefault()
				onCancel?.()
			}
		}

		document.addEventListener('keydown', handleKeyDown)

		return () => {
			document.removeEventListener('keydown', handleKeyDown)
		}
	}, [open, onCancel])

	useBodyScrollLock(open)

	const isBottom = useIsBottomOverlay(open)

	if (!open) return null

	const titleId = `${uid}-title`
	const descId = `${uid}-desc`

	const handleTrapKeyDown = (e) => {
		if (e.key !== 'Tab') return

		const dialog = dialogRef.current

		if (!dialog) return

		const focusableElements = dialog.querySelectorAll(
			'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
		)

		if (focusableElements.length === 0) {
			e.preventDefault()
			return
		}

		const firstElement = focusableElements[0]
		const lastElement =
			focusableElements[focusableElements.length - 1]

		if (
			e.shiftKey &&
			document.activeElement === firstElement
		) {
			e.preventDefault()
			lastElement.focus()
		}

		if (
			!e.shiftKey &&
			document.activeElement === lastElement
		) {
			e.preventDefault()
			firstElement.focus()
		}
	}

	const dimClass = isBottom
		? 'dim is_active'
		: 'dim is_active bg-transparent'

	return createPortal(
		<div>
			<div
				className={dimClass}
				onClick={() => onCancel?.()}
				aria-hidden="true"
			/>

			<div
				ref={dialogRef}
				className="alert_popup is_active"
				role="alertdialog"
				aria-modal="true"
				aria-labelledby={titleId}
				aria-describedby={descId}
				tabIndex="-1"
				onKeyDown={handleTrapKeyDown}
			>
				<div className="alert_popup_head">
					<p
						className="section_tit"
						id={titleId}
					>
						{title}
					</p>

					{quote && (
						<p className="alert_popup_quote">
							{quote}
						</p>
					)}

					<p
						className="alert_popup_desc"
						id={descId}
					>
						{desc}
					</p>
				</div>

				<div className="popup_actions">
					<button
						type="button"
						className="btn btn_lg btn_primary_border"
						ref={confirmRef}
						onClick={() => onConfirm?.()}
					>
						{confirmLabel}
					</button>
				</div>
			</div>
		</div>,
		document.body
	)
}