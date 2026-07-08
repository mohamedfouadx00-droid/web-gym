import type { ButtonHTMLAttributes, ReactNode } from 'react'

export function Page({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section className="page">
      <header className="page-header">
        <div>
          <h1>{title}</h1>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <span className="brand-pill">GYM</span>
      </header>
      {children}
    </section>
  )
}

export function Card({ title, children, className = '' }: { title?: string; children: ReactNode; className?: string }) {
  return <section className={`card ${className}`}>{title && <h2>{title}</h2>}{children}</section>
}

export function Button({ children, variant = 'primary', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' }) {
  return <button className={`btn ${variant}`} {...props}>{children}</button>
}

export function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return <div className="stat"><span>{label}</span><strong>{value}</strong>{hint && <small>{hint}</small>}</div>
}

export function EmptyState({ text }: { text: string }) {
  return <div className="empty-state">{text}</div>
}

export function ProgressBar({ value, max }: { value: number; max: number }) {
  const percent = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  return <div className="progress-track"><div className="progress-fill" style={{ width: `${percent}%` }} /></div>
}
