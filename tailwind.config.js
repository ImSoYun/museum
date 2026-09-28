/** @type {import('tailwindcss').Config} */
// 확장자 '.js'를 반드시 붙인다. tailwindcss 3.4는 'tailwindcss/defaultTheme'(무확장)를
// exports 맵에 노출하지 않아 Node ESM에서 ERR_MODULE_NOT_FOUND가 난다(실측).
import defaultTheme from 'tailwindcss/defaultTheme.js'

/**
 * 퍼블(workspace/design/publish-v1)은 html,body{font-size:20px}를 전제로 하고
 * 모든 치수를 rem으로 쓴다(layout.css L4 · component.css L2 주석). 실측한 최소
 * 스텝은 0.05rem이며 이는 루트 20px에서 정확히 1px이다.
 *
 * 그래서 스케일 키를 "20px 루트에서의 px 값"으로 잡는다.
 *   spacing[16] === '0.8rem'  → 20px 루트에서 16px
 * 퍼블 CSS의 0.8rem을 p-16 / gap-16 으로 그대로 옮길 수 있어, 값 번역이
 * 사람의 암산이 아니라 ÷20 나눗셈 하나로 끝난다.
 *
 * 주의: Tailwind 기본 스케일(1 = 0.25rem)과 키의 의미가 다르다.
 *       기본에서의 p-4(=1rem)는 여기서 p-20(=1rem)이다.
 */
const ROOT_PX = 20
const rem = (px) => `${px / ROOT_PX}rem`

/** 1px~200px를 1px 간격으로. 퍼블 최대 상용 치수는 3.6rem(72px)이고
 *  200px(10rem)까지면 LNB 폭 16rem을 제외한 전 구간을 덮는다. */
const spacing = { 0: '0px', px: '1px' }
for (let px = 1; px <= 200; px += 1) spacing[px] = rem(px)

/** 200px 초과 상용값만 개별 등록.
 *  320=16rem(.lnb width) 480=24rem(.card/.auth_inner/.alert_popup max-width)
 *  520=26rem(.upload_dropzone_inner) 1000=50rem(.intro_content max-width) */
for (const px of [240, 280, 320, 400, 480, 520, 640, 800, 1000, 1600]) {
  spacing[px] = rem(px)
}

/** legacy 호환 키 — Tailwind 기본 소수 키(0.5/1.5/2.5/3.5)를 쓰는 곳이
 *  비테스트 JSX에 124군데 남아 있다(gap-1.5 24 · py-1.5 21 · py-0.5 10 …).
 *  교체로 키가 사라지면 그 선언이 통째로 생성되지 않으므로, legacy 기준의
 *  픽셀 등가값(0.5=2px 1.5=6px 2.5=10px 3.5=14px)으로 다시 등록해 둔다.
 *  ※ 새 코드에서는 쓰지 않는다. round06b에서 정수 키로 치환한 뒤 이 블록을 지운다. */
Object.assign(spacing, { 0.5: rem(2), 1.5: rem(6), 2.5: rem(10), 3.5: rem(14) })

/** 퍼블 폰트 크기 실사용 구간은 12px(.auth_footer_txt 0.6rem)~40px(.mng_page_tit 2rem).
 *  기본 행간은 reset.css L154의 line-height:130%와 같은 1.3(무단위)으로 맞춘다. */
const publishFontSize = {}
for (let px = 10; px <= 48; px += 1) publishFontSize[px] = [rem(px), { lineHeight: '1.3' }]

export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    // ── spacing만 "교체"다 ──────────────────────────────────────────────
    // Tailwind 기본(1=0.25rem)과 퍼블(1=1px)이 같은 숫자 키를 두 의미로 쓰므로
    // 병합이 불가능하다. 기존 정수 키 594곳은 값이 1/4로 줄고, 이 시각 회귀가
    // 리스크 A(§12.2)이며 R6d-06 전 라우트 스윕으로 확인한다.
    // width/height/inset은 Tailwind가 spacing 위에 full·screen·분수를 더해
    // 별도로 정의하므로 w-full·h-screen·top-1/2(실측 62건)는 영향받지 않는다.
    spacing,

    // ── fontSize·borderRadius는 "병합"이다 ─────────────────────────────
    // 기본 키는 이름형(xs/sm/base/lg, sm/md/lg/xl/2xl/3xl)이고 퍼블 키는
    // 숫자형이라 겹치지 않는다. 교체하면 이름 키가 사라져 text-sm 125곳 /
    // rounded-* 92곳의 선언이 통째로 생성되지 않는다 — 단위 테스트는 클래스
    // 이름만 보므로 571 green인 채로 미전환 화면의 글자와 모서리가 소멸한다.
    fontSize: { ...defaultTheme.fontSize, ...publishFontSize },
    borderRadius: {
      ...defaultTheme.borderRadius,        // none·sm·DEFAULT·md·lg·xl·2xl·3xl·full 보존
      DEFAULT: rem(8),   // 0.4rem  — .form_input · .lnb_menu a · .tab_seg_menu (퍼블 값으로 덮어씀)
      4: rem(4),         // 0.2rem  — .tab_seg_btn · .data_table_dl_btn
      5: rem(5),         // 0.25rem — .btn_sm · .status_tag · .data_delete_btn
      8: rem(8),
      10: rem(10),       // 0.5rem  — .btn_lg · .lnb_new_btn
      16: rem(16),       // 0.8rem  — .lnb · .card · .alert_popup · .page_tabs
      20: rem(20),       // 1rem    — .intro_search_box
      25: rem(25),       // 1.25rem — .intro_search_card
      50: rem(50),       // 2.5rem  — .upload_dropzone_btn (알약형)
    },
    extend: {
      fontFamily: { sans: ['Pretendard', 'system-ui', 'sans-serif'] },
      lineHeight: { DEFAULT: '1.3' },       // reset.css L154 line-height:130%
      letterSpacing: { tight: '-0.05em' },  // reset.css L156 -1px의 20px 루트 등가
      colors: {
        // §5.3 최종 토큰표를 CSS 변수로 참조한다. 값을 두 곳에 적지 않기 위해
        // 하드코딩이 아니라 var()를 쓴다 — 토큰 정본은 src/styles/tokens.css 하나다.
        primary: {
          DEFAULT: 'var(--primary)',
          5: 'var(--primary5)', 10: 'var(--primary10)', 20: 'var(--primary20)',
          // 기존 키는 남긴다(미전환 화면 다수가 참조). 500만 퍼블 값으로 정렬.
          50: '#EAF2FE', 100: '#E9F1FE', 500: 'var(--primary)',
          600: '#0B50D0', 700: '#08429E', 800: '#0843A8',
        },
        navy: 'var(--navy)',
        status: {                            // 신설 — 퍼블 3종
          done: 'var(--status-done)',
          review: 'var(--status-review)',
          fail: 'var(--status-fail)',
        },
        // ── 퍼블 토큰 브리지 (R6d-02가 심은 것 — 전면 교체에서 반드시 옮긴다) ──
        // 소비처는 §5.6 규칙 2가 정한 "퍼블 미납품 화면"이다.
        // 지우면 src/theme/tokens.test.js 의 4번째 테스트가 즉시 red가 된다.
        pub: {
          primary: 'var(--primary)',
          primary5: 'var(--primary5)',
          primary10: 'var(--primary10)',
          primary20: 'var(--primary20)',
          navy: 'var(--navy)',
          black: 'var(--black)',
          white: 'var(--white)',
          gray40: 'var(--gray40)',
          gray50: 'var(--gray50)',
          gray70: 'var(--gray70)',
          gray80: 'var(--gray80)',
        },
        gra: { from: 'var(--gra-from)', to: 'var(--gra-to)' },
        focusring: 'var(--focus-ring)',
        // ok/prog/warn/bad는 개명하지 않고 유지한다 — §5.6 규칙 6.
        // 개명하면 미전환 6파일이 디자인과 무관한 이유로 red가 되어 게이트의
        // 신호대잡음비가 떨어진다.
        ok:   { DEFAULT: '#1E8E5A', bg: '#E6F4EC' },
        prog: { DEFAULT: '#2563EB', bg: '#E7EFFE' },
        warn: { DEFAULT: '#B7791F', bg: '#FBF3E2' },
        bad:  { DEFAULT: '#D6452F', bg: '#FBE9E5' },
        // ── 현행 키 전량 보존 (round06b 정리 대상) ──────────────────────
        // 미전환 화면이 279곳에서 참조한다(text-ink 95 · border-line 94 ·
        // bg-canvas 32 · bg-offwhite 22 …, 실측). 주석으로만 적어 두면
        // 이 블록을 옮겨 적는 순간 279개 선언이 함께 사라지므로 코드로 남긴다.
        ink: { DEFAULT:'#1E2124', deep:'#11131C', 700:'#2b2f34', 800:'#11131C', 900:'#1E2124' },
        govnavy: '#0F1A3D', adminnavy: '#062A5C',
        canvas: '#F4F5F8', surface: '#FFFFFF', offwhite: '#F7F8FB',
        line: { DEFAULT:'#E5E7EF', soft:'#E2E5EE', hair:'#EFF1F6' },
        gold: '#B5862F', kogl: '#0A7C4A',
        brand: { 50:'#EAF2FE',100:'#E9F1FE',500:'#256ef4',600:'#0B50D0',700:'#08429E' },
      },
      backgroundImage: {
        // component.css L11 .btn_primary_gra 와 동일 (§5.2.2 — 퍼블 참조 0회이나
        // 전량 반입으로 규칙이 들어오므로 리터럴을 토큰으로 흡수해 둔다)
        'primary-gra': 'linear-gradient(92deg, var(--gra-from) 0%, var(--gra-to) 104.6%)',
      },
      keyframes: {
        modalIn: { '0%': { opacity: '0', transform: 'translateY(12px) scale(.99)' }, '100%': { opacity: '1', transform: 'none' } },
        overlayIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        // 퍼블 .detail_popup 전용 등장 애니메이션(round06c-ext D1-5b 후속 fix).
        // modalIn을 쓸 수 없는 이유: .detail_popup은 position:fixed + left/top 50% +
        // `transform: translate(-50%,-50%)` 로 **transform으로 중앙정렬**한다(publish-v2
        // component.css). modalIn의 종점은 `transform: none`이고 fill-mode가 `both`라
        // 애니메이션이 끝난 뒤에도 그 종점이 유지되어 중앙정렬 transform을 지워버린다
        // → 모달이 화면 중앙에서 자기 크기의 절반만큼 우하단으로 밀려 잘린다(브라우저
        // 실측: 960x765 모달이 top 450·left 715에 놓여 bottom 1215 > viewport 900).
        // 그래서 종점에도 중앙정렬 translate를 유지한 전용 키프레임을 둔다.
        // (modalIn 자체는 고치지 않는다 — Modal.jsx·Toast.jsx는 부모 flex가 중앙정렬하므로
        //  `transform: none`이 정상 동작이고, 손대면 그쪽이 회귀한다.)
        popupIn: {
          '0%': { opacity: '0', transform: 'translate(-50%, -50%) translateY(12px) scale(.99)' },
          '100%': { opacity: '1', transform: 'translate(-50%, -50%)' },
        },
      },
      animation: {
        modalIn: 'modalIn .22s ease both',
        overlayIn: 'overlayIn .18s ease both',
        popupIn: 'popupIn .22s ease both',
      },
    },
  },
  plugins: [],
}
