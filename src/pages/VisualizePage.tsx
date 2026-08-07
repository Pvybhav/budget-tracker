import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

export default function VisualizePage() {
  const expenses = useLiveQuery(() => db.expenses.toArray());
  const payments = useLiveQuery(() => db.payments.toArray());
  const categories = useLiveQuery(() => db.categories.toArray());
  const cards = useLiveQuery(() => db.cards.toArray());

  if (!expenses || !payments || !categories || !cards) {
    return <div className="p-8 text-slate-400">Loading charts...</div>;
  }

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  // 1. Category-wise spent in current month
  const monthlyCategoryData = categories.map(cat => {
    const total = expenses
      .filter(exp => {
        const d = new Date(exp.date);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear && exp.categoryId === cat.id;
      })
      .reduce((sum, exp) => sum + exp.amount, 0);
    return { name: cat.title, amount: total };
  }).filter(d => d.amount > 0);

  // 2. Category-wise spent for the year
  const yearlyCategoryData = categories.map(cat => {
    const total = expenses
      .filter(exp => {
        const d = new Date(exp.date);
        return d.getFullYear() === currentYear && exp.categoryId === cat.id;
      })
      .reduce((sum, exp) => sum + exp.amount, 0);
    return { name: cat.title, amount: total };
  }).filter(d => d.amount > 0);

  // 3. Credit card-wise spending for this month
  const monthlyCardSpendingData = cards.map(card => {
    const total = expenses
      .filter(exp => {
        const d = new Date(exp.date);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear && exp.cardId === card.id;
      })
      .reduce((sum, exp) => sum + exp.amount, 0);
    return { name: card.title, amount: total };
  }).filter(d => d.amount > 0);

  // 4. Credit card-wise spending for yearly
  const yearlyCardSpendingData = cards.map(card => {
    const total = expenses
      .filter(exp => {
        const d = new Date(exp.date);
        return d.getFullYear() === currentYear && exp.cardId === card.id;
      })
      .reduce((sum, exp) => sum + exp.amount, 0);
    return { name: card.title, amount: total };
  }).filter(d => d.amount > 0);

  const ChartCard = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl flex flex-col h-[400px]">
      <h3 className="text-slate-200 font-semibold mb-6 text-lg">{title}</h3>
      <div className="flex-1 w-full min-h-0">
        {children}
      </div>
    </div>
  );

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-800 border border-slate-700 p-3 rounded-lg shadow-xl outline-none">
          <p className="text-slate-200 font-medium mb-1">{payload[0].name}</p>
          <p className="text-emerald-400 font-bold">₹{payload[0].value.toLocaleString()}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-8 pb-12">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Visualize</h1>
        <p className="text-slate-400">Spending and payment insights for {now.toLocaleString('default', { month: 'long', year: 'numeric' })}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Month Category Bar Chart */}
        <ChartCard title="Spending by Category (This Month)">
          {monthlyCategoryData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyCategoryData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis 
                  dataKey="name" 
                  stroke="#94a3b8" 
                  fontSize={12} 
                  tickLine={false} 
                  axisLine={false}
                />
                <YAxis 
                  stroke="#94a3b8" 
                  fontSize={12} 
                  tickLine={false} 
                  axisLine={false}
                  tickFormatter={(value) => `₹${value}`}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: '#1e293b' }} />
                <Bar dataKey="amount" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-500 italic">No data for this month</div>
          )}
        </ChartCard>

        {/* Year Category Bar Chart */}
        <ChartCard title="Spending by Category (This Year)">
          {yearlyCategoryData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={yearlyCategoryData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis 
                  dataKey="name" 
                  stroke="#94a3b8" 
                  fontSize={12} 
                  tickLine={false} 
                  axisLine={false}
                />
                <YAxis 
                  stroke="#94a3b8" 
                  fontSize={12} 
                  tickLine={false} 
                  axisLine={false}
                  tickFormatter={(value) => `₹${value}`}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: '#1e293b' }} />
                <Bar dataKey="amount" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-500 italic">No data for this year</div>
          )}
        </ChartCard>

        {/* Month Card Spending Pie Chart */}
        <ChartCard title="Spending by Card (This Month)">
          {monthlyCardSpendingData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={monthlyCardSpendingData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="amount"
                >
                  {monthlyCardSpendingData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-500 italic">No data for this month</div>
          )}
        </ChartCard>

        {/* Year Card Spending Pie Chart */}
        <ChartCard title="Spending by Card (This Year)">
          {yearlyCardSpendingData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={yearlyCardSpendingData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="amount"
                >
                  {yearlyCardSpendingData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-500 italic">No data for this year</div>
          )}
        </ChartCard>
      </div>
    </div>
  );
}
