import { render, screen, fireEvent, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ManageProvider } from '../state/ManageProvider.jsx'
import { ToastProvider } from '../components/Toast.jsx'
import Ocr from '../pages/manage/Ocr.jsx'
import Meta from '../pages/manage/Meta.jsx'

test('파이프라인: D2a — "다음 단계로 보내기"는 준비중이라 OCR→Meta 승급이 더 이상 일어나지 않는다(같은 Provider 트리)', () => {
  // 검증 대상이 사라졌다 — 이전에는 Ocr.jsx의 promote()가 useManage 전역 상태를
  // 실제로 옮겨 Meta.jsx가 그 변화를 같은 ManageProvider 트리에서 관찰했지만,
  // D2a가 두 화면의 "다음 단계로 보내기"를 모두 showToast('준비 중입니다') 스텁으로
  // 바꾸며 useManage의 promote 자체를 호출하지 않는다 — 크로스 페이지 파이프라인이
  // 사라졌음을 여기서 고정한다(약화가 아니라 대체: "이동한다" → "이동하지 않는다").
  render(
    <ToastProvider>
      <ManageProvider>
        <MemoryRouter>
          <div>
            <section data-testid="ocr"><Ocr /></section>
            <section data-testid="meta"><Meta /></section>
          </div>
        </MemoryRouter>
      </ManageProvider>
    </ToastProvider>
  )
  const ocrSection = screen.getByTestId('ocr')
  const ocrTable = ocrSection.querySelector('table.data_table')
  fireEvent.click(within(ocrSection).getByLabelText('선택 o1'))
  fireEvent.click(within(ocrSection).getByRole('button', { name: '다음 단계로 보내기' }))

  expect(screen.getByRole('status')).toHaveTextContent('준비 중입니다')

  // OCR 표에 행이 그대로 남는다 (더 이상 승급되지 않는다)
  expect(ocrTable.textContent).toContain('유물대장_001.pdf')

  // Meta 표에도 나타나지 않는다 (수신할 파이프라인 자체가 없다)
  const metaSection = screen.getByTestId('meta')
  const metaTable = metaSection.querySelector('table.data_table')
  expect(metaTable.textContent).not.toContain('유물대장_001.pdf')
})
