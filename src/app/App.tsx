import { useEffect, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Navigate, Route, Routes } from 'react-router-dom'
import { appSettings, db } from '../data/db'
import Shell from '../components/Shell'
import OnboardingPage from '../features/onboarding/OnboardingPage'
import HomePage from '../features/home/HomePage'
import FoodPage from '../features/food/FoodPage'
import WaterPage from '../features/water/WaterPage'
import ProgressPage from '../features/progress/ProgressPage'
import MorePage from '../features/more/MorePage'

function Guard({ children }: { children: ReactNode }) {
  const activeUserId = appSettings.activeUserId
  const storedUser = useLiveQuery(
    async () => activeUserId ? (await db.users.get(activeUserId) ?? null) : null,
    [activeUserId],
  )

  useEffect(() => {
    if (storedUser !== null || !activeUserId) return
    appSettings.activeUserId = null
    appSettings.onboardingCompleted = false
  }, [storedUser, activeUserId])

  if (!appSettings.onboardingCompleted || !activeUserId || storedUser === null) {
    return <Navigate to="/onboarding" replace />
  }

  if (storedUser === undefined) {
    return <main className="app-loading" dir="rtl"><span>GYM</span><p>بجهز بياناتك...</p></main>
  }

  return <>{children}</>
}

export default function App() {
  return (
    <Routes>
      <Route path="/onboarding" element={<OnboardingPage />} />

      <Route element={<Guard><Shell /></Guard>}>
        <Route index element={<HomePage />} />
        <Route path="/food" element={<FoodPage />} />
        <Route path="/water" element={<WaterPage />} />
        <Route path="/progress" element={<ProgressPage />} />
        <Route path="/more" element={<MorePage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
