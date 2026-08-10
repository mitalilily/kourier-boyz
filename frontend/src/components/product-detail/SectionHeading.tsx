import React from 'react'

interface SectionHeadingProps {
  title: string
  subtitle?: string
}

const SectionHeading: React.FC<SectionHeadingProps> = ({ title, subtitle }) => (
  <div>
    {subtitle ? (
      <p className="text-xs uppercase tracking-[0.2em] text-gray-400">{subtitle}</p>
    ) : null}
    <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
  </div>
)

export default SectionHeading

