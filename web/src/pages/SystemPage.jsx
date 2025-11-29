import React, { useState, useEffect } from 'react';
import { 
  Table, Button, Modal, Form, Input, Switch, 
  message, Space, Tag, Checkbox 
} from 'antd';
import { 
  PlusOutlined, EditOutlined, DeleteOutlined, 
  UserOutlined, LockOutlined, MailOutlined 
} from '@ant-design/icons';
import api from '../services/api';

const SystemPage = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [form] = Form.useForm();
  
  // Data for selection
  const [routes, setRoutes] = useState([]);
  const [projects, setProjects] = useState([]);
  
  // Fetch initial data
  useEffect(() => {
    fetchUsers();
    fetchRoutes();
    fetchProjects();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await api.get('/users/');
      setUsers(response.data);
    } catch (error) {
      message.error('获取用户列表失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchRoutes = async () => {
    try {
      const response = await api.get('/users/routes');
      setRoutes(response.data);
    } catch (error) {
      console.error('获取路由权限列表失败', error);
    }
  };

  const fetchProjects = async () => {
    try {
      const response = await api.get('/projects/');
      // Transform for Transfer component
      const projectData = response.data.map(p => ({
        key: p.id,
        title: p.name,
        description: p.description
      }));
      setProjects(projectData);
    } catch (error) {
      console.error('获取项目列表失败', error);
    }
  };

  const handleAdd = () => {
    setEditingUser(null);
    form.resetFields();
    // Set default values
    form.setFieldsValue({
      is_active: true,
      is_superuser: false,
      permissions: [],
      project_ids: []
    });
    setModalVisible(true);
  };

  const handleEdit = (record) => {
    setEditingUser(record);
    form.resetFields();
    form.setFieldsValue({
      username: record.username,
      full_name: record.full_name,
      email: record.email,
      is_active: record.is_active,
      is_superuser: record.is_superuser,
      permissions: record.permissions,
      project_ids: record.accessible_project_ids
    });
    setModalVisible(true);
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/users/${id}`);
      message.success('删除用户成功');
      fetchUsers();
    } catch (error) {
      message.error('删除用户失败');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      
      if (editingUser) {
        // Update
        await api.put(`/users/${editingUser.id}`, values);
        message.success('更新用户成功');
      } else {
        // Create
        await api.post('/users/', values);
        message.success('创建用户成功');
      }
      
      setModalVisible(false);
      fetchUsers();
    } catch (error) {
      console.error(error);
      message.error(editingUser ? '更新失败' : '创建失败');
    }
  };

  const columns = [
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
      render: (text, record) => (
        <Space>
          <span className="font-medium">{text}</span>
          {record.is_superuser && <Tag color="red">管理员</Tag>}
        </Space>
      ),
    },
    {
      title: '姓名',
      dataIndex: 'full_name',
      key: 'full_name',
    },
    {
      title: '状态',
      dataIndex: 'is_active',
      key: 'is_active',
      render: (active) => (
        <Tag color={active ? 'success' : 'error'}>
          {active ? '启用' : '禁用'}
        </Tag>
      ),
    },
    {
      title: '权限',
      key: 'permissions',
      render: (_, record) => (
        <Space wrap>
          {record.is_superuser ? (
            <Tag>所有权限</Tag>
          ) : (
            record.permissions.map(p => {
              const route = routes.find(r => r.path === p);
              return <Tag key={p}>{route ? route.name : p}</Tag>;
            })
          )}
        </Space>
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space size="middle">
          <Button 
            type="text" 
            icon={<EditOutlined />} 
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Button 
            type="text" 
            danger 
            icon={<DeleteOutlined />} 
            onClick={() => {
              Modal.confirm({
                title: '确认删除',
                content: `确定要删除用户 ${record.username} 吗？`,
                onOk: () => handleDelete(record.id)
              });
            }}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">系统管理</h1>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          添加用户
        </Button>
      </div>

      <Table 
        columns={columns} 
        dataSource={users} 
        rowKey="id" 
        loading={loading}
        pagination={{ pageSize: 10 }}
      />

      <Modal
        title={
          <div className="flex items-center gap-3 pb-4 border-b">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
              <UserOutlined className="text-white text-xl" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-800">
                {editingUser ? "编辑用户" : "添加新用户"}
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                {editingUser ? "修改用户信息和权限配置" : "创建新用户并分配相应权限"}
              </p>
            </div>
          </div>
        }
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={800}
        okText={editingUser ? "保存修改" : "创建用户"}
        cancelText="取消"
        centered
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          className="mt-6"
        >
          {/* 基本信息区域 */}
          <div className="bg-gray-50 rounded-lg p-5 mb-5">
            <h4 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <div className="w-1 h-4 bg-blue-500 rounded"></div>
              基本信息
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <Form.Item
                name="username"
                label="用户名"
                rules={[
                  { required: true, message: '请输入用户名' },
                  { min: 3, message: '用户名至少3个字符' }
                ]}
              >
                <Input 
                  prefix={<UserOutlined className="text-gray-400" />} 
                  placeholder="请输入用户名" 
                  disabled={!!editingUser}
                  size="large"
                />
              </Form.Item>
              
              <Form.Item
                name="full_name"
                label="真实姓名"
              >
                <Input 
                  placeholder="请输入真实姓名" 
                  size="large"
                />
              </Form.Item>
              
              <Form.Item
                name="email"
                label="电子邮箱"
                rules={[{ type: 'email', message: '请输入有效的邮箱地址' }]}
              >
                <Input 
                  prefix={<MailOutlined className="text-gray-400" />} 
                  placeholder="example@company.com" 
                  size="large"
                />
              </Form.Item>

              <Form.Item
                name="password"
                label={editingUser ? "密码（留空则不修改）" : "登录密码"}
                rules={[
                  { required: !editingUser, message: '请输入密码' },
                  { min: 6, message: '密码至少6个字符' }
                ]}
              >
                <Input.Password 
                  prefix={<LockOutlined className="text-gray-400" />} 
                  placeholder={editingUser ? "留空表示不修改密码" : "请设置登录密码"} 
                  size="large"
                />
              </Form.Item>
            </div>
          </div>

          {/* 账号设置区域 */}
          <div className="bg-gray-50 rounded-lg p-5 mb-5">
            <h4 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <div className="w-1 h-4 bg-green-500 rounded"></div>
              账号设置
            </h4>
            <div className="grid grid-cols-2 gap-6">
              <div className="flex items-center justify-between p-4 bg-white rounded-lg border border-gray-200">
                <div>
                  <p className="font-medium text-gray-700">账号状态</p>
                  <p className="text-xs text-gray-500 mt-1">控制用户是否可以登录系统</p>
                </div>
                <Form.Item
                  name="is_active"
                  valuePropName="checked"
                  noStyle
                >
                  <Switch 
                    checkedChildren="启用" 
                    unCheckedChildren="禁用"
                    className="ml-4"
                  />
                </Form.Item>
              </div>

              <div className="flex items-center justify-between p-4 bg-white rounded-lg border border-gray-200">
                <div>
                  <p className="font-medium text-gray-700">超级管理员</p>
                  <p className="text-xs text-gray-500 mt-1">拥有所有权限，无需单独配置</p>
                </div>
                <Form.Item
                  name="is_superuser"
                  valuePropName="checked"
                  noStyle
                >
                  <Switch 
                    checkedChildren="是" 
                    unCheckedChildren="否"
                    className="ml-4"
                  />
                </Form.Item>
              </div>
            </div>
          </div>

          {/* 菜单权限区域 */}
          <div className="bg-gray-50 rounded-lg p-5 mb-5">
            <h4 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <div className="w-1 h-4 bg-purple-500 rounded"></div>
              菜单权限
              <span className="text-xs font-normal text-gray-500 ml-2">
                （勾选用户可访问的功能模块）
              </span>
            </h4>
            <Form.Item name="permissions" noStyle>
              <Checkbox.Group className="w-full">
                <div className="grid grid-cols-3 gap-x-6 gap-y-3">
                  {routes.map(route => (
                    <Checkbox 
                      key={route.path} 
                      value={route.path}
                      className="text-gray-700"
                    >
                      {route.name}
                    </Checkbox>
                  ))}
                </div>
              </Checkbox.Group>
            </Form.Item>
          </div>

          {/* 项目权限区域 */}
          <div className="bg-gray-50 rounded-lg p-5">
            <h4 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <div className="w-1 h-4 bg-orange-500 rounded"></div>
              项目数据权限
              <span className="text-xs font-normal text-gray-500 ml-2">
                （勾选用户可访问的项目数据）
              </span>
            </h4>
            <Form.Item name="project_ids" noStyle>
              <Checkbox.Group className="w-full">
                <div className="grid grid-cols-2 gap-x-6 gap-y-3 max-h-60 overflow-y-auto pr-2">
                  {projects.map(project => (
                    <Checkbox 
                      key={project.key} 
                      value={project.key}
                      className="text-gray-700"
                    >
                      <div className="flex flex-col">
                        <span className="font-medium">{project.title}</span>
                        {project.description && (
                          <span className="text-xs text-gray-400 truncate">{project.description}</span>
                        )}
                      </div>
                    </Checkbox>
                  ))}
                </div>
              </Checkbox.Group>
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </div>
  );
};

export default SystemPage;
