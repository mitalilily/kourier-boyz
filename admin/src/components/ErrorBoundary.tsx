import { Button, Result } from 'antd'
import { Component, type ErrorInfo, type ReactNode } from 'react'

export interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
  onRetry?: () => void
  title?: string
  subTitle?: string
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

/**
 * Catches JavaScript errors in child components and shows a fallback UI.
 * Use for lazy-loaded chunks (e.g. "Failed to fetch dynamically imported module").
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    error: null,
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo)
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null })
    this.props.onRetry?.()
  }

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback
      }
      const isChunkError =
        this.state.error?.message?.includes('Failed to fetch dynamically imported module') ||
        this.state.error?.message?.includes('Loading chunk')
      return (
        <Result
          status="error"
          title={this.props.title ?? (isChunkError ? 'Failed to load' : 'Something went wrong')}
          subTitle={
            this.props.subTitle ??
            (isChunkError
              ? 'The page could not be loaded. This can happen after a new deployment—try refreshing.'
              : this.state.error.message)
          }
          extra={
            this.props.onRetry ? (
              <Button type="primary" onClick={this.handleRetry}>
                Retry
              </Button>
            ) : null
          }
        />
      )
    }
    return this.props.children
  }
}
