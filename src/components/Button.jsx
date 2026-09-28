/**
 * Button — reusable button with design-system variants and sizes.
 *
 * variant: "primary" | "dark" | "outline" | "pill" | "gold"  (default: "primary")
 * size:    "sm" | "md" | "lg"                                 (default: "md")
 *
 * All other props (onClick, type, disabled, aria-*, className, …) are spread
 * onto the underlying <button> element.  Caller className merges/extends.
 */

const BASE =
  'inline-flex items-center justify-center gap-1.5 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1'

const VARIANT = {
  primary: 'bg-primary-600 hover:bg-primary-700 text-white font-bold',
  dark:    'bg-ink text-white font-bold hover:bg-ink-deep',
  outline: 'bg-white border border-line-soft text-[#4A5266] font-semibold hover:bg-canvas',
  pill:    'rounded-full border border-line-soft bg-white text-[#5A6173]',
  gold:    'bg-gold text-white font-bold hover:opacity-90',
}

// round06c 리뷰 fix2: 이 프로젝트는 Tailwind 높이 스케일을 퍼블 spacing(1=1px)로
// 재정의했다(round06d, tailwind.config.js) — 그 결과 h-8은 32px가 아니라 8px, h-10은
// 40px가 아니라 10px로 붕괴해 sm/md 버튼 글자가 세로로 뭉개졌다. lg는 애초에 스케일
// 영향을 받지 않는 임의값 h-[46px]라 멀쩡했다 — sm/md도 같은 방식(임의 px값)으로 맞춘다.
//
// ── round06e 후속: 가로 패딩도 마저 고친다 ──────────────────────────────────
// 위 fix2는 세로(h-*)만 고치고 가로(px-*)는 그대로 두어 절반만 적용됐다. 원인이 스케일
// 재정의 하나이므로 가로도 똑같이 무너져 있었다: px-3=3px · px-4=4px · px-5=5px
// (브라우저 실측 — 빈 <div class="px-3">의 computed padding-left가 3px).
// 라이브 계정 화면의 "정보 수정"·"비밀번호 변경"(둘 다 sm)이 좌우 3px로 렌더됐다.
//
// **높이와 달리 임의값(px-[20px])을 쓰지 않는다.** 세로는 fix2가 임의값으로 갔지만
// 가로는 그러면 안 되는 이유가 있다 — 이 앱의 반응형은 루트폰트 축소다:
//   tailwind-base.css:28,40,41 → 20px / ≤1024px 18px / ≤768px 16px
//   (같은 파일 주석: "루트폰트만 줄여 전 화면이 비례 축소되는 것이 퍼블의 반응형 구현 방식")
// 퍼블의 padding은 rem이라 이 구간에서 함께 줄지만, px-[20px]는 절대 px라 어디서나
// 20px로 고정돼 ≤768px에서 퍼블보다 25% 넓어진다. 반면 이 프로젝트의 spacing은
// rem(px)=px/20+'rem' 이라 **px-<숫자>가 곧 rem 등가**이므로 루트폰트를 그대로 따라간다:
//   px-20 = 1rem   · px-16 = 0.8rem   (브라우저 실측: px-16의 computed가 정확히 16px)
// 즉 여기서 옳은 표기는 스케일 네이티브인 px-20 / px-16 이다.
//
// 값의 출처는 디자인 정본인 퍼블이다(루트 20px 기준, 1rem = 20px):
//   sm ← .btn_sm { padding: 0 1rem }   → px-20  (publish-v1·v2 component.css 공통)
//   md ← .btn_md { padding: 0 0.8rem } → px-16  (publish-v2에만 존재)
//   lg ← 퍼블 .btn_lg는 width:100%라 가로 패딩 규칙 자체가 없다. 따를 정본이 없어
//        sm과 같은 1rem(px-20)으로 둔다. 현재 Button lg 호출부는 0곳이다.
// sm(1rem)이 md(0.8rem)보다 넓은 것은 오타가 아니라 퍼블 그대로다 — 임의로 고치지 않는다.
//
// ⚠️ 높이·글자크기는 이번 범위가 아니라 손대지 않았고, 퍼블과 여전히 어긋난다
//    (퍼블 .btn_sm 1.8rem/0.7rem ↔ 코드 h-[32px]/text-[12.5px] 등). 별도 라운드 사안이다.
const SIZE = {
  sm: 'h-[32px] px-20 text-[12.5px]',
  md: 'h-[40px] px-16 text-sm',
  lg: 'h-[46px] px-20 text-[15px]',
}

export default function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...rest
}) {
  const variantCls = VARIANT[variant] ?? VARIANT.primary
  const sizeCls    = SIZE[size]    ?? SIZE.md

  // pill overrides rounded-lg → rounded-full; keep BASE but swap radius
  const baseCls = variant === 'pill'
    ? BASE.replace('rounded-lg', '')
    : BASE

  const cls = [baseCls, variantCls, sizeCls, className]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()

  return (
    <button className={cls} {...rest}>
      {children}
    </button>
  )
}
