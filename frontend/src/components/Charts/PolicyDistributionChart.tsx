import React from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';

interface PolicyDistributionProps {
  data: { policy: string; count: number; percentage: number }[];
}

const COLORS = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EC4899', '#06B6D4'];

export const PolicyDistributionChart: React.FC<PolicyDistributionProps> = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-xs text-slate-500">
        No active custody policies registered yet
      </div>
    );
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={80}
            paddingAngle={4}
            dataKey="count"
            nameKey="policy"
          >
            {data.map((_, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="#0F1626" strokeWidth={2} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: '#0F1626',
              borderColor: '#1E2B4D',
              borderRadius: '12px',
              fontSize: '12px',
              color: '#F1F5F9',
            }}
            formatter={(val: any, name: any, item: any) => [
              `${val} secret(s) (${item.payload.percentage}%)`,
              `Policy: ${name}`,
            ]}
          />
          <Legend
            verticalAlign="bottom"
            height={36}
            formatter={(value) => <span className="text-xs text-slate-300 font-mono">{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};
