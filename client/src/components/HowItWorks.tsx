import React from 'react';
import { UserCheck, CheckSquare } from 'lucide-react';
import { Card, CardBody } from './ui/Card';
import { Badge } from './ui/Badge';

const UserReportWarningIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    {/* Body */}
    <path d="M5 20v-1a5 5 0 0 1 5-5h2" />
    {/* Head */}
    <circle cx="11" cy="8" r="4" />
    {/* Speech Bubble */}
    <path d="M16 4a4 4 0 0 1 4 4v1a4 4 0 0 1-2.7 3.8L15 14v-2.1A4 4 0 0 1 12 8a4 4 0 0 1 4-4z" />
    {/* Exclamation */}
    <line x1="16" y1="6" x2="16" y2="9.5" />
    <line x1="16" y1="11.5" x2="16.01" y2="11.5" />
  </svg>
);

const DashboardGridIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <rect x="3" y="3" width="7" height="11" rx="1.5" />
    <rect x="3" y="16" width="7" height="5" rx="1.5" />
    <rect x="14" y="3" width="7" height="5" rx="1.5" />
    <rect x="14" y="10" width="7" height="11" rx="1.5" />
  </svg>
);

export const HowItWorks: React.FC = () => {
  const steps = [
    {
      step: '01',
      title: 'Create an Account',
      description:
        'Sign up with your email and Mysuru locality to access verified reporting and keep track of your submitted issues.',
      icon: <UserCheck className="w-5 h-5 text-bridge-gold-700" />,
    },
    {
      step: '02',
      title: 'Submit Your Issue',
      description:
        'Provide the problem type, a brief description, landmark location, and photo evidence showing the condition.',
      icon: <UserReportWarningIcon className="w-5 h-5 text-bridge-gold-700" />,
    },
    {
      step: '03',
      title: 'Review and Follow Up',
      description:
        'The system checks for duplicate reports in your area and prepares the ticket with evidence signals for ward engineers.',
      icon: <CheckSquare className="w-5 h-5 text-bridge-gold-700" />,
    },
    {
      step: '04',
      title: 'Track Progress',
      description:
        'Follow your complaint through field inspection, department assignment, and final civic resolution.',
      icon: <DashboardGridIcon className="w-5 h-5 text-bridge-gold-700" />,
    },
  ];

  return (
    <section id="how-it-works" className="py-16 sm:py-20 bg-bridge-ivory-50 border-b border-bridge-almond-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-12 sm:mb-16">
          <Badge variant="info" size="sm" className="mb-2">
            Simple Process
          </Badge>
          <h2 className="text-2xl sm:text-3xl font-bold text-bridge-charcoal-900 tracking-tight">
            How CivicBridge Works
          </h2>
          <p className="mt-3 text-sm sm:text-base text-bridge-charcoal-600">
            A straightforward 4-step journey designed for citizens of Mysuru to report and resolve civic problems.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((item) => (
            <Card key={item.step} hoverable className="bg-white">
              <CardBody className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-xl bg-bridge-almond-50 border border-bridge-almond-200 flex items-center justify-center">
                    {item.icon}
                  </div>
                  <span className="text-xl font-bold text-bridge-gold-600/60 font-mono">
                    {item.step}
                  </span>
                </div>
                <h3 className="text-base font-bold text-bridge-charcoal-900 mb-2">
                  {item.title}
                </h3>
                <p className="text-xs sm:text-sm text-bridge-charcoal-600 leading-relaxed">
                  {item.description}
                </p>
              </CardBody>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};
