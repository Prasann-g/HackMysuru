import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  hoverable?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  hoverable = false,
  ...props
}) => {
  return (
    <div
      className={`bg-white border border-bridge-almond-200 rounded-xl shadow-bridge-card transition-all duration-200 ease-out ${
        hoverable
          ? 'hover:shadow-civic-md hover:border-bridge-gold-400/80 hover:-translate-y-0.5 motion-reduce:hover:translate-y-0 cursor-pointer'
          : ''
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export const CardHeader: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => {
  return (
    <div className={`p-5 border-b border-bridge-almond-200/80 ${className}`}>
      {children}
    </div>
  );
};

export const CardBody: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => {
  return <div className={`p-5 text-bridge-charcoal-700 ${className}`}>{children}</div>;
};

export const CardFooter: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => {
  return (
    <div className={`p-4 bg-bridge-almond-50/80 border-t border-bridge-almond-200/80 rounded-b-xl ${className}`}>
      {children}
    </div>
  );
};
