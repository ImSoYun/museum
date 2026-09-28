import { RouterProvider } from 'react-router-dom'
import { router } from './router.jsx'
import { ScenarioProvider } from './context/ScenarioContext.jsx'
import { ToastProvider } from './components/Toast.jsx'
export default function App() {
  return (
    <ToastProvider>
      <ScenarioProvider>
        <RouterProvider router={router} />
      </ScenarioProvider>
    </ToastProvider>
  )
}
