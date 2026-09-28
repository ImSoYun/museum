import { createContext, useReducer } from 'react'
import { ocrFiles } from '../data/ocrFiles.js'
import { metaFiles } from '../data/metaFiles.js'
import { embeddingStatus } from '../data/embeddingStatus.js'
import { learningHistory } from '../data/learningHistory.js'
import { managedMaterials } from '../data/managedMaterials.js'

export const ManageContext = createContext(null)

// 단방향 파이프라인 순서
export const STAGES = ['ocr', 'meta', 'embedding', 'history', 'materials']

function nextStage(stage) {
  const i = STAGES.indexOf(stage)
  return i >= 0 && i < STAGES.length - 1 ? STAGES[i + 1] : null
}

let seq = 0
function nextId() {
  seq += 1
  return `up-${seq}`
}

const initial = {
  ocr: ocrFiles,
  meta: metaFiles,
  embedding: embeddingStatus,
  history: learningHistory,
  materials: managedMaterials,
}

function reducer(state, action) {
  switch (action.type) {
    case 'promote': {
      const { stage, ids } = action
      const to = nextStage(stage)
      if (!to) return state
      const moving = state[stage].filter((it) => ids.includes(it.id))
      return {
        ...state,
        [stage]: state[stage].filter((it) => !ids.includes(it.id)),
        [to]: [...moving, ...state[to]],
      }
    }
    case 'addUpload':
      return {
        ...state,
        ocr: [
          {
            id: nextId(),
            name: action.name,
            uploadedAt: '방금 전',
            ocrStatus: '처리 대기',
            translateStatus: '미완료',
            extractPreview: null,
          },
          ...state.ocr,
        ],
      }
    case 'removeItem':
      return {
        ...state,
        [action.stage]: state[action.stage].filter((it) => it.id !== action.id),
      }
    case 'updateMeta':
      return {
        ...state,
        meta: state.meta.map((it) => (it.id === action.id ? { ...it, ...action.patch } : it)),
      }
    case 'updateItem':
      return {
        ...state,
        [action.stage]: state[action.stage].map((it) =>
          it.id === action.id ? { ...it, ...action.patch } : it
        ),
      }
    default:
      return state
  }
}

export function ManageProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initial)
  const value = {
    ocr: state.ocr,
    meta: state.meta,
    embedding: state.embedding,
    history: state.history,
    materials: state.materials,
    promote: (stage, ids) => dispatch({ type: 'promote', stage, ids }),
    addUpload: (name) => dispatch({ type: 'addUpload', name }),
    removeItem: (stage, id) => dispatch({ type: 'removeItem', stage, id }),
    updateMeta: (id, patch) => dispatch({ type: 'updateMeta', id, patch }),
    updateItem: (stage, id, patch) => dispatch({ type: 'updateItem', stage, id, patch }),
  }
  return <ManageContext.Provider value={value}>{children}</ManageContext.Provider>
}
