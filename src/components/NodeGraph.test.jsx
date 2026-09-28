import { render, screen, fireEvent } from '@testing-library/react'
import NodeGraph, { tintOf, canvasMode } from './NodeGraph.jsx'
// Test fixture: NodeGraph is a prop-driven component; direct import is intentional here.
import { nodes, nodeEdges } from '../data/nodes.js'

test('renders one button per outer node', () => {
  render(<NodeGraph nodes={nodes} edges={nodeEdges} onNodeClick={vi.fn()} />)
  const outerNodes = nodes.filter((n) => n.group !== 'root')
  outerNodes.forEach((n) => {
    expect(screen.getByRole('button', { name: n.label })).toBeInTheDocument()
  })
})

// round10a A조 최종 리뷰 I-1 — 읽기 전용에서 노드 버튼이 disabled 없이 원색 그대로
// 남아 "눌릴 것처럼 보이는데 눌러도 아무 일이 없다"는 병이 되살아났다(OutputTab.jsx가
// 컨테이너 흐림을 걷어낸 뒤 이 버튼 자체가 유일한 비활성 신호였는데, 그 신호가
// 없었다). disabled prop을 받으면 실제 disabled 속성 + 이 화면 다른 컨트롤과 같은
// 관행을 갖는다. ⚠️ 흐림(opacity-40)은 쓰지 않는다 — 사용자 지시(2026-09-17)
// 「회색화면 치우고 그냥 그대로인데 안눌러지도록」. 색은 활성과 똑같이 둔다.
test('disabled prop이 true면 노드 버튼이 비활성 속성과 표시를 함께 받는다(round10a A조 I-1)', () => {
  render(<NodeGraph nodes={nodes} edges={nodeEdges} onSelect={vi.fn()} disabled />)
  const outerNodes = nodes.filter((n) => n.group !== 'root')
  outerNodes.forEach((n) => {
    const btn = screen.getByRole('button', { name: n.label })
    expect(btn).toBeDisabled()
    expect(btn.className).not.toContain('opacity-40')
    expect(btn.className).toContain('cursor-not-allowed')
  })
})

// disabled인 버튼은 클릭해도 핸들러가 불리지 않는다 — 브라우저의 기본 동작이지만
// jsdom에서도 같은지 직접 확인해 둔다(이 라운드의 주제 자체가 "보이되 못 누른다"다).
test('disabled면 클릭해도 onSelect가 불리지 않는다(round10a A조 I-1)', () => {
  const fn = vi.fn()
  render(<NodeGraph nodes={nodes} edges={nodeEdges} onSelect={fn} disabled />)
  fireEvent.click(screen.getByText('4·19 혁명'))
  expect(fn).not.toHaveBeenCalled()
})

// 결정 7 「보이되 못 누른다」 — 흐려지는 것은 노드 버튼(조작 요소)뿐이고, 커넥터
// 선·중앙 토픽 노드는 disabled와 무관하게 그대로 그려진다(다시 컨테이너째 흐리는
// 회귀를 이 테스트가 막는다).
test('disabled여도 커넥터 SVG와 노드는 그대로 그려진다 — 그래프 자체는 숨기지 않는다(결정 7)', () => {
  const { container } = render(
    <NodeGraph nodes={nodes} edges={nodeEdges} onSelect={vi.fn()} disabled />,
  )
  const lines = container.querySelector('.node_graph_lines')
  expect(lines).not.toBeNull()
  // SVG 요소의 className은 문자열이 아니라 SVGAnimatedString이라 getAttribute로 본다.
  expect(lines.getAttribute('class')).not.toContain('opacity-40')
  const canvas = container.querySelector('.node_graph_canvas')
  expect(canvas.className).not.toContain('opacity-40')
})

test('node click fires onNodeClick handler', () => {
  const fn = vi.fn()
  render(<NodeGraph nodes={nodes} edges={nodeEdges} onNodeClick={fn} />)
  fireEvent.click(screen.getByText('4·19 혁명'))
  expect(fn).toHaveBeenCalled()
})

test('node click calls onSelect with nodeId', () => {
  const fn = vi.fn()
  render(<NodeGraph nodes={nodes} edges={nodeEdges} onSelect={fn} />)
  fireEvent.click(screen.getByText('4·19 혁명'))
  const called = fn.mock.calls[0][0]
  expect(called.id).toBe('n1')
})

// D1-8 A1 — 외곽 노드는 링 좌표를 left/top에 그대로 주고 transform으로 중앙정렬한다.
// (px 추정치로 오프셋을 빼던 이전 방식은 컨테이너 폭에 따라 오차가 달라졌다.)
test('outer nodes center themselves with a transform instead of a px offset', () => {
  render(<NodeGraph nodes={nodes} edges={nodeEdges} onNodeClick={vi.fn()} />)
  const node = screen.getByRole('button', { name: '4·19 혁명' })
  expect(node.style.transform).toBe('translate(-50%, -50%)')
  expect(node.style.left.endsWith('%')).toBe(true)
  expect(node.style.top.endsWith('%')).toBe(true)
})

// D1-8 A3 — 퍼블은 테두리색과 짝지은 연한 배경을 노드마다 인라인으로 준다.
test('outer nodes get a light tint paired with their border color', () => {
  render(<NodeGraph nodes={nodes} edges={nodeEdges} onNodeClick={vi.fn()} />)
  const node = screen.getByRole('button', { name: '4·19 혁명' })
  expect(node.style.borderColor).not.toBe('')
  expect(node.style.background).toBe(tintOf('#3D5AE0'))
  expect(node.style.background).not.toBe('rgb(255, 255, 255)')
})

test('tintOf mixes the cluster color into white and falls back safely', () => {
  // 흰색에 8% 섞기: 255 - (255 - 0) * 0.08 = 234.6 → 235
  expect(tintOf('#000000')).toBe('rgb(235, 235, 235)')
  expect(tintOf('#ffffff')).toBe('rgb(255, 255, 255)')
  expect(tintOf('nope')).toBe('#fff')
})

// D1-9 — 설계 캔버스 스케일 경계값. 컨테이너 폭이 GRAPH_W(750)보다 좁아지면 박스 px 고정
// 대비 링 %가 먼저 줄어 겹침이 생기므로(1280×800 실측: 겹침 8쌍), 750을 경계로 유동/스케일이
// 갈린다. 경계값 750 자체는 유동(현행 1440+ 검증 동작을 바꾸지 않는 쪽)에 포함한다.
describe('canvasMode', () => {
  test('경계값 750은 유동 모드(스케일 없음)', () => {
    expect(canvasMode(750)).toEqual({ mode: 'fluid', scale: 1 })
  })

  test('750보다 넓으면(1440 데스크톱 등) 유동 모드', () => {
    expect(canvasMode(800)).toEqual({ mode: 'fluid', scale: 1 })
  })

  test('750보다 좁으면(1280 실측 590 등) 스케일 모드, scale = width / 750', () => {
    expect(canvasMode(590)).toEqual({ mode: 'scaled', scale: 590 / 750 })
  })
})

// D1-9 — jsdom은 레이아웃을 계산하지 않고(getBoundingClientRect 항상 0) ResizeObserver도
// 기본적으로 없는 환경(SSR 등)을 흉내낼 수 있어야 한다. 여기서는 vitest.setup.js가 깔아 둔
// 전역 스텁을 일부러 지워, 컴포넌트가 관찰 없이도 크래시 없이 유동 모드로 렌더되는지 본다.
test('ResizeObserver가 없어도(jsdom SSR 흉내) 크래시 없이 유동 모드로 렌더된다', () => {
  const original = global.ResizeObserver
  // eslint-disable-next-line no-global-assign
  delete global.ResizeObserver
  try {
    expect(typeof ResizeObserver).toBe('undefined')
    render(<NodeGraph nodes={nodes} edges={nodeEdges} onNodeClick={vi.fn()} />)
    const canvas = document.querySelector('.node_graph_canvas')
    expect(canvas).not.toBeNull()
    // 유동 모드 표식: scale 없는 100%/100% 래퍼(스케일 모드였다면 transform: scale(...)이 붙는다).
    expect(canvas.style.width).toBe('100%')
    expect(canvas.style.transform).toBe('')
  } finally {
    global.ResizeObserver = original
  }
})

// D1-9 — 노드+SVG가 설계 캔버스 래퍼 안에 함께 있어야 스케일이 걸릴 때 같은 비율로 줄어든다.
test('노드와 커넥터 SVG가 같은 설계 캔버스 래퍼(.node_graph_canvas) 안에 있다', () => {
  const { container } = render(
    <NodeGraph nodes={nodes} edges={nodeEdges} onNodeClick={vi.fn()} />,
  )
  const canvas = container.querySelector('.node_graph_canvas')
  expect(canvas).not.toBeNull()
  const node = screen.getByRole('button', { name: '4·19 혁명' })
  expect(canvas.contains(node)).toBe(true)
  expect(canvas.querySelector('.node_graph_lines')).not.toBeNull()
})
