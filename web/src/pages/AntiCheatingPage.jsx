import React, { useState, useEffect } from 'react';
import { 
  Table, Button, Modal, Form, Input, Upload, 
  message, Space, Tag, Progress, InputNumber 
} from 'antd';
import { 
  UploadOutlined, FileExcelOutlined, 
  DeleteOutlined, EyeOutlined, ReloadOutlined 
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

const AntiCheatingPage = () => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form] = Form.useForm();
  const navigate = useNavigate();

  useEffect(() => {
    fetchTasks();
    // Poll for updates every 5 seconds
    const interval = setInterval(fetchTasks, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchTasks = async () => {
    try {
      const response = await api.get('/anti-cheating/tasks');
      setTasks(response.data);
    } catch (error) {
      console.error('Failed to fetch tasks', error);
    }
  };

  const handleUpload = async () => {
    try {
      const values = await form.validateFields();
      const formData = new FormData();
      formData.append('file', values.file[0].originFileObj);
      formData.append('name', values.name);
      formData.append('threshold', values.threshold);

      setUploading(true);
      await api.post('/anti-cheating/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      message.success('任务创建成功，正在后台分析');
      setModalVisible(false);
      form.resetFields();
      fetchTasks();
    } catch (error) {
      message.error('上传失败');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/anti-cheating/tasks/${id}`);
      message.success('删除成功');
      fetchTasks();
    } catch (error) {
      message.error('删除失败');
    }
  };

  const columns = [
    {
      title: '任务名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        const colors = {
          pending: 'default',
          processing: 'processing',
          completed: 'success',
          failed: 'error'
        };
        const labels = {
          pending: '等待中',
          processing: '分析中',
          completed: '已完成',
          failed: '失败'
        };
        return <Tag color={colors[status]}>{labels[status]}</Tag>;
      }
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (text) => new Date(text).toLocaleString()
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button 
            type="link" 
            icon={<EyeOutlined />} 
            disabled={record.status !== 'completed'}
            onClick={() => navigate(`/anti-cheating/results/${record.id}`)}
          >
            查看结果
          </Button>
          <Button 
            type="text" 
            danger 
            icon={<DeleteOutlined />} 
            onClick={() => handleDelete(record.id)}
          >
            删除
          </Button>
        </Space>
      )
    }
  ];

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">防作弊检测</h1>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetchTasks}>刷新</Button>
          <Button type="primary" icon={<UploadOutlined />} onClick={() => setModalVisible(true)}>
            新建检测任务
          </Button>
        </Space>
      </div>

      <Table 
        columns={columns} 
        dataSource={tasks} 
        rowKey="id" 
        loading={loading}
      />

      <Modal
        title="新建防作弊检测任务"
        open={modalVisible}
        onOk={handleUpload}
        onCancel={() => setModalVisible(false)}
        confirmLoading={uploading}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="任务名称"
            rules={[{ required: true, message: '请输入任务名称' }]}
          >
            <Input placeholder="例如：期末考试问卷检测" />
          </Form.Item>

          <Form.Item
            name="threshold"
            label="相似度阈值 (0.0 - 1.0)"
            initialValue={0.8}
            help="超过此相似度的回答将被标记为疑似作弊"
          >
            <InputNumber min={0.1} max={1.0} step={0.1} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            name="file"
            label="上传数据文件 (Excel/CSV)"
            rules={[{ required: true, message: '请上传文件' }]}
            extra="文件需包含列：user_id, question_id, answer"
          >
            <Upload 
              beforeUpload={() => false} 
              maxCount={1}
              accept=".xlsx,.xls,.csv"
            >
              <Button icon={<FileExcelOutlined />}>选择文件</Button>
            </Upload>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default AntiCheatingPage;
