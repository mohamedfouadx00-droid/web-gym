import {Navigate,Route,Routes} from 'react-router-dom'
import {appSettings} from '../data/db'
import Shell from '../components/Shell'
import OnboardingPage from '../features/onboarding/OnboardingPage'
import HomePage from '../features/home/HomePage'
import RecoveryPage from '../features/recovery/RecoveryPage'
import ExercisesPage from '../features/exercises/ExercisesPage'
import WorkoutPage from '../features/workout/WorkoutPage'
import NutritionPage from '../features/nutrition/NutritionPage'
import ProgressPage from '../features/progress/ProgressPage'
import MorePage from '../features/more/MorePage'
function Guard({children}:{children:React.ReactNode}){return !appSettings.onboardingCompleted||!appSettings.activeUserId?<Navigate to="/onboarding" replace/>:<>{children}</>}
export default function App(){return <Routes><Route path="/onboarding" element={<OnboardingPage/>}/><Route element={<Guard><Shell/></Guard>}><Route index element={<HomePage/>}/><Route path="/recovery" element={<RecoveryPage/>}/><Route path="/exercises" element={<ExercisesPage/>}/><Route path="/workout" element={<WorkoutPage/>}/><Route path="/nutrition" element={<NutritionPage/>}/><Route path="/progress" element={<ProgressPage/>}/><Route path="/more" element={<MorePage/>}/></Route><Route path="*" element={<Navigate to="/" replace/>}/></Routes>}
