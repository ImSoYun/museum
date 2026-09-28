import { useState, useRef, useEffect } from 'react'

export function useSimulatedDelay() {
  const [loading, setLoading] = useState(false)
  const timer = useRef(null)
  useEffect(() => () => clearTimeout(timer.current), [])
  function run(ms, onDone) {
    setLoading(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => { setLoading(false); onDone && onDone() }, ms)
  }
  return { loading, run }
}
