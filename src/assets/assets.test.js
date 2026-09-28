// 이 파일의 책임: 퍼블(publish-v1 + v2 갱신분)에서 반입한 정적 자산과, 코드가 계속 참조하는
// 기존 자산이 실제로 파일로 존재하는지 계약으로 지킨다.
// 왜 테스트로 지키나: 자산 누락은 빌드가 아니라 런타임 404 로 드러나 발견이 늦다.
// 파일명은 퍼블 원본 그대로 유지한다 — 재납품분과의 대조 비용을 0으로 두기 위해 개명하지 않는다.
//
// R6c-ext A1: publish-v2 img/ 전량 반입. v2 icon/layout은 v1의 상위집합(기존 파일과
// 바이트 동일 — 실측 diff 확인)이라 개수만 늘었다. etc/·sub/는 v2 신설 폴더라
// 새 디렉터리(src/assets/etc/·src/assets/sub/)로 들여온다(icons·layout과 같은 복수형 관례).
import fs from 'node:fs'
import path from 'node:path'
import { test, expect } from 'vitest'

const FONT_WEIGHTS = ['Light', 'Regular', 'Medium', 'SemiBold', 'Bold', 'ExtraBold']
const FONTS = FONT_WEIGHTS.flatMap((w) => [`Pretendard-${w}.woff2`, `Pretendard-${w}.woff`])

const ICONS = [
  'ic_angle.svg', 'ic_arrow_down.svg', 'ic_arrow_left.svg', 'ic_chat_bot.svg',
  'ic_check.svg', 'ic_chevron_left.svg', 'ic_chevron_right.svg',
  'ic_double_arrow_left.svg', 'ic_double_arrow_right.svg',
  'ic_download.svg', 'ic_download_dark.svg',
  'ic_file_excel.svg', 'ic_file_json.svg', 'ic_file_xml.svg',
  'ic_info.svg', 'ic_kebab.svg', 'ic_lnb_toggle.svg', 'ic_logo_mark.svg', 'ic_logout.svg',
  'ic_nav_data.svg', 'ic_nav_data_active.svg', 'ic_nav_home.svg', 'ic_nav_home_active.svg',
  'ic_nav_library.svg', 'ic_nav_search.svg', 'ic_nav_system.svg', 'ic_nav_system_active.svg',
  'ic_plus.svg', 'ic_search_btn.svg', 'ic_search_table.svg', 'ic_select_arrow.svg',
  'ic_sparkle.svg', 'ic_upload.svg',
  // R6c-ext A1 — v2 신규분(62개). ic_close·ic_nav_library_active·ic_nav_search_active는
  // v1에서 known-missing 이었다가 v2로 재납품됐다(§ KNOWN_MISSING 갱신 참조).
  'ic_ai_brief_logo.svg', 'ic_ai_chat_avatar.svg', 'ic_arrow_down_20.svg', 'ic_arrow_down_white.svg',
  'ic_arrow_left_24.svg', 'ic_arrow_right_24.svg', 'ic_arrow_sort_both.svg', 'ic_arrow_top.svg',
  'ic_calendar.svg', 'ic_certified.svg', 'ic_certified_white.svg',
  'ic_chat_copy.svg', 'ic_chat_reset.svg', 'ic_chat_send.svg', 'ic_chat_topic.svg',
  'ic_check_primary.svg', 'ic_close.svg', 'ic_comment.svg', 'ic_comment_white.svg',
  'ic_copy.svg', 'ic_copy_dark.svg', 'ic_document.svg', 'ic_document_white.svg',
  'ic_edit.svg', 'ic_emergency.svg', 'ic_export_all.svg', 'ic_external_link.svg',
  'ic_fit_page.svg', 'ic_fit_width.svg', 'ic_flag.svg',
  'ic_info_line.svg', 'ic_inquiry.svg', 'ic_library_save.svg', 'ic_myinfo.svg',
  'ic_nav_library_active.svg', 'ic_nav_search_active.svg',
  'ic_overview.svg', 'ic_page_next.svg', 'ic_page_prev.svg', 'ic_pdf_page.svg', 'ic_printer.svg',
  'ic_rating_face_1.svg', 'ic_rating_face_2.svg', 'ic_rating_face_3.svg', 'ic_rating_face_4.svg',
  'ic_rating_face_5.svg', 'ic_rating_face_6.svg', 'ic_rating_face_7.svg',
  'ic_regenerate.svg', 'ic_spread.svg', 'ic_swap.svg', 'ic_text_select.svg', 'ic_time.svg',
  'ic_timeline_dot.svg', 'ic_trend_down.svg', 'ic_trend_up.svg',
  'ic_view_grid.svg', 'ic_view_grid_active.svg', 'ic_view_list.svg', 'ic_view_list_active.svg',
  'ic_zoom_minus.svg', 'ic_zoom_plus.svg',
]

const LAYOUT = [
  'intro_orb_combined.png', 'logo.svg', 'logo_wordmark.svg',
  'page_bg.png', 'profile_avatar.svg',
  // R6c-ext A1 — v2 신규분(9개, 자료상세·라이브러리 카드 예시 이미지)
  'detail_sample_cover.png',
  'sample_archive_01.png', 'sample_archive_02.png', 'sample_archive_03.png', 'sample_archive_04.png',
  'sample_archive_05.png', 'sample_archive_06.png', 'sample_archive_07.png', 'sample_archive_08.png',
]

// R6c-ext A1 — v2 신설 폴더. etc/는 계정 아바타 예시 + KOGL 배지, sub/는 노드상세 미리보기 1장.
// icons·layout과 같은 복수형 관례를 따르되, v2 원본 폴더명(icon 단수)이 아니라
// 기존 app 자산 트리의 명명 관례(복수형)를 새 폴더에도 그대로 적용한다.
const ETC = [
  'avatar_01.png', 'avatar_02.png', 'avatar_03.png', 'avatar_04.png',
  'badge_kogl_type4.svg',
]
const SUB = ['node_detail_preview.png']

// 퍼블 미납 자산 — 퍼블 마크업이 참조하지만 img/icon/ 에 파일이 없다(재요청 목록 등재분).
// R6d-08 Icon.jsx 는 이 3건을 비활성 경로로 폴백한다(§6.5.4).
// 여기서 "없음"을 단언해 두는 이유: 재납품으로 파일이 들어오면 이 테스트가 먼저 깨져
// 폴백 코드를 걷어낼 시점을 알려주기 때문이다.
// 목록의 정의는 known-missing.js 한 곳뿐이다 — R6d-04 의 css-contract.test.js 도 같은 것을
// 읽는다. 두 곳에 적으면 재납품 때 한쪽만 고쳐 조용히 갈라진다.
//
// R6c-ext A1: v2에서 3건 모두 재납품돼 known-missing.js가 빈 배열이 됐다(§ 파일 주석 참조).
import { KNOWN_MISSING } from './known-missing'

// 기존 자산 중 남기는 것. logo.jpg·ci-gray.png 는 R6d-14 에서 파일째 삭제되므로 단언에서 뺐다.
// ci-symbol.png 는 D1-6 이전에는 pages/results/ChatTab.jsx 의 AI 아바타 폴백이 참조했으나,
// D1-6 재퍼블에서 그 아바타가 퍼블 자산(ic_ai_chat_avatar.svg)으로 교체되며 실소비처가 0이
// 됐다(grep 실측 — src/ 전체에서 남은 참조는 이 테스트 파일과 ChatTab.jsx:76 의 설명 주석뿐이다.
// Home.jsx·SearchNav.jsx 는 참조하지 않는다). 삭제 여부는 별도 정리 태스크로 분리하고, 여기서는
// 파일 존재만 계속 지킨다(KEPT 유지).
const KEPT = ['ci-symbol.png']

test('퍼블 반입 자산(v1+v2 갱신분)과 유지 자산이 존재한다', () => {
  const groups = [
    ['fonts', FONTS],
    ['icons', ICONS],
    ['layout', LAYOUT],
    ['etc', ETC],
    ['sub', SUB],
    ['', KEPT],
  ]
  let total = 0
  for (const [dir, files] of groups) {
    for (const f of files) {
      const rel = path.join('src/assets', dir, f)
      expect(fs.existsSync(path.join(__dirname, dir, f)), `누락: ${rel}`).toBe(true)
      total += 1
    }
  }
  expect(FONTS.length + ICONS.length + LAYOUT.length + ETC.length + SUB.length).toBe(127)
  expect(total).toBe(128)

  for (const f of KNOWN_MISSING) {
    expect(fs.existsSync(path.join(__dirname, 'icons', f)), `미납분이 들어왔다: ${f}`).toBe(false)
  }
})
