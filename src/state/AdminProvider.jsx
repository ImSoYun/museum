import { createContext, useReducer } from 'react'
import { clusteringPrompts } from '../data/clusteringPrompts.js'
import { useAuth } from '../context/AuthContext.jsx'

export const AdminContext = createContext(null)

let seq = 0
function nextId() {
  seq += 1
  return `crit-${seq}`
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

// round06c F2: manager 기본값(CURRENT_USER.name)은 reducer 밖(AdminProvider 컴포넌트)에서
// 채운다 — reducer는 훅을 호출할 수 없는 순수 함수라 useAuth()에 닿지 못하기 때문이다.
// 그래서 여기서는 action.payload.manager를 그대로 받아 쓰기만 한다(이미 해소된 값).
function reducer(state, action) {
  switch (action.type) {
    case 'add':
      return [
        {
          id: nextId(),
          createdAt: action.payload.createdAt ?? today(),
          title: action.payload.title,
          prompt: action.payload.prompt ?? '',
          manager: action.payload.manager,
          active: action.payload.active ?? true,
        },
        ...state,
      ]
    case 'update':
      return state.map((c) => (c.id === action.id ? { ...c, ...action.patch } : c))
    case 'remove':
      return state.filter((c) => !action.ids.includes(c.id))
    case 'toggleActive':
      return state.map((c) => (c.id === action.id ? { ...c, active: !c.active } : c))
    default:
      return state
  }
}

export function AdminProvider({ children }) {
  const { user } = useAuth()
  const [criteria, dispatch] = useReducer(reducer, clusteringPrompts)
  const value = {
    criteria,
    // 세션 사용자 요약 필드는 display_name이다(CURRENT_USER.name 자리를 대체 — museum/auth/routes.py
    // :_summarize·AuthContext.DEMO_MOCK_USER와 동일 계약).
    addCriterion: (payload) =>
      dispatch({ type: 'add', payload: { ...payload, manager: payload.manager ?? user?.display_name } }),
    updateCriterion: (id, patch) => dispatch({ type: 'update', id, patch }),
    removeCriteria: (ids) => dispatch({ type: 'remove', ids }),
    toggleActive: (id) => dispatch({ type: 'toggleActive', id }),
  }
  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>
}
