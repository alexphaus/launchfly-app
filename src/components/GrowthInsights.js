// src/components/GrowthInsights.js
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, Target, Users, ArrowRight } from 'lucide-react';

/**
 * GrowthInsights Component
 * 
 * Displays business growth metrics and insights from our core growth strategies.
 * This component visualizes the data from the growBusiness function.
 */
const GrowthInsights = ({ businessData, theme }) => {
  // Extract growth metrics if available, or use empty defaults
  const growthMetrics = businessData?.growthMetrics || {};
  const experiments = businessData?.experiments || [];
  const customers = growthMetrics?.customers || { totalLeads: 0, totalVisits: 0, conversionRate: 0 };
  const revenue = growthMetrics?.revenue || { totalRevenue: 0, sales: 0 };
  
  // Format metrics for display
  const formattedTotalRevenue = revenue.totalRevenue ? `$${revenue.totalRevenue.toLocaleString()}` : '$0';
  const conversionRate = customers.conversionRate ? `${(customers.conversionRate * 100).toFixed(1)}%` : '0%';
  
  // Prepare channel performance data for chart
  const channelData = customers.channelPerformance ? Object.values(customers.channelPerformance) : [];
  
  // Colors for charts
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];
  
  return (
    <div className="bg-white rounded-2xl p-6 md:p-8" style={{ boxShadow: theme.shadows.lg }}>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-2xl font-extrabold" style={{ color: theme.colors.textDark }}>
          Growth Insights
        </h3>
        <span className="text-xs py-1 px-3 rounded-full font-medium" style={{ backgroundColor: theme.colors.success + '20', color: theme.colors.success }}>
          Active
        </span>
      </div>
      
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="p-4 rounded-xl bg-gradient-to-br" style={{ background: theme.gradients.primary }}>
          <div className="flex items-start">
            <div className="p-2 rounded-lg bg-white/20 mr-3">
              <TrendingUp size={20} className="text-white" />
            </div>
            <div>
              <p className="text-white/80 text-sm">Total Revenue</p>
              <h4 className="text-white text-2xl font-bold">{formattedTotalRevenue}</h4>
            </div>
          </div>
        </div>
        
        <div className="p-4 rounded-xl bg-blue-50 border" style={{ borderColor: theme.colors.borderLight }}>
          <div className="flex items-start">
            <div className="p-2 rounded-lg mr-3" style={{ background: theme.colors.bgLight }}>
              <Target size={20} style={{ color: theme.colors.primary }} />
            </div>
            <div>
              <p style={{ color: theme.colors.textGray }} className="text-sm">Conversion Rate</p>
              <h4 style={{ color: theme.colors.textDark }} className="text-2xl font-bold">{conversionRate}</h4>
            </div>
          </div>
        </div>
        
        <div className="p-4 rounded-xl bg-blue-50 border" style={{ borderColor: theme.colors.borderLight }}>
          <div className="flex items-start">
            <div className="p-2 rounded-lg mr-3" style={{ background: theme.colors.bgLight }}>
              <Users size={20} style={{ color: theme.colors.primary }} />
            </div>
            <div>
              <p style={{ color: theme.colors.textGray }} className="text-sm">Total Visitors</p>
              <h4 style={{ color: theme.colors.textDark }} className="text-2xl font-bold">
                {customers.totalVisits ? customers.totalVisits.toLocaleString() : '0'}
              </h4>
            </div>
          </div>
        </div>
      </div>
      
      {/* Marketing Channel Performance */}
      {channelData.length > 0 && (
        <div className="mb-8">
          <h4 className="font-bold mb-4" style={{ color: theme.colors.textDark }}>Channel Performance</h4>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={channelData}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar name="Leads Generated" dataKey="leads" fill={theme.colors.primary} />
                <Bar name="Website Visits" dataKey="visits" fill={theme.colors.secondaryCta} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
      
      {/* Growth Experiments */}
      {experiments.length > 0 && (
        <div>
          <h4 className="font-bold mb-4" style={{ color: theme.colors.textDark }}>
            Growth Experiments
          </h4>
          <div className="space-y-4">
            {experiments.map((experiment, index) => (
              <div 
                key={index}
                className="p-4 rounded-xl border transition-all hover:shadow-md"
                style={{ borderColor: theme.colors.borderLight }}
              >
                <div className="flex justify-between items-start mb-2">
                  <h5 className="font-semibold" style={{ color: theme.colors.textDark }}>
                    {experiment.name}
                  </h5>
                  <span className={`text-xs py-1 px-2 rounded-full ${experiment.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {experiment.success ? 'Success' : 'Needs Review'}
                  </span>
                </div>
                <p className="text-sm mb-3" style={{ color: theme.colors.textGray }}>
                  {experiment.hypothesis}
                </p>
                {experiment.learnings && (
                  <div className="text-sm bg-blue-50 p-3 rounded">
                    <strong>Insights:</strong> {experiment.learnings}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Empty State */}
      {!growthMetrics.customers && !experiments.length && (
        <div className="text-center py-8 px-4 border-2 border-dashed rounded-xl" style={{ borderColor: theme.colors.borderLight }}>
          <h4 className="font-bold mb-2" style={{ color: theme.colors.textDark }}>
            Growth Analytics Coming Soon
          </h4>
          <p className="text-sm mb-4" style={{ color: theme.colors.textGray }}>
            After you launch your business, we'll start collecting data and running growth experiments.
          </p>
          <button
            className="inline-flex items-center gap-2 py-2 px-4 rounded-lg text-sm font-medium"
            style={{ color: theme.colors.white, background: theme.colors.primary }}
          >
            Activate Business First <ArrowRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
};

export default GrowthInsights;
