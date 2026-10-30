import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  variant?: 'blue' | 'violet' | 'emerald' | 'amber' | 'rose';
  trend?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  variant = 'blue',
  trend,
}) => {
  const variantStyles = {
    blue: {
      iconBg: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      glow: 'group-hover:border-blue-500/40',
      badge: 'text-blue-400 bg-blue-500/10',
    },
    violet: {
      iconBg: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
      glow: 'group-hover:border-violet-500/40',
      badge: 'text-violet-400 bg-violet-500/10',
    },
    emerald: {
      iconBg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      glow: 'group-hover:border-emerald-500/40',
      badge: 'text-emerald-400 bg-emerald-500/10',
    },
    amber: {
      iconBg: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      glow: 'group-hover:border-amber-500/40',
      badge: 'text-amber-400 bg-amber-500/10',
    },
    rose: {
      iconBg: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
      glow: 'group-hover:border-rose-500/40',
      badge: 'text-rose-400 bg-rose-500/10',
    },
  };

  const currentVariant = variantStyles[variant];

  return (
    <div className={`group glass-card glass-card-hover p-5 rounded-2xl relative overflow-hidden transition-all duration-300 ${currentVariant.glow}`}>
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">{title}</p>
          <div className="text-2xl font-bold tracking-tight text-white">{value}</div>
          {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
        </div>
        <div className={`p-3 rounded-xl border ${currentVariant.iconBg} transition-transform duration-300 group-hover:scale-110`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      {trend && (
        <div className="mt-4 pt-3 border-t border-navy-700/50 flex items-center justify-between text-xs">
          <span className="text-slate-400">Activity Trend</span>
          <span className={`font-medium px-2 py-0.5 rounded-full ${currentVariant.badge}`}>
            {trend}
          </span>
        </div>
      )}
    </div>
  );
};
