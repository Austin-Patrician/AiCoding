import React, { useState, useEffect } from 'react';
import { Table, Tag, Button, Card, message, Space, Tooltip, Popconfirm, Modal } from 'antd';
import { 
  PlayCircleOutlined, 
  EyeOutlined, 
  ClockCircleOutlined, 
  CheckCircleOutlined, 
  CloseCircleOutlined,
  FileTextOutlined,
  ReloadOutlined,
  DeleteOutlined,
  ExclamationCircleOutlined,
  PlusOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import dayjs from 'dayjs';
import NewAnalysisModal from '../components/NewAnalysisModal';

const TaskListPage = () => {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const response = await api.get('/analysis/tasks');
      setTasks(response.data);
    } catch (error) {
      message.error('获取任务列表失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartTask = async (taskId) => {
    try {
      await api.post(`/analysis/tasks/${taskId}/start`);
      message.success('任务已开始执行');
      fetchTasks(); // Refresh list
    } catch (error) {
      message.error('启动任务失败: ' + (error.response?.data?.detail || error.message));
    }
  };

  const handleRerunTask = async (taskId) => {
    try {
      await api.post(`/analysis/tasks/${taskId}/rerun`);
      message.success('任务已重新启动');
      fetchTasks();
    } catch (error) {
      message.error('重新运行失败: ' + (error.response?.data?.detail || error.message));
    }
  };

  const handleDeleteTask = async (taskId) => {
    try {
      await api.delete(`/analysis/tasks/${taskId}`);
      message.success('任务已删除');
      fetchTasks();
    } catch (error) {
      message.error('删除失败: ' + (error.response?.data?.detail || error.message));
    }
  };

  const getStatusTag = (status) => {
    const config = {
      draft: { color: 'default', icon: <FileTextOutlined />, text: '草稿' },
      pending: { color: 'processing', icon: <ClockCircleOutlined />, text: '等待中' },
      processing: { color: 'blue', icon: <ClockCircleOutlined spin />, text: '进行中' },
      completed: { color: 'success', icon: <CheckCircleOutlined />, text: '已完成' },
      failed: { color: 'error', icon: <CloseCircleOutlined />, text: '失败' }
    };
    const item = config[status] || { color: 'default', text: status };
    return (
      <Tag icon={item.icon} color={item.color}>
        {item.text}
      </Tag>
    );
  };

  const columns = [
    {
      title: '任务ID',
      dataIndex: 'task_id',
      key: 'task_id',
      render: (text) => <span className="text-gray-500 text-xs">{text.substring(0, 8)}...</span>
    },
    {
      title: '项目',
      dataIndex: 'project_id',
      key: 'project_id',
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (text) => dayjs(text).format('YYYY-MM-DD HH:mm:ss')
    },
    {
      title: '配置详情',
      key: 'config',
      render: (_, record) => {
        const configs = record.column_configs || {};
        return (
          <div className="space-y-1">
            {Object.entries(configs).map(([col, config]) => (
              <div key={col} className="text-xs">
                <span className="font-medium">{col}:</span>{' '}
                <Tag color={config.mode === 'fixed' ? 'blue' : 'green'}>
                  {config.mode === 'fixed' ? '固定' : '开放'}
                </Tag>
                <span className="text-gray-500">
                  {config.classification_mode === 'ai_only' ? '纯AI' : '混合模式'}
                </span>
              </div>
            ))}
          </div>
        );
      }
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => getStatusTag(status)
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      render: (_, record) => (
        <Space size="small">
          {record.status === 'draft' && (
            <Tooltip title="开始分析">
              <Button 
                type="primary" 
                size="small"
                icon={<PlayCircleOutlined />} 
                onClick={() => handleStartTask(record.task_id)}
              >
                开始
              </Button>
            </Tooltip>
          )}
          {(record.status === 'completed' || record.status === 'processing' || record.status === 'pending') && (
            <Tooltip title="查看结果">
              <Button 
                type="default" 
                size="small"
                icon={<EyeOutlined />} 
                onClick={() => navigate(`/coding/analysis/results/${record.task_id}`)}
              >
                查看
              </Button>
            </Tooltip>
          )}
          {(record.status === 'completed' || record.status === 'failed') && (
            <Tooltip title="重新运行">
              <Popconfirm
                title="确认重新运行？"
                description="将清除现有结果并重新执行分析"
                onConfirm={() => handleRerunTask(record.task_id)}
                okText="确认"
                cancelText="取消"
                icon={<ExclamationCircleOutlined style={{ color: '#faad14' }} />}
              >
                <Button 
                  type="default" 
                  size="small"
                  icon={<ReloadOutlined />} 
                />
              </Popconfirm>
            </Tooltip>
          )}
          {record.status !== 'processing' && (
            <Tooltip title="删除任务">
              <Popconfirm
                title="确认删除？"
                description="此操作不可恢复，任务及所有结果将被永久删除"
                onConfirm={() => handleDeleteTask(record.task_id)}
                okText="删除"
                cancelText="取消"
                okButtonProps={{ danger: true }}
                icon={<ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />}
              >
                <Button 
                  type="text" 
                  danger
                  size="small"
                  icon={<DeleteOutlined />} 
                />
              </Popconfirm>
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">任务列表</h1>
          <p className="text-gray-500 mt-1">查看和管理所有分析任务</p>
        </div>
        <Space>
          <Button 
            type="primary" 
            icon={<PlusOutlined />} 
            onClick={() => setIsModalOpen(true)}
          >
            新建分析
          </Button>
          <Button onClick={fetchTasks}>刷新</Button>
        </Space>
      </div>

      <Card className="shadow-sm">
        <Table 
          columns={columns} 
          dataSource={tasks} 
          rowKey="task_id" 
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <NewAnalysisModal 
        open={isModalOpen} 
        onCancel={() => setIsModalOpen(false)}
        onSuccess={() => {
          setIsModalOpen(false);
          fetchTasks();
        }}
      />
    </div>
  );
};

export default TaskListPage;
