import React, { useEffect, useState } from 'react';
import { Button, Card, Tag, Spin, Empty, Modal, Form, Input, message, Dropdown } from 'antd';
import { PlusOutlined, FileTextOutlined, MoreOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

const ProjectsPage = () => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [form] = Form.useForm();
  const navigate = useNavigate();

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const response = await api.get('/projects/');
      setProjects(response.data);
    } catch (error) {
      console.error('Failed to fetch projects:', error);
      message.error('获取项目列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = () => {
    setEditingProject(null);
    form.resetFields();
    setIsModalVisible(true);
  };

  const handleEditProject = (project, e) => {
    e.stopPropagation();
    setEditingProject(project);
    form.setFieldsValue({
      name: project.name,
      description: project.description
    });
    setIsModalVisible(true);
  };

  const handleDeleteProject = (project, e) => {
    e.stopPropagation();
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除项目 "${project.name}" 吗？此操作无法撤销。`,
      okText: '确定',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await api.delete(`/projects/${project.id}`);
          message.success('项目已删除');
          fetchProjects();
        } catch (error) {
          console.error('Failed to delete project:', error);
          message.error('删除项目失败');
        }
      }
    });
  };

  const handleSaveProject = async () => {
    try {
      const values = await form.validateFields();
      
      if (editingProject) {
        await api.put(`/projects/${editingProject.id}`, values);
        message.success('项目已更新');
      } else {
        await api.post('/projects/', values);
        message.success('项目已创建');
      }
      
      setIsModalVisible(false);
      form.resetFields();
      fetchProjects();
    } catch (error) {
      console.error('Validation failed:', error);
    }
  };

  const handleCardClick = (project) => {
    setEditingProject(project);
    form.setFieldsValue({
      name: project.name,
      description: project.description
    });
    setIsModalVisible(true);
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
          <h1 className="text-2xl font-bold text-slate-800">项目列表</h1>
          <p className="text-slate-500 mt-1">管理您的问卷分析项目</p>
        </div>
        <Button 
          type="primary" 
          icon={<PlusOutlined />} 
          size="large"
          onClick={handleCreateProject}
        >
          新建项目
        </Button>
      </div>

      {projects.length === 0 ? (
        <Card>
          <Empty 
            description="暂无项目，点击上方按钮开始新建项目"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => (
            <Card
              key={project.id}
              hoverable
              className="cursor-pointer transition-shadow hover:shadow-lg relative group"
              onClick={() => handleCardClick(project)}
            >
              <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                <Dropdown
                  menu={{
                    items: [
                      {
                        key: 'edit',
                        icon: <EditOutlined />,
                        label: '编辑项目',
                        onClick: (e) => handleEditProject(project, e.domEvent),
                      },
                      {
                        key: 'delete',
                        icon: <DeleteOutlined />,
                        label: '删除项目',
                        danger: true,
                        onClick: (e) => handleDeleteProject(project, e.domEvent),
                      },
                    ],
                  }}
                  trigger={['click']}
                >
                  <Button 
                    type="text" 
                    icon={<MoreOutlined />} 
                    onClick={(e) => e.stopPropagation()}
                    className="bg-white/80 backdrop-blur-sm hover:bg-white"
                  />
                </Dropdown>
              </div>

              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <FileTextOutlined className="text-blue-600 text-xl" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold text-slate-800 truncate pr-8">
                    {project.name}
                  </h3>
                  <p className="text-sm text-slate-500 mt-1 line-clamp-2 h-10">
                    {project.description || '暂无描述'}
                  </p>
                  <div className="flex items-center space-x-2 mt-3">
                    <Tag color="blue">
                      {new Date(project.created_at).toLocaleDateString('zh-CN')}
                    </Tag>
                    {project.updated_at && (
                      <Tag color="green">
                        更新于: {new Date(project.updated_at).toLocaleDateString('zh-CN')}
                      </Tag>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        title={editingProject ? "编辑项目" : "新建项目"}
        open={isModalVisible}
        onOk={handleSaveProject}
        onCancel={() => {
          setIsModalVisible(false);
          form.resetFields();
        }}
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="项目名称"
            rules={[{ required: true, message: '请输入项目名称' }]}
          >
            <Input placeholder="例如：2025年度客户满意度调研" size="large" />
          </Form.Item>
          
          <Form.Item
            name="description"
            label="项目描述"
          >
            <Input.TextArea 
              placeholder="简要说明项目背景和目标" 
              rows={4}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ProjectsPage;
