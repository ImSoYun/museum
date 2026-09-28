import { useContext } from 'react'
import { ManageContext } from './ManageProvider.jsx'

export function useManage() {
  const ctx = useContext(ManageContext)
  if (!ctx) throw new Error('useManage must be used within ManageProvider')
  return ctx
}
