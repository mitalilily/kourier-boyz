import { HomeOutlined, QuestionCircleOutlined, SearchOutlined } from '@ant-design/icons'
import { Button, Card, Space, Typography } from 'antd'
import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

const { Title, Text, Paragraph } = Typography

const NotFound = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    // Trigger fade-in animation
    setIsVisible(true)
  }, [])

  return (
    <div className="absolute inset-0 flex items-center justify-center w-full h-full p-4 md:p-8">
      <div
        className={`w-full max-w-2xl transition-all duration-600 ease-in-out ${
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5'
        }`}
      >
        <Card className="shadow-2xl rounded-2xl bg-gradient-to-br from-white to-gray-50 border border-gray-200 overflow-hidden">
          <div className="text-center py-8 md:py-12 px-6 md:px-8">
            {/* 404 Number */}
            <div className="mb-6 md:mb-8">
              <Title
                level={1}
                className="!m-0 !mb-2 font-bold text-6xl md:text-7xl text-gray-300 tracking-tight"
              >
                404
              </Title>
            </div>

            {/* Icon Container with Animation */}
            <div className="icon-container mb-6 md:mb-8">
              <div className="mx-auto flex items-center justify-center w-24 h-24 md:w-32 md:h-32 rounded-full bg-gradient-to-br from-blue-500 to-blue-400 shadow-lg shadow-blue-500/30">
                <QuestionCircleOutlined className="lock-icon text-white text-4xl md:text-5xl" />
              </div>
            </div>

            {/* Title */}
            <Title
              level={2}
              className="!m-0 !mb-4 font-semibold text-gray-800 tracking-tight"
            >
              Page Not Found
            </Title>

            {/* Subtitle */}
            <Paragraph className="text-lg text-gray-600 mb-2 leading-relaxed max-w-lg mx-auto">
              The page you're looking for doesn't exist or has been moved.
            </Paragraph>

            <Text className="text-sm text-gray-400 block mb-8">
              Please check the URL or navigate back to the dashboard
            </Text>

            {/* Route Info */}
            {location.pathname && (
              <div className="mb-6 md:mb-8 py-3 px-5 bg-gray-100 rounded-lg inline-block">
                <Space size="small">
                  <SearchOutlined className="text-gray-400 text-sm" />
                  <Text className="text-xs md:text-sm font-mono text-gray-600">
                    {location.pathname}
                  </Text>
                </Space>
              </div>
            )}

            {/* Action Buttons */}
            <Space size="middle" className="mt-8">
              <Button
                type="primary"
                size="large"
                icon={<HomeOutlined />}
                onClick={() => navigate('/dashboard')}
                className="h-12 px-8 rounded-lg text-base font-medium shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 hover:-translate-y-0.5 transition-all duration-300"
              >
                Go to Dashboard
              </Button>
              <Button
                size="large"
                onClick={() => navigate(-1)}
                className="h-12 px-8 rounded-lg text-base font-medium hover:-translate-y-0.5 transition-all duration-300"
              >
                Go Back
              </Button>
            </Space>
          </div>
        </Card>
      </div>
    </div>
  )
}

export default NotFound

















