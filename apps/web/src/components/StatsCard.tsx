import React from 'react';

type Props = {
  title: string;
  value: string | number;
  variant?: 'default' | 'warning' | 'neutral' | 'danger' | 'success';
  small?: boolean;
};

const variantStyles: Record<
  NonNullable<Props['variant']>,
  { bg: string; color: string }
> = {
  default: { bg: '#ffffff', color: '#0f172a' },
  warning: { bg: '#fffbeb', color: '#92400e' },
  neutral: { bg: '#ecfdf5', color: '#065f46' },
  danger: { bg: '#fff1f2', color: '#7f1d1d' },
  success: { bg: '#f0fdf4', color: '#065f46' },
};

const StatsCard: React.FC<Props> = ({ title, value, variant = 'default', small }) => {
  const styles = variantStyles[variant];

  return (
    <div
      className="stats-card"
      style={{
        background: styles.bg,
        color: styles.color,
        borderRadius: 12,
        padding: small ? 12 : 20,
        boxShadow: '0 6px 18px rgba(2,6,23,0.04)',
        minHeight: 92,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
      }}
    >
      <div className="stats-card-title" style={{ fontSize: 13, color: '#6b7280', marginBottom: 8 }}>
        {title}
      </div>
      <div className="stats-card-value" style={{ fontSize: small ? 20 : 28, fontWeight: 800 }}>
        {value}
      </div>
    </div>
  );
};

export default StatsCard;