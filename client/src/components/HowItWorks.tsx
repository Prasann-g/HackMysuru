import React from 'react';
import { UserCheck, FilePlus, CheckSquare, Activity } from 'lucide-react';
import { Card, CardBody } from './ui/Card';
import { Badge } from './ui/Badge';

export const HowItWorks: React.FC = () => {
  const steps = [
    {
      step: '01',
      title: 'Create an Account',
      description:
        'Sign up with your email and Mysuru locality to access verified reporting and keep track of your submitted issues.',
      icon: <UserCheck className="w-5 h-5 text-brand-teal-700" />,
    },
    {
      step: '02',
      title: 'Submit Your Issue',
      description:
        'Provide the problem type, a brief description, landmark location, and photo evidence showing the condition.',
      icon: <FilePlus className="w-5 h-5 text-brand-teal-700" />,
    },
    {
      step: '03',
      title: 'Review and Follow Up',
      description:
        'The system checks for duplicate reports in your area and prepares the ticket with evidence signals for ward engineers.',
      icon: <CheckSquare className="w-5 h-5 text-brand-teal-700" />,
    },
    {
      step: '04',
      title: 'Track Progress',
      description:
        'Follow your complaint through field inspection, department assignment, and final civic resolution.',
      icon: <Activity className="w-5 h-5 text-brand-teal-700" />,
    },
  ];

  return (
    <section id="how-it-works" className="py-16 sm:py-20 bg-brand-slate-50 border-b border-brand-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-12 sm:mb-16">
          <Badge variant="info" size="sm" className="mb-2">
            Simple Process
          </Badge>
          <h2 className="text-2xl sm:text-3xl font-bold text-brand-slate-900 tracking-tight">
            How Civic Trust Works
          </h2>
          <p className="mt-3 text-sm sm:text-base text-brand-slate-600">
            A straightforward 4-step journey designed for citizens of Mysuru to report and resolve civic problems.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((item) => (
            <Card key={item.step} hoverable className="bg-white">
              <CardBody className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-xl bg-brand-teal-50 border border-brand-teal-200 flex items-center justify-center">
                    {item.icon}
                  </div>
                  <span className="text-xl font-bold text-brand-teal-700/40 font-mono">
                    {item.step}
                  </span>
                </div>
                <h3 className="text-base font-bold text-brand-slate-900 mb-2">
                  {item.title}
                </h3>
                <p className="text-xs sm:text-sm text-brand-slate-600 leading-relaxed">
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
