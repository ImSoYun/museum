/**
 * 이 파일의 책임: 반입한 CSS를 "텍스트로" 읽어 이식 계약을 단언한다.
 *
 * 왜 렌더가 아닌가 — jsdom은 CSS를 로드하지 않는다(vitest css:false 기본).
 * 그래서 .form_input을 렌더해도 높이 45px을 확인할 수 없다. 대신
 * src/assets/assets.test.js가 fs.existsSync로 파일 계약을 검사한 선례를 따라
 * 규칙의 존재/부재를 텍스트 수준에서 고정한다.
 *
 * 이 테스트가 말하는 것: "규칙이 파일에 있다".
 * 이 테스트가 말하지 못하는 것: "화면이 그렇게 보인다" → R6d-06 스윕(D10·D11).
 *
 * spec 대응: §9.4 #9 · §10.1 D7 · D9.
 */
import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect } from 'vitest'

const SRC = path.resolve(__dirname, '..')            // web/src
const read = (rel) => fs.readFileSync(path.join(SRC, rel), 'utf8')

/** 훑는 대상 — §5.7-5가 "특정 파일만 열거하면 반드시 빠뜨린다"고 못박은 지점이다.
 *  R6d-05가 publish/ 파일 3개를 추가하면 이 배열에 함께 넣는다. */
export const PUBLISH_CSS_FILES = [
  'styles/publish/reset-forms.css',
  'styles/publish/common-kept.css',
  'styles/publish/layout.css',
  'styles/publish/component.css',
]

/** 퍼블이 참조하지만 실제 파일이 납품되지 않은 자산(§14 결함 1·7).
 *  red를 방치하면 게이트가 죽으므로 허용목록으로 분리한다.
 *  자산이 재납품되면 여기서 빼는 것만으로 가드가 켜진다.
 *
 *  정의는 여기가 아니라 R6d-01 이 만든 src/assets/known-missing.js 한 곳이다 —
 *  같은 배열을 assets.test.js 도 읽으므로 두 곳에 적으면 재납품 때 갈라진다(D8과 같은 원리).
 *  아래 재-export 는 편의용이며 값을 다시 적지 않는다. */
export { KNOWN_MISSING } from '../assets/known-missing'
import { KNOWN_MISSING } from '../assets/known-missing'

describe('CSS 계약 — 루트 폰트와 토큰 출처', () => {
  it('루트 폰트 20px과 반응형 축소 2단이 정의돼 있다', () => {
    const base = read('styles/tailwind-base.css')
    expect(base).toMatch(/html,\s*body\s*\{[^}]*font-size:\s*20px/)
    expect(base).toMatch(/@media\s*\(max-width:\s*1024px\)[^}]*\{[^{]*\{[^}]*font-size:\s*18px/)
    expect(base).toMatch(/@media\s*\(max-width:\s*768px\)[^}]*\{[^{]*\{[^}]*font-size:\s*16px/)
  })

  it(':root 정의는 tokens.css 한 곳뿐이다', () => {
    // 퍼블은 reset.css·common.css 두 곳에 :root를 두었고 --black·--primary10이
    // 서로 달랐다(§5.3). 이식 후 그 충돌이 재발하지 않게 고정한다.
    expect(read('styles/tokens.css')).toContain(':root')
    const others = ['index.css', 'styles/fonts.css', 'styles/tailwind-base.css',
                    'styles/tailwind-utilities.css', ...PUBLISH_CSS_FILES]
    for (const f of others) {
      expect(read(f), `${f}에 :root가 있다 — 토큰 단일 출처(D8) 위반`).not.toContain(':root')
    }
  })
})

describe('CSS 계약 — 죽은 코드 미반입 (D7)', () => {
  it('반입한 퍼블 CSS에 폐기 판정 규칙이 하나도 없다', () => {
    const all = PUBLISH_CSS_FILES.map(read).join('\n')

    // reset.css L143 전역 * 규칙 — preflight와 3중 충돌(§5.5 충돌 1)
    expect(all).not.toMatch(/^\s*\*\s*\{/m)
    // letter-spacing:-1px 도 버리기로 한 구간이다(§5.2.3) — 재반입을 여기서 잡는다.
    expect(all).not.toMatch(/letter-spacing:\s*-1px/)
    // reset.css L198~219 속성 프리픽스 선택자 — Tailwind 클래스를 무차별 타격한다
    expect(all).not.toContain('[class^=bg-]')
    expect(all).not.toContain('[class^=hover_]')
    // reset.css L189~196 — preflight가 font-weight:inherit로 만들고
    // 퍼블 마크업은 제목마다 명시 클래스를 준다
    expect(all).not.toMatch(/h1,\s*\n?\s*h2/)
    // 미채택 라이브러리 잔재 · 빈 껍데기
    for (const dead of ['.slick-', '.swiper', 'flatpickr', '.sz_xs', '.sz_lg']) {
      expect(all, `죽은 코드 ${dead}가 반입됐다`).not.toContain(dead)
    }
    // 폐기 확정 토큰(§5.3) — 반입 CSS 어디서도 참조하지 않아야 한다
    for (const t of ['--blue', '--red', '--gray5', '--gray90', '--body']) {
      expect(all, `폐기 토큰 ${t} 참조가 남았다`).not.toContain(`var(${t})`)
    }
  })
})

describe('CSS 계약 — url() 참조 자산 (D9)', () => {
  it('반입 CSS가 참조하는 자산이 전부 존재한다(허용목록 밖 누락 0)', () => {
    const targets = ['index.css', 'styles/tailwind-base.css', ...PUBLISH_CSS_FILES]
    const missing = []
    let refCount = 0
    for (const rel of targets) {
      const dir = path.dirname(path.join(SRC, rel))
      for (const m of read(rel).matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)) {
        const ref = m[1].trim()
        if (ref.startsWith('data:') || ref.startsWith('http')) continue
        refCount += 1
        const abs = path.resolve(dir, ref)
        if (!fs.existsSync(abs)) missing.push(`${rel} → ${ref}`)
      }
    }
    // §5.7-5의 경로 치환을 빠뜨리면(예: ../img/icon/ic_check.svg를 그대로 둠)
    // 여기서 잡힌다. 참조가 0건이면 치환이 아니라 반입 자체가 누락된 것이다.
    expect(refCount, 'url() 참조가 0건 — 반입 누락 의심').toBeGreaterThan(0)
    const unexpected = missing.filter(
      (m) => !KNOWN_MISSING.some((k) => m.endsWith(k)),
    )
    expect(unexpected, `허용목록 밖 자산 누락: ${unexpected.join(' / ')}`).toEqual([])
  })
})

describe('CSS 계약 — 퍼블 클래스와 현행 Tailwind 코드의 충돌 (R6d-05)', () => {
  /**
   * 왜 이 검사가 필요한가 — 반입만으로는 어떤 화면도 바뀌지 않아야 한다.
   * 바뀐다면 퍼블 클래스명과 현행 JSX의 className 토큰이 겹쳤다는 뜻이고,
   * 그 겹침은 테스트가 아니라 화면에서만 드러난다(단위 테스트는 클래스 이름
   * 문자열만 본다). 그래서 텍스트 수준에서 교집합이 공집합임을 고정한다.
   *
   * 특히 주의할 이름: common-kept.css의 `.hidden`은 Tailwind의 hidden 유틸과
   * 이름이 같다. 지금은 className으로 쓰인 곳이 0이라 통과하지만, 누군가
   * className="hidden"을 쓰는 순간 이 테스트가 red가 된다. 그때는 Tailwind
   * hidden 대신 조건부 렌더나 sr_only를 쓰라는 신호다(§5.6 규칙 3·5).
   */
  const collectPublishClasses = () => {
    const css = PUBLISH_CSS_FILES.map(read).join('\n')
    const set = new Set()
    for (const m of css.matchAll(/\.([a-zA-Z_][\w-]*)/g)) set.add(m[1])
    return set
  }

  /**
   * 퍼블 클래스를 JSX에서 의도적으로 쓰는 것은 §5.6 규칙 1(퍼블 납품 화면은 퍼블
   * 클래스)의 정상 소비다. T9(AlertPopup)에서는 이 예외를 "파일명" 단위
   * (publishingComponents whitelist)로 줬고 T11(ManageTabs·AdminTabs)에서 그
   * whitelist를 늘렸다 — 그런데 파일 통째 면제는 구멍이 있다: 면제된 파일에
   * 나중에 우발적 Tailwind 충돌(예: className="hidden")이 들어와도 이 가드가
   * 잡지 못한다. 파일이 아니라 "의도된 클래스명"만 충돌 검사에서 빼면, 같은
   * 파일의 다른 className은 여전히 검사 대상에 남는다(리뷰 Important, T11).
   *
   * 새 화면 태스크(T18~T27)가 퍼블 클래스를 쓰기 시작하면 여기에 그 클래스명을
   * 추가한다(파일명이 아니라) — 반드시 대상 JSX를 Read해 실측한 값만 넣는다.
   */
  const INTENDED_PUBLISH_CLASSNAMES = new Set([
    // T9 AlertPopup.jsx
    'dim', 'is_active', 'alert_popup', 'alert_popup_head',
    'alert_popup_tit', 'alert_popup_desc',
    'btn', 'btn_lg', 'btn_outline_primary',
    // T11 ManageTabs.jsx · AdminTabs.jsx
    'mng_page_tit', 'page_tabs',
    // T12 DataTable.jsx · Pagination.jsx
    'data_table', 'form_check', 'sr_only', 'ty_02',
    'data_pagination', 'data_pagination_pages',
    // R6d-14 AppShell.jsx — 퍼블 2단 셸(intro_wrap|mng_wrap + intro_main|mng_main)
    'intro_wrap', 'intro_main', 'mng_wrap', 'mng_main',
    // R6d-15 Lnb.jsx — 퍼블 좌측 내비게이션(nav.lnb) 4블록
    'lnb', 'is_collapsed', 'icon_btn', 'active',
    'lnb_top', 'lnb_head', 'lnb_logo', 'lnb_logo_full',
    'lnb_toggle', 'lnb_toggle_icon', 'lnb_logo_mark',
    'lnb_new_btn', 'lnb_new_txt', 'lnb_menu',
    'lnb_divider', 'lnb_history', 'lnb_history_tit', 'lnb_history_list',
    'lnb_history_item', 'lnb_history_link', 'lnb_history_txt',
    'lnb_history_more', 'ic_kebab',
    'lnb_profile', 'lnb_profile_avatar', 'lnb_profile_info',
    // round10b Task C — 사용자 결정(2026-09-17) "이메일관련은 다 빼": lnb_profile_email을
    // 뺐다(Lnb.jsx가 더 이상 그 줄을 렌더하지 않는다).
    'lnb_profile_name', 'lnb_profile_role', 'lnb_logout',
    // R6d-16~20 인증 계층 — AuthLayout.jsx(auth_wrap 골격) + pages/auth/{Login,Join,FindAccount}.jsx(card·auth_head 등)
    'auth_wrap', 'auth_inner', 'auth_logo', 'auth_footer_txt',
    'auth_head', 'auth_head_tit', 'ic_back', 'card', 'card_tit',
    // R6d-18 Login.jsx — /login 폼 필드 · 눈아이콘 토글 · 링크
    'form_section', 'form_stack', 'form_group', 'form_label', 'form_input',
    'form_input_box', 'btn_primary', 'ic_toggle', 'ic_eye_on', 'ic_eye_off',
    'auth_link_row',
    // R6d-19 Join.jsx — /join 폼 필드 · select 라디오버튼 · 신청권한 셀렉트박스
    'form_row_split', 'select_box',
    // R6d-20 FindAccount.jsx — /find 아이디·비밀번호 찾기 폼 · segmented 탭 패널
    'tab_seg_panel', 'notice_box',
    // T18 IntroHero.jsx · IntroSearchCard.jsx · Home.jsx · SearchNav.jsx —
    // 인트로 히어로·검색카드·추천질문·AI 고지(/ 와 /search 공용)
    'intro_hero', 'intro_orb', 'intro_logo_lockup', 'intro_wordmark', 'intro_subtitle',
    'intro_search_card', 'intro_search_notice', 'intro_search_box',
    'intro_search_input', 'intro_search_btn',
    'intro_questions', 'intro_questions_tit', 'intro_questions_list', 'intro_question_card',
    'intro_disclaimer', 'intro_content',
    // round06c-ext D1-4 — publish-v2가 자식 요소를 자손 선택자가 아닌 전용 클래스로 스타일한다(각 1선택자).
    'intro_search_notice_icon', 'intro_search_notice_txt', 'intro_search_btn_icon',
    'intro_questions_tit_icon', 'intro_questions_tit_txt', 'intro_disclaimer_icon',
    // T22 Ocr.jsx · FileDropzone.jsx — manage_ocr 이식(드롭존 + 툴바 + 7열 표)
    'data_panel', 'data_panel_body', 'data_table_group',
    'data_toolbar', 'data_total', 'data_delete_btn', 'data_delete_count',
    'data_table_dl_btn',
    'upload_dropzone_inner', 'upload_dropzone_txt',
    'upload_dropzone_desc', 'upload_dropzone_filename', 'upload_dropzone_btn',
    'upload_dropzone_input',
    // T23 Meta.jsx — manage_meta 퍼블 이식(template_bar + 전폭 드롭존 + 6열 표)
    'template_bar', 'template_bar_txt', 'template_bar_desc',
    'template_bar_list', 'template_bar_link',
    // T23 Meta.jsx는 T22의 FileDropzone을 재사용하므로 upload_dropzone 클래스 중복 없음.
    // T23 Meta.jsx는 T22의 DataTable을 재사용하므로 data_table 클래스 중복 없음.
    // T23 Meta.jsx는 T22의 StatusBadge(variant="text")를 재사용하므로
    // 퍼블 상태 배지 클래스(data_status_text·ty_*) 중복 없음.
    'data_status_text', 'ty_done',
    // 추가: T23에서 새로 쓰는 퍼블 클래스
    'data_col_name', 'data_promote_btn',
    // 추가: R6d-23 Embedding.jsx · History.jsx · Materials.jsx — 데이터 패널 헤더 공통 클래스
    'data_panel_head', 'data_panel_tit', 'data_panel_desc',
    // 추가: R6d-23 Embedding.jsx · Materials.jsx — 소형 버튼 변형(History.jsx는 미사용)
    'btn_sm', 'btn_outline',
    // 추가: R6d-24 DataFilterBar.jsx · History.jsx
    'data_filter_bar', 'data_filter_divider', 'data_filter_search', 'data_filter_search_btn',
    // 추가: R6d-25 Materials.jsx — 작업 열의 버튼 래퍼
    'data_col_actions',
    // R6c-ext A1 — publish-v2 이식 신규 클래스(A2·A3에서 실사용 예정)
    // Lnb.jsx 나의 기록 케밥 드롭다운(A2)
    'history_menu', 'history_menu_item',
    // R6F 후속 ConfirmPopup.jsx — 퍼블 삭제 확인(#history_delete_alert, alert_popup
    // 2버튼 변형). alert_popup 계열·btn 계열·dim·is_active·section_tit은 이미 위에 등재.
    'alert_popup_quote', 'popup_actions', 'btn_gray',
    // R6c-ext A2 — Lnb.jsx가 v2 명시 클래스로 재작성(a→.lnb_menu_link·li→.lnb_menu_item·
    // img→.lnb_menu_icon·span→.lnb_menu_label, layout.css 주석 R6c-ext A1 참조)
    'lnb_menu_item', 'lnb_menu_link', 'lnb_menu_icon', 'lnb_menu_label',
    // PageTabs.jsx(A3) · ManageTabs.jsx(D2a)·SystemTabs.jsx(D2b)
    'page_tabs_link',
    // round07b-ext T13 — SearchFlowLayout.jsx가 「산출물생성」 탭에 붙이는 미열람 건수
    // 뱃지. 클래스는 T13에서 썼는데 CSS 반입이 빠져 뱃지가 스타일 없이 떴다 —
    // 리뷰에서 퍼블 v2 규칙 1개를 그대로 반입하며 함께 등재한다.
    'result_tabs_badge',
    // Pagination.jsx v2 클래스(브리지 반입 — 소비처 미확정, §4 디자인 참조)
    'data_pagination_arrow', 'data_pagination_page_btn',
    // 라이브러리 셸(향후 과업 소비)
    'library_wrap', 'library_main',
    // R6c-ext D1-5b — publish-v2 검색흐름 CSS 이식(component.css R6c-ext D1-5b 블록).
    // 아래 클래스는 D1-3(SearchFlowLayout)·D1-5(SearchResults·ResultsTab·MaterialModal)의
    // 마크업에서 실측한 것만 넣는다. 이식 CSS에 없는 훅(ty_audio)은 퍼블 클래스가 아니라
    // 여기 넣지 않는다(충돌 검사 대상 밖).
    'result_query_bar', 'result_query_bar_icon', 'result_query_bar_input',
    'result_query_btn', 'result_query_btn_icon',
    'result_wrap',
    'result_meta_bar', 'result_meta_filters', 'data_total_tit', 'data_total_count', 'ty_lg',
    'result_body',
    'result_filter_list', 'result_filter_list_menu', 'result_filter_btn', 'result_filter_count',
    'result_card', 'result_card_group', 'result_card_grid', 'result_card_badges',
    'result_card_tit', 'result_card_meta', 'result_card_thumb', 'result_card_thumb_img',
    'result_card_dl', 'result_card_dl_icon',
    'tag', 'ty_image', 'ty_video', 'ty_book', 'ty_web',
    'detail_popup', 'detail_popup_content', 'detail_popup_meta', 'detail_popup_source',
    'detail_popup_gallery', 'detail_popup_gallery_img', 'detail_popup_body',
    'detail_popup_info', 'detail_popup_info_row', 'detail_popup_info_term',
    'detail_popup_info_desc', 'detail_popup_desc', 'detail_popup_license',
    // R6c-ext 리뷰 A1·A5 — MaterialModal.jsx 헤더를 퍼블 .panel_head.ty_modal 로 되돌리고
    // popup_tit·popup_close·popup_scroll CSS 를 반입했다. 이제 이 이름들이 반입 CSS 에
    // 선택자로 존재하므로(=퍼블 클래스) 의도된 소비로 등재해야 한다.
    'panel_head', 'ty_modal', 'popup_tit', 'popup_close', 'popup_scroll',
    // R6c-ext D1-6 — publish-v2 결과기반 AI 대화(ai_chat) 이식.
    // 소비처: pages/ChatView.jsx(result_wrap.ty_chat + chat_welcome*),
    // pages/results/ChatTab.jsx(chat_body 이하), components/GlowBorder.jsx(glow_border).
    // D1-5b 가 소비처 없다며 스킵한 result_wrap 의 ty_chat 변형이 여기서 소비된다.
    'ty_chat', 'chat_welcome', 'chat_welcome_tit', 'chat_welcome_desc',
    'chat_body', 'chat_topic_bar', 'chat_topic_bar_icon', 'chat_topic_bar_txt',
    'chat_thread', 'chat_msg', 'ty_user', 'ty_ai',
    'chat_msg_avatar', 'chat_msg_content', 'chat_msg_bubble',
    'chat_msg_bubble_txt', 'ty_indent',
    'chat_msg_cite', 'chat_cite_item', 'chat_cite_num', 'chat_cite_txt',
    'chat_msg_actions', 'chat_msg_actions_icon',
    'chat_input_dock', 'chat_input_bar', 'chat_input_bar_input',
    'chat_input_send', 'chat_input_send_icon',
    'glow_border',
    // R6c-ext D1-7 — publish-v2 산출물생성(output_node) 이식.
    // 소비처: pages/OutputView.jsx(result_wrap 은 이미 등재, chat_welcome 재사용도 이미 등재),
    // pages/results/OutputTab.jsx(node_view·node_select_panel), components/NodeGraph.jsx.
    'btn_icon', 'btn_md', 'btn_outline_dark', 'btn_dark',
    'node_view', 'node_criteria', 'node_criteria_head', 'node_criteria_tit', 'node_criteria_desc',
    'node_criteria_list', 'node_criteria_btn',
    'node_graph', 'node_graph_lines', 'node_graph_node', 'node_graph_node_label', 'node_graph_node_tag',
    'ty_center', 'node_graph_node_sub',
    'node_select_panel', 'node_select_head', 'node_select_tit', 'node_select_tags', 'node_select_tag',
    'node_select_tag_label', 'node_select_tag_count', 'node_select_tag_remove', 'node_select_tag_remove_icon',
    // ('ty_active' 는 D1-7 리뷰 B3에서 제거 — 앱이 어떤 칩에도 붙이지 않아 이식 CSS 3규칙을
    //  지웠다. 등재는 실사용 실측분만 담는다. component.css 「미반입(계약)」 주석 참조.)
    'node_select_body', 'node_select_guide', 'node_select_types', 'node_select_type', 'node_select_type_head',
    'node_select_type_tit', 'node_select_type_desc', 'node_select_type_row', 'node_select_type_divider',
    // (node_result_* 9개는 round07b-ext 리뷰에서 제거 — task-11이 「생성 결과 패널」
    //  마크업을 걷어내 소비처가 사라졌고, component.css의 해당 11규칙도 함께 지웠다.
    //  node_select_tag.ty_active 를 지운 D1-7 리뷰 B3와 같은 논거.)
    // R6c-ext D2a — 자료관리 5탭 재퍼블. Pagination.jsx·DataFilterBar.jsx·FileDropzone.jsx의
    // v2 클래스 갱신(A1 이월 concern) + template_bar/upload_dropzone 공용 제목 클래스.
    // data_pagination_arrow·data_pagination_page_btn은 이미 위(Pagination.jsx v2 클래스)에
    // 등재돼 있었고, 이번에 실제 아이콘 클래스만 새로 쓴다.
    'data_pagination_arrow_icon',
    'data_filter_search_input', 'data_filter_search_btn_icon',
    'section_tit', 'upload_dropzone_btn_icon',
    // R6c-ext D2b — 시스템관리 셸(모니터링·노드관리·이용로그) 재퍼블.
    // Monitoring.jsx stat_card KPI(방향 modifier ty_up/ty_down 포함)
    'stat_card_list', 'stat_card', 'stat_card_label', 'stat_card_data',
    'stat_card_value', 'stat_card_compare', 'stat_card_delta', 'stat_card_delta_icon',
    'ty_up', 'ty_down',
    // Nodes.jsx 검색바 + "클러스터링 기준 추가"
    'node_setting_bar', 'node_setting_label', 'node_setting_bar_input', 'data_add_btn',
    // Log.jsx 엑셀 다운로드(필터바 옆 단독 버튼)
    'data_filter_export_btn',
    // R6c-ext D2c — 라이브러리 v2(list/card 이중뷰) 재퍼블. 소비처 pages/Library.jsx.
    // 검색바 변형(ty_02는 이미 위에서 등재돼 있어 재등재하지 않는다).
    'library_panel', 'ty_gap',
    'view_toggle', 'view_toggle_btn', 'view_toggle_icon', 'view_toggle_icon_active',
    'avatar_stack', 'avatar_stack_icon', 'ty_overlap', 'avatar_stack_more',
    'library_card_list', 'library_card', 'library_card_head', 'library_card_avatar',
    'library_card_writer', 'library_card_body', 'library_card_tit', 'library_card_tit_link',
    'library_card_desc', 'library_card_date', 'library_card_date_icon',
    'library_card_lock', 'library_pw_btn', 'library_card_lock_icon',
    'library_card_foot', 'library_card_counts', 'library_card_counts_item',
    'library_card_counts_icon', 'library_card_counts_icon_active',
    // data_table_wrap은 이미 CSS에 있었으나(v1) 첫 실 소비처가 Library.jsx 목록뷰다.
    'data_table_wrap', 'library_table', 'library_table_lock', 'library_table_lock_icon',
    // 최초 소비처 Library.jsx 목록뷰 프로젝트명 열(위 component.css [S] data_table 블록 참조).
    'data_col_name_link', 'data_col_name_tit', 'sub_txt',
    // R6c-ext D2d 마무리 — layout.css R6c-ext A1 주석이 반입만 해두고 미뤘던 auth_wrap
    // 자손 선택자 3건의 명시 클래스. 소비처: pages/auth/{Join,FindAccount}.jsx(ic_back_img),
    // pages/auth/Login.jsx(auth_link_row_link), layouts/AuthLayout.jsx(auth_logo_img).
    'ic_back_img', 'auth_link_row_link', 'auth_logo_img',
    // round06f 갈래 B — publish-v2 AI 브리핑 카드 이식.
    // 소비처: pages/results/AiBriefCard.jsx(SearchResults.jsx 의 LiveResultsPanel 이 마운트).
    // glow_border 는 D1-6 에서 이미 등재돼 있어 다시 넣지 않는다(그 CSS 도 재반입하지
    // 않는다 — component.css round06f 블록 주석 참조).
    'ai_brief_card', 'ai_brief_head', 'ai_brief_logo', 'ai_brief_logo_icon',
    'ai_brief_info', 'ai_brief_tit', 'ai_brief_tag', 'ai_brief_desc',
    'ai_brief_actions', 'ai_brief_more', 'ai_brief_more_icon',
    'ai_brief_toggle', 'ai_brief_toggle_icon',
    'ai_brief_body', 'ai_brief_notice', 'ai_brief_notice_icon',
    // round06f 갈래 D — publish-v2 dropdown_box ty_check 이식(자료유형 다중선택).
    // 소비처: components/DropdownCheckBox.jsx(pages/results/ResultsTab.jsx 가 마운트).
    // ty_02·form_check·sr_only 는 이미 위에 등재돼 있어 다시 넣지 않는다.
    // form_check_label 은 이 컴포넌트 한 곳에만 붙이는 의도된 예외다(spec §9.4) —
    // 퍼블 규칙 .dropdown_box_list.ty_check .form_check .form_check_label 이 요구한다.
    'dropdown_box', 'ty_labeled', 'ty_filled',
    'dropdown_box_trigger', 'dropdown_box_label', 'dropdown_box_value', 'dropdown_box_arrow',
    'dropdown_box_value_group', 'dropdown_box_value_count',
    'dropdown_box_panel', 'dropdown_box_panel_head',
    'dropdown_box_list', 'ty_check', 'form_check_label',
    // round06f 갈래 C — publish-v2 검색 품질 만족도 위젯 이식.
    // 소비처: pages/results/RatingWidget.jsx. ty_02·form_group·form_label·form_input·
    // sr_only·btn·btn_md·btn_primary 는 이미 위에 등재돼 있어 다시 넣지 않는다.
    'rating_widget', 'rating_tit', 'rating_tit_icon', 'rating_desc',
    'rating_score_list', 'rating_score_btn', 'rating_score_input',
    'rating_score_face', 'rating_score_num', 'rating_score_btn_tooltip',
    'ty_01', 'ty_03', 'ty_04',
    'rating_score_caption', 'txt', 'txt_01', 'txt_02', 'txt_03',
    'rating_comment', 'rating_optional',
    'rating_submit_row', 'rating_count', 'rating_comment_count',
    // round07b-ext NodeModal — 퍼블 node_detail 92규칙(component.css 파일 끝 [S] node_detail
    // 블록). 브리핑의 나열은 마크업을 읽어 작성돼 있었고, 실제 반입한 CSS 선택자와 대조해
    // 8개를 보탰다 — node_detail_modal_foot·node_detail_modal_foot_tag(하단 버튼 wrapper·
    // 뱃지), node_detail_trans_body·node_detail_trans_meta(콤마로 묶인 한 규칙의 두 선택자,
    // brief는 body_text만 적어 뒀다), node_detail_trans_meta_list, node_detail_viewer_tool·
    // node_detail_viewer_11·node_detail_viewer_zoom(뷰어 툴바의 낱개 버튼들). is_open·
    // ty_active는 위(alert_popup 등)의 is_active와 다른 문자열이라 신규 등재다.
    // round07b-ext — NodeModal 헤더가 퍼블과 같은 마크업(img.popup_close_icon +
    // panel_head.ty_between)을 쓰게 되면서 두 규칙을 추가 반입했다. 없으면 ✕ 가
    // 원본 크기로 나와 제목을 밀어낸다(라이브 실측).
    'popup_close_icon', 'ty_between',
    'node_detail_modal', 'node_detail_modal_body', 'node_detail_modal_main',
    'node_detail_modal_columns', 'node_detail_modal_meta_head',
    'node_detail_modal_meta_tit', 'node_detail_modal_meta_tit_txt',
    'node_detail_modal_meta_tag', 'node_detail_modal_source',
    'node_detail_modal_source_icon', 'node_detail_modal_foot', 'node_detail_modal_foot_tag',
    'node_detail_tree', 'node_detail_tree_row', 'node_detail_tree_row_toggle',
    'node_detail_tree_row_label', 'node_detail_tree_row_count',
    'node_detail_tree_row_arrow', 'node_detail_tree_sub',
    'node_detail_tree_sub_item', 'node_detail_tree_sub_item_label',
    'node_detail_viewer', 'node_detail_viewer_bar', 'node_detail_viewer_name',
    'node_detail_viewer_name_icon', 'node_detail_viewer_tools',
    'node_detail_viewer_tools_group', 'node_detail_viewer_tool', 'node_detail_viewer_tool_icon',
    'node_detail_viewer_11', 'node_detail_viewer_zoom',
    'node_detail_viewer_page', 'node_detail_viewer_main',
    'node_detail_viewer_thumbs', 'node_detail_viewer_thumb',
    'node_detail_viewer_thumb_img', 'node_detail_viewer_thumb_img_icon',
    'node_detail_viewer_thumb_num', 'node_detail_viewer_preview',
    'node_detail_viewer_preview_img',
    'node_detail_trans', 'node_detail_trans_head', 'node_detail_trans_head_top',
    'node_detail_trans_tit', 'node_detail_trans_page',
    'node_detail_trans_page_label', 'node_detail_trans_page_value',
    'node_detail_trans_lang', 'node_detail_trans_swap',
    'node_detail_trans_swap_icon', 'node_detail_trans_btn',
    'node_detail_trans_sub_head', 'node_detail_trans_sub_tit',
    'node_detail_trans_actions', 'node_detail_trans_action',
    'node_detail_trans_action_icon', 'node_detail_trans_body',
    'node_detail_trans_body_text', 'node_detail_trans_meta', 'node_detail_trans_meta_list',
    'is_open', 'ty_active',
    // round07b-ext task-6 NodeModal.jsx(소비처가 이번에 생겼다) — task-5는 CSS만 반입하고
    // JSX가 아직 없어 이 5개는 그때 등재되지 않았다. 전부 node_detail 92규칙 선택자다:
    // form_check_input(체크박스 자체, reset-forms.css — DataTable.jsx는 아직 속성선택자
    // 방식이라 지금까지 미등재), ty_box·ty_fill(뷰어 툴바 버튼 변형)·ty_plain(툴바 그룹
    // 변형)·wrap(.node_detail_trans .wrap — 번역정보/메타정보 두 패널의 공통 틀).
    'form_check_input', 'ty_box', 'ty_fill', 'ty_plain', 'wrap',
    // round07b-ext task-11 OutputCard.jsx(pages/results/OutputCard.jsx) — 산출물 카드의
    // "선택" 상태 클래스. 이것은 §5.6 규칙1의 정상 소비(퍼블이 실제로 정의한 CSS를
    // 재사용)가 **아니다** — component.css의 「R6c-ext D1-7 이식」 머리주석
    // 「미반입(계약)」 절("node_graph_node.is_selected · is_pinged")이 도입 예정이었으나 미반입
    // 상태로 남겨 둔 선택 시각을 "설명"할 뿐인 산문이고, 실제 .is_selected 선택자는
    // 그 CSS 파일 어디에도 없다. collectPublishClasses는 주석까지 텍스트로 훑으므로
    // 그 산문 속 ".is_selected" 한 글자가 우연히 "퍼블 클래스"로 오검출된다 — 우리
    // 카드의 .is_selected는 publish-ext.css에 새로 정의한 완전히 별개의 규칙이다
    // (그 파일은 이 계약 검사 대상 밖). 그래서 여기 등재는 "의도된 재사용"이 아니라
    // "코멘트발 오탐 회피"임을 남겨 둔다.
    'is_selected',
    // round07h — SortSelect.jsx·LabeledSelect.jsx(공개여부·종류, 단일선택 listbox
    // 변형)가 component.css [S] dropdown_box 블록에 새로 반입한 L387-388 두 규칙의
    // 첫 소비처다(위 round06f 갈래 D 절 갱신 참조).
    'dropdown_box_list_item', 'dropdown_box_item',
    // round07h task-6 — MaterialModal.jsx 자료상세뷰어 2단(피그마). 퍼블 detail_popup은
    // 1단이라 component.css 끝에 변형 블록으로 새로 추가했다(퍼블 원본을 덮지 않음).
    // ty_two_col은 detail_popup_content 변형, col_left/col_right는 그 안의 좌/우단
    // 래퍼다 — 이 셋은 이 라운드에서 새로 정의한 규칙이지 퍼블 납품 클래스의 재사용이
    // 아니지만, 같은 CSS 파일(component.css)에 있어 collectPublishClasses가 그대로
    // 집어낸다. 그래서 §5.6 규칙3 취지(같은 이름을 쓰는 곳이 어디인지 텍스트로 추적
    // 가능해야 한다)에 따라 여기 등재해 둔다.
    'ty_two_col', 'detail_popup_col_left', 'detail_popup_col_right',
    // round07j — 퍼블 재납품이 component.css 에 새로 넣은 규칙들. 아홉 개가 한꺼번에
    // 충돌로 잡혔는데 **성격이 둘로 갈렸다**:
    //   ① 아래 여덟은 우리 JSX 가 이미 퍼블 이름으로 쓰고 있었는데 CSS 가 없던 것들이다
    //      (btn_darkgray 는 OutputDetailPage 다운로드 버튼, detail_popup_ocr* 는
    //      MaterialModal OCR 블록, gallery_btn 은 이번에 생긴 이전/다음 버튼).
    //      뒤늦게 규칙이 도착한 정상 경로이므로 의도된 소비로 등재한다.
    //   ② 아홉째 animate-modalIn 은 **등재하지 않았다** — 퍼블 클래스가 아니라
    //      Tailwind 애니메이션 유틸리티라서, 거기 붙은 padding 이 앱의 모든 모달과
    //      토스트에 얹혔다. 근거와 처리는 component.css 의 해당 자리 주석에 있다.
    //      이 검사가 존재하는 이유가 바로 ②이므로, ①을 등재하며 ②를 함께 통과시키지
    //      않도록 주의할 것.
    'btn_close', 'btn_darkgray', 'btn_open', 'btn_white',
    'detail_popup_ocr', 'detail_popup_ocr_body', 'detail_popup_ocr_title',
    'gallery_btn',
  ])

  const collectClassNameTokens = () => {
    const set = new Set()
    const walk = (dir) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name)
        if (e.isDirectory()) { walk(p); continue }
        if (!/\.jsx?$/.test(e.name) || /\.test\./.test(e.name)) continue
        const text = fs.readFileSync(p, 'utf8')
        // className="…" / className={'…'} / className={`…`} / className={cond ? '…' : '…'}
        for (const attr of text.matchAll(/className\s*=\s*(\{[^\n]*|"[^"]*"|'[^']*')/g)) {
          for (const lit of attr[1].matchAll(/["'`]([^"'`]*)["'`]/g)) {
            for (const tok of lit[1].split(/\s+/)) if (tok) set.add(tok)
          }
        }
      }
    }
    walk(SRC)
    return set
  }

  it('퍼블 CSS의 클래스와 현행 JSX의 className 토큰이 겹치지 않는다(의도된 퍼블 클래스는 예외)', () => {
    const publish = collectPublishClasses()
    const tokens = collectClassNameTokens()
    expect(publish.size, '퍼블 클래스 추출 0건 — 반입 누락 의심').toBeGreaterThan(100)
    expect(tokens.size, 'className 토큰 추출 0건 — 추출기 고장').toBeGreaterThan(100)

    // 파일 면제가 아니라 클래스명 면제 — 같은 파일의 다른(의도치 않은) 충돌은 잡힌다.
    const collided = [...publish]
      .filter((c) => tokens.has(c))
      .filter((c) => !INTENDED_PUBLISH_CLASSNAMES.has(c))
      .sort()
    expect(
      collided,
      `퍼블 클래스와 Tailwind 코드가 같은 이름을 쓴다: ${collided.join(', ')} ` +
      `— 두 체계가 한 요소에서 만나면 결과를 클래스 목록만 보고 알 수 없다(§5.6 규칙 3). ` +
      `의도된 퍼블 클래스라면 INTENDED_PUBLISH_CLASSNAMES에 추가하라.`,
    ).toEqual([])
  })
})

describe('CSS 계약 — 퍼블 대비 의도된 편차(publish-ext.css)', () => {
  it('.lnb_history는 overflow-y:auto로 스크롤 컨테이너가 된다(round06e H) — 누적 시 하단 프로필이 밀리지 않는다', () => {
    const ext = read('styles/publish-ext.css')
    expect(ext).toMatch(/\.lnb_history\s*\{[^}]*overflow-y:\s*auto/)
  })

  /** 규칙을 찾기 전에 주석을 걷어낸다.
   *
   *  왜 필요한가 — 이 파일은 CSS를 "텍스트로" 읽으므로, 규칙 블록을 통째로 주석
   *  처리해도 문자열은 그대로 남아 정규식이 계속 맞는다. 즉 "규칙이 살아 있다"가
   *  아니라 "그런 글자가 파일에 있다"만 잠그게 된다(R1 Minor 3). 주석을 먼저 지우면
   *  최소한 **주석화**라는 가장 흔한 무력화는 red로 잡힌다.
   *
   *  여전히 못 잡는 것: 셀렉터 오타·캐스케이드 패배·미디어쿼리 오적용처럼 "파일에는
   *  있으나 화면에는 안 먹는" 경우. 그건 텍스트 검사의 원리적 한계다(파일 머리주석). */
  const live = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '')

  /** 파일에 있는 **모든** @media print 블록을 훑는다.
   *
   *  round07f-fix2 R1 재리뷰가 실증한 구멍 — 아래 두 테스트가 예전에는
   *  `/@media\s+print\s*\{([\s\S]*?)\n\}/.exec(ext)`로 첫 블록 하나만 잡았다.
   *  `.exec`는 매치 하나만 돌려주므로, 파일 끝에 전역 `@media print { body * {...} }`를
   *  하나 더 붙여도(예: 전 화면 백지 인쇄를 되살리는 회귀) 첫 블록만 보던 두 테스트는
   *  전부 green으로 남았다(변이 테스트로 실증). `matchAll` + `/g`로 모든 블록을
   *  모아 그 전부를 검사 대상에 넣는다. */
  const collectPrintBlocks = (css) =>
    [...css.matchAll(/@media\s+print\s*\{([\s\S]*?)\n\}/g)].map((m) => m[1])

  // round07g Task4 — 「작업선택」이 네이티브 <select> 에서 커스텀 리스트박스로 바뀐
  // 이유는 오직 하나, **위로** 펼치기 위해서다(브라우저는 <select> 의 펼침 방향을
  // 지정하게 해 주지 않고, 채팅 입력 바는 화면 맨 아래라 아래로 열면 잘린다).
  //
  // jsdom 은 레이아웃을 계산하지 않으므로 「위에 그려졌다」를 좌표로 볼 수 없다.
  // 여기서 잠그는 것은 그 방향을 만드는 **선언 한 줄**이다 — bottom 기준 절대배치이고
  // top 오프셋이 없다(둘 다 있으면 상자가 늘어날 뿐 위로 열리지 않는다).
  // 짝이 되는 마크업 층(패널이 트리거보다 DOM 앞)은 TaskSelect.test.jsx 가 잠근다.
  it('.chat_task_select_panel 은 트리거 위로 펼친다(round07g) — bottom 기준, top 오프셋 없음', () => {
    const ext = live(read('styles/publish-ext.css'))
    const panel = /\.chat_task_select_panel\s*\{([^}]*)\}/.exec(ext)
    expect(panel, '.chat_task_select_panel 규칙이 없다 — 패널 위치가 정의되지 않았다').not.toBeNull()
    expect(panel[1]).toMatch(/position:\s*absolute/)
    expect(panel[1], '위로 여는 장치는 bottom 기준 배치 한 줄이다').toMatch(/bottom:\s*calc\(100%/)
    expect(panel[1], 'top 오프셋이 들어오면 패널이 아래로 열린다').not.toMatch(/(^|;)\s*top:/)
  })

  // round07f Task 6 — 퍼블의 .node_detail_viewer는 **이미지** 뷰어용 다크 크롬이다
  // (component.css: background #333). 산출물 뷰어는 그 안에 검은 글자의 문서를 그리므로
  // 본문 표면을 밝게 덮지 않으면 제목·본문·표 데이터가 읽히지 않는다(R1 Critical).
  it('.ty_output이 산출물 본문만 밝은 표면으로 덮는다(round07f) — 퍼블 원본은 그대로다', () => {
    const ext = live(read('styles/publish-ext.css'))
    const main = /\.node_detail_viewer\.ty_output\s+\.node_detail_viewer_main\s*\{([^}]*)\}/.exec(ext)
    expect(main, '.ty_output 본문 규칙이 없다 — 검은 글자가 #333 위에 얹힌다').not.toBeNull()
    expect(main[1]).toMatch(/background:\s*#fff/i)
    // 퍼블은 「썸네일 | 프리뷰」 2단 flex + 0.8rem padding이다. 둘 다 되돌려야
    // 문서 한 덩어리가 제 폭으로 흐르고 화면 맞춤 측정이 성립한다(Important 2 ①②).
    expect(main[1]).toMatch(/display:\s*block/)
    expect(main[1]).toMatch(/padding:\s*0/)
    // 33.2rem(664px) 고정폭 해제 — 상세 화면 폭과 무관한 상자가 되면 안 된다.
    expect(ext).toMatch(/\.node_detail_viewer\.ty_output\s*\{[^}]*width:\s*100%/)

    // 배율 래퍼 — zoom(레이아웃 재계산)이지 transform:scale(레이아웃 불변)이 아니다.
    // scale로 되돌리면 「화면 맞춤」 뒤에도 빈 가로 스크롤이 남는다(브라우저 실측).
    const scaler = /\.node_detail_viewer\.ty_output\s+\.node_detail_viewer_doc\s*\{([^}]*)\}/.exec(ext)
    expect(scaler, '배율 래퍼 규칙이 없다').not.toBeNull()
    expect(scaler[1]).toMatch(/zoom:\s*var\(--doc-zoom/)
    expect(scaler[1]).not.toMatch(/transform:/)
    // 래퍼 폭이 「내용의 폭」이어야 화면 맞춤의 분모가 성립한다.
    expect(scaler[1]).toMatch(/width:\s*max-content/)

    // 그리고 **퍼블 원본은 손대지 않았다** — NodeModal의 이미지 뷰어는 다크 크롬
    // 그대로여야 하고, 이 프로젝트는 퍼블 납품물을 정본으로 보존한다(CLAUDE.md §2).
    const publish = read('styles/publish/component.css')
    expect(publish).toMatch(/\.node_detail_viewer\s*\{[^}]*background:\s*#333/)
    expect(publish).toMatch(/\.node_detail_viewer\s*\{[^}]*width:\s*33\.2rem/)
    expect(publish, '퍼블 원본에 산출물 전용 클래스가 새어 들어갔다').not.toContain('ty_output')
  })

  // round07f Task 6 — 산출물 원문 뷰어의 「인쇄」는 window.print() 하나로는 탭줄·
  // 검색바·다운로드 버튼까지 종이에 싣는다. spec §3.3이 요구한 「뷰어만 남기는
  // print CSS」가 실제로 파일에 있는지 잠근다 — 인쇄 결과는 jsdom으로 렌더해 볼 수
  // 없으므로(이 파일 머리주석의 한계 그대로) 규칙의 존재를 텍스트로 고정한다.
  it('@media print가 뷰어 본문만 남긴다(round07f) — 인쇄 시 셸이 함께 실리지 않는다', () => {
    const ext = live(read('styles/publish-ext.css'))
    const blocks = collectPrintBlocks(ext)
    expect(blocks.length, 'publish-ext.css에 @media print 블록이 없다').toBeGreaterThan(0)
    const rules = blocks.join('\n')
    expect(rules).toMatch(/body\.is_printing_output\s+\*\s*\{[^}]*visibility:\s*hidden/)
    expect(rules).toMatch(/\.node_detail_viewer_main[^{]*\{[^}]*visibility:\s*visible/)
    // 뷰어 본문은 스크롤 컨테이너(max-height는 JSX 인라인 스타일)라 !important로
    // 풀지 않으면 화면에 보이던 만큼만 인쇄된다.
    expect(rules).toMatch(/max-height:\s*none\s*!important/)
    expect(rules).toMatch(/overflow:\s*visible\s*!important/)
    // 툴바는 종이에 의미가 없다.
    expect(rules).toMatch(/\.node_detail_viewer_bar\s*\{[^}]*display:\s*none/)
  })

  // 이 파일은 index.css가 **전역**으로 import한다. 그래서 인쇄 규칙의 범위가
  // 곧 「어느 화면에서 Ctrl+P를 누르든」이다. body.is_printing_output 밖으로
  // 한 줄이라도 새면 뷰어가 없는 화면(/library·/manage/*·/admin/*)의 인쇄가
  // 통째로 백지가 된다 — 되살릴 요소가 그 화면에 없기 때문이다(R1 Important 1).
  it('@media print의 모든 규칙이 body.is_printing_output 안으로 한정된다 — 뷰어 없는 화면 인쇄가 죽지 않는다', () => {
    const ext = live(read('styles/publish-ext.css'))
    const blocks = collectPrintBlocks(ext)
    expect(blocks.length, 'publish-ext.css에 @media print 블록이 없다').toBeGreaterThan(0)
    // 블록마다 셀렉터만 뽑아(선언부는 버린다) 전 블록에 걸쳐 모은다 — 블록이 여러 개면
    // 그중 하나만 검사하고 넘어가는 구멍을 막는다(위 collectPrintBlocks 주석 참조).
    const selectors = blocks.flatMap((rules) =>
      rules
        .split('}')
        .map((chunk) => chunk.split('{')[0])
        .join(',')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    )
    expect(selectors.length, '인쇄 블록이 비었다').toBeGreaterThan(3)
    const unscoped = selectors.filter((s) => !s.startsWith('body.is_printing_output'))
    expect(
      unscoped,
      `인쇄 규칙이 전역으로 샌다: ${unscoped.join(' / ')} — 이 파일은 모든 화면에 ` +
      `로드되므로, 범위를 열면 뷰어가 없는 화면의 Ctrl+P가 백지를 뽑는다.`,
    ).toEqual([])
  })

  // round10b Task A — 노드 상세 모달 두 결함(NodeModal.jsx). 퍼블 원본(component.css)은
  // 고치지 않으므로 확장(publish-ext.css)에 덧댄 속성이 실제로 살아 있는지만 여기서 잠근다.
  it('.node_detail_viewer_name이 긴 파일명을 말줄임한다(round10b) — min-width:0 + overflow ellipsis', () => {
    const ext = live(read('styles/publish-ext.css'))
    const rule = /\.node_detail_viewer_name\s*\{([^}]*)\}/.exec(ext)
    expect(rule, '.node_detail_viewer_name 규칙이 없다').not.toBeNull()
    expect(rule[1]).toMatch(/min-width:\s*0/)
    expect(rule[1]).toMatch(/overflow:\s*hidden/)
  })

  // round10b 재리뷰 M-3 — .node_detail_viewer_name은 component.css가 display:flex로
  // 만든다(아이콘+파일명 가로 배치). text-overflow는 flex 컨테이너 자신의 익명
  // 텍스트 아이템에는 먹지 않는다(inline formatting context가 아니라서) — 위 시험이
  // 잠갔던 세 속성을 그 컨테이너에 그대로 둬도 잘림에 "…"가 붙지 않는다. 그래서
  // 파일명을 감싸는 별도 요소(.node_detail_viewer_name_text)를 두고 그쪽에
  // text-overflow:ellipsis + white-space:nowrap을 건다 — flex item은 blockify되어
  // 이 요소가 inline(span)이어도 실제로는 block으로 렌더되므로 ellipsis가 먹는다.
  it('.node_detail_viewer_name_text가 파일명에 말줄임표를 실제로 그린다(round10b 재리뷰 M-3)', () => {
    const ext = live(read('styles/publish-ext.css'))
    const rule = /\.node_detail_viewer_name_text\s*\{([^}]*)\}/.exec(ext)
    expect(rule, '.node_detail_viewer_name_text 규칙이 없다').not.toBeNull()
    expect(rule[1]).toMatch(/min-width:\s*0/)
    expect(rule[1]).toMatch(/overflow:\s*hidden/)
    expect(rule[1]).toMatch(/text-overflow:\s*ellipsis/)
    expect(rule[1]).toMatch(/white-space:\s*nowrap/)
  })

  it('.node_detail_trans_sub_head가 스크롤 중 상단에 고정된다(round10b) — sticky + 불투명 배경', () => {
    const ext = live(read('styles/publish-ext.css'))
    const rule = /\.node_detail_trans_sub_head\s*\{([^}]*)\}/.exec(ext)
    expect(rule, '.node_detail_trans_sub_head 규칙이 없다').not.toBeNull()
    expect(rule[1]).toMatch(/position:\s*sticky/)
    expect(rule[1]).toMatch(/top:\s*0/)
    // 배경이 없으면 스크롤되는 본문 글자가 이 소제목 뒤로 비쳐 보인다 — 빠뜨리기 쉬운 부분이라
    // 시험으로 고정한다(brief 경고 참조).
    expect(rule[1], '배경이 없으면 스크롤되는 본문 글자가 비쳐 보인다').toMatch(/background:\s*#fff/)
    expect(rule[1]).toMatch(/z-index:\s*1\b/)
  })

  // round10b 재리뷰 M-4 — AiBriefCard.jsx가 고지 아이콘(ai_brief_notice_icon)을
  // 원래 자리 .ai_brief_notice(component.css — display:flex; gap:0.3rem)에서
  // .ai_brief_desc(component.css — flex 없음)로 옮겼는데 그 보정을 안 뒀다. JSX의
  // 줄바꿈은 공백이 되지 않으므로 아이콘과 글자가 그대로 붙는다 — flex+같은 gap으로
  // 되돌린다.
  it('.ai_brief_desc가 고지 아이콘과 글자 사이 gap을 되살린다(round10b 재리뷰 M-4)', () => {
    const ext = live(read('styles/publish-ext.css'))
    const rule = /\.ai_brief_desc\s*\{([^}]*)\}/.exec(ext)
    expect(rule, '.ai_brief_desc 규칙이 없다').not.toBeNull()
    expect(rule[1]).toMatch(/display:\s*flex/)
    expect(rule[1]).toMatch(/gap:\s*0\.3rem/)
  })

  // round10c Task B1 #19 — 기획 이슈: 사이드바를 접으면(.lnb.is_collapsed) 프로필 아바타가
  // 가로로 눌린다. 라이브 실측(2026-09-18, https://sai.landsoft.co.kr, 배포본에 직접 CSS를
  // 주입해 전후를 쟀다): 접힘 상태 .lnb_profile이 좌우 패딩 8px씩을 그대로 가져가 콘텐츠
  // 폭 24px 중 8px만 남고, 아바타(CSS 지정 24×24, 원본 40×40)의 실제 렌더가 8×24였다.
  // 주입 후 재측정: 접힘 24×24(정사각) · 펼침 40×40·padding 8px 유지, 회귀 없음.
  //
  // ★ 범인은 flex-shrink가 아니다(처음 진단이 틀렸고 라이브에서 바로잡았다). 아바타에는
  //   publish/layout.css:125가 이미 flex-shrink:0을 걸어 뒀고 실측 computed 값도 "0"이다.
  //   실제 상한은 Tailwind preflight의 `img { max-width: 100% }`이고, max-width는 플렉스
  //   신축이 끝난 뒤에 적용되는 별도 상한이라 flex-shrink:0으로도 막지 못한다. 그래서
  //   고침은 「안 줄어들게」가 아니라 「부모가 자리를 내주게」다 — 아래 시험이 그것을 잠근다.
  //
  // jsdom은 실제 레이아웃을 계산하지 않아(이 파일 머리주석 참조) "8×24가 24×24가 됐다"를
  // 시험으로 재현할 수 없다 — 그래서 치수가 아니라 **규칙의 존재**를 잠그고, 치수는
  // 배포 후 라이브에서 다시 잰다(brief 실측 절차 그대로).
  it('.lnb.is_collapsed .lnb_profile이 접힘 전용 좌우 패딩 0을 갖는다(round10c #19)', () => {
    const ext = live(read('styles/publish-ext.css'))
    const rule = /\.lnb\.is_collapsed \.lnb_profile\s*\{([^}]*)\}/.exec(ext)
    expect(rule, '.lnb.is_collapsed .lnb_profile 규칙이 없다').not.toBeNull()
    expect(rule[1]).toMatch(/padding-left:\s*0/)
    expect(rule[1]).toMatch(/padding-right:\s*0/)
  })

  // object-fit:cover는 고침이 아니라 대비다 — 지금은 원본이 정사각(40×40)이라 fill이어도
  // 결과가 같지만, 비정사각 아바타가 들어오면 fill은 다시 찌그러뜨린다. 접힘 전용이 아니라
  // 전역인데, 펼침 40×40에 영향이 없음을 라이브에서 실측 확인했다.
  it('.lnb_profile_avatar가 object-fit:cover를 갖는다(round10c #19) — 비정사각 원본 대비', () => {
    const ext = live(read('styles/publish-ext.css'))
    const rule = /\.lnb_profile_avatar\s*\{([^}]*)\}/.exec(ext)
    expect(rule, '.lnb_profile_avatar 규칙이 없다').not.toBeNull()
    expect(rule[1]).toMatch(/object-fit:\s*cover/)
  })
})
