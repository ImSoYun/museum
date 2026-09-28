import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import useBodyScrollLock from './useBodyScrollLock.js'
import useIsBottomOverlay from './useOverlayStack.js'

// round10 사용자 결정(2026-09-16) — 모달을 Escape 로 닫는다. 지금까지 이 컴포넌트는
// 배경 클릭과 ✕ 버튼만 닫기 경로로 갖고 있었다.
//
// [왜 스택을 두나]
// 겹쳐 열린 모달(자료 상세 위의 라이트박스 등)에서 document 리스너를 각자 달면 Escape
// 한 번에 전부 닫힌다. 그래서 열린 순서를 한 곳에 쌓아 두고 **맨 위 하나만** 반응한다.
// 라이트박스처럼 Modal 을 쓰지 않는 겹침도 같은 스택에 올려야 하므로 훅을 내보낸다.
const escapeStack = []

// round10a 최종리뷰 I-5 — 토큰 push/pop 은 **[active] 하나만** 보고 한다. onEscape 를
// deps 에 같이 두면(예전 코드) 콜백 identity 가 바뀔 때마다(부모가 매 렌더 새 클로저를
// 내려보내는 흔한 패턴 — 예: `onClose={() => setOpenMaterial(null)}`) cleanup 이 토큰을
// 빼고 새 토큰을 스택 **맨 위**에 다시 push 한다. 겹쳐 열린 두 레이어 중 나중에 연
// 쪽(라이트박스)이 먼저 있었어도, 바깥(상세) 쪽만 리렌더로 재푸시되면 순서가 뒤집혀
// Escape 가 엉뚱하게 바깥을 닫아버린다(MaterialModal.jsx — 라이트박스용을 먼저, 상세용을
// 나중에 선언해서 재현되는 순서). 그래서 push/pop 은 active 가 바뀔 때만 하고, 최신
// 콜백은 ref 로 따로 들고 있다가 실제로 Escape 가 눌린 순간에만 꺼내 쓴다.
export function useEscapeToClose(active, onEscape) {
  const onEscapeRef = useRef(onEscape)
  useEffect(() => {
    onEscapeRef.current = onEscape
  })

  useEffect(() => {
    if (!active) return
    const token = {}
    escapeStack.push(token)
    function onKeyDown(e) {
      if (e.key !== 'Escape') return
      if (escapeStack[escapeStack.length - 1] !== token) return   // 맨 위가 아니면 양보한다
      if (typeof onEscapeRef.current === 'function') onEscapeRef.current()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      const i = escapeStack.indexOf(token)
      if (i !== -1) escapeStack.splice(i, 1)
    }
  }, [active])
}

const SIZE_MAP = {
  sm: 'max-w-lg',
  md: 'max-w-2xl',
  lg: 'max-w-4xl',
  xl: 'max-w-5xl',
  doc: 'max-w-[1180px]',
}

export default function Modal({ open, title, onClose, children, footer, size = 'md', headerRight }) {
  // round07k ① — 훅은 **조기반환보다 먼저** 부른다. 아래 `if (!open) return null` 뒤에
  // 두면 열림/닫힘에 따라 훅 호출 수가 달라져 React 가 죽는다(Rules of Hooks).
  useBodyScrollLock(open)
  // 훅은 조기반환보다 먼저(위 주석과 같은 이유). 배경 클릭·✕ 와 **같은** onClose 를 태운다 —
  // 닫는 경로가 셋이어도 뒷정리(포커스 복귀 등)는 한 곳에서 하게 한다.
  useEscapeToClose(open, onClose)
  // round10c Task A3 — 겹쳐 열려도 딤은 한 겹만. useOverlayStack.js 머리주석 참조:
  // 판정은 스택의 현재 상태에서 매번 파생되므로, 닫는 순서가 엇갈려도(예: 이 Modal이
  // MaterialModal보다 먼저 닫혀도) 남은 위엣것이 딤을 되찾는다.
  const isBottom = useIsBottomOverlay(open)
  if (!open) return null
  const sizeClass = SIZE_MAP[size] ?? SIZE_MAP.md
  const isDoc = size === 'doc'
  // round10b 라이브 결함 L1 — **body 로 포털한다.**
  //
  // 배포본에서 사용자가 신고했다(2026-09-18): 홈에서 「나의 기록 → 라이브러리 저장」을 열면
  // 홈의 검색 영역과 추천 카드가 **모달 위로** 그려졌다. z-index 경합이 아니었다 —
  // 모달을 덮은 홈 요소들은 z-index 가 아예 없었다(auto).
  //
  // 원인은 쌓임 맥락(stacking context)이다. 실측한 조상 사슬:
  //     모달 → .lnb_history 안에 렌더 → 조상 .lnb        { position: sticky;  z-index: 1 }
  //     홈   →                          조상 .intro_main  { position: relative; z-index: 1 }
  // 둘이 z-index 1 로 **동률**이고, 동률이면 DOM 뒤쪽이 이긴다 — `.intro_main` 이 `.lnb` 보다
  // 뒤에 있어 홈이 모달을 덮었다. 아래 `z-50` 은 **`.lnb` 맥락 안에서만** 의미가 있어서
  // `.lnb` 자체(z=1)를 넘지 못한다. 「더 큰 z-index 가 이긴다」는 같은 맥락 안에서만 참이다.
  //
  // 그래서 오버레이를 body 의 자식으로 옮긴다 — 맥락이 루트가 되어 z-50 이 제 뜻대로 동작하고,
  // **어느 화면에서 열든** 같은 결과가 된다. `.lnb`·`.intro_main` 의 z-index 를 조정하는 것은
  // 대증요법이다(다음에 또 다른 맥락에서 같은 일이 난다). 이 셸을 쓰는 12개 화면이 한 번에 풀린다.
  //
  // ⚠️ 포털은 **DOM 위치만** 옮긴다 — React 트리(컨텍스트·이벤트 버블링)는 그대로다.
  //    그래서 소비처가 넘긴 onClose·children 은 물론, 상위 Provider 도 평소처럼 닿는다.
  // round10c Task A3 — 맨 아래가 아니면 딤 배경을 투명으로 덮어쓴다. 요소는 그대로
  // 둔다(bg-transparent 를 덧붙일 뿐 지우지 않는다) — 배경 클릭으로 닫는 경로가 이
  // 요소의 onClick 에 달려 있어, 요소를 없애면 그 닫기 경로가 함께 사라진다.
  const dimClass = isBottom ? 'bg-[rgba(20,26,46,.5)]' : 'bg-transparent'
  return createPortal(
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center ${dimClass} animate-overlayIn`}
      onClick={onClose}
    >
      <div
        className={`bg-white rounded-2xl shadow-[0_30px_80px_-20px_rgba(8,15,38,.5)] animate-modalIn ${sizeClass} w-full ${isDoc ? 'max-h-[86vh]' : 'max-h-[85vh]'} overflow-auto`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* round10b Task A — 이 셸(헤더·본문·푸터)은 기본 Tailwind 스케일 관용구(px-6·py-4·
            p-6·py-3·gap-10)로 쓰여 있었다. 이 프로젝트 spacing은 spacing[N]=Npx라(tailwind.config.js)
            그 관용구 그대로는 의도값의 1/4로 렌더된다 — 이 셸을 쓰는 화면이 12개라 여기 하나가
            전부에 걸렸다(round10a 실측: 저장 모달 푸터 17px·버튼 11px, 버튼이 잘림. round10b B-4가
            ChatExhibitionDecisionModal.jsx를 지워 13개에서 줄었다).
            본문 24px는 MaterialModal.jsx:22-24가 이미 실측해 둔 퍼블 정본값(1.2rem=24px)이고,
            헤더·푸터 가로 padding도 같은 24px로 맞춰 본문과 좌우 여백이 이어져 보이게 한다. */}
        <div className="flex items-center justify-between px-24 py-16">
          <h3 className="text-base font-bold text-ink-900">{title}</h3>
          {/* round10b 재리뷰 M-1 — gap-2(2px)도 이 셸이 데려온 기본 스케일 관용구였다.
              headerRight↔✕ 간격은 이 프로젝트에서 작은 간격의 관행값인 0.4rem=8px(popup_actions·
              log_detail_meta 등, component.css)로 맞춘다 — gap-8. */}
          <div className="flex items-center gap-8">
            {headerRight && <div>{headerRight}</div>}
            <button
              aria-label="닫기"
              onClick={onClose}
              className="rounded-lg text-[#3A4250] hover:text-ink"
            >
              <X size={18} />
            </button>
          </div>
        </div>
        <div className="p-24">{children}</div>
        {/* 푸터 버튼 사이 gap — 퍼블·피그마 어디에도 이 셸 전용 의도값이 없다(NEEDS_CONTEXT로
            물을 만한 지점이었으나, 퍼블이 이미 같은 모양(두 버튼 가로 배치)을 규정해 둔
            component.css:91 `.popup_actions{gap:0.4rem}`(alert_popup/form_popup 공용, ConfirmPopup.jsx
            소비)을 그대로 가져와 맞춘다 — 임의값 대신 이미 있는 같은 모양의 퍼블 관행을 따른다.
            이 스케일은 spacing[N]=Npx다(tailwind.config.js:13, ÷20 환산) — 0.4rem은 20px 루트에서
            8px이지 4px가 아니다(4px=4/20=0.2rem). 그래서 gap-8(재리뷰 I-1·I-2 — gap-4는 스케일을
            잘못 읽어 의도값의 절반이었다). */}
        {footer && <div className="px-24 py-12 flex justify-end gap-8">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}
