// 이 파일의 책임: v2 이식의 주요 밀도(spacing/폰트) 리터럴이 ¼ 축소 없이 보존됨을 텍스트로 고정한다.
//
// 배경(round06d 함정): 퍼블 CSS를 옮겨 적을 때 정수 spacing이 실수로 ¼로 줄거나
// (예: 16rem → 4rem) 리터럴 폰트가 축소되는 사고가 있었다. css-contract.test.js는
// "규칙이 있다/없다"만 보고 "값이 맞다"는 보지 않으므로, 핵심 리터럴 값을 여기서
// 문자 그대로 고정한다.
import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect } from 'vitest'

const SRC = path.resolve(__dirname, '..')
const read = (rel) => fs.readFileSync(path.join(SRC, rel), 'utf8')

// v2 layout.css 실측값(round06d 함정: 정수 spacing ¼ 축소·리터럴 폰트 축소 방지)
const LAYOUT_DENSITY = [
  [/\.lnb\s*\{[^}]*width:\s*16rem/, 'LNB 폭 16rem'],
  [/\.lnb\s*\{[^}]*padding:\s*1\.2rem\s+0\.8rem/, 'LNB 패딩 1.2rem 0.8rem'],
  [/\.lnb\s*\{[^}]*gap:\s*1\.2rem/, 'LNB gap 1.2rem'],
  [/\.lnb\.is_collapsed\s*\{[^}]*width:\s*3\.6rem/, '접힘 폭 3.6rem'],
  [/\.lnb_new_btn\s*\{[^}]*height:\s*3rem/, '새검색 버튼 높이 3rem'],
  [/\.lnb_new_txt\s*\{[^}]*font-size:\s*0\.9rem/, '새검색 폰트 0.9rem'],
  [/\.lnb_menu_link\s*\{[^}]*height:\s*2\.5rem/, '메뉴 링크 높이 2.5rem'],
  [/\.lnb_menu_link\s*\{[^}]*font-size:\s*0\.8rem/, '메뉴 폰트 0.8rem'],
  [/\.mng_page_tit\s*\{[^}]*font-size:\s*2rem/, '페이지 제목 2rem'],
  [/\.mng_page_tit\s*\{[^}]*padding:\s*2rem\s+0/, '페이지 제목 패딩 2rem 0'],
]
describe('CSS 밀도 — v2 layout 리터럴 보존', () => {
  const css = read('styles/publish/layout.css')
  it.each(LAYOUT_DENSITY)('%s 값이 보존된다', (re, _label) => {
    expect(css).toMatch(re)
  })
  it('px 폭발 없음 — LNB 폭이 실수로 px(64px 등)로 바뀌지 않았다', () => {
    expect(css).not.toMatch(/\.lnb\s*\{[^}]*width:\s*\d+px/)
  })
})

// v2 component.css 검색흐름(R6c-ext D1-5b) 실측값 — 검색바 높이·카드 그리드 열수·
// 필터 폭·모달 폭·갤러리 높이가 ¼ 축소나 오타로 줄지 않았음을 문자 그대로 고정한다.
const COMPONENT_DENSITY = [
  [/\.result_query_bar\s*\{[^}]*height:\s*3\.2rem/, 'result_query_bar 높이 3.2rem'],
  [/\.result_card_grid\s*\{[^}]*grid-template-columns:\s*repeat\(4,\s*1fr\)/, 'result_card_grid 4열'],
  [/\.result_filter_list\s*\{[^}]*width:\s*12rem/, 'result_filter_list 폭 12rem'],
  [/\.detail_popup\s*\{[^}]*width:\s*48rem/, 'detail_popup 폭 48rem'],
  [/\.detail_popup_gallery\s*\{[^}]*height:\s*18rem/, 'detail_popup_gallery 높이 18rem'],
]
describe('CSS 밀도 — v2 component 검색흐름 리터럴 보존', () => {
  const css = read('styles/publish/component.css')
  it.each(COMPONENT_DENSITY)('%s 값이 보존된다', (re, _label) => {
    expect(css).toMatch(re)
  })
})

// v2 component.css AI대화(R6c-ext D1-6) 실측값 — 웰컴 배너 높이·인용 그리드 열수·
// AI 버블 패딩·전송 버튼 크기가 ¼ 축소나 오타로 줄지 않았음을 문자 그대로 고정한다.
//
// round07j — AI 버블 패딩이 `1.2rem 4rem 1.2rem 1.2rem`(우측만 4rem 인 비대칭)에서
// **`1.2rem` 균등**으로 바뀌었다. 퍼블이 같은 커밋에서 버블 폭 확보 방식을 통째로
// 갈아탄 결과다 — 우측 여백을 패딩으로 만들던 것을, 이제 부모(.chat_msg_content)의
// `padding-right: 15%` + `min-width: 60%` 와 버블의 `width: 100%` 가 만든다.
// 그러므로 이 줄은 「값이 실수로 줄었다」가 아니라 **설계가 옮겨간 것**이고,
// 퍼블이 정본이므로(CLAUDE.md §2) 새 값을 잠근다.
// ★ 이 테스트의 목적은 그대로다 — 셋 중 하나만 되돌아가면 버블이 다시 깨지므로
//   폭을 만드는 세 값을 함께 고정한다(아래 세 줄).
const CHAT_DENSITY = [
  [/\.chat_welcome\s*\{[^}]*height:\s*4\.65rem/, 'chat_welcome 높이 4.65rem'],
  [/\.chat_welcome\s*\{[^}]*width:\s*calc\(100% \+ 2\.4rem\)/, 'chat_welcome bleed 폭 calc(100% + 2.4rem)'],
  [/\.chat_msg_cite\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/, 'chat_msg_cite 2열'],
  // ★ 값의 **끝**을 [;}] 로 못박는다. 처음엔 [;\s] 로 뒀는데, 그러면 공백도
  //   받아서 옛 비대칭 값 `padding: 1.2rem 4rem 1.2rem 1.2rem` 의 앞부분에도
  //   그대로 걸려 **되돌려도 초록**이었다(변이 테스트로 발견, 2026-09-09).
  //   한 토큰짜리 값을 잠글 때 뒤를 \s 로 열어 두면 그 테스트는 못 실패한다.
  [/\.chat_msg\.ty_ai \.chat_msg_bubble\s*\{[^}]*padding:\s*1\.2rem\s*[;}]/, 'AI 버블 패딩 1.2rem 균등'],
  [/\.chat_msg\.ty_ai \.chat_msg_bubble\s*\{[^}]*width\s*:\s*100%/, 'AI 버블 width 100%'],
  [/\.chat_msg\.ty_ai \.chat_msg_content\s*\{[^}]*padding-right:\s*15%/, 'AI 버블 컨텐츠 우측 여백 15%'],
  [/\.chat_input_send\s*\{[^}]*width:\s*1\.8rem/, 'chat_input_send 폭 1.8rem'],
  [/\.chat_input_dock\s*\{[^}]*position:\s*sticky/, 'chat_input_dock sticky'],
]
describe('CSS 밀도 — v2 component AI대화 리터럴 보존', () => {
  const css = read('styles/publish/component.css')
  it.each(CHAT_DENSITY)('%s 값이 보존된다', (re, _label) => {
    expect(css).toMatch(re)
  })
  it('인용칩 글로우가 반쪽 이식이 아니다 — .glow_border 기본 규칙과 rect 12규칙이 함께 있다', () => {
    // .chat_cite_item .glow_border 계열은 기본 규칙의 opacity/animation 을 뒤집을 뿐이다.
    // 기본 규칙이 없으면 호버해도 아무 것도 켜지지 않는다(D1-6 판단 근거).
    expect(css).toMatch(/^\.glow_border \{/m)
    for (let n = 1; n <= 12; n += 1) {
      expect(css, `rect:nth-of-type(${n}) 누락`).toContain(`.glow_border rect:nth-of-type(${n})`)
      expect(css, `@keyframes glow_border_spin_${n} 누락`).toContain(`@keyframes glow_border_spin_${n} `)
    }
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\) \{ \.glow_border rect/)
  })
})

// v2 component.css 산출물생성(R6c-ext D1-7) 실측값 — 노드그래프 높이·클러스터링 패널 폭·
// 세부유형 행 그리드 비율이 ¼ 축소나 오타로 줄지 않았음을 고정한다.
// (node_result_body 18rem 은 round07b-ext 리뷰에서 뺐다 — task-11이 「생성 결과 패널」
//  마크업을 걷어냈고 그 CSS 블록도 함께 제거돼, 지킬 리터럴 자체가 없어졌다.)
// node_graph 21.2rem 은 특히 틀리기 쉽다(px-6 류로 옮기면 21.2rem=424px 이 6px 근방으로 줄 수 있다).
const OUTPUT_DENSITY = [
  [/\.node_graph\s*\{[^}]*height:\s*21\.2rem/, 'node_graph 높이 21.2rem'],
  [/\.node_criteria\s*\{[^}]*width:\s*12rem/, 'node_criteria 폭 12rem'],
  [/\.node_select_type_row\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*3fr\)\s*minmax\(0,\s*1fr\)/, 'node_select_type_row 그리드 3:1'],
]
describe('CSS 밀도 — v2 component 산출물생성 리터럴 보존', () => {
  const css = read('styles/publish/component.css')
  it.each(OUTPUT_DENSITY)('%s 값이 보존된다', (re, _label) => {
    expect(css).toMatch(re)
  })
})

// v2 component.css 자료관리 재퍼블(R6c-ext D2a) 실측값 — 공용 section_tit 폰트가
// upload_dropzone_tit/template_bar_tit 전용 규칙과 같은 1.2rem/700을 유지하는지,
// 업로드 버튼 아이콘이 1.25rem 정사각을 유지하는지 문자 그대로 고정한다. 이 값들이
// ¼ 축소(예: 1.2rem → 0.3rem)되면 자료관리 5탭 전부의 제목·아이콘이 함께 깨진다.
const MANAGE_DENSITY = [
  [/\.section_tit\s*\{[^}]*font-size:\s*1\.2rem[^}]*font-weight:\s*700/, 'section_tit 1.2rem/700'],
  [/\.upload_dropzone_btn_icon\s*\{[^}]*width:\s*1\.25rem[^}]*height:\s*1\.25rem/, 'upload_dropzone_btn_icon 1.25rem 정사각'],
  [/\.data_filter_bar \.data_filter_search_input\s*\{[^}]*font-size:\s*0\.7rem/, 'data_filter_search_input 폰트 0.7rem'],
]
describe('CSS 밀도 — v2 component 자료관리 재퍼블 리터럴 보존', () => {
  const css = read('styles/publish/component.css')
  it.each(MANAGE_DENSITY)('%s 값이 보존된다', (re, _label) => {
    expect(css).toMatch(re)
  })
})

// v2 component.css 시스템관리 셸 재퍼블(R6c-ext D2b) 실측값 — KPI 값 폰트·검색바 높이가
// ¼ 축소(예: 2.3rem → 0.5rem대)되지 않았는지, stat_card_list가 4열을 유지하는지 고정한다.
// stat_card_value 2.3rem은 오늘 질의 수 "9,142" 같은 큰 수를 담는 값이라 특히 눈에 띄게
// 틀리기 쉽다(px-6류로 옮기면 2.3rem=46px이 6px 근방으로 줄 수 있다).
const SYSTEM_SHELL_DENSITY = [
  [/\.stat_card_list\s*\{[^}]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/, 'stat_card_list 4열'],
  [/\.stat_card_value\s*\{[^}]*font-size:\s*2\.3rem/, 'stat_card_value 폰트 2.3rem'],
  [/\.node_setting_bar_input\s*\{[^}]*height:\s*2\.6rem/, 'node_setting_bar_input 높이 2.6rem'],
]
describe('CSS 밀도 — v2 component 시스템관리 셸 재퍼블 리터럴 보존', () => {
  const css = read('styles/publish/component.css')
  it.each(SYSTEM_SHELL_DENSITY)('%s 값이 보존된다', (re, _label) => {
    expect(css).toMatch(re)
  })
})

// v2 component.css 라이브러리 재퍼블(R6c-ext D2c) 실측값 — 카드뷰 4열 그리드·아바타
// 스택 원 지름·잠금 배지의 좌우 비대칭 패딩이 ¼ 축소나 오타로 줄지 않았는지 고정한다.
// library_card_lock의 padding(0.4rem 1.2rem)은 좌우가 위아래의 3배라 옮겨 적을 때
// 가장 틀리기 쉽다(px-6류로 옮기면 1.2rem=24px이 6px 근방으로 줄 수 있다).
const LIBRARY_DENSITY = [
  [/\.library_card_list\s*\{[^}]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/, 'library_card_list 4열'],
  [/\.avatar_stack_icon\s*\{[^}]*width:\s*1\.2rem[^}]*height:\s*1\.2rem/, 'avatar_stack_icon 1.2rem 정원'],
  [/\.library_card_lock\s*\{[^}]*padding:\s*0\.4rem 1\.2rem/, 'library_card_lock 패딩 0.4rem 1.2rem(좌우 비대칭)'],
]
describe('CSS 밀도 — v2 component 라이브러리 재퍼블 리터럴 보존', () => {
  const css = read('styles/publish/component.css')
  it.each(LIBRARY_DENSITY)('%s 값이 보존된다', (re, _label) => {
    expect(css).toMatch(re)
  })
})

// v2 component.css AI 브리핑 카드(round06f 갈래 B) 실측값 — 로고 배지 지름·태그 높이·
// 본문 상단 여백·고지 아이콘 크기가 ¼ 축소나 오타로 줄지 않았는지 고정한다.
// ai_brief_logo의 2rem 원형 배지는 그라디언트 배경과 함께 눈에 잘 띄어 축소되면 바로
// 드러나지만, ai_brief_notice_icon처럼 0.7rem대 미세 아이콘은 반토막이 나도 화면에서
// 알아채기 어렵다(px-6류로 옮기면 0.7rem=14px이 6px 근방으로 줄 수 있다).
const AI_BRIEF_DENSITY = [
  [/\.ai_brief_card\s*\{[^}]*padding:\s*1rem\s+1\.2rem/, 'ai_brief_card 패딩 1rem 1.2rem'],
  [/\.ai_brief_logo\s*\{[^}]*width:\s*2rem[^}]*height:\s*2rem/, 'ai_brief_logo 2rem 정원'],
  [/\.ai_brief_tag\s*\{[^}]*height:\s*1rem/, 'ai_brief_tag 높이 1rem'],
  [/\.ai_brief_body\s*\{[^}]*margin-top:\s*1\.2rem/, 'ai_brief_body 상단 여백 1.2rem'],
  [/\.ai_brief_notice_icon\s*\{[^}]*width:\s*0\.7rem[^}]*height:\s*0\.7rem/, 'ai_brief_notice_icon 0.7rem 정사각'],
  // p3-task-6-brief.md Step 1 지정분(리뷰 Fix 2로 보강) — 본문 폰트·더보기 버튼 높이.
  [/\.ai_brief_body\s*\{[^}]*font-size:\s*0\.8rem/, 'ai_brief_body 폰트 0.8rem'],
  [/\.ai_brief_more\s*\{[^}]*height:\s*1\.6rem/, 'ai_brief_more 높이 1.6rem'],
]
describe('CSS 밀도 — v2 component AI 브리핑 카드 리터럴 보존', () => {
  const css = read('styles/publish/component.css')
  it.each(AI_BRIEF_DENSITY)('%s 값이 보존된다', (re, _label) => {
    expect(css).toMatch(re)
  })

  it('glow_border 규칙이 파일에 한 벌만 있다(round06f ai_brief 이식 시 재반입 금지)', () => {
    // 퍼블에서 glow_border 27규칙은 ai_brief_card 그룹(L318-344) 한복판에 있다. 그룹을
    // 통째로 옮기면 D1-6이 이미 반입해 둔 [S] glow_border 와 겹쳐 @keyframes 가 두 벌이
    // 되고, 뒤 정의가 앞을 조용히 덮어쓴다(렌더는 되므로 어떤 테스트도 잡지 못한다).
    // 기존 D1-6 가드(css-density.test.js 위쪽 CHAT_DENSITY)는 toContain(존재)만 보므로
    // 중복 재반입을 잡지 못한다 — 이 테스트가 "조용한 덮어쓰기"의 유일한 방어선이다.
    for (let n = 1; n <= 12; n += 1) {
      const hits = css.split(`@keyframes glow_border_spin_${n} `).length - 1
      expect(hits, `@keyframes glow_border_spin_${n} 이 ${hits}벌 있다`).toBe(1)
    }
    expect(css.split('.glow_border rect:nth-of-type(1)').length - 1).toBe(1)
  })
})

// v2 component.css 자료유형 드롭다운(round06f 갈래 D) 실측값 — 트리거 높이(1.75rem)와
// 패널 z-index(10), 목록 gap(0.8rem)이 ¼ 축소나 오타로 줄지 않았음을 고정한다.
// z-index 10 은 특히 중요하다 — 패널은 result_meta_bar 아래 결과 카드 위로 떠야 하는데
// 값이 줄면 카드에 가려 항목을 고를 수 없다(렌더는 되므로 단위 테스트가 잡지 못한다).
const DROPDOWN_DENSITY = [
  [/\.dropdown_box_trigger\s*\{[^}]*height:\s*1\.75rem/, 'dropdown_box_trigger 높이 1.75rem'],
  [/\.dropdown_box_panel\s*\{[^}]*z-index:\s*10/, 'dropdown_box_panel z-index 10'],
  [/\.dropdown_box_panel\s*\{[^}]*width:\s*max-content/, 'dropdown_box_panel width max-content'],
  [/\.dropdown_box_list\s*\{[^}]*gap:\s*0\.8rem/, 'dropdown_box_list gap 0.8rem'],
  [/\.dropdown_box_list\.ty_check \.form_check \.form_check_label\s*\{[^}]*font-size:\s*0\.7rem/, 'ty_check 항목 라벨 0.7rem'],
  // round07h — SortSelect.jsx·LabeledSelect.jsx(공개여부·종류, 단일선택 listbox 변형)가 첫
  // 소비처가 되어 반입한 두 규칙. 옵션 글자가 브라우저 기본 버튼 폰트로 폴백하지 않도록 잠근다.
  [/\.dropdown_box_list_item\{[^}]*display:\s*flex/, 'dropdown_box_list_item display flex'],
  [/\.dropdown_box_item\s*\{[^}]*font-size:\s*0\.7rem/, 'dropdown_box_item 글자 0.7rem'],
  [/\.dropdown_box_item\s*\{[^}]*color:\s*#1a1a1a/, 'dropdown_box_item 색 #1a1a1a'],
]
describe('CSS 밀도 — v2 component 자료유형 드롭다운 리터럴 보존', () => {
  const css = read('styles/publish/component.css')
  it.each(DROPDOWN_DENSITY)('%s 값이 보존된다', (re, _label) => {
    expect(css).toMatch(re)
  })

  it('앱이 그리지 않는 dropdown_box 변형은 반입하지 않는다(D7 죽은 코드 미반입)', () => {
    // 노출갯수(ty_page_size)는 §1.4 #2로 미참조, #embed_filter_status 는 다른 화면의 ID
    // 선택자다. dropdown_box_item 계열(단일선택 listbox 변형)은 round06f 당시엔 소비처가
    // ty_check(다중선택)뿐이라 미반입이었으나, round07h 의 SortSelect·LabeledSelect가
    // 첫 소비처가 되어 반입됐다(위 DROPDOWN_DENSITY 가 그 값을 잠근다) — 더는 제외 목록이 아니다.
    expect(css).not.toContain('.dropdown_box.ty_page_size')
    expect(css).not.toContain('#embed_filter_status')
  })
})

// v2 component.css 만족도 위젯(round06f 갈래 C) 실측값 — 점수 버튼 높이(4.5rem)와
// 코멘트 입력 높이(7rem)가 ¼ 축소나 오타로 줄지 않았음을 고정한다. 4.5rem=90px 은 얼굴
// 아이콘 + 숫자 2단을 세로로 담는 값이라 줄면 두 요소가 겹친다. 포커스링은 리터럴이 아니라
// 토큰(var(--focus-ring))으로 반입했음을 함께 잠근다(§8.4 — 색 단일 출처 유지).
const RATING_DENSITY = [
  [/\.rating_score_btn\s*\{[^}]*height:\s*4\.5rem/, 'rating_score_btn 높이 4.5rem'],
  [/\.rating_score_list\s*\{[^}]*gap:\s*0\.8rem/, 'rating_score_list gap 0.8rem'],
  [/\.rating_comment\s*\{[^}]*height:\s*7rem/, 'rating_comment 높이 7rem'],
  [/\.rating_widget\s*\{[^}]*padding:\s*1\.2rem/, 'rating_widget 패딩 1.2rem'],
  [/\.rating_widget \.form_group\s*\{[^}]*margin-top:\s*1\.6rem/, 'rating form_group 상단 여백 1.6rem'],
]
describe('CSS 밀도 — v2 component 만족도 위젯 리터럴 보존', () => {
  const css = read('styles/publish/component.css')
  it.each(RATING_DENSITY)('%s 값이 보존된다', (re, _label) => {
    expect(css).toMatch(re)
  })

  it('포커스링은 리터럴 #256ef4가 아니라 var(--focus-ring)으로 반입한다(색 단일 출처)', () => {
    expect(css).toMatch(/\.rating_score_btn:has\(\.rating_score_input:focus-visible\)\s*\{[^}]*outline:\s*2px dashed var\(--focus-ring\)/)
    expect(css).not.toMatch(/\.rating_score_btn:has\(\.rating_score_input:focus-visible\)\s*\{[^}]*#256ef4/)
  })

  it('4점(보통)은 퍼블대로 2·3점과 같은 적색 계열 ty_02다(§1.4 #6 ① — 결함이지만 퍼블 준수)', () => {
    // 색을 임의로 고치지 않았음을 잠근다. 개정은 디자인 라운드의 몫이다(CLAUDE.md §2).
    expect(css).toMatch(/\.rating_score_btn\.ty_02\s*\{[^}]*border-color:\s*#ff4a3a/)
  })
})
