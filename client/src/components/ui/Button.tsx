import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  icon,
  children,
  className = '',
  disabled,
  ...props
}) => {
  const baseStyles = 'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-bridge-gold-500 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 cursor-pointer active:scale-[0.985] motion-reduce:active:scale-100';

  const sizeStyles = {
    sm: 'px-3 py-1.5 text-xs gap-1.5',
    md: 'px-4 py-2 text-sm gap-2',
    lg: 'px-5 py-2.5 text-base gap-2.5',
  };

  const variantStyles = {
    primary: 'bg-bridge-charcoal-800 text-white hover:bg-bridge-charcoal-900 shadow-bridge-sm hover:shadow-civic active:bg-bridge-charcoal-950 border border-bridge-charcoal-700',
    secondary: 'bg-bridge-almond-100 text-bridge-charcoal-800 hover:bg-bridge-almond-200 hover:border-bridge-almond-400 border border-bridge-almond-300 active:bg-bridge-almond-300',
    outline: 'bg-white text-bridge-charcoal-800 hover:bg-bridge-ivory-100 hover:border-bridge-almond-400 shadow-bridge-sm hover:shadow-civic-sm border border-bridge-almond-300 active:bg-bridge-almond-200',
    ghost: 'text-bridge-charcoal-700 hover:bg-bridge-almond-100/90 hover:text-bridge-charcoal-900 active:bg-bridge-almond-200',
  };

  return (
    <button
      className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      disabled={disabled}
      {...props}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      <span>{children}</span>
    </button>
  );
};
