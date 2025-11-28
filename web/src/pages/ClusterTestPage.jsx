import React, { useState, useEffect } from 'react';
import { 
  Card, Button, Tag, Table, message, Popconfirm, Tooltip,
  Empty, Space, Badge
} from 'antd';
import { 
  RobotOutlined, ClusterOutlined, 
  DeleteOutlined, ReloadOutlined,
  PlusOutlined, FileExcelOutlined,
  EyeOutlined, ExperimentOutlined,
  CopyOutlined, RedoOutlined
} from '@ant-design/icons';
import api from '../services/api';
import ClusterTestModal from '../components/ClusterTestModal';
import ClusterResultModal from '../components/ClusterResultModal';

const ClusterTestPage = () => {
  // History state
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Modal state
  const [testModalVisible, setTestModalVisible] = useState(false);
  const [resultModalVisible, setResultModalVisible] = useState(false);
  const [currentResult, setCurrentResult] = useState(null);
  const [currentResults, setCurrentResults] = useState([]); // 多列结果
  const [resultLoading, setResultLoading] = useState(false);
  
  // 预设配置（用于复制或重跑）
  const [presetConfig, setPresetConfig] = useState(null);
  const [rerunningId, setRerunningId] = useState(null);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const response = await api.get('/workshop/cluster-test/history');
      setHistory(response.data);
    } catch (error) {
      console.error('Failed to fetch history:', error);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleDeleteHistory = async (id, e) => {
    e?.stopPropagation();
    try {
      await api.delete(`/workshop/cluster-test/${id}`);
      message.success('删除成功');
      fetchHistory();
    } catch (error) {
      message.error('删除失败');
    }
  };

  const viewResult = async (record) => {
    setResultLoading(true);
    setResultModalVisible(true);
    setCurrentResults([]); // 清空多列结果
    try {
      const response = await api.get(`/workshop/cluster-test/${record.id}`);
      setCurrentResult(response.data);
    } catch (error) {
      message.error('加载失败');
      setResultModalVisible(false);
    } finally {
      setResultLoading(false);
    }
  };

  const handleTestSuccess = (results) => {
    fetchHistory();
    setPresetConfig(null);
    // 展示所有结果
    if (results && results.length > 0) {
      setCurrentResults(results);
      setCurrentResult(null); // 清空单个结果
      setResultModalVisible(true);
    }
  };

  // 复制配置新建测试
  const handleCopyConfig = (record, e) => {
    e?.stopPropagation();
    setPresetConfig({
      file_id: record.file_id,
      file_name: record.file_name,
      column_name: record.column_name,
      engine: record.engine,
      sample_size: record.sample_size,
      max_codes: record.max_codes
    });
    setTestModalVisible(true);
    message.info('已加载配置，可修改后执行');
  };

  // 重新运行
  const handleRerun = async (record, e) => {
    e?.stopPropagation();
    setRerunningId(record.id);
    try {
      const response = await api.post('/workshop/cluster-test', {
        file_id: record.file_id,
        file_name: record.file_name,
        column_name: record.column_name,
        engine: record.engine,
        sample_size: record.sample_size,
        max_codes: record.max_codes
      });
      message.success('重新分析完成');
      fetchHistory();
      setCurrentResult(response.data);
      setCurrentResults([]); // 单个结果
      setResultModalVisible(true);
    } catch (error) {
      message.error(`分析失败: ${error.response?.data?.detail || error.message}`);
    } finally {
      setRerunningId(null);
    }
  };

  // Table Columns
  const tableColumns = [
    {
      title: '文件',
      dataIndex: 'file_name',
      key: 'file_name',
      ellipsis: true,
      render: (text, record) => (
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-green-50 flex items-center justify-center">
            <FileExcelOutlined className="text-green-500 text-sm" />
          </div>
          <span className="text-gray-700">{text || record.file_id?.slice(0, 8) + '...'}</span>
        </div>
      )
    },
    {
      title: '分析列',
      dataIndex: 'column_name',
      key: 'column_name',
      width: 150,
      ellipsis: true,
      render: (text) => (
        <span className="inline-flex items-center px-2.5 py-1 bg-gray-50 border border-gray-100 rounded-full text-xs text-gray-600">
          {text}
        </span>
      )
    },
    {
      title: '引擎',
      dataIndex: 'engine',
      key: 'engine',
      width: 120,
      render: (text) => (
        <span className={`
          inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium
          ${text === 'llm' ? 'bg-blue-50 text-blue-600 border border-blue-100' : 'bg-violet-50 text-violet-600 border border-violet-100'}
        `}>
          {text === 'llm' ? <RobotOutlined /> : <ClusterOutlined />}
          {text === 'llm' ? 'LLM' : 'BERTopic'}
        </span>
      )
    },
    {
      title: '数据量',
      dataIndex: 'sample_size',
      key: 'sample_size',
      width: 90,
      align: 'center',
      render: (val) => (
        <span className="text-xs text-gray-500">
          {val === -1 ? '全量' : `${val} 条`}
        </span>
      )
    },
    {
      title: '主题数',
      dataIndex: 'result_count',
      key: 'result_count',
      width: 80,
      align: 'center',
      render: (count) => (
        <span className="inline-flex items-center px-2 py-0.5 bg-cyan-50 text-cyan-600 rounded-full text-xs font-medium border border-cyan-100">
          {count}
        </span>
      )
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 170,
      render: (text) => (
        <span className="text-gray-400 text-sm">
          {new Date(text).toLocaleString()}
        </span>
      )
    },
    {
      title: '操作',
      key: 'action',
      width: 160,
      render: (_, record) => (
        <Space size={4}>
          <Tooltip title="查看结果">
            <Button 
              type="text" 
              size="small"
              icon={<EyeOutlined className="text-gray-400" />}
              onClick={(e) => {
                e.stopPropagation();
                viewResult(record);
              }}
              className="!w-8 !h-8 hover:!bg-blue-50 hover:!text-blue-500"
            />
          </Tooltip>
          <Tooltip title="重新运行">
            <Button 
              type="text" 
              size="small"
              icon={<RedoOutlined className={rerunningId === record.id ? 'animate-spin' : 'text-gray-400'} />}
              onClick={(e) => handleRerun(record, e)}
              loading={rerunningId === record.id}
              className="!w-8 !h-8 hover:!bg-green-50 hover:!text-green-500"
            />
          </Tooltip>
          <Tooltip title="复制配置">
            <Button 
              type="text" 
              size="small"
              icon={<CopyOutlined className="text-gray-400" />}
              onClick={(e) => handleCopyConfig(record, e)}
              className="!w-8 !h-8 hover:!bg-violet-50 hover:!text-violet-500"
            />
          </Tooltip>
          <Popconfirm
            title="确定删除此记录？"
            onConfirm={(e) => handleDeleteHistory(record.id, e)}
            okText="确定"
            cancelText="取消"
          >
            <Tooltip title="删除">
              <Button 
                type="text" 
                size="small"
                icon={<DeleteOutlined className="text-gray-400" />} 
                onClick={(e) => e.stopPropagation()}
                className="!w-8 !h-8 hover:!bg-red-50 hover:!text-red-500"
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div className="h-full">
      {/* Header */}
      <div className="flex justify-between items-center mb-5">
        <div>
          <h2 className="text-xl font-semibold text-gray-800 m-0 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center shadow-sm">
              <ExperimentOutlined className="text-white text-base" />
            </div>
            聚类测试
          </h2>
          <p className="text-sm text-gray-400 m-0 mt-1.5 ml-12">
            对比 LLM 与 BERTopic 主题提取效果
          </p>
        </div>
        <Space size={8}>
          <Button 
            icon={<ReloadOutlined />}
            onClick={fetchHistory}
            loading={historyLoading}
            className="!rounded-lg !border-gray-200 !text-gray-600 hover:!border-gray-300"
          >
            刷新
          </Button>
          <Button 
            type="primary"
            icon={<PlusOutlined />} 
            onClick={() => setTestModalVisible(true)}
            className="!rounded-lg !bg-blue-500 hover:!bg-blue-600 !border-blue-500 !shadow-sm"
          >
            新建测试
          </Button>
        </Space>
      </div>

      {/* History Table */}
      <Card className="!rounded-xl !border-gray-100 !shadow-sm" styles={{ body: { padding: 0 } }}>
        <Table
          dataSource={history}
          columns={tableColumns}
          rowKey="id"
          loading={historyLoading}
          pagination={{ 
            pageSize: 10,
            showTotal: (total) => `共 ${total} 条记录`,
            className: '!px-4 !py-3'
          }}
          locale={{ 
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={<span className="text-gray-400">暂无测试记录</span>}
                className="!py-12"
              >
                <Button 
                  type="primary" 
                  icon={<PlusOutlined />} 
                  onClick={() => setTestModalVisible(true)}
                  className="!rounded-lg !bg-blue-500 hover:!bg-blue-600"
                >
                  创建第一个测试
                </Button>
              </Empty>
            )
          }}
          onRow={(record) => ({
            onClick: () => viewResult(record),
            className: 'cursor-pointer hover:!bg-gray-50/80 transition-colors'
          })}
        />
      </Card>

      {/* New Test Modal */}
      <ClusterTestModal
        visible={testModalVisible}
        onCancel={() => {
          setTestModalVisible(false);
          setPresetConfig(null);
        }}
        onSuccess={handleTestSuccess}
        presetConfig={presetConfig}
      />

      {/* Result Modal */}
      <ClusterResultModal
        visible={resultModalVisible}
        onCancel={() => {
          setResultModalVisible(false);
          setCurrentResult(null);
          setCurrentResults([]);
        }}
        result={currentResult}
        results={currentResults}
        loading={resultLoading}
      />
    </div>
  );
};

export default ClusterTestPage;
