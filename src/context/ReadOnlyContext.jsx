// 이 파일의 책임: 「지금 화면이 읽기 전용인가」 하나만 아래로 흘린다(round10).
//
// 상세는 기존 검색·대화·산출물 화면을 그대로 태운다(spec §6) — 그 화면들이 저마다
// prop 을 받으려면 중간 컴포넌트가 전부 그것을 날라야 한다. 플래그 하나라 컨텍스트가 싸다.
// 기본값이 false 라 기존 화면(자료검색)은 아무 것도 바뀌지 않는다.
import { createContext, useContext } from 'react'

const ReadOnlyContext = createContext(false)

export function ReadOnlyProvider({ value, children }) {
  return <ReadOnlyContext.Provider value={value}>{children}</ReadOnlyContext.Provider>
}

export function useReadOnly() {
  return useContext(ReadOnlyContext)
}
