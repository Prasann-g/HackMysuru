import React from 'react';
import { Camera, SearchCheck, GitFork, Clock } from 'lucide-react';
import { Card, CardBody } from '../ui/Card';
import { Badge } from '../ui/Badge';

export const WhyCivicTrust: React.FC = () => {
  const values = [
    {
      icon: <Camera className="w-5 h-5 text-brand-teal-700" />,
      title: 'Submit with Clear Evidence',
      description:
        'Citizens can report potholes, streetlight outages, or garbage dumping with descriptions, landmark locations, and photos showing visible details.',
      status: 'Active in Citizen Portal',
      statusVariant: 'verified' as const,
    },
    {
      icon: <SearchCheck className="w-5 h-5 text-brand-teal-700" />,
      title: 'Evidence-Based Review',
      description:
        'Explainable checks evaluate reported issues to highlight potential duplicates or missing information, assisting ward engineers before teams are dispatched.',
      status: 'Decision Support Active',
      statusVariant: 'info' as const,
    },
    {
      icon: <GitFork className="w-5 h-5 text-brand-teal-700" />,
      title: 'Direct Authority Routing',
      description:
        'Helps direct complaints to the responsible Mysuru City Corporation (MCC) department and ward division rather than getting lost in administrative silos.',
      status: 'MCC Ward Mapping',
      statusVariant: 'info' as const,
    },
    {
      icon: <Clock className="w-5 h-5 text-brand-teal-700" />,
      title: 'Follow Complaint Progress',
      description:
        'Track the lifecycle of your reported complaint with clear stages from initial review and field assignment to final on-site resolution.',
      status: 'SLA Tracking',
      statusVariant: 'review' as const,
    },
  ];

  return (
    <section className="py-16 sm:py-20 bg-white border-b border-brand-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto text-center mb-12 sm:mb-16">
          <Badge variant="info" size="sm" className="mb-2">
            Why Civic Trust
          </Badge>
          <h2 className="text-2xl sm:text-3xl font-bold text-brand-slate-900 tracking-tight">
            Better civic reporting for Mysuru neighborhoods
          </h2>
          <p className="mt-3 text-sm sm:text-base text-brand-slate-600 leading-relaxed">
            A transparent bridge connecting Mysuru residents with ward engineers to ensure genuine civic issues are noticed, verified, and resolved.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {values.map((v) => (
            <Card key={v.title} hoverable className="flex flex-col justify-between">
              <CardBody className="p-6">
                <div className="w-10 h-10 rounded-xl bg-brand-teal-50 border border-brand-teal-200 flex items-center justify-center mb-4">
                  {v.icon}
                </div>
                <h3 className="text-base font-bold text-brand-slate-900 mb-2">
                  {v.title}
                </h3>
                <p className="text-xs sm:text-sm text-brand-slate-600 leading-relaxed mb-4">
                  {v.description}
                </p>
                <div className="pt-3 border-t border-brand-slate-100 mt-auto">
                  <Badge variant={v.statusVariant} size="sm">
                    {v.status}
                  </Badge>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};
