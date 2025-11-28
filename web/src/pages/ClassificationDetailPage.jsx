import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Spin, Button, message, Empty, Select, Input, Pagination } from 'antd';
import { 
  DownloadOutlined, 
  PieChartOutlined, 
  TableOutlined,
  SearchOutlined,
  RobotOutlined,
  ClusterOutlined
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import * as XLSX from 'xlsx';
import api from '../services/api';

const ClassificationDetailPage = () => {
  const [searchParams] = useSearchParams();
  const cacheId = searchParams.get('id');
  
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  
  // 表格筛选状态
  const [selectedTheme, setSelectedTheme] = useState('all');
  const [searchText, setSearchText] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  useEffect(() => {
    if (cacheId) {
      fetchData();
    } else {
      setError('缺少数据 ID 参数');
      setLoading(false);
    }
  }, [cacheId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/workshop/classified-data/cache/${cacheId}`);
      setData(res.data);
    } catch (err) {
      console.error('获取数据失败:', err);
      setError('数据已过期或不存在，请重新运行分析');
    } finally {
      setLoading(false);
    }
  };

  // 获取饼图配置
  const getPieChartOption = () => {
    if (!data?.classified_data) return {};

    const chartData = Object.entries(data.classified_data).map(([name, texts]) => ({
      name,
      value: texts.length
    }));

    // 专业蓝色系配色
    const colors = [
      '#3B82F6', // blue-500
      '#60A5FA', // blue-400
      '#93C5FD', // blue-300
      '#BFDBFE', // blue-200
      '#818CF8', // violet-400
      '#A5B4FC', // indigo-300
      '#6366F1', // indigo-500
      '#8B5CF6', // violet-500
      '#C4B5FD', // violet-300
      '#34D399', // emerald-400
      '#10B981', // emerald-500
      '#6EE7B7', // emerald-300
    ];

    return {
      tooltip: {
        trigger: 'item',
        formatter: '{b}: {c} 条 ({d}%)',
        backgroundColor: 'rgba(255, 255, 255, 0.96)',
        borderColor: '#e5e7eb',
        borderWidth: 1,
        textStyle: { color: '#374151', fontSize: 13 },
        padding: [12, 16],
        extraCssText: 'box-shadow: 0 4px 12px rgba(0,0,0,0.1); border-radius: 8px;'
      },
      legend: {
        type: 'scroll',
        orient: 'vertical',
        right: '5%',
        top: 'center',
        itemWidth: 12,
        itemHeight: 12,
        itemGap: 12,
        textStyle: {
          fontSize: 13,
          color: '#4B5563'
        },
        formatter: (name) => {
          const item = chartData.find(d => d.name === name);
          return item ? `${name}  (${item.value})` : name;
        }
      },
      series: [
        {
          name: '分类占比',
          type: 'pie',
          radius: ['45%', '70%'],
          center: ['35%', '50%'],
          avoidLabelOverlap: true,
          itemStyle: {
            borderRadius: 6,
            borderColor: '#fff',
            borderWidth: 2
          },
          label: {
            show: false
          },
          emphasis: {
            label: {
              show: true,
              fontSize: 14,
              fontWeight: 'bold',
              color: '#374151'
            },
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: 'rgba(0, 0, 0, 0.2)'
            }
          },
          labelLine: {
            show: false
          },
          data: chartData,
          color: colors
        }
      ]
    };
  };

  // 获取过滤后的表格数据
  const getFilteredData = () => {
    if (!data?.classified_data) return [];
    
    let rows = [];
    
    // 按主题过滤
    const themes = selectedTheme === 'all' 
      ? Object.keys(data.classified_data) 
      : [selectedTheme];
    
    themes.forEach(theme => {
      const texts = data.classified_data[theme] || [];
      texts.forEach((text, idx) => {
        rows.push({
          key: `${theme}-${idx}`,
          theme,
          index: idx + 1,
          text
        });
      });
    });
    
    // 按搜索文本过滤
    if (searchText.trim()) {
      const keyword = searchText.toLowerCase();
      rows = rows.filter(row => 
        row.text.toLowerCase().includes(keyword) ||
        row.theme.toLowerCase().includes(keyword)
      );
    }
    
    return rows;
  };

  // 导出 Excel
  const handleExport = () => {
    if (!data?.classified_data) {
      message.warning('没有可导出的数据');
      return;
    }

    const themes = Object.keys(data.classified_data);
    const maxLength = Math.max(...themes.map(t => data.classified_data[t].length));

    const rows = [];
    for (let i = 0; i < maxLength; i++) {
      const row = {};
      themes.forEach(theme => {
        row[theme] = data.classified_data[theme][i] || '';
      });
      rows.push(row);
    }

    const ws = XLSX.utils.json_to_sheet(rows, { header: themes });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '分类结果');
    
    const fileName = `分类详情_${new Date().toLocaleDateString().replace(/\//g, '-')}.xlsx`;
    XLSX.writeFile(wb, fileName);
    message.success('导出成功');
  };

  // 计算总数
  const getTotalCount = () => {
    if (!data?.classified_data) return 0;
    return Object.values(data.classified_data).reduce((sum, texts) => sum + texts.length, 0);
  };

  const filteredData = getFilteredData();
  const paginatedData = filteredData.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Spin size="large" />
          <p className="mt-4 text-gray-500">加载数据中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Empty 
          description={error}
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      </div>
    );
  }

  const meta = data?.meta || {};

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`
                w-10 h-10 rounded-xl flex items-center justify-center shadow-sm
                ${meta.engine === 'bertopic' 
                  ? 'bg-gradient-to-br from-violet-500 to-violet-600' 
                  : 'bg-gradient-to-br from-blue-500 to-blue-600'
                }
              `}>
                {meta.engine === 'bertopic' 
                  ? <ClusterOutlined className="text-white text-lg" /> 
                  : <RobotOutlined className="text-white text-lg" />
                }
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-800">分类详情</h1>
                <div className="flex items-center gap-3 text-sm text-gray-500 mt-0.5">
                  {meta.column_name && <span>{meta.column_name}</span>}
                  {meta.file_name && (
                    <>
                      <span className="text-gray-300">|</span>
                      <span>{meta.file_name}</span>
                    </>
                  )}
                  <span className="text-gray-300">|</span>
                  <span>{getTotalCount()} 条数据</span>
                </div>
              </div>
            </div>
            
            <Button 
              type="primary" 
              icon={<DownloadOutlined />}
              onClick={handleExport}
              className="!rounded-lg !bg-blue-500 hover:!bg-blue-600 !h-9"
            >
              导出 Excel
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Pie Chart Card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
            <PieChartOutlined className="text-blue-500" />
            <span className="font-medium text-gray-700">分类占比分布</span>
            <span className="ml-2 px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full text-xs">
              {Object.keys(data?.classified_data || {}).length} 个分类
            </span>
          </div>
          <div className="p-4">
            <ReactECharts 
              option={getPieChartOption()} 
              style={{ height: 360 }}
              opts={{ renderer: 'svg' }}
            />
          </div>
        </div>

        {/* Table Card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {/* Table Header */}
          <div className="px-6 py-4 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TableOutlined className="text-blue-500" />
                <span className="font-medium text-gray-700">数据明细</span>
              </div>
              <div className="flex items-center gap-3">
                <Select
                  value={selectedTheme}
                  onChange={(v) => { setSelectedTheme(v); setCurrentPage(1); }}
                  style={{ width: 180 }}
                  className="!rounded-lg"
                  options={[
                    { value: 'all', label: '全部分类' },
                    ...Object.keys(data?.classified_data || {}).map(t => ({
                      value: t,
                      label: `${t} (${data.classified_data[t].length})`
                    }))
                  ]}
                />
                <Input
                  placeholder="搜索内容..."
                  prefix={<SearchOutlined className="text-gray-400" />}
                  value={searchText}
                  onChange={(e) => { setSearchText(e.target.value); setCurrentPage(1); }}
                  allowClear
                  style={{ width: 200 }}
                  className="!rounded-lg"
                />
              </div>
            </div>
          </div>

          {/* Excel-like Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-16">
                    序号
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-40">
                    分类
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    原文
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {paginatedData.map((row, idx) => (
                  <tr 
                    key={row.key} 
                    className={`hover:bg-blue-50/50 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}
                  >
                    <td className="px-4 py-3 text-sm text-gray-400 font-mono">
                      {(currentPage - 1) * pageSize + idx + 1}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`
                        inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium
                        ${meta.engine === 'bertopic' ? 'bg-violet-100 text-violet-700' : 'bg-blue-100 text-blue-700'}
                      `}>
                        {row.theme}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 max-w-2xl">
                      <div className="line-clamp-2">{row.text}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50/50">
            <span className="text-sm text-gray-500">
              共 {filteredData.length} 条记录
              {searchText && ` (筛选自 ${getTotalCount()} 条)`}
            </span>
            <Pagination
              current={currentPage}
              pageSize={pageSize}
              total={filteredData.length}
              onChange={setCurrentPage}
              showSizeChanger={false}
              showQuickJumper
              size="small"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClassificationDetailPage;
