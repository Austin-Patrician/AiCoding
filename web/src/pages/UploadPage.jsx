import { Upload, Button, message, Select, Card, Steps, Table, Input, Modal } from 'antd';
import { InboxOutlined, PlusOutlined } from '@ant-design/icons';
import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import ConfigurationPage from './ConfigurationPage';

const { Dragger } = Upload;
const { Step } = Steps;

const API_BASE_URL = 'http://127.0.0.1:8000/api/v1';

const UploadPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const projectId = searchParams.get('project');
  
  const [currentStep, setCurrentStep] = useState(0);
  const [fileInfo, setFileInfo] = useState(null);
  const [selectedQuestionColumn, setSelectedQuestionColumn] = useState(null);
  const [selectedAnswerColumn, setSelectedAnswerColumn] = useState(null);
  const [config, setConfig] = useState(null);
  
  // Project selection modal
  const [showProjectModal, setShowProjectModal] = useState(!projectId);
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(projectId);
  const [newProjectName, setNewProjectName] = useState('');
  const [creatingProject, setCreatingProject] = useState(false);

  useEffect(() => {
    fetchProjects();
    if (projectId) {
      loadProjectMapping(projectId);
    }
  }, [projectId]);

  const fetchProjects = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/projects/`);
      setProjects(response.data);
    } catch (error) {
      console.error('Failed to fetch projects:', error);
    }
  };

  const loadProjectMapping = async (pid) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/projects/${pid}/mapping`);
      if (response.data.mapping) {
        setSelectedQuestionColumn(response.data.mapping.question_column);
        setSelectedAnswerColumn(response.data.mapping.answer_column);
      }
    } catch (error) {
      console.error('Failed to load mapping:', error);
    }
  };

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) {
      message.warning('请输入项目名称');
      return;
    }
    setCreatingProject(true);
    try {
      const response = await axios.post(`${API_BASE_URL}/projects/`, {
        name: newProjectName,
        description: ''
      });
      setSelectedProject(response.data.id);
      setProjects([...projects, response.data]);
      message.success('项目创建成功');
      setShowProjectModal(false);
      navigate(`/coding/analysis/new?project=${response.data.id}`);
    } catch (error) {
      message.error('项目创建失败');
    } finally {
      setCreatingProject(false);
    }
  };

  const handleProjectSelect = () => {
    if (!selectedProject) {
      message.warning('请选择一个项目');
      return;
    }
    setShowProjectModal(false);
    navigate(`/coding/analysis/new?project=${selectedProject}`);
  };

  const uploadProps = {
    name: 'file',
    multiple: false,
    action: `${API_BASE_URL}/files/upload`,
    onChange(info) {
      const { status } = info.file;
      if (status === 'done') {
        message.success(`${info.file.name} 上传成功`);
        setFileInfo(info.file.response);
        setCurrentStep(1);
      } else if (status === 'error') {
        message.error(`${info.file.name} 上传失败`);
      }
    },
    showUploadList: false,
  };

  const handleNextToConfig = async () => {
    if (!selectedQuestionColumn || !selectedAnswerColumn) {
      message.warning('请选择题目列和答案列');
      return;
    }
    
    // Save mapping
    try {
      await axios.post(`${API_BASE_URL}/projects/${selectedProject}/mapping`, {
        question_column: selectedQuestionColumn,
        answer_column: selectedAnswerColumn,
        additional_columns: []
      });
      message.success('列映射已保存');
    } catch (error) {
      console.error('Failed to save mapping:', error);
    }
    
    setCurrentStep(2);
  };

  const handleStartAnalysis = async (configuration) => {
    setConfig(configuration);
    
    try {
      const response = await axios.post(`${API_BASE_URL}/analysis/tasks`, {
        file_id: fileInfo.file_id,
        project_id: selectedProject,
        question_column: selectedQuestionColumn,
        answer_column: selectedAnswerColumn,
        mode: configuration.mode,
        engine: configuration.engine,
        codes: configuration.codes
      });
      
      message.success('分析任务已启动');
      navigate(`/coding/analysis/results/${response.data.task_id}`);
    } catch (error) {
      console.error('Failed to start analysis:', error);
      message.error('启动分析失败');
    }
  };

  return (
    <div>
      {/* Project Selection Modal */}
      <Modal
        title="选择或创建项目"
        open={showProjectModal}
        onOk={handleProjectSelect}
        onCancel={() => navigate('/projects')}
        okText="确定"
        cancelText="取消"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              选择已有项目
            </label>
            <Select
              style={{ width: '100%' }}
              placeholder="选择项目"
              value={selectedProject}
              onChange={setSelectedProject}
              options={projects.map(p => ({ label: p.name, value: p.id }))}
            />
          </div>
          <div className="text-center text-slate-400">或</div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              创建新项目
            </label>
            <Input
              placeholder="输入项目名称"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              onPressEnter={handleCreateProject}
            />
            <Button
              type="dashed"
              icon={<PlusOutlined />}
              className="w-full mt-2"
              onClick={handleCreateProject}
              loading={creatingProject}
            >
              创建新项目
            </Button>
          </div>
        </div>
      </Modal>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">新增数据分析</h1>
        <p className="text-slate-500 mt-1">上传问卷数据并配置分析参数</p>
      </div>

      <Steps current={currentStep} className="mb-8">
        <Step title="上传 Excel" />
        <Step title="选择列映射" />
        <Step title="配置分析" />
      </Steps>

      {currentStep === 0 && (
        <Card>
          <Dragger {...uploadProps}>
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
            <p className="ant-upload-hint">
              仅支持 Excel 文件 (.xlsx, .xls)
            </p>
          </Dragger>
        </Card>
      )}

      {currentStep === 1 && fileInfo && (
        <Card title="选择列映射">
          <p className="text-slate-600 mb-4">请选择包含题目和答案的列</p>
          
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                题目列
              </label>
              <Select
                style={{ width: '100%' }}
                placeholder="选择题目列"
                value={selectedQuestionColumn}
                onChange={setSelectedQuestionColumn}
                options={fileInfo.columns.map((col) => ({ label: col, value: col }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                答案列
              </label>
              <Select
                style={{ width: '100%' }}
                placeholder="选择答案列"
                value={selectedAnswerColumn}
                onChange={setSelectedAnswerColumn}
                options={fileInfo.columns.map((col) => ({ label: col, value: col }))}
              />
            </div>
          </div>
          
          <h4 className="font-medium text-slate-700 mb-2">数据预览:</h4>
          <Table 
            dataSource={fileInfo.preview} 
            columns={fileInfo.columns.map(col => ({ 
              title: col, 
              dataIndex: col, 
              key: col, 
              ellipsis: true,
              className: col === selectedQuestionColumn || col === selectedAnswerColumn ? 'bg-primary-50' : ''
            }))}
            pagination={false}
            scroll={{ x: true }}
            size="small"
            rowKey={(record, index) => index}
          />

          <div className="mt-6 text-right">
            <Button type="primary" onClick={handleNextToConfig}>
              下一步: 配置分析
            </Button>
          </div>
        </Card>
      )}

      {currentStep === 2 && (
        <ConfigurationPage 
          fileId={fileInfo.file_id} 
          columnName={selectedAnswerColumn} 
          onNext={handleStartAnalysis} 
        />
      )}
    </div>
  );
};

export default UploadPage;
