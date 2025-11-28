import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Table, Progress, Spin, Button, message, Empty } from 'antd';
import { DownloadOutlined, ReloadOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import axios from 'axios';

const API_BASE_URL = 'http://127.0.0.1:8000/api/v1';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

const ResultsPage = () => {
  const { taskId } = useParams();
  const navigate = useNavigate();
  const [taskData, setTaskData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [polling, setPolling] = useState(true);

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

  // Prepare chart data
  const chartData = Object.entries(statistics || {}).map(([name, value]) => ({
    name,
    value
  }));

  const columns = [
    {
      title: '行号',
      dataIndex: 'row_index',
      key: 'row_index',
      width: 80,
    },
    {
      title: '原始文本',
      dataIndex: 'original_text',
      key: 'original_text',
      ellipsis: true,
      width: 400,
    },
    {
      title: '分类结果',
      dataIndex: 'assigned_code',
      key: 'assigned_code',
      width: 150,
      render: (code) => (
        <span className="px-3 py-1 bg-primary-100 text-primary-700 rounded-full text-sm font-medium">
          {code}
        </span>
      ),
    },
    {
      title: '置信度',
      dataIndex: 'confidence',
      key: 'confidence',
      width: 100,
      render: (conf) => conf ? `${(conf * 100).toFixed(1)}%` : '-',
    },
  ];

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
          <Button 
            type="primary" 
            icon={<DownloadOutlined />} 
            size="large"
            onClick={handleExport}
          >
            导出结果
          </Button>
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
          {/* Statistics Card */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <Card title="分类统计" extra={<span className="text-slate-500">总计: {total} 条</span>}>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </Card>

            <Card title="分类分布">
              <div className="space-y-3">
                {Object.entries(statistics || {}).map(([code, count], index) => (
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
          <Card title="详细结果" className="mb-6">
            <Table
              columns={columns}
              dataSource={results}
              rowKey="row_index"
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
    </div>
  );
};

export default ResultsPage;
