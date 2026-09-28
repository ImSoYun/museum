import { materials } from './materials.js'
import { institutions } from './institutions.js'
import { dashboard } from './dashboard.js'
import { chatMessages } from './chat.js'
import { nodes, nodeEdges } from './nodes.js'
import { ocrFiles, SOURCE_FILES } from './ocrFiles.js'
import { metaFiles } from './metaFiles.js'
import { embeddingStatus } from './embeddingStatus.js'
import { learningHistory, MANAGERS } from './learningHistory.js'
import { managedMaterials } from './managedMaterials.js'
import { queryLogs } from './queryLogs.js'
import { clusteringPrompts } from './clusteringPrompts.js'

// ── 기존 스모크 테스트 ─────────────────────────────────────────────────────
test('materials have required fields', () => {
  expect(materials.length).toBeGreaterThan(0)
  expect(materials[0]).toHaveProperty('title')
  expect(materials[0].meta).toHaveProperty('detail')
})
test('institutions and dashboard load', () => {
  expect(institutions[0].name).toBe('전체')
  expect(dashboard.todayQueries).toBe(9142)
})

// ── 시나리오 A 정합 테스트 ────────────────────────────────────────────────
test('materials 60건 이상, 기관명이 institutions에 존재', () => {
  expect(materials.length).toBeGreaterThanOrEqual(60)
  // institutions에서 '전체(all)' 제외한 기관 이름 집합
  const names = new Set(institutions.filter(i => i.id !== 'all').map(i => i.name))
  for (const m of materials) {
    expect(names.has(m.institution)).toBe(true)
  }
})

test('institutions는 전체 aggregate + 8개 기관 = 총 9개', () => {
  expect(institutions.length).toBe(9)
  const allEntry = institutions.find(i => i.id === 'all')
  expect(allEntry).toBeDefined()
  expect(allEntry.name).toBe('전체')
  // 8개 실제 기관 존재 확인
  const nonAll = institutions.filter(i => i.id !== 'all')
  expect(nonAll.length).toBe(8)
})

test('chat.sources는 모두 실제 material id', () => {
  const ids = new Set(materials.map(m => m.id))
  for (const msg of chatMessages) {
    for (const s of (msg.sources || [])) {
      expect(ids.has(s)).toBe(true)
    }
  }
})

test('nodeEdges 끝점은 모두 실제 node id', () => {
  const ids = new Set(nodes.map(n => n.id))
  for (const e of nodeEdges) {
    expect(ids.has(e.from)).toBe(true)
    expect(ids.has(e.to)).toBe(true)
  }
})

test('nodes는 8개 이상 15개 이하', () => {
  expect(nodes.length).toBeGreaterThanOrEqual(8)
  expect(nodes.length).toBeLessThanOrEqual(15)
})

test('institutions all.count = sum of others', () => {
  const allEntry = institutions.find(i => i.id === 'all')
  const sum = institutions.filter(i => i.id !== 'all').reduce((acc, i) => acc + i.count, 0)
  expect(allEntry.count).toBe(sum)
})

// ── 시나리오 B 정합 테스트 ────────────────────────────────────────────────

// 최소 행 수
test('ocrFiles has at least 20 rows', () => {
  expect(ocrFiles.length).toBeGreaterThanOrEqual(20)
})
test('metaFiles has at least 15 rows', () => {
  expect(metaFiles.length).toBeGreaterThanOrEqual(15)
})
test('embeddingStatus has at least 20 rows', () => {
  expect(embeddingStatus.length).toBeGreaterThanOrEqual(20)
})
test('learningHistory has at least 25 rows', () => {
  expect(learningHistory.length).toBeGreaterThanOrEqual(25)
})
test('managedMaterials has at least 25 rows', () => {
  expect(managedMaterials.length).toBeGreaterThanOrEqual(25)
})

// 상태값 검증
test('ocrFiles: ocrStatus and translateStatus are within allowed values', () => {
  const allowed = new Set(['완료', '검수중', '미완료'])
  for (const f of ocrFiles) {
    expect(allowed.has(f.ocrStatus)).toBe(true)
    expect(allowed.has(f.translateStatus)).toBe(true)
  }
})
test('embeddingStatus: embedding within 완료/실패/검수중; data within 정상/오류/대기', () => {
  const embAllowed = new Set(['완료', '실패', '검수중'])
  const dataAllowed = new Set(['정상', '오류', '대기'])
  for (const e of embeddingStatus) {
    expect(embAllowed.has(e.embedding)).toBe(true)
    expect(dataAllowed.has(e.data)).toBe(true)
  }
})
test('learningHistory: status within 반영 완료/반영 중/반영 실패/검수중', () => {
  const allowed = new Set(['반영 완료', '반영 중', '반영 실패', '검수중'])
  for (const l of learningHistory) {
    expect(allowed.has(l.status)).toBe(true)
  }
})
test('metaFiles: mapping within 완료/검수중', () => {
  const allowed = new Set(['완료', '검수중'])
  for (const f of metaFiles) {
    expect(allowed.has(f.mapping)).toBe(true)
  }
})

// 파일명 교집합: SOURCE_FILES, ocrFiles, metaFiles, embeddingStatus, learningHistory가 공통 파일명을 공유
test('SOURCE_FILES names overlap with ocrFiles names (>0 intersection)', () => {
  const sourceSet = new Set(SOURCE_FILES)
  const ocrNames = new Set(ocrFiles.map(f => f.name))
  const intersection = [...ocrNames].filter(n => sourceSet.has(n))
  expect(intersection.length).toBeGreaterThan(0)
})
test('learningHistory names overlap with embeddingStatus names (>0 intersection)', () => {
  const embNames = new Set(embeddingStatus.map(e => e.name))
  const overlap = learningHistory.filter(l => embNames.has(l.name))
  expect(overlap.length).toBeGreaterThan(0)
})
test('learningHistory names overlap with ocrFiles names (>0 intersection)', () => {
  const ocrNames = new Set(ocrFiles.map(f => f.name))
  const overlap = learningHistory.filter(l => ocrNames.has(l.name))
  expect(overlap.length).toBeGreaterThan(0)
})
test('metaFiles names overlap with ocrFiles names (>0 intersection)', () => {
  const ocrNames = new Set(ocrFiles.map(f => f.name))
  const overlap = metaFiles.filter(f => ocrNames.has(f.name))
  expect(overlap.length).toBeGreaterThan(0)
})

// 담당자 집합 검증
test('learningHistory managers are within shared MANAGERS set', () => {
  const managerSet = new Set(MANAGERS)
  for (const l of learningHistory) {
    expect(managerSet.has(l.manager)).toBe(true)
  }
})
test('managedMaterials managers are within shared MANAGERS set', () => {
  const managerSet = new Set(MANAGERS)
  for (const m of managedMaterials) {
    expect(managerSet.has(m.manager)).toBe(true)
  }
})

// id 포맷 검증
test('ocrFiles ids are prefixed o*, metaFiles f*, embeddingStatus e*, learningHistory l*, managedMaterials d*', () => {
  for (const f of ocrFiles)        expect(f.id).toMatch(/^o\d+$/)
  for (const f of metaFiles)       expect(f.id).toMatch(/^f\d+$/)
  for (const e of embeddingStatus) expect(e.id).toMatch(/^e\d+$/)
  for (const l of learningHistory) expect(l.id).toMatch(/^l\d+$/)
  for (const m of managedMaterials) expect(m.id).toMatch(/^d\d+$/)
})

// extractPreview: 완료 행에는 null이 아닌 값이 있어야 함
test('ocrFiles with ocrStatus 완료 have non-null extractPreview', () => {
  const doneRows = ocrFiles.filter(f => f.ocrStatus === '완료')
  expect(doneRows.length).toBeGreaterThan(0)
  for (const f of doneRows) {
    expect(f.extractPreview).not.toBeNull()
    expect(typeof f.extractPreview).toBe('string')
    expect(f.extractPreview.length).toBeGreaterThan(0)
  }
})

// ── 시나리오 C 정합 테스트 ────────────────────────────────────────────────

test('queryLogs has at least 20 rows', () => {
  expect(queryLogs.length).toBeGreaterThanOrEqual(20)
})

test('queryLogs: every rating is 도움됨 or 도움되지 않음', () => {
  const allowed = new Set(['도움됨', '도움되지 않음'])
  for (const q of queryLogs) {
    expect(allowed.has(q.rating)).toBe(true)
  }
})

test('queryLogs: ids are prefixed q*', () => {
  for (const q of queryLogs) {
    expect(q.id).toMatch(/^q\d+$/)
  }
})

test('queryLogs: majority rating is 도움됨 (realistic distribution)', () => {
  const helpful = queryLogs.filter(q => q.rating === '도움됨').length
  expect(helpful).toBeGreaterThan(queryLogs.length / 2)
})

test('clusteringPrompts has between 10 and 20 rows', () => {
  expect(clusteringPrompts.length).toBeGreaterThanOrEqual(10)
  expect(clusteringPrompts.length).toBeLessThanOrEqual(20)
})

test('clusteringPrompts: at least one active=true and at least one active=false', () => {
  const hasTrue = clusteringPrompts.some(c => c.active === true)
  const hasFalse = clusteringPrompts.some(c => c.active === false)
  expect(hasTrue).toBe(true)
  expect(hasFalse).toBe(true)
})

test('clusteringPrompts: every manager is in shared MANAGERS set', () => {
  const managerSet = new Set(MANAGERS)
  for (const c of clusteringPrompts) {
    expect(managerSet.has(c.manager)).toBe(true)
  }
})

test('dashboard.todayQueries === 9142 (regression guard)', () => {
  expect(dashboard.todayQueries).toBe(9142)
})

// ── queryLogs 불변식: comment === comments.length ─────────────────────────
test('queryLogs: comment field equals comments array length for every log', () => {
  for (const q of queryLogs) {
    expect(Array.isArray(q.comments)).toBe(true)
    expect(q.comment).toBe(q.comments.length)
  }
})

test('queryLogs: logs with comment > 0 have non-empty comment texts', () => {
  for (const q of queryLogs) {
    if (q.comment > 0) {
      for (const text of q.comments) {
        expect(typeof text).toBe('string')
        expect(text.length).toBeGreaterThan(0)
      }
    }
  }
})

test('queryLogs: logs with comment === 0 have empty comments array', () => {
  for (const q of queryLogs) {
    if (q.comment === 0) {
      expect(q.comments).toEqual([])
    }
  }
})

// ── T6-9 공공누리 제4유형 통일 ──────────────────────────────────────────────
test('materials source: 제1유형 표기가 하나도 없다(제4유형으로 통일)', () => {
  const offenders = materials.filter((m) => /제1유형/.test(m.source || ''))
  expect(offenders.length).toBe(0)
})

test('materials source: 공공누리 자료는 제4유형으로 표기된다', () => {
  const kogl = materials.filter((m) => /공공누리/.test(m.source || ''))
  expect(kogl.length).toBeGreaterThan(0)
  for (const m of kogl) {
    expect(/제4유형/.test(m.source)).toBe(true)
  }
})

test('materials source: 학회 인증필요 자료(m83~m85)는 저작권자 허락 유지', () => {
  for (const id of ['m83', 'm84', 'm85']) {
    const m = materials.find((x) => x.id === id)
    expect(m).toBeDefined()
    expect(/저작권자 허락/.test(m.source)).toBe(true)
  }
})
