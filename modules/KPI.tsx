import React, { useState, useMemo } from 'react';
import { User, Unit, KPIData, KPI_KEYS, KPIKey } from '../types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, LineChart, Line, CartesianGrid } from 'recharts';
import { Download, FileUp, Filter, AlertOctagon } from 'lucide-react';

interface KPIProps {
  users: User[];
  units: Unit[];
}

// Generate random KPI data for demo
const generateKPI = (users: User[]): KPIData[] => {
    return users.map(u => {
        const targets: any = {};
        Object.keys(KPI_KEYS).forEach(key => {
            const target = Math.floor(Math.random() * 50) + 50;
            const actual = Math.floor(Math.random() * target * 1.2); // Random performance
            targets[key] = { target, actual };
        });
        return {
            hrmCode: u.hrmCode,
            fullName: u.fullName,
            unitId: u.unitId,
            targets
        };
    });
};

const KPI: React.FC<KPIProps> = ({ users, units }) => {
  const [activeTab, setActiveTab] = useState<'plan' | 'eval'>('plan');
  const [filterUnit, setFilterUnit] = useState<string>('all');
  const [filterKey, setFilterKey] = useState<KPIKey>('fiber');
  
  // Use useMemo to simulate "Database" fetch
  const kpiData = useMemo(() => generateKPI(users), [users]);

  // Filtering Logic
  const filteredData = kpiData.filter(item => {
      if (filterUnit !== 'all') {
          // Check if item's unit is the selected unit OR a child of it
          const unit = units.find(u => u.id === item.unitId);
          // Simple check: is exact unit or parent is selected unit
          if (item.unitId !== filterUnit && unit?.parentId !== filterUnit) return false;
      }
      return true;
  });

  // Calculate completion % for the selected key
  const chartData = filteredData.map(item => {
      const t = item.targets[filterKey];
      const percent = t.target > 0 ? (t.actual / t.target) * 100 : 0;
      return {
          name: item.fullName,
          percent: Math.round(percent),
          actual: t.actual,
          target: t.target
      };
  }).sort((a, b) => b.percent - a.percent);

  const top5 = chartData.slice(0, 5);
  const bottom5 = [...chartData].sort((a, b) => a.percent - b.percent).slice(0, 5);

  return (
    <div className="space-y-6">
       <div className="flex justify-between items-end">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Bộ chỉ số điều hành</h2>
            <p className="text-sm text-slate-500">Giao kế hoạch và đánh giá BSC/KPI nhân viên</p>
          </div>
          <div className="flex bg-slate-200 p-1 rounded-lg">
            <button onClick={() => setActiveTab('plan')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'plan' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600'}`}>Giao kế hoạch</button>
            <button onClick={() => setActiveTab('eval')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'eval' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600'}`}>Đánh giá</button>
          </div>
       </div>

       {activeTab === 'plan' && (
         <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 text-center">
              <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4"><FileUp size={32} /></div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">Import Dữ liệu Kế hoạch</h3>
              <p className="text-slate-500 mb-6">Tải lên file Excel (.xlsx) chứa chỉ tiêu. Trường khóa là <strong>Mã HRM</strong>.</p>
              
              <div className="bg-slate-50 border p-4 rounded-lg max-w-2xl mx-auto text-left mb-6 font-mono text-xs">
                  <div className="font-bold text-slate-700 mb-2">Mẫu file Excel (Header):</div>
                  <div className="bg-white border p-2 text-slate-500">HRM_CODE, FIBER_TARGET, MYTV_TARGET, MESH_TARGET, ...</div>
              </div>

              <div className="flex gap-4 justify-center">
                  <button className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-700">Chọn File Excel</button>
                  <button className="bg-white border border-slate-300 text-slate-700 px-6 py-2 rounded-lg font-bold hover:bg-slate-50">Kết nối Google Sheet</button>
              </div>
         </div>
       )}

       {activeTab === 'eval' && (
         <div className="space-y-6">
            {/* Filters */}
            <div className="bg-white p-4 rounded-xl shadow-sm border flex flex-wrap gap-4 items-center">
               <div className="flex items-center gap-2 text-sm text-slate-600 font-bold"><Filter size={16} /> Lọc dữ liệu:</div>
               
               <select className="border rounded-lg px-3 py-1.5 text-sm" value={filterUnit} onChange={e => setFilterUnit(e.target.value)}>
                   <option value="all">Tất cả đơn vị</option>
                   {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
               </select>

               <select className="border rounded-lg px-3 py-1.5 text-sm bg-blue-50 text-blue-700 font-medium" value={filterKey} onChange={e => setFilterKey(e.target.value as KPIKey)}>
                   {Object.entries(KPI_KEYS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
               </select>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
               <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                 <h3 className="font-bold text-lg mb-4 text-green-700">Top 5 Nhân viên Xuất sắc</h3>
                 <div className="h-64">
                   <ResponsiveContainer width="100%" height="100%">
                     <BarChart data={top5} layout="vertical" margin={{left: 40}}>
                       <XAxis type="number" hide />
                       <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 11}} />
                       <Tooltip cursor={{fill: 'transparent'}} />
                       <Bar dataKey="percent" fill="#22c55e" barSize={15} radius={[0, 4, 4, 0]} name="% Hoàn thành" label={{ position: 'right', fill: '#666', fontSize: 10 }} />
                     </BarChart>
                   </ResponsiveContainer>
                 </div>
               </div>

               <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                  <h3 className="font-bold text-lg mb-4 text-red-600 flex items-center gap-2"><AlertOctagon size={20}/> Top 5 Nhân viên Cần cố gắng</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={bottom5} layout="vertical" margin={{left: 40}}>
                        <XAxis type="number" hide />
                        <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 11}} />
                        <Tooltip cursor={{fill: 'transparent'}} />
                        <Bar dataKey="percent" fill="#ef4444" barSize={15} radius={[0, 4, 4, 0]} name="% Hoàn thành" label={{ position: 'right', fill: '#666', fontSize: 10 }} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
               </div>
            </div>

            {/* Detailed Table */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
               <div className="p-4 border-b bg-slate-50"><h3 className="font-bold text-slate-800">Bảng chi tiết số liệu: {KPI_KEYS[filterKey]}</h3></div>
               <div className="overflow-x-auto">
                 <table className="w-full text-sm text-left">
                   <thead className="bg-slate-100 text-slate-700 font-bold">
                     <tr>
                       <th className="p-3">Nhân viên</th>
                       <th className="p-3">Đơn vị</th>
                       <th className="p-3 text-right">Kế hoạch (Target)</th>
                       <th className="p-3 text-right">Thực hiện (Actual)</th>
                       <th className="p-3 text-center">% Hoàn thành</th>
                       <th className="p-3 text-center">Đánh giá</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100">
                     {filteredData.map((item, index) => {
                         const target = item.targets[filterKey].target;
                         const actual = item.targets[filterKey].actual;
                         const percent = target ? (actual / target) * 100 : 0;
                         const unitName = units.find(u => u.id === item.unitId)?.name;
                         return (
                           <tr key={index} className="hover:bg-slate-50">
                             <td className="p-3 font-medium">{item.fullName}</td>
                             <td className="p-3 text-slate-500 text-xs">{unitName}</td>
                             <td className="p-3 text-right font-mono">{target.toLocaleString()}</td>
                             <td className="p-3 text-right font-mono font-bold text-blue-700">{actual.toLocaleString()}</td>
                             <td className="p-3 text-center">
                                 <span className={`px-2 py-1 rounded text-xs text-white ${percent >= 100 ? 'bg-green-500' : percent >= 80 ? 'bg-yellow-500' : 'bg-red-500'}`}>
                                     {percent.toFixed(1)}%
                                 </span>
                             </td>
                             <td className="p-3 text-center text-xs">{percent >= 100 ? 'Đạt' : 'Chưa đạt'}</td>
                           </tr>
                         )
                     })}
                   </tbody>
                 </table>
               </div>
            </div>
         </div>
       )}
    </div>
  );
};

export default KPI;
