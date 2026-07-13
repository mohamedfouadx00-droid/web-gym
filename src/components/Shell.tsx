import { Apple, BarChart3, Droplets, Home, MoreHorizontal } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'

const nav = [
  ['/', 'اليوم', Home],
  ['/food', 'أكلي', Apple],
  ['/water', 'مياهي', Droplets],
  ['/progress', 'تقدمي', BarChart3],
  ['/more', 'المزيد', MoreHorizontal],
] as const

export default function Shell() {
  return (
    <div className="app-shell">
      <main className="content"><Outlet /></main>
      <nav className="bottom-nav">
        {nav.map(([to, label, Icon]) => (
          <NavLink key={to} to={to} end={to === '/'}>
            <Icon size={21} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
