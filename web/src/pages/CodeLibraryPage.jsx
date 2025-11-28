import React, { useState, useEffect } from 'react';
import { Card, Button, Empty, Modal, Form, Input, Tag, message, Spin } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, CopyOutlined } from '@ant-design/icons';
import api from '../services/api';

const CodeLibraryPage = () => {
  const [codeLibraries, setCodeLibraries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingLibrary, setEditingLibrary] = useState(null);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchCodeLibraries();
  }, []);

  const fetchCodeLibraries = async () => {
    try {
      const response = await api.get('/code-libraries/');
      setCodeLibraries(response.data);
    } catch (error) {
      console.error('Failed to fetch code libraries:', error);
      message.error('获取编码库列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleNewLibrary = () => {
    setEditingLibrary(null);
    form.resetFields();
    setIsModalVisible(true);
  };

  const handleEditLibrary = (library) => {
    setEditingLibrary(library);
    form.setFieldsValue({
      name: library.name,
      description: library.description,
      codes: library.codes.join('\n')
    });
    setIsModalVisible(true);
  };

  const handleDuplicateLibrary = async (library) => {
    try {
      const newLibrary = {
        name: `${library.name} (副本)`,
        codes: library.codes,
        description: library.description
      };
      await api.post('/code-libraries/', newLibrary);
      message.success('编码库已复制');
      fetchCodeLibraries();
    } catch (error) {
      console.error('Failed to duplicate library:', error);
      message.error('复制编码库失败');
    }
  };

  const handleDeleteLibrary = (id) => {
    Modal.confirm({
      title: '确认删除',
      content: '删除后无法恢复，确定要删除这个编码库吗？',
      okText: '确定',
      cancelText: '取消',
      onOk: async () => {
        try {
          await api.delete(`/code-libraries/${id}`);
          message.success('编码库已删除');
          fetchCodeLibraries();
        } catch (error) {
          console.error('Failed to delete library:', error);
          message.error('删除编码库失败');
        }
      }
    });
  };

  const handleSaveLibrary = async () => {
    try {
      const values = await form.validateFields();
      const codes = values.codes.split('\n').map(c => c.trim()).filter(c => c);
      
      if (codes.length === 0) {
        message.error('至少需要添加一个编码');
        return;
      }

      const libraryData = {
        name: values.name,
        description: values.description,
        codes
      };

      if (editingLibrary) {
        await api.put(`/code-libraries/${editingLibrary.id}`, libraryData);
        message.success('编码库已更新');
      } else {
        await api.post('/code-libraries/', libraryData);
        message.success('编码库已创建');
      }
      
      setIsModalVisible(false);
      form.resetFields();
      fetchCodeLibraries();
    } catch (error) {
      console.error('Validation failed:', error);
      // If it's not a validation error (which doesn't have response), show API error
      if (error.response) {
        message.error('保存失败: ' + (error.response.data.detail || '未知错误'));
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">编码库管理</h1>
          <p className="text-gray-500 mt-1">创建和管理可复用的编码体系，用于固定编码分析</p>
        </div>
        <Button 
          type="primary" 
          icon={<PlusOutlined />} 
          size="large"
          onClick={handleNewLibrary}
        >
          新建编码库
        </Button>
      </div>

      {codeLibraries.length === 0 ? (
        <Card className="bg-white">
          <Empty 
            description="暂无编码库，点击右上角按钮创建第一个编码库"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {codeLibraries.map((library) => (
            <Card
              key={library.id}
              hoverable
              className="border-blue-200"
              actions={[
                <Button
                  type="text"
                  icon={<EditOutlined />}
                  onClick={() => handleEditLibrary(library)}
                >
                  编辑
                </Button>,
                <Button
                  type="text"
                  icon={<CopyOutlined />}
                  onClick={() => handleDuplicateLibrary(library)}
                >
                  复制
                </Button>,
                <Button
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => handleDeleteLibrary(library.id)}
                >
                  删除
                </Button>
              ]}
            >
              <div className="mb-3">
                <h3 className="text-lg font-semibold text-gray-800">{library.name}</h3>
                <p className="text-sm text-gray-500 mt-1">{library.description}</p>
              </div>
              
              <div className="mb-2">
                <div className="text-xs text-gray-500 mb-2">
                  共 {library.codes.length} 个编码
                </div>
                <div className="flex flex-wrap gap-1">
                  {library.codes.slice(0, 8).map((code, index) => (
                    <Tag key={index} color="blue">
                      {code}
                    </Tag>
                  ))}
                  {library.codes.length > 8 && (
                    <Tag>+{library.codes.length - 8}</Tag>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Library Modal */}
      <Modal
        title={editingLibrary ? "编辑编码库" : "新建编码库"}
        open={isModalVisible}
        onOk={handleSaveLibrary}
        onCancel={() => {
          setIsModalVisible(false);
          form.resetFields();
        }}
        width={700}
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="编码库名称"
            rules={[{ required: true, message: '请输入编码库名称' }]}
          >
            <Input placeholder="例如：满意度评价" size="large" />
          </Form.Item>
          
          <Form.Item
            name="description"
            label="描述"
            rules={[{ required: true, message: '请输入描述' }]}
          >
            <Input placeholder="简要说明这个编码库的用途" />
          </Form.Item>
          
          <Form.Item
            name="codes"
            label="编码列表"
            rules={[{ required: true, message: '请输入编码列表' }]}
            help="每行一个编码，支持粘贴批量添加"
          >
            <Input.TextArea
              rows={10}
              placeholder="非常满意&#10;满意&#10;一般&#10;不满意&#10;非常不满意"
            />
          </Form.Item>
          
          <div className="bg-blue-50 p-3 rounded text-sm text-gray-600">
            <strong>提示：</strong>编码库创建后可在"新建分析"中选择使用，一个编码库可以复用到多个分析任务中。
          </div>
        </Form>
      </Modal>
    </div>
  );
};

export default CodeLibraryPage;
