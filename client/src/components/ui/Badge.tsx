import React from 'react';

export interface BadgeProps {
  variant?: 'verified' | 'review' | 'duplicate' | 'info' | 'neutral';
  size?: 'sm' | 'md';
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'neutral',
  size = 'md',
  icon,
  children,
  className = '',
}) => {
  const baseStyles = 'inline-flex items-center font-medium rounded-full border transition-colors';

  const sizeStyles = {
    sm: 'px-2 py-0.5 text-xs gap-1',
    md: 'px-2.5 py-1 text-xs gap-1.5',
  };

  const variantStyles = {
    verified: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    review: 'bg-amber-50 text-amber-800 border-amber-200',
    duplicate: 'bg-rose-50 text-rose-800 border-rose-200',
    info: 'bg-bridge-gold-50 text-bridge-gold-800 border-bridge-gold-200',
    neutral: 'bg-bridge-almond-100 text-bridge-charcoal-700 border-bridge-almond-200',
  };

  return (
    <span className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}>
      {icon && <span className="shrink-0">{icon}</span>}
      <span>{children}</span>
    </span>
  );
};
