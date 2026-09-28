/**
 * 이 파일의 책임: tailwind.config.js가 "퍼블 20px 스케일 계약"을 지키는지
 * 설정 수준에서 단언한다.
 *
 * 왜 렌더가 아니라 설정을 보는가 — jsdom은 CSS를 로드하지 않고, 미디어쿼리로
 * 루트폰트를 줄이는 퍼블의 반응형 구현도 재현하지 않는다. 실제 화면의
 * 20/18/16px 검증은 R6d-06 브라우저 스윕(D10)의 몫이고, 여기서는
 * "설정이 사라지지 않았는가"만 지킨다.
 *
 * 이 가드가 필요한 이유(spec §5.4.3 · §9.1): spacing을 교체하면서
 * fontSize·borderRadius를 병합하지 않거나 현행 color 키를 옮겨 적지 않으면
 *   text-sm 류 125곳 / rounded-* 류 92곳 / 소수 spacing 124곳 / 색 키 279곳
 * 의 선언이 빌드 산출 CSS에서 통째로 사라진다. 그런데 단위 테스트는 클래스
 * "이름" 문자열만 보므로 571 green을 유지한 채 화면만 무너진다. 그 소멸을
 * 잡는 두 장치가 이 파일과 D10a(빌드 산출 CSS grep)다.
 */
import { describe, it, expect } from 'vitest'
import defaultTheme from 'tailwindcss/defaultTheme.js'
import config from '../../tailwind.config.js'

describe('tailwind 스케일 계약 — 퍼블 20px 루트', () => {
  it('spacing 키는 "20px 루트에서의 px 값"이며 legacy 소수 키가 재등록돼 있다', () => {
    const { spacing } = config.theme

    // 퍼블 CSS의 0.8rem을 p-16 으로 그대로 옮길 수 있어야 한다
    expect(spacing[16]).toBe('0.8rem')
    expect(spacing[20]).toBe('1rem')
    expect(spacing[1]).toBe('0.05rem')   // 최소 스텝 = 20px 루트의 1px
    expect(spacing[0]).toBe('0px')
    expect(spacing.px).toBe('1px')

    // Tailwind 기본 스케일(1 = 0.25rem) 잔재가 남아 있으면 두 체계가 섞인다
    expect(spacing['1']).not.toBe('0.25rem')

    // legacy 호환 소수 키 — 재등록하지 않으면 gap-1.5 등 124곳의 선언이
    // 생성 자체가 되지 않는다(값 변경이 아니라 키 소멸)
    expect(spacing[0.5]).toBe('0.1rem')   // legacy 2px
    expect(spacing[1.5]).toBe('0.3rem')   // legacy 6px
    expect(spacing[2.5]).toBe('0.5rem')   // legacy 10px
    expect(spacing[3.5]).toBe('0.7rem')   // legacy 14px

    // 200px 초과 상용값
    expect(spacing[320]).toBe('16rem')    // layout.css .lnb width
    expect(spacing[480]).toBe('24rem')    // .card / .auth_inner / .alert_popup
    expect(spacing[1000]).toBe('50rem')   // .intro_content max-width
  })

  it('fontSize는 퍼블 숫자 키와 Tailwind 이름 키를 함께 갖는다(교체 아님, 병합)', () => {
    const { fontSize } = config.theme

    expect(fontSize[14][0]).toBe('0.7rem')          // .form_input · .data_table
    expect(fontSize[14][1].lineHeight).toBe('1.3')  // reset.css L154 line-height:130%
    expect(fontSize[12][0]).toBe('0.6rem')          // .auth_footer_txt
    expect(fontSize[40][0]).toBe('2rem')            // .mng_page_tit

    // 병합 축 보존 — 빠뜨리면 42파일 125곳의 글자 크기가 루트값으로 떨어진다
    for (const k of ['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl']) {
      expect(fontSize[k]).toEqual(defaultTheme.fontSize[k])
    }
  })

  it('borderRadius 이름 키와 현행 colors 키가 전부 보존된다', () => {
    const { borderRadius } = config.theme

    // 병합 축 보존 — 빠뜨리면 37파일 92곳의 모서리가 각진다
    for (const k of ['none', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', 'full']) {
      expect(borderRadius[k]).toBe(defaultTheme.borderRadius[k])
    }
    expect(borderRadius.DEFAULT).toBe('0.4rem')  // 퍼블 .form_input 값으로 덮어씀
    expect(borderRadius[16]).toBe('0.8rem')      // .lnb .card .alert_popup .page_tabs
    expect(borderRadius[50]).toBe('2.5rem')      // .upload_dropzone_btn 알약형

    const c = config.theme.extend.colors

    // 토큰 단일 출처(D8) — 색값은 tokens.css에만 적고 여기서는 var()로 참조한다
    expect(c.primary.DEFAULT).toBe('var(--primary)')
    expect(c.primary[500]).toBe('var(--primary)')
    expect(c.navy).toBe('var(--navy)')
    expect(c.status).toEqual({
      done: 'var(--status-done)',
      review: 'var(--status-review)',
      fail: 'var(--status-fail)',
    })

    // R6d-02가 심은 퍼블 토큰 브리지가 전면 교체 과정에서 사라지지 않았는가
    // (조립 시 해소 #1 — tokens.test.js와 이중으로 지킨다)
    expect(c.pub.primary).toBe('var(--primary)')
    expect(c.gra.from).toBe('var(--gra-from)')
    expect(c.focusring).toBe('var(--focus-ring)')

    // 현행 키 전량 보존 — 주석으로만 적으면 279곳이 함께 사라진다(§5.4.3)
    expect(c.ink.DEFAULT).toBe('#1E2124')
    expect(c.line.DEFAULT).toBe('#E5E7EF')
    expect(c.line.soft).toBe('#E2E5EE')
    expect(c.canvas).toBe('#F4F5F8')
    expect(c.surface).toBe('#FFFFFF')
    expect(c.offwhite).toBe('#F7F8FB')
    expect(c.govnavy).toBe('#0F1A3D')
    expect(c.adminnavy).toBe('#062A5C')
    expect(c.gold).toBe('#B5862F')
    expect(c.kogl).toBe('#0A7C4A')
    expect(c.brand[500]).toBe('#256ef4')
    // ok/prog/warn/bad는 개명하지 않는다(§5.6 규칙 6)
    for (const k of ['ok', 'prog', 'warn', 'bad']) {
      expect(c[k].DEFAULT).toBeTruthy()
      expect(c[k].bg).toBeTruthy()
    }
  })
})
