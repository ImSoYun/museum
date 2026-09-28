import { describe, expect, it } from 'vitest'
import { CHAT_TASKS, CHAT_TASK_ORDER } from './chatTasks.js'

describe('대화 작업 레지스트리', () => {
  // round10b B-4(시트 #11) — exhibition(특별전시, docx)을 채팅 작업선택에서
  // 빼고 exhibit(학예 기획 자료, xlsx)을 넣었다(chatTasks.js 정의부 주석 참조).
  it('두 종류가 피그마 순서로 있다', () => {
    expect(CHAT_TASK_ORDER).toEqual(['caption', 'exhibit'])
  })

  // 종류를 더할 때 문구 한 칸을 빠뜨리면 화면이 undefined 를 그린다.
  // 여기서 전수로 잠가 두면 빠뜨린 칸이 이 테스트에서 먼저 걸린다.
  it.each(CHAT_TASK_ORDER)('%s 는 문구 칸이 모두 채워져 있다', (key) => {
    const t = CHAT_TASKS[key]
    expect(t.value).toBe(key)
    for (const field of ['optionLabel', 'closedLabel', 'userBubble', 'panelTitle', 'emptyNoCitation', 'emptyAllExcluded']) {
      expect(typeof t[field], `${key}.${field}`).toBe('string')
      expect(t[field].length, `${key}.${field}`).toBeGreaterThan(0)
    }
    expect(typeof t.doneSummary).toBe('function')
    expect(t.doneSummary(3)).toContain('3')
  })

  // 빈 상태 문구가 설명문 어휘로 쓰여 있어 그대로 옮기면 학예 기획 자료 화면이
  // 「설명문」 이야기를 한다(spec §4). 종류 이름이 제 문구에 들어 있는지로 잠근다.
  it('학예 기획 자료 문구에 「설명문」이 섞이지 않는다', () => {
    const t = CHAT_TASKS.exhibit
    for (const field of ['userBubble', 'panelTitle', 'emptyNoCitation', 'emptyAllExcluded']) {
      expect(t[field], `${field}`).not.toContain('설명문')
    }
    expect(t.doneSummary(1)).not.toContain('설명문')
  })

  // round10b — 열린 목록은 「생성」, 닫힌 트리거는 「작성」이 caption에만 있는
  // 규칙이 아니라는 것을 exhibit로도 확인한다(파일 머리 주석 「생성/작성이 다른
  // 것은 오타가 아니다」가 새 항목에도 적용된다).
  it('exhibit도 열린 목록은 「생성」, 닫힌 트리거는 「작성」이다', () => {
    const t = CHAT_TASKS.exhibit
    expect(t.optionLabel).toBe('학예 기획 자료 생성')
    expect(t.closedLabel).toBe('학예 기획 자료 작성')
  })

  // round10b B-4 — exhibition(특별전시)은 채팅 레지스트리에서 완전히 빠졌다.
  // 남아 있으면 CHAT_TASK_ORDER만 고치고 CHAT_TASKS 쪽은 죽은 채로 남는(반대로도
  // 마찬가지) 절반짜리 삭제가 된다.
  it('exhibition 키는 더 이상 없다 — 채팅에서는 완전히 빠졌다', () => {
    expect(CHAT_TASKS.exhibition).toBeUndefined()
    expect(Object.keys(CHAT_TASKS)).toEqual(['caption', 'exhibit'])
  })
})
