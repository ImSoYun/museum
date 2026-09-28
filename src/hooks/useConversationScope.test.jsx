/**
 * 이 파일의 책임: 「이 화면이 보고 있는 대화」 판정 규칙(useConversationScope).
 *
 * round07g 최종 리뷰 Important-1 이 만든 자리다. 규칙이 셸(SearchFlowLayout)과
 * 산출물 화면(OutputTab) 두 곳에서 각자 계산되던 것을 한 곳으로 모았고, 그 한 곳을
 * 여기서 직접 잠근다 — 화면을 통해서만 검증하면 「우선순위」·「자가 해제」처럼 규칙
 * 자체인 것들이 화면 배선에 가려진다.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import useConversationScope, { leavingConversation } from './useConversationScope.js'

function Probe({ conversationId }) {
  const { scope, fromContext, carryState } = useConversationScope(conversationId)
  return (
    <>
      <span data-testid="scope">{scope ?? '(없음)'}</span>
      <span data-testid="from">{fromContext ?? '(없음)'}</span>
      <span data-testid="carry">{carryState ? carryState.staleConversationId : '(없음)'}</span>
    </>
  )
}

function renderAt({ search = '', state = null, conversationId = null } = {}) {
  render(
    <MemoryRouter initialEntries={[{ pathname: '/search/output', search, state }]}>
      <Probe conversationId={conversationId} />
    </MemoryRouter>,
  )
  return {
    scope: () => screen.getByTestId('scope').textContent,
    from: () => screen.getByTestId('from').textContent,
    carry: () => screen.getByTestId('carry').textContent,
  }
}

describe('useConversationScope — 우선순위', () => {
  it('주소의 ?c= 가 최우선이다', () => {
    const s = renderAt({ search: '?c=conv-URL', conversationId: 'conv-CTX' })
    expect(s.scope()).toBe('conv-URL')
  })

  it('?c= 가 없으면 컨텍스트의 대화를 쓴다 — 새 검색 직후를 받는다', () => {
    const s = renderAt({ conversationId: 'conv-CTX' })
    expect(s.scope()).toBe('conv-CTX')
  })

  it('둘 다 없으면 대화를 모른다', () => {
    expect(renderAt().scope()).toBe('(없음)')
  })
})

describe('useConversationScope — 두고 온 대화는 세지 않는다 (Important-1)', () => {
  // 리뷰가 실증한 경로 그대로다: 라이브러리에서 시드 프로젝트를 열면 컨텍스트에
  // 직전 대화가 남는데, 그 대화는 누른 프로젝트의 것이 아니다.
  it('컨텍스트 대화가 「두고 온 대화」와 같으면 없는 것으로 친다', () => {
    const s = renderAt({
      state: leavingConversation('conv-PREV'),
      conversationId: 'conv-PREV',
    })
    expect(s.scope()).toBe('(없음)')
  })

  it('그래도 주소의 ?c= 는 살아 있다 — 대화를 실은 딥링크까지 막지 않는다', () => {
    const s = renderAt({
      search: '?c=conv-LIB',
      state: leavingConversation('conv-PREV'),
      conversationId: 'conv-PREV',
    })
    expect(s.scope()).toBe('conv-LIB')
  })

  // 깃발(「대화 없음」)이 아니라 **두고 온 id** 를 싣는 이유가 이 테스트다. 셸의
  // 검색바는 이동 없이 새 검색을 하므로, 깃발이면 그 자리에서 선 새 대화까지 가린다.
  it('새 대화가 서면 저절로 풀린다 — 같은 위치에서 검색해도 가려지지 않는다', () => {
    const s = renderAt({
      state: leavingConversation('conv-PREV'),
      conversationId: 'conv-NEW',
    })
    expect(s.scope()).toBe('conv-NEW')
  })

  it('두고 온 대화가 없으면(첫 방문) 아무것도 무효화하지 않는다', () => {
    const s = renderAt({ state: leavingConversation(null), conversationId: 'conv-CTX' })
    expect(s.scope()).toBe('conv-CTX')
  })
})

describe('useConversationScope — 판정을 다음 위치로 나른다', () => {
  it('두고 온 대화가 있으면 carryState 로 되돌려 준다', () => {
    const s = renderAt({ state: leavingConversation('conv-PREV'), conversationId: 'conv-PREV' })
    expect(s.carry()).toBe('conv-PREV')
  })

  it('없으면 carryState 도 없다 — 아무 위치에나 표식을 붙이지 않는다', () => {
    expect(renderAt({ conversationId: 'conv-CTX' }).carry()).toBe('(없음)')
  })
})

// ── round07g 라이브 수정 ─────────────────────────────────────────────────────
// `fromContext` 는 「주소를 빼고, 컨텍스트가 실제로 선 대화」다. 셸(SearchFlowLayout)이
// **주소가 낡았는가**를 판단하는 데 쓴다 — scope 는 주소와 컨텍스트를 이미 합쳐 버려서
// 그 구분이 불가능하다(주소가 있으면 언제나 주소를 돌려주므로, scope 로 판단하면
// 「새 대화가 섰다」를 영영 못 본다 = 라이브 결함 그대로).
//
// 두고 온 대화 규칙(③)이 여기에도 걸리는 것이 핵심이다. 안 걸리면 라이브러리 딥링크
// 화면에서 두고 온 대화가 **주소로 승격돼** 되살아난다 — 이 라운드가 막은 결함의 재발이다.
describe('useConversationScope — fromContext(주소를 뺀 컨텍스트 대화)', () => {
  it('주소에 ?c= 가 있어도 컨텍스트가 선 대화를 그대로 돌려준다', () => {
    const s = renderAt({ search: '?c=conv-URL', conversationId: 'conv-CTX' })
    expect(s.scope()).toBe('conv-URL')
    expect(s.from()).toBe('conv-CTX')
  })

  it('두고 온 대화는 fromContext 에서도 빠진다 — 주소로 승격될 길이 없다', () => {
    const s = renderAt({
      state: leavingConversation('conv-PREV'),
      conversationId: 'conv-PREV',
    })
    expect(s.from()).toBe('(없음)')
  })

  it('컨텍스트에 대화가 없으면 없다', () => {
    expect(renderAt({ search: '?c=conv-URL' }).from()).toBe('(없음)')
  })
})
