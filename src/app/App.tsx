import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { appSettings } from '../data/db'
import Shell from '../components/Shell'
import OnboardingPage from '../features/onboarding/OnboardingPage'
import HomePage from '../features/home/HomePage'
import FoodPage from '../features/food/FoodPage'
import WaterPage from '../features/water/WaterPage'
import ProgressPage from '../features/progress/ProgressPage'
import MorePage from '../features/more/MorePage'

function Guard({ children }: { children: ReactNode }) {
  if (!appSettings.onboardingCompleted || !appSettings.activeUserId) {
    return <Navigate to="/onboarding" replace />
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
