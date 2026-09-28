/**
 * 이 파일의 책임: 앱 계층(LNB가 있는 화면)의 셸.
 *
 * round06d에서 퍼블 publish-v1의 2단 구조로 재편했다.
 * 퍼블 body 최상위는 [nav.lnb, main] 둘뿐이다(main.html:16-108 / manage_list.html).
 * 상단 GNB·빵부스러기·푸터를 폐기한 것은 취향이 아니라 기하학적 귀결이다 —
 * .lnb 가 height: calc(100vh - 1.6rem) 전체높이 카드라(layout.css:24)
 * 위에 30px+62px짜리 바가 있으면 그 값이 성립하지 않는다(spec §6.3).
 *
 * 남은 두 관심사는 서로 다른 축이다.
 *  - 시각 구조: intro_wrap(홈) / library_wrap(/library) / mng_wrap(그 외) 3단 + 맨 앞의
 *    skip link 1개(퍼블 .skip_menu 미반입, Tailwind 신설 — spec §6.8.5 · §13 U-29).
 *    library_wrap은 round06c-ext A3에서 추가했다 — 퍼블 v2 library.html의 최상위가
 *    .library_wrap(구조는 mng_wrap과 동일, layout.css:179-182)이라 /library만 이 클래스로
 *    갈라친다. D2c(라이브러리 화면)가 이 분기를 소비한다.
 *  - 상태 컨테이너: Library/Manage/Admin 3중첩 — 재편 전과 **동일하게 유지**한다.
 *    (AppShell.providers.test.jsx가 이 중첩을 계약으로 감시한다)
 *
 * 시스템관리 권한 차단(round06d R6d-26): Lnb가 차단 사유(blockReasonOf)를 판정해
 * onBlocked(kind, trigger)로 알려주면, 셸은 그 사유를 alertKind에 담아 AlertPopup에
 * 넘긴다. AlertPopup은 mng_wrap/intro_wrap 밖의 형제다(§6.6.4) — T14의 AppShell.test
 * #2가 wrap의 직계 자식이 정확히 3개임을 단언하므로 안에 넣으면 그 테스트가 깨진다.
 */
import { useEffect, useRef, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Lnb from '../components/layout/Lnb.jsx'
import AlertPopup from '../components/AlertPopup.jsx'
import { LibraryProvider } from '../state/LibraryProvider.jsx'
import { ManageProvider } from '../state/ManageProvider.jsx'
import { AdminProvider } from '../state/AdminProvider.jsx'
import ComingSoon from '../components/ComingSoon.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { isShellLevelGated } from '../data/envGates.js'

// round06c F2(spec §9.6·R7): 접힘 상태를 localStorage에 영속한다. users에 서버 컬럼을
// 신설하지 않는다(이월 종결) — 클라이언트 전용 영속이라 새로고침·재방문에도 유지된다.
const LNB_COLLAPSED_KEY = 'lnb.collapsed'

function readStoredCollapsed() {
  try {
    return window.localStorage.getItem(LNB_COLLAPSED_KEY) === 'true'
  } catch {
    // 사생활 모드 등 localStorage 접근이 막힌 환경에서도 렌더는 계속돼야 한다 — 퍼블 기본값(펼침)으로 폴백.
    return false
  }
}

export default function AppShell() {
  const { pathname } = useLocation()
  // round06e 갈래 B — env 게이트 신호. RequireAuth(역할 게이트)를 이미 통과한 뒤의 판정이다.
  const { appEnv } = useAuth()
  // 퍼블 aria-expanded="true"(펼침)가 기본값이다. 라우트 이동 간에는 AppShell이
  // 언마운트되지 않아 자연히 유지되고, localStorage 덕에 새로고침·재방문에도 유지된다(spec §9.6).
  const [collapsed, setCollapsed] = useState(readStoredCollapsed)

  useEffect(() => {
    try {
      window.localStorage.setItem(LNB_COLLAPSED_KEY, String(collapsed))
    } catch {
      /* 저장 실패해도 이번 세션의 렌더는 그대로 진행한다 */
    }
  }, [collapsed])
  // null | 'system_access' | 'wip' — Lnb의 onBlocked가 채우고, AlertPopup의 onClose가 비운다.
  const [alertKind, setAlertKind] = useState(null)
  // 차단 팝업을 닫은 뒤 포커스를 되돌릴 트리거 엘리먼트 보관소.
  // Lnb.onBlocked(reason, e.currentTarget)는 raw DOM element를 2번째 인자로 주는데,
  // AlertPopup은 ref 객체(.current 접근)를 계약으로 기대한다(AlertPopup.jsx:36,46).
  // 두 계약 사이의 간극을 메우는 것은 셸의 몫이다 — ref로 감싸 어댑터 역할을 한다.
  const triggerRef = useRef(null)
  // 퍼블은 홈만 .intro_wrap(가운데 정렬·gap 없음)이고, /library는 .library_wrap(v2 신규),
  // 나머지는 .mng_wrap(gap 0.8rem)이다 — 셋 다 구조(gap·padding)는 같고 이름만 다르다.
  const isIntro = pathname === '/'
  const isLibrary = pathname.startsWith('/library')
  const wrapClass = isIntro ? 'intro_wrap' : isLibrary ? 'library_wrap' : 'mng_wrap'
  const mainClass = isIntro ? 'intro_main' : isLibrary ? 'library_main' : 'mng_main'

  return (
    <LibraryProvider>
      <ManageProvider>
        <AdminProvider>
          <div className={wrapClass}>
            {/*
              skip link — 퍼블 .skip_menu 는 가져오지 않고 Tailwind 로 신설한다(spec §6.8.5 · §13 U-29).
              가져오지 않는 이유: 퍼블 실납품 10화면이 .skip_menu 를 한 번도 참조하지 않아
              스타일 검증이 안 된 죽은 규칙이기 때문이다(§5.2.4의 폐기 판정과 같은 기준).
              평소에는 sr-only 로 숨고 포커스를 받으면 드러난다 — 키보드 사용자가 LNB 메뉴
              전체를 지나치지 않고 본문으로 건너뛸 수 있어야 한다. 포커스 순서는 DOM 순서이므로
              반드시 셸의 첫 자식이어야 한다.
            */}
            <a
              href="#main"
              className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:left-8 focus:top-8 focus:bg-white focus:text-primary focus:px-16 focus:py-8 focus:rounded-lg focus:outline focus:outline-2 focus:outline-primary"
            >
              본문 바로가기
            </a>
            <Lnb
              collapsed={collapsed}
              onToggle={() => setCollapsed((v) => !v)}
              onBlocked={(kind, trigger) => {
                triggerRef.current = trigger
                setAlertKind(kind)
              }}
            />
            {/* id="main" 은 위 skip link 의 목적지다. 지우면 링크가 죽는다. */}
            <main id="main" className={mainClass}>
              {/* round06f 갈래 E — **셸 레벨** env 게이트(spec §10.2·§10.3).
                  round06e는 여기서 isEnvHidden으로 판정해 <Outlet>을 통째로 갈아치웠다.
                  그러면 그 경로가 속한 탭줄까지 함께 사라진다 — /search/output이면
                  SearchFlowLayout의 검색바·page_tabs가, /system/*·/manage/*이면 각
                  화면이 그리는 SystemTabs·ManageTabs가 그렇다. 사용자 요구는 "탭은
                  두고 본문만 준비중"이었다(§2-5). A8(round06b)부터 셸 레벨 게이트
                  대상은 이제 없다 — PAGE_LEVEL_PREFIXES(/search·/system·/library·
                  /manage) 전부가 페이지 레벨 <EnvGate>로 통일됐다. 이 셸 판정은
                  PAGE_LEVEL_PREFIXES 바깥에 등록될 미래의 항목을 위해 남겨 둔다.
                  URL 직접 진입은 두 계층 모두 pathname으로 판정하므로 그대로 덮인다.
                  분배가 어긋나면 아무도 막지 않는 경로가 조용히 생기므로(R-11),
                  envGates.test.js의 정합 테스트가 세 정본을 함께 잠근다. */}
              {isShellLevelGated(pathname, appEnv) ? <ComingSoon /> : <Outlet />}
            </main>
          </div>
          <AlertPopup kind={alertKind} onClose={() => setAlertKind(null)} triggerRef={triggerRef} />
        </AdminProvider>
      </ManageProvider>
    </LibraryProvider>
  )
}
