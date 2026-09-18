import React from 'react';
import { ShieldAlert, CheckCircle2, UserCheck, Eye } from 'lucide-react';
import { Card, CardBody } from '../ui/Card';
import { Badge } from '../ui/Badge';

export const TrustTransparency: React.FC = () => {
  const points = [
    {
      icon: <CheckCircle2 className="w-5 h-5 text-emerald-600" />,
      title: 'Decision Support for Officials',
      description:
        'CivicBridge evaluates complaints to provide evidence signals for ward engineers. Automated checks never dismiss or finalize a complaint without administrative oversight.',
    },
    {
      icon: <UserCheck className="w-5 h-5 text-bridge-gold-700" />,
      title: 'Human-in-the-Loop Review',
      description:
        'If an issue has incomplete information, category ambiguity, or potential similarities with another complaint, it is flagged for human review by a ward officer.',
    },
    {
      icon: <Eye className="w-5 h-5 text-amber-600" />,
      title: 'Submitted Evidence Only',
      description:
        'Photos taken with GPS Map Camera or other apps are treated as citizen-submitted evidence. Visible stamps provide helpful details but do not represent certified proof of authenticity.',
    },
    {
      icon: <ShieldAlert className="w-5 h-5 text-bridge-gold-700" />,
      title: 'Citizen Privacy by Default',
      description:
        'Private citizen contact details are strictly safeguarded and never exposed on public dashboards or incident markers.',
    },
  ];

  return (
    <section className="py-16 sm:py-20 bg-white border-b border-bridge-almond-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto text-center mb-12 sm:mb-16">
          <Badge variant="neutral" size="sm" className="mb-2">
            Governance Principles
          </Badge>
          <h2 className="text-2xl sm:text-3xl font-bold text-bridge-charcoal-900 tracking-tight">
            Trust &amp; Transparency in Civic Action
          </h2>
          <p className="mt-3 text-sm sm:text-base text-bridge-charcoal-600 leading-relaxed">
            Honest communication about what technology can and cannot verify.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
          {points.map((pt) => (
            <Card key={pt.title} className="border-bridge-almond-200">
              <CardBody className="p-6 flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-bridge-almond-100 flex items-center justify-center shrink-0 mt-0.5">
                  {pt.icon}
                </div>
                <div>
                  <h3 className="text-base font-bold text-bridge-charcoal-900 mb-1.5">
                    {pt.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-bridge-charcoal-600 leading-relaxed">
                    {pt.description}
                  </p>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};
