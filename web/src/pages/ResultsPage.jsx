import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Table, Progress, Spin, Button, message, Empty, Tabs, Tag, Input, Space } from 'antd';
import { DownloadOutlined, ArrowLeftOutlined, SearchOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import axios from 'axios';

const API_BASE_URL = 'http://127.0.0.1:8000/api/v1';

const COLORS = [
  '#3b82f6', // Blue
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#14b8a6', // Teal
  '#f97316', // Orange
  '#6366f1', // Indigo
  '#84cc16', // Lime
  '#06b6d4', // Cyan
  '#d946ef', // Fuchsia
  '#f43f5e', // Rose
  '#0ea5e9', // Sky
  '#22c55e', // Green
  '#eab308', // Yellow
  '#a855f7', // Purple
  '#64748b', // Slate
  '#475569', // Slate Dark
  '#94a3b8'  // Slate Light
];

const ResultsPage = () => {
  const { taskId } = useParams();
  const navigate = useNavigate();
  const [taskData, setTaskData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [polling, setPolling] = useState(true);
  const [activeColumn, setActiveColumn] = useState(null);
  
  // Search state
  const [searchText, setSearchText] = useState('');
  const [searchedColumn, setSearchedColumn] = useState('');
  const searchInput = useRef(null);

  const handleSearch = (selectedKeys, confirm, dataIndex) => {
    confirm();
    setSearchText(selectedKeys[0]);
    setSearchedColumn(dataIndex);
  };

  const handleReset = (clearFilters) => {
    clearFilters();
    setSearchText('');
  };

  const getColumnSearchProps = (dataIndex) => ({
    filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters, close }) => (
      <div style={{ padding: 8 }} onKeyDown={(e) => e.stopPropagation()}>
        <Input
          ref={searchInput}
          placeholder={`搜索 ${dataIndex}`}
          value={selectedKeys[0]}
          onChange={(e) => setSelectedKeys(e.target.value ? [e.target.value] : [])}
          onPressEnter={() => handleSearch(selectedKeys, confirm, dataIndex)}
          style={{ marginBottom: 8, display: 'block' }}
        />
        <Space>
          <Button
            type="primary"
            onClick={() => handleSearch(selectedKeys, confirm, dataIndex)}
            icon={<SearchOutlined />}
            size="small"
            style={{ width: 90 }}
          >
            搜索
          </Button>
          <Button
            onClick={() => clearFilters && handleReset(clearFilters)}
            size="small"
            style={{ width: 90 }}
          >
            重置
          </Button>
          
        </Space>
      </div>
    ),
    filterIcon: (filtered) => (
      <SearchOutlined style={{ color: filtered ? '#1677ff' : undefined }} />
    ),
    onFilter: (value, record) =>
      record[dataIndex]
        .toString()
        .toLowerCase()
        .includes(value.toLowerCase()),
    onFilterDropdownOpenChange: (visible) => {
      if (visible) {
        setTimeout(() => searchInput.current?.select(), 100);
      }
    },
    render: (text) => text,
  });

  useEffect(() => {
    fetchTaskStatus();
    const interval = setInterval(() => {
      if (polling) {
        fetchTaskStatus();
      }
    }, 2000); // Poll every 2 seconds

    return () => clearInterval(interval);
  }, [taskId, polling]);

  const fetchTaskStatus = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/analysis/tasks/${taskId}`);
      setTaskData(response.data);
      
      if (response.data.status === 'completed' || response.data.status === 'failed') {
        setPolling(false);
        // Set default active column if not set
        if (!activeColumn && response.data.results && Object.keys(response.data.results).length > 0) {
          setActiveColumn(Object.keys(response.data.results)[0]);
        }
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch task status:', error);
      message.error('获取任务状态失败');
      setLoading(false);
      setPolling(false);
    }
  };

  const handleExport = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/analysis/tasks/${taskId}/export`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `analysis_results_${taskId}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      message.success('导出成功');
    } catch (error) {
      console.error('Export failed:', error);
      message.error('导出失败');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  if (!taskData) {
    return (
      <Card>
        <Empty description="未找到任务数据" />
      </Card>
    );
  }

  const { status, progress, total, results, statistics, error } = taskData;

  // Get data for active column
  const currentColumnData = activeColumn && results ? results[activeColumn] : null;
  const currentStatistics = activeColumn && statistics ? statistics[activeColumn] : {};
  
  // Sort statistics by value descending
  const sortedStatisticsEntries = Object.entries(currentStatistics || {}).sort(([, a], [, b]) => b - a);

  // Prepare chart data
  const chartData = sortedStatisticsEntries.map(([name, value]) => ({
    name,
    value
  }));

  const getChartOption = () => ({
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c} ({d}%)',
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderColor: '#eee',
      borderWidth: 1,
      textStyle: {
        color: '#333'
      }
    },
    legend: {
      type: 'scroll',
      orient: 'vertical',
      right: 10,
      top: 'middle',
      bottom: 20,
      textStyle: {
        color: '#64748b'
      },
      pageIconColor: '#64748b',
      pageTextStyle: {
        color: '#64748b'
      }
    },
    color: COLORS,
    series: [
      {
        name: '分类统计',
        type: 'pie',
        radius: ['50%', '75%'],
        center: ['40%', '50%'],
        avoidLabelOverlap: true,
        itemStyle: {
          borderRadius: 8,
          borderColor: '#fff',
          borderWidth: 2
        },
        label: {
          show: false,
          position: 'center'
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 18,
            fontWeight: 'bold',
            formatter: '{b}\n{d}%',
            color: '#334155'
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
        data: chartData
      }
    ]
  });

  // Generate filters from statistics
  const codeFilters = sortedStatisticsEntries.map(([code]) => ({
    text: code,
    value: code,
  }));

  const columns = [
    {
      title: '行号',
      dataIndex: 'row_id', // Changed from row_index to row_id as per backend
      key: 'row_id',
      width: 120,
      render: (text) => <span className="text-gray-500 text-xs">{text}</span>
    },
    {
      title: '原始文本',
      dataIndex: 'original_text',
      key: 'original_text',
      ellipsis: true,
      width: 400,
      ...getColumnSearchProps('original_text'),
    },
    {
      title: '分类结果',
      dataIndex: 'assigned_code',
      key: 'assigned_code',
      width: 150,
      filters: codeFilters,
      filterMultiple: true,
      onFilter: (value, record) => record.assigned_code === value,
      render: (code) => (
        <Tag color="blue">
          {code}
        </Tag>
      ),
    },
    {
      title: '置信度',
      dataIndex: 'confidence',
      key: 'confidence',
      width: 100,
      render: (conf) => conf ? `${(conf * 100).toFixed(1)}%` : '-',
    },
    {
      title: '分类方法',
      dataIndex: 'method',
      key: 'method',
      width: 120,
      render: (method) => {
        const map = {
          'exact_mapping': '精确映射',
          'partial_mapping': '部分映射',
          'fixed_code_match': '固定编码',
          'keyword_match': '关键词',
          'ai_classification': 'AI分类',
          'ai_batch_classification': 'AI批量',
          'default_fallback': '默认归类'
        };
        return <span className="text-xs text-gray-500">{map[method] || method}</span>;
      }
    }
  ];

  // Generate tabs items
  const tabItems = results ? Object.keys(results).map(colName => ({
    key: colName,
    label: colName,
  })) : [];

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <Button 
            icon={<ArrowLeftOutlined />} 
            onClick={() => navigate('/coding')}
            className="mb-2"
          >
            返回
          </Button>
          <h1 className="text-2xl font-bold text-slate-800">分析结果</h1>
          <p className="text-slate-500 mt-1">任务 ID: {taskId}</p>
        </div>
        {status === 'completed' && (
          <Space>
            <Button 
              icon={<DownloadOutlined />} 
              size="large"
              onClick={handleExport}
            >
              导出结果
            </Button>
            <Button 
              type="primary" 
              icon={<DownloadOutlined />} 
              size="large"
              onClick={handleExport}
            >
              导出全部
            </Button>
          </Space>
        )}
      </div>

      {/* Status Card */}
      <Card className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-700 mb-2">任务状态</h3>
            {status === 'pending' && <span className="text-blue-600">等待处理...</span>}
            {status === 'processing' && (
              <div className="flex items-center space-x-3">
                <Spin />
                <span className="text-blue-600">处理中...</span>
              </div>
            )}
            {status === 'completed' && <span className="text-green-600 font-medium">✓ 已完成</span>}
            {status === 'failed' && <span className="text-red-600 font-medium">✗ 失败: {error}</span>}
          </div>
          {status === 'processing' && (
            <div className="w-64">
              <Progress 
                percent={progress} 
                status="active"
                format={(percent) => `${percent}% (${Math.floor(total * percent / 100)}/${total})`}
              />
            </div>
          )}
        </div>
      </Card>

      {status === 'completed' && (
        <>
          <Tabs 
            activeKey={activeColumn} 
            onChange={setActiveColumn}
            type="card"
            className="mb-4"
            items={tabItems}
          />

          {activeColumn && (
            <>
              {/* Statistics Card */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <Card title={`分类统计 - ${activeColumn}`} extra={<span className="text-slate-500">总计: {total} 条</span>}>
                  <ReactECharts 
                    option={getChartOption()} 
                    style={{ height: 300, width: '100%' }} 
                    notMerge={true}
                    lazyUpdate={true}
                  />
                </Card>

                <Card title={`分类分布 - ${activeColumn}`}>
                  <div className="space-y-3 max-h-[300px] overflow-y-auto">
                    {sortedStatisticsEntries.map(([code, count], index) => (
                      <div key={code} className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div 
                            className="w-4 h-4 rounded"
                            style={{ backgroundColor: COLORS[index % COLORS.length] }}
                          />
                          <span className="font-medium text-slate-700">{code}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-lg font-semibold text-slate-800">{count}</span>
                          <span className="text-sm text-slate-500 ml-2">
                            ({((count / total) * 100).toFixed(1)}%)
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>

              {/* Results Table */}
              <Card title={`详细结果 - ${activeColumn}`} className="mb-6">
                <Table
                  columns={columns}
                  dataSource={currentColumnData?.results || []}
                  rowKey="row_id"
                  pagination={{
                    pageSize: 20,
                    showSizeChanger: true,
                    showTotal: (total) => `共 ${total} 条记录`,
                  }}
                  scroll={{ x: true }}
                />
              </Card>
            </>
          )}
        </>
      )}
    </div>
  );
};

export default ResultsPage;
