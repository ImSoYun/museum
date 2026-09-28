import { useContext } from 'react'
import { LibraryContext } from './LibraryProvider.jsx'

export function useLibrary() {
  const ctx = useContext(LibraryContext)
  if (!ctx) throw new Error('useLibrary must be used within LibraryProvider')
  return ctx
}
