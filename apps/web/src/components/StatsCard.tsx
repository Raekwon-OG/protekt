import React from 'react';

type Props = {
  title: string;
  value: string;
  trend?: string;
  variant?: 'default' | 'warning' | 'neutral';
};

const StatColors: Record<string, string> = {
  default: 'card',
  warning: 'card-warning',
  neutral: 'card-neutral',
};

const StatsCard: React.FC<Props> = ({ title, value, trend, variant = 'default' }) => {
  return (
    <div className={`stat-card ${StatColors[variant] || 'card'}`}>
      <div className="stat-title">{title}</div>
      <div className="stat-value">{value}</div>
      {trend && <div className="stat-trend">{trend}</div>}
    </div>
  );
};

export default StatsCard;