import { useLayoutEffect, useRef, useState } from 'react'
import { NODE_COLORS } from '../theme/tokens.js'

// 이 파일의 책임: 산출물생성(output_node.html)의 노드 클러스터링 뷰 — 방사형 마인드맵.
// 표시 전용(브리프 §범위 4) — 클릭하면 부모(OutputTab)가 NodeModal을 연다. 실제 mutation은
// 없다.
//
// round10a A조 최종 리뷰 I-1 — 읽기 전용(프로젝트 상세)에서 이 그래프의 노드 버튼이
// "활성처럼" 보이는 병이 되살아났다. round10 T2가 바깥 .node_view 컨테이너의 opacity-40을
// 걷어냈는데(유효 0.16으로 그래프·건수까지 흐려지던 것을 고쳤다), 그 컨테이너 흐림이
// **이 파일 노드 버튼의 유일한 비활성 신호**였다 — 정작 이 버튼 자체엔 disabled도
// 흐림도 없어, 걷어내자 원색 + 손가락 커서 + hover 그림자로 반응하는데 눌러도 아무
// 일도 없는 화면이 남았다(spec §0 ②와 같은 증상 — 이 라운드가 잡으려던 병 그 자체).
//
// 고침 — disabled prop을 받아 외곽 노드 버튼에 실제 disabled 속성과 이 화면 다른
// 컨트롤들의 기존 관행(cursor-not-allowed — OutputTab.jsx의 node_criteria_btn·
// node_select_tag와 같은 표기)을 그대로 붙인다. 커넥터 SVG(.node_graph_lines)는 버튼과
// 별개 형제 요소라 손대지 않는다 — 그래프 선·건수 뱃지가 흐려지는 것은 옛 버그처럼
// **컨테이너와 겹쳐 곱해질 때**였지 이 정도 단일 레벨 dimming(이 화면의 다른 컨트롤도
// 이미 쓰는 것과 같은 강도)에서가 아니다(spec 결정 7 "보이되 못 누른다").
//
// R6c-ext D1-7 재퍼블 — 퍼블 node_graph* 클래스(publish-v2 component.css L554-565, 14규칙)로
// 옮겼다. 배치 계산은 앱 고유 로직으로 유지한다 — 퍼블 html은 고정 10개 노드의 좌표를
// 하드코딩한 정적 데모라 임의 개수의 시나리오 노드에 재사용할 수 없다(§4 디자인 참조 — 미참조
// 사유).
//
// D1-8 A1·A2 — 좌표계를 하나로 정리했다. 이전 판은 링 좌표를 880×430 가상 캔버스의 %로 주면서
// 박스 중앙정렬 오프셋만 px 추정치(BOX_W/BOX_H)로 빼는 단위 혼용이라, 컨테이너 폭에 따라
// 오차가 달라졌다. 지금은 **모든 길이를 아래 설계 캔버스의 px로만 계산**하고 마지막에 %로
// 환산하며, 중앙정렬은 인라인 transform이 담당한다.
// (퍼블 CSS는 .node_graph_node.ty_center 에만 translate(-50%,-50%)를 주므로 외곽 노드에
//  인라인 transform을 얹어도 퍼블 규칙과 충돌하지 않는다 — component.css L556·L561 확인.)
//
// 설계 캔버스 = 데스크톱 1440×900에서 실측한 .node_graph 크기(750×424px; 높이는 퍼블
// .node_graph{height:21.2rem}·루트폰트 20px에서 고정). SVG viewBox도 같은 값을 쓰고
// preserveAspectRatio="none"이라, 실제 컨테이너가 더 넓으면 선과 노드 위치가 같은 비율로
// 늘어난다(가로 여유는 늘어나기만 하므로 겹침이 새로 생기지 않는다).
const GRAPH_W = 750
const GRAPH_H = 424
const CX = GRAPH_W / 2
const CY = GRAPH_H / 2

// 노드 박스 실측(같은 조건): 외곽 노드 120~123 × 93px — 퍼블 padding 0.75rem 1.5rem +
// 라벨 0.8rem + gap 0.5rem + 태그 height 1.5rem의 결과다. 최대치에 1px 여유를 더해 쓴다.
// 이 값은 "이웃과 얼마나 떨어져야 하는가"(간격 배분)와 링 inset에만 쓰이고, 노드의 실제
// 크기나 중앙정렬에는 개입하지 않는다.
const NODE_W = 124
const NODE_H = 94

// 링 반경 — 박스 절반만큼 안쪽으로 들여야 박스가 캔버스를 벗어나지 않는다.
const RING_RX = CX - NODE_W / 2 // 313
const RING_RY = CY - NODE_H / 2 // 165

// 링 모양(초타원 |x/rx|^p + |y/ry|^p = 1)의 지수.
// 2 = 순수 타원인데, 그때 둘레는 노드 12.3개분뿐이어서 12개를 놓으면 간격 여유가 2px까지
// 줄어 라벨이 서로 닿는다. 3이면 네 귀퉁이 공간까지 쓰면서 둘레가 늘어 13.7개분이 되고,
// 12개 배치 시 최소 여유 13px을 확보한다(1440px 데스크톱 실측 검증).
const RING_POWER = 3

// 첫 노드는 12시 방향에서 시작한다(화면 좌표계라 y가 아래로 증가 → -90°가 위).
const RING_START = -Math.PI / 2

// 링을 몇 조각으로 나눠 적분할지 — 값이 커도 12개 좌표를 뽑는 비용은 무시할 만하다.
const RING_STEPS = 1440

const FALLBACK_COLORS = Object.values(NODE_COLORS)

// 퍼블은 노드마다 테두리색과 짝지은 연한 배경을 인라인으로 준다(output_node.html L55-132:
// #0056b5↔#f5f9fe · #f90↔#fff6e4 · #20bd5e↔#ecf9eb …). 모두 흰색에 원색을 8% 안팎 섞은
// 톤이라, 클러스터 색에서 같은 비율로 파생한다. 인라인으로 주는 것도 퍼블 원본과 동형이다.
const TINT_RATIO = 0.08

export function tintOf(hex) {
  const parsed = /^#([0-9a-f]{6})$/i.exec(String(hex))
  if (!parsed) return '#fff'
  const rgb = parseInt(parsed[1], 16)
  const mix = (channel) => Math.round(255 - (255 - channel) * TINT_RATIO)
  return `rgb(${mix((rgb >> 16) & 255)}, ${mix((rgb >> 8) & 255)}, ${mix(rgb & 255)})`
}

function nodeColor(n, idx) {
  if (n.color) return n.color
  return FALLBACK_COLORS[idx % FALLBACK_COLORS.length]
}

// 초타원 위의 점(설계 캔버스 px).
function ringPoint(t) {
  const cos = Math.cos(t)
  const sin = Math.sin(t)
  const e = 2 / RING_POWER
  return {
    x: CX + RING_RX * Math.sign(cos) * Math.abs(cos) ** e,
    y: CY + RING_RY * Math.sign(sin) * Math.abs(sin) ** e,
  }
}

// 이웃 노드와 겹치지 않기 위해 필요한 최소 중심간 거리. 두 박스는 x·y 어느 한 축에서만
// 떨어져도 겹치지 않으므로, 진행 방향(dx, dy)이 수평이면 박스 폭이, 수직이면 높이가 기준이 된다.
function neededSpacing(dx, dy) {
  const len = Math.hypot(dx, dy) || 1
  const cos = Math.abs(dx) / len
  const sin = Math.abs(dy) / len
  return Math.min(
    cos > 0 ? NODE_W / cos : Infinity,
    sin > 0 ? NODE_H / sin : Infinity,
  )
}

// 노드 n개를 놓을 각도. 등각(이전 판)이나 등호장으로 나누면 링이 급히 휘는 구간에서 간격이
// 모자라 라벨이 겹친다. 그래서 링을 잘게 쪼개 구간마다 "노드 몇 개분의 폭인가"를 누적하고,
// 그 누적량을 n등분한 지점에 노드를 놓는다. 총 누적량 = 이 링의 수용량(노드 개수).
function ringAngles(n) {
  const step = (2 * Math.PI) / RING_STEPS
  const cumulative = []
  let capacity = 0
  for (let i = 0; i < RING_STEPS; i++) {
    const t = RING_START + i * step
    const before = ringPoint(t - step / 2)
    const after = ringPoint(t + step / 2)
    const dx = after.x - before.x
    const dy = after.y - before.y
    capacity += Math.hypot(dx, dy) / neededSpacing(dx, dy)
    cumulative.push(capacity)
  }
  const angles = []
  for (let i = 0; i < RING_STEPS && angles.length < n; i++) {
    if (cumulative[i] >= (capacity * angles.length) / n) angles.push(RING_START + i * step)
  }
  return angles
}

// D1-9 — 좁은 뷰포트 대응(설계 캔버스 스케일).
// 노드 박스는 px 고정(NODE_W/NODE_H — 퍼블 padding+라벨+태그에서 나온 실측치)인데 링 좌표는
// 컨테이너 %라서, 컨테이너 폭이 GRAPH_W(750px)보다 좁아지면 링만 줄고 박스는 그대로라 겹친다
// (1280×800 실측: 그래프 590×424, 겹침 8쌍·이탈 2개 — '부마항쟁'·'언론 검열'). 두 대안을 기각했다.
//   1) 컨테이너 폭에 맞춰 NODE_W/NODE_H·RING_RX/RY를 다시 계산 — 박스 자체가 줄어 좁은
//      화면일수록 라벨이 읽기 힘들 만큼 작아지고, 배치 로직이 %/px 두 갈래로 갈린다.
//   2) 박스는 그대로 두고 SVG만 늘리는(현 preserveAspectRatio="none") 방식을 링 %에도 적용 —
//      링 %가 줄어드는 비율과 박스(px 고정)가 안 줄어드는 비율이 달라 선 끝점(SVG 좌표)이
//      박스 중심(DOM % 좌표)에서 어긋난다.
// 대신 노드+SVG를 하나의 "설계 캔버스" 래퍼로 감싸, 컨테이너가 GRAPH_W 이상이면 래퍼를
// 유동(100%/100%, 스케일 없음 — 1440+에서 이미 검증된 동작 그대로 유지)으로 두고, 좁으면
// 래퍼를 750×424 고정 후 CSS transform: scale()로 통째로 축소한다. 안의 모든 좌표(px·%·SVG
// viewBox)가 같은 비율로 줄어들므로 기하가 보존된다(선 끝점=박스 중심 일치 유지).
export function canvasMode(containerWidth) {
  if (containerWidth >= GRAPH_W) return { mode: 'fluid', scale: 1 }
  return { mode: 'scaled', scale: containerWidth / GRAPH_W }
}

// .node_graph 컨테이너의 실제 폭을 관찰한다. jsdom은 레이아웃을 계산하지 않아
// getBoundingClientRect().width가 항상 0이고, ResizeObserver 자체가 없는 환경도 있을 수
// 있으므로(SSR 등) 그런 경우 관찰을 생략하고 GRAPH_W 폴백 → 유동 모드로 안전하게 머문다
// (크래시 금지 — 관찰 실패가 배치 실패로 번지면 안 된다).
function useContainerWidth(ref) {
  const [width, setWidth] = useState(GRAPH_W)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return undefined
    const apply = (w) => setWidth(w || GRAPH_W)
    apply(el.getBoundingClientRect().width)

    if (typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect
      if (rect) apply(rect.width)
    })
    observer.observe(el)
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ref identity is stable (useRef)
  }, [])

  return width
}

// ⚠️ 사용자 지시(2026-09-17): 「회색화면 치우고 **그냥 그대로인데 안눌러지도록**」.
// 그래서 흐림(opacity-40)을 쓰지 않는다 — 색·테두리·건수 뱃지는 활성과 **똑같이** 두고,
// 실제 `disabled` 속성과 not-allowed 커서로만 「못 누른다」를 말한다. hover 그림자는
// publish-ext.css 가 disabled 일 때 끈다(반응하는 것처럼 보이면 그 자체가 거짓말이다).
export default function NodeGraph({ nodes, edges: _edges, onNodeClick, onSelect, disabled = false }) {
  // Support both callback names for backward-compat; onSelect is the test-facing name.
  const handleClick = onSelect ?? onNodeClick

  const graphRef = useRef(null)
  const containerWidth = useContainerWidth(graphRef)
  const { mode, scale } = canvasMode(containerWidth)

  const outerNodes = nodes.filter((n) => n.group !== 'root')
  const rootNode = nodes.find((n) => n.group === 'root') ?? nodes[0]

  // 링 위 좌표를 미리 계산한다(선과 노드가 같은 좌표를 쓴다).
  const angles = ringAngles(outerNodes.length)
  const radial = outerNodes.map((node, i) => {
    const { x, y } = ringPoint(angles[i])
    return { node, x, y, color: nodeColor(node, i) }
  })

  // 유동 모드: 현행 검증된 동작(래퍼가 컨테이너를 100% 채움, 스케일 없음) 그대로.
  // 스케일 모드: 래퍼를 설계 캔버스 크기로 고정하고 중앙에서 통째로 축소한다.
  // left/top:50% + translate(-50%,-50%) 뒤에 오는 scale()은 (스케일 전) 자기 자신의
  // 박스 크기 기준으로 -50%/-50% 이동한 뒤 중심을 기준으로 축소하므로, 스케일 값과 무관하게
  // 항상 부모 중앙에 정확히 놓인다.
  const canvasStyle =
    mode === 'fluid'
      ? { position: 'relative', width: '100%', height: '100%' }
      : {
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: `${GRAPH_W}px`,
          height: `${GRAPH_H}px`,
          transform: `translate(-50%, -50%) scale(${scale})`,
        }

  return (
    <div className="node_graph" ref={graphRef}>
      <div className="node_graph_canvas" style={canvasStyle}>
        {/* SVG connector lines — 퍼블 node_graph_lines(L555). 색은 output_node.html
            L72-83 정본 값(stroke #B4D3F6, width 2)을 따르고, 좌표계는 설계 캔버스와 같다. */}
        <svg
          viewBox={`0 0 ${GRAPH_W} ${GRAPH_H}`}
          className="node_graph_lines"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {radial.map(({ x, y }, i) => (
            <line
              key={i}
              x1={CX}
              y1={CY}
              x2={x}
              y2={y}
              stroke="#B4D3F6"
              strokeWidth="2"
            />
          ))}
        </svg>

        {/* Central Topic node — ty_center가 transform:translate(-50%,-50%)로 중앙 정렬한다 */}
        <div
          className="node_graph_node ty_center"
          style={{ left: `${(CX / GRAPH_W) * 100}%`, top: `${(CY / GRAPH_H) * 100}%` }}
        >
          <p className="node_graph_node_label">{rootNode?.label ?? 'Topic'}</p>
          <p className="node_graph_node_sub">Topic</p>
        </div>

        {/* Outer nodes — left/top은 링 좌표 그대로, 중앙정렬은 transform이 담당한다 */}
        {radial.map(({ node, x, y, color }) => (
          <button
            key={node.id}
            type="button"
            disabled={disabled}
            onClick={() => handleClick?.(node)}
            className={`node_graph_node${disabled ? ' cursor-not-allowed' : ''}`}
            style={{
              left: `${(x / GRAPH_W) * 100}%`,
              top: `${(y / GRAPH_H) * 100}%`,
              transform: 'translate(-50%, -50%)',
              background: tintOf(color),
              borderColor: color,
            }}
            aria-label={node.label}
          >
            <span className="node_graph_node_label">{node.label}</span>
            <span className="node_graph_node_tag" style={{ background: color }}>
              {node.count}건
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
