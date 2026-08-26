import { ReloadOutlined, ShopOutlined } from '@ant-design/icons'
import { Button, Result } from 'antd'
import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
}

export default class RouteErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[Marketplace] Route render failed:', error, info)
  }

  recoverToDashboard = () => {
    window.location.assign(`${window.location.pathname}#/dashboard`)
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <main className="kb-route-recovery">
        <Result
          status="warning"
          title="This seller view needs a quick refresh"
          subTitle="Your workspace is still safe. Return to the seller hub or reload this view to continue."
          extra={[
            <Button key="dashboard" type="primary" icon={<ShopOutlined />} onClick={this.recoverToDashboard}>
              Return to seller hub
            </Button>,
            <Button key="reload" icon={<ReloadOutlined />} onClick={() => window.location.reload()}>
              Reload view
            </Button>,
          ]}
        />
      </main>
    )
  }
}
