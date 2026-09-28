import { scenarios, MAIN_SCENARIO_ID, matchScenario, matchScenarioResult, getScenario } from './scenarios.js'
import { materials } from './materials.js'

const matIds = new Set(materials.map((m) => m.id))

test('3개 시나리오 + 메인 1개', () => {
  expect(scenarios.length).toBe(3)
  expect(scenarios.filter((s) => s.main).length).toBe(1)
  expect(scenarios.map((s) => s.id).sort()).toEqual(['democracy', 'economy', 'independence'])
  expect(MAIN_SCENARIO_ID).toBe('democracy')
})

test('각 시나리오 materialIds는 실제 material id, 비어있지 않음', () => {
  for (const s of scenarios) {
    expect(s.materialIds.length).toBeGreaterThan(0)
    for (const id of s.materialIds) expect(matIds.has(id)).toBe(true)
  }
})

test('chat sources ⊆ 해당 시나리오 materialIds', () => {
  for (const s of scenarios) {
    const ids = new Set(s.materialIds)
    for (const msg of s.chat) for (const src of msg.sources || []) expect(ids.has(src)).toBe(true)
  }
})

test('nodeEdges 끝점은 실제 node id; nodeItems 값 ⊆ materialIds', () => {
  for (const s of scenarios) {
    const nodeIds = new Set(s.nodes.map((n) => n.id))
    for (const e of s.nodeEdges) { expect(nodeIds.has(e.from)).toBe(true); expect(nodeIds.has(e.to)).toBe(true) }
    const ids = new Set(s.materialIds)
    for (const arr of Object.values(s.nodeItems)) for (const id of arr) expect(ids.has(id)).toBe(true)
  }
})

test('keywords 비어있지 않음 + typeFacets 4종', () => {
  for (const s of scenarios) {
    expect(s.keywords.length).toBeGreaterThan(0)
    expect(Object.keys(s.typeFacets).sort()).toEqual(['도서', '영상', '음성', '이미지'])
  }
})

test('matchScenario: 키워드 매칭, 없으면 메인', () => {
  expect(matchScenario('5·18 자료').id).toBe('democracy')
  expect(matchScenario('수출 경제개발').id).toBe('economy')
  expect(matchScenario('독립운동가').id).toBe('independence')
  expect(matchScenario('아무거나 xyz').id).toBe(MAIN_SCENARIO_ID)
  expect(getScenario('nope').id).toBe(MAIN_SCENARIO_ID)
})

test('matchScenarioResult: 키워드 매칭 시 matched=true + 해당 시나리오', () => {
  const r = matchScenarioResult('5·18 자료')
  expect(r.matched).toBe(true)
  expect(r.scenario.id).toBe('democracy')
})

test('matchScenarioResult: 키워드 미매칭 시 matched=false + 메인 폴백', () => {
  const r = matchScenarioResult('아무거나 xyz')
  expect(r.matched).toBe(false)
  expect(r.scenario.id).toBe(MAIN_SCENARIO_ID)
})

test('matchScenarioResult: 빈 입력은 미매칭 폴백', () => {
  expect(matchScenarioResult('').matched).toBe(false)
})

// T6-3 불변식: 그래프 node.count == nodeItems[id].length
test('T6-3: 모든 시나리오에서 node.count === nodeItems[id].length (그래프 ↔ 모달 일치)', () => {
  for (const s of scenarios) {
    for (const node of s.nodes) {
      const items = s.nodeItems[node.id]
      if (items === undefined) continue // nodeItems 키가 없는 노드는 건너뜀
      expect(node.count).toBe(items.length)
    }
  }
})

test('matchScenario: "1970년대 국가 관광 정책" 질의는 economy로 매칭된다(round06e — 5·18 오폴백 방지)', () => {
  expect(matchScenario('1970년대 국가 관광 정책에 대해 알려줘').id).toBe('economy')
})

test('matchScenario: "스탈린 소비에트 연방 총리 기념 케이스" 질의는 independence로 매칭된다', () => {
  expect(matchScenario('이오시프 스탈린 소비에트 연방 총리 기념 케이스의 자료열람과 신청하는 방법을 알려줘.').id).toBe('independence')
})
