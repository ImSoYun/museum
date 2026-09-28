import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import Button from './Button.jsx'

describe('Button', () => {
  it('primary variant has bg-primary-600', () => {
    render(<Button variant="primary">Click</Button>)
    expect(screen.getByRole('button').className).toMatch(/bg-primary-600/)
  })

  it('dark variant has bg-ink', () => {
    render(<Button variant="dark">Click</Button>)
    expect(screen.getByRole('button').className).toMatch(/bg-ink/)
  })

  it('outline variant has border and border-line-soft', () => {
    render(<Button variant="outline">Click</Button>)
    const cls = screen.getByRole('button').className
    expect(cls).toMatch(/border/)
    expect(cls).toMatch(/border-line-soft/)
  })

  it('pill variant has rounded-full', () => {
    render(<Button variant="pill">Click</Button>)
    expect(screen.getByRole('button').className).toMatch(/rounded-full/)
  })

  it('gold variant has bg-gold', () => {
    render(<Button variant="gold">Click</Button>)
    expect(screen.getByRole('button').className).toMatch(/bg-gold/)
  })

  // round06c 리뷰 fix2: 이 프로젝트 Tailwind 스케일에서 h-8=8px·h-10=10px로 재정의되어
  // (round06d) 실제 높이와 이름이 어긋난다 — 임의값(h-[32px]/h-[40px])으로 고정해
  // lg(h-[46px])와 같은 스케일-독립 방식을 쓴다.
  it('size sm applies h-[32px]', () => {
    render(<Button size="sm">Click</Button>)
    expect(screen.getByRole('button').className).toMatch(/h-\[32px\]/)
  })

  it('size md applies h-[40px]', () => {
    render(<Button size="md">Click</Button>)
    expect(screen.getByRole('button').className).toMatch(/h-\[40px\]/)
  })

  it('size lg applies h-\[46px\]', () => {
    render(<Button size="lg">Click</Button>)
    expect(screen.getByRole('button').className).toMatch(/h-\[46px\]/)
  })

  // 가로 패딩도 세로 높이와 똑같은 이유로 무너져 있었다(a370852가 높이만 고쳤다).
  // 기대값의 출처는 디자인 정본인 퍼블이다 — 이 프로젝트의 spacing은 rem(px)=px/20+'rem'
  // 이라 px-<숫자>가 곧 rem 등가다(px-20=1rem · px-16=0.8rem):
  //   .btn_sm { padding: 0 1rem }   → px-20  (publish-v1/v2 component.css 공통)
  //   .btn_md { padding: 0 0.8rem } → px-16  (publish-v2 component.css)
  //   .btn_lg 는 width:100% 라 가로 패딩 규칙이 없다 → sm과 같은 1rem(px-20)
  it('size sm applies px-20 (=1rem) — 퍼블 .btn_sm padding: 0 1rem', () => {
    render(<Button size="sm">Click</Button>)
    expect(screen.getByRole('button').className).toMatch(/(?:^|\s)px-20(?=\s|$)/)
  })

  it('size md applies px-16 (=0.8rem) — 퍼블 .btn_md padding: 0 0.8rem', () => {
    render(<Button size="md">Click</Button>)
    expect(screen.getByRole('button').className).toMatch(/(?:^|\s)px-16(?=\s|$)/)
  })

  it('size lg applies px-20 (=1rem) — 퍼블에 .btn_lg 가로 패딩 규칙이 없어 sm과 동일', () => {
    render(<Button size="lg">Click</Button>)
    expect(screen.getByRole('button').className).toMatch(/(?:^|\s)px-20(?=\s|$)/)
  })

  // 회귀의 본질을 잠근다: 옛 Tailwind 기본 스케일 감각으로 쓴 한 자리 px-<숫자>다.
  // 이 프로젝트는 spacing을 퍼블 px 기반으로 "교체"해 숫자가 곧 px이므로, px-3은
  // 12px가 아니라 3px·px-4=4px·px-5=5px로 붕괴한다. 버튼 좌우 패딩이 한 자리 px인
  // 경우는 설계상 없다 — 누군가 px-3으로 되돌리면 이 테스트가 즉시 깨진다.
  //
  // 두 자리(px-16·px-20)는 이 스케일에서 **정상 표기**이므로 막지 않는다. 절대 px를
  // 박는 px-[20px]도 막지 않되, 그건 루트폰트 축소를 따라가지 못해 권장하지 않는다
  // (근거는 Button.jsx 주석). 값 자체는 위 3건이 별도로 잠근다.
  it.each(['sm', 'md', 'lg'])(
    'size %s uses no single-digit px-<n> (spacing scale is 1=1px, so px-3 means 3px)',
    (size) => {
      render(<Button size={size}>Click</Button>)
      expect(screen.getByRole('button').className).not.toMatch(/(?:^|\s)px-\d(?:\.\d)?(?=\s|$)/)
    },
  )

  it('onClick fires when clicked', () => {
    const handleClick = vi.fn()
    render(<Button variant="primary" onClick={handleClick}>Click</Button>)
    fireEvent.click(screen.getByRole('button'))
    expect(handleClick).toHaveBeenCalledOnce()
  })

  it('custom className merges', () => {
    render(<Button variant="primary" className="custom-class">Click</Button>)
    expect(screen.getByRole('button').className).toMatch(/custom-class/)
  })

  it('renders children', () => {
    render(<Button>Hello</Button>)
    expect(screen.getByRole('button')).toHaveTextContent('Hello')
  })

  it('passes type and disabled to button', () => {
    render(<Button type="submit" disabled>Click</Button>)
    const btn = screen.getByRole('button')
    expect(btn).toHaveAttribute('type', 'submit')
    expect(btn).toBeDisabled()
  })
})
