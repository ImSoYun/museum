import { createContext, useCallback, useRef, useState } from 'react'

export const ToastContext = createContext(null)

let seq = 0

export function ToastProvider({ children, duration = 2500 }) {
  const [toasts, setToasts] = useState([])
  const timers = useRef({})

  const remove = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id))
    if (timers.current[id]) {
      clearTimeout(timers.current[id])
      delete timers.current[id]
    }
  }, [])

  // 두 번째 인자는 이 호출에만 적용되는 표시 시간이다. 기본 2500ms 는 「저장
  // 했습니다」처럼 짧은 확인 문구를 전제로 고른 값이라, 사실을 담은 긴 문장
  // (round07e 의 「타임라인 항목이 만들어지지 않았습니다」 같은)은 다 읽히기
  // 전에 사라진다. 읽히지 않는 안내는 안내하지 않은 것과 같다.
  const showToast = useCallback(
    (message, options) => {
      seq += 1
      const id = seq
      const ms = options?.duration ?? duration
      setToasts((list) => [...list, { id, message }])
      timers.current[id] = setTimeout(() => remove(id), ms)
    },
    [duration, remove]
  )

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] flex flex-col items-center gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className="bg-ink text-white text-sm rounded-lg px-4 py-2.5 shadow-[0_10px_30px_-8px_rgba(8,15,38,.5)] animate-modalIn"
			style={{ padding: "10px 20px"}}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
