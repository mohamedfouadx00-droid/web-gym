import { Component, type ErrorInfo, type ReactNode } from 'react'
import { RefreshCw, ShieldAlert } from 'lucide-react'

interface Props { children: ReactNode }
interface State { hasError: boolean }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('GYM app error', error, info)
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <main className="fatal-error" dir="rtl">
        <ShieldAlert size={44} />
        <h1>حصل خطأ غير متوقع</h1>
        <p>بياناتك محفوظة على الجهاز. أعد تحميل التطبيق، ولو المشكلة تكررت صدّر نسخة احتياطية من الإعدادات.</p>
        <button onClick={() => window.location.reload()}>
          <RefreshCw size={18} />
          أعد تحميل التطبيق
        </button>
      </main>
    )
  }
}
