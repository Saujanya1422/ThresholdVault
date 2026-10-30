import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

interface RecoveryActivityProps {
  data: { label: string; pending: number; recovered: number; failed: number }[];
}

export const RecoveryActivityChart: React.FC<RecoveryActivityProps> = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-xs text-slate-500">
        No recovery operations logged yet
      </div>
    );
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1E2B4D" vertical={false} />
          <XAxis
            dataKey="label"
            stroke="#64748B"
            fontSize={11}
            tickLine={false}
            tickFormatter={(val) => (val.length > 12 ? `${val.substring(0, 10)}...` : val)}
          />
          <YAxis stroke="#64748B" fontSize={11} tickLine={false} allowDecimals={false} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#0F1626',
              borderColor: '#1E2B4D',
              borderRadius: '12px',
              fontSize: '12px',
              color: '#F1F5F9',
            }}
          />
          <Legend
            verticalAlign="bottom"
            height={36}
            formatter={(value) => (
              <span className="text-xs text-slate-300 capitalize">{value}</span>
            )}
          />
          <Bar dataKey="recovered" name="Recovered" fill="#10B981" radius={[4, 4, 0, 0]} />
          <Bar dataKey="pending" name="Pending Quorum" fill="#3B82F6" radius={[4, 4, 0, 0]} />
          <Bar dataKey="failed" name="Failed / Rejected" fill="#F43F5E" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
