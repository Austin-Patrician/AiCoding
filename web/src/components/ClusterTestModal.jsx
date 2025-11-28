import React, { useState, useEffect } from 'react';
import { 
  Modal, Button, Upload, Select, Slider, 
  InputNumber, Divider, Radio, Steps, Checkbox, Tag, message, Collapse, Switch
} from 'antd';
import { 
  RobotOutlined, ClusterOutlined, 
  PlayCircleOutlined, FileExcelOutlined, 
  TableOutlined, SettingOutlined, CheckCircleOutlined,
  DownOutlined, CopyOutlined
} from '@ant-design/icons';
import api from '../services/api';

// 默认列配置
const getDefaultColumnConfig = () => ({
  enabled: true,
  engine: 'llm',
  sampleSize: 50,
  maxCodes: 10
});

const ClusterTestModal = ({ 
  visible, 
  onCancel, 
  onSuccess,
  presetConfig // 预设配置（用于复制/重跑）
}) => {
  // Step state
  const [currentStep, setCurrentStep] = useState(0);
  
  // File state
  const [fileList, setFileList] = useState([]);
  const [uploadedFileId, setUploadedFileId] = useState(null);
  const [uploadedFileName, setUploadedFileName] = useState(null);
  const [columns, setColumns] = useState([]);
  
  // 每列独立配置: { columnName: { enabled, engine, sampleSize, maxCodes } }
  const [columnConfigs, setColumnConfigs] = useState({});
  const [submitting, setSubmitting] = useState(false);
  
  // 当展开的配置面板
  const [expandedColumn, setExpandedColumn] = useState(null);

  // 当有预设配置时，加载文件并初始化
  useEffect(() => {
    if (visible && presetConfig) {
      loadPresetConfig();
    }
  }, [visible, presetConfig]);

  const loadPresetConfig = async () => {
    if (!presetConfig?.file_id) return;
    
    try {
      // 获取文件信息
      const response = await api.get(`/files/${presetConfig.file_id}/info`);
      const cols = response.data.columns || [];
      
      setUploadedFileId(presetConfig.file_id);
      setUploadedFileName(presetConfig.file_name);
      setColumns(cols);
      setFileList([{ uid: '1', name: presetConfig.file_name || presetConfig.file_id, status: 'done' }]);
      
      // 初始化配置，默认不选中
      const initialConfigs = {};
      cols.forEach(col => {
        initialConfigs[col] = { ...getDefaultColumnConfig(), enabled: false };
      });
      
      // 如果有预设列，设置该列的配置
      if (presetConfig.column_name && cols.includes(presetConfig.column_name)) {
        initialConfigs[presetConfig.column_name] = {
          enabled: true,
          engine: presetConfig.engine || 'llm',
          sampleSize: presetConfig.sample_size > 0 ? presetConfig.sample_size : 50,
          maxCodes: presetConfig.max_codes || 10
        };
      }
      
      setColumnConfigs(initialConfigs);
      setCurrentStep(0); // 停在第一步，方便用户修改
    } catch (error) {
      console.error('Failed to load preset config:', error);
      message.warning('加载文件信息失败，请重新上传');
    }
  };

  // 获取选中的列
  const selectedColumns = Object.entries(columnConfigs)
    .filter(([_, config]) => config.enabled)
    .map(([col, _]) => col);

  const resetForm = () => {
    setCurrentStep(0);
    setFileList([]);
    setUploadedFileId(null);
    setUploadedFileName(null);
    setColumns([]);
    setColumnConfigs({});
    setExpandedColumn(null);
  };

  const handleCancel = () => {
    resetForm();
    onCancel();
  };

  const handleUpload = async (options) => {
    const { file, onSuccess: onUploadSuccess, onError } = options;
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await api.post('/files/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setUploadedFileId(response.data.file_id);
      setUploadedFileName(file.name);
      const cols = response.data.columns || [];
      setColumns(cols);
      // 初始化每列的默认配置（默认都不选中）
      const initialConfigs = {};
      cols.forEach(col => {
        initialConfigs[col] = { ...getDefaultColumnConfig(), enabled: false };
      });
      setColumnConfigs(initialConfigs);
      setFileList([{ uid: file.uid, name: file.name, status: 'done' }]);
      onUploadSuccess(response.data);
      message.success('文件上传成功，请选择要分析的列');
    } catch (error) {
      onError(error);
      message.error('文件上传失败: ' + (error.response?.data?.detail || error.message));
    }
  };

  // 切换列的选中状态
  const handleColumnToggle = (col) => {
    setColumnConfigs(prev => ({
      ...prev,
      [col]: {
        ...prev[col],
        enabled: !prev[col].enabled
      }
    }));
  };

  // 更新单列的配置
  const updateColumnConfig = (col, key, value) => {
    setColumnConfigs(prev => ({
      ...prev,
      [col]: {
        ...prev[col],
        [key]: value
      }
    }));
  };

  // 全选/取消全选
  const handleSelectAll = () => {
    const allSelected = selectedColumns.length === columns.length;
    setColumnConfigs(prev => {
      const newConfigs = { ...prev };
      columns.forEach(col => {
        newConfigs[col] = { ...newConfigs[col], enabled: !allSelected };
      });
      return newConfigs;
    });
  };

  // 批量应用配置到所有选中的列
  const applyConfigToAll = (key, value) => {
    setColumnConfigs(prev => {
      const newConfigs = { ...prev };
      selectedColumns.forEach(col => {
        newConfigs[col] = { ...newConfigs[col], [key]: value };
      });
      return newConfigs;
    });
  };

  const handleSubmit = async () => {
    if (!uploadedFileId || selectedColumns.length === 0) {
      message.warning('请先完成配置');
      return;
    }

    setSubmitting(true);
    try {
      // 为每个选中的列创建测试任务，使用各自的配置
      const results = [];
      for (const column of selectedColumns) {
        const config = columnConfigs[column];
        const response = await api.post('/workshop/cluster-test', {
          file_id: uploadedFileId,
          file_name: uploadedFileName,
          column_name: column,
          engine: config.engine,
          sample_size: config.engine === 'llm' ? config.sampleSize : -1,
          max_codes: config.maxCodes
        });
        results.push(response.data);
      }
      
      message.success(`${selectedColumns.length} 个列的分析任务已完成`);
      handleCancel();
      onSuccess(results);
    } catch (error) {
      message.error(`分析失败: ${error.response?.data?.detail || error.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 0: return uploadedFileId && selectedColumns.length > 0; // 上传文件且选择了列
      case 1: return selectedColumns.length > 0; // 配置步骤，至少选了一列
      case 2: return true;
      default: return false;
    }
  };

  // Step 0: Upload File & Select Columns
  const renderUploadStep = () => (
    <div className="py-4">
      {/* Upload Area */}
      <Upload.Dragger
        customRequest={handleUpload}
        fileList={fileList}
        accept=".xlsx,.xls"
        maxCount={1}
        showUploadList={false}
        className="!border-gray-200 !bg-gray-50/50 hover:!border-blue-400 hover:!bg-blue-50/30"
      >
        {fileList.length > 0 ? (
          <div className="py-3">
            <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-green-50 flex items-center justify-center">
              <FileExcelOutlined className="text-xl text-green-500" />
            </div>
            <p className="text-sm font-medium text-gray-700">{fileList[0].name}</p>
            <p className="text-xs text-gray-400 mt-1">点击可重新上传</p>
          </div>
        ) : (
          <div className="py-3">
            <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-gray-100 flex items-center justify-center">
              <FileExcelOutlined className="text-xl text-gray-400" />
            </div>
            <p className="text-sm text-gray-600">点击或拖拽 Excel 文件到此处</p>
            <p className="text-xs text-gray-400 mt-1">支持 .xlsx 和 .xls 格式</p>
          </div>
        )}
      </Upload.Dragger>

      {/* Column Selection - Show after upload */}
      {columns.length > 0 && (
        <div className="mt-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <TableOutlined />
              <span>选择要分析的列 ({selectedColumns.length}/{columns.length})</span>
            </div>
            <Button 
              type="link" 
              size="small" 
              onClick={handleSelectAll}
              className="!text-blue-500 !px-0"
            >
              {selectedColumns.length === columns.length ? '取消全选' : '全选'}
            </Button>
          </div>
          
          <div className="max-h-48 overflow-y-auto rounded-xl border border-gray-200 bg-white">
            {columns.map((col, index) => {
              const config = columnConfigs[col] || getDefaultColumnConfig();
              const isSelected = config.enabled;
              
              return (
                <div
                  key={col}
                  onClick={() => handleColumnToggle(col)}
                  className={`
                    px-4 py-2.5 flex items-center gap-3 cursor-pointer transition-colors border-b border-gray-100 last:border-b-0
                    ${isSelected ? 'bg-blue-50/50' : 'bg-white hover:bg-gray-50'}
                  `}
                >
                  <Checkbox checked={isSelected} className="!mr-0 pointer-events-none" />
                  <span className="w-5 h-5 rounded bg-gray-100 text-xs flex items-center justify-center text-gray-400 shrink-0">
                    {index + 1}
                  </span>
                  <span className={`flex-1 truncate text-sm ${isSelected ? 'font-medium text-gray-800' : 'text-gray-600'}`}>
                    {col}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );

  // Step 1: Configure Each Selected Column
  const renderConfigStep = () => (
    <div className="py-4">
      <div className="mb-4 text-sm text-gray-500">
        为 {selectedColumns.length} 个列配置分析参数
      </div>

      <div className="max-h-80 overflow-y-auto space-y-3 pr-1">
        {selectedColumns.map((col, index) => {
          const config = columnConfigs[col];
          const isExpanded = expandedColumn === col;
          
          return (
            <div 
              key={col} 
              className="rounded-xl border border-gray-200 bg-white overflow-hidden"
            >
              {/* Column Header - Always visible */}
              <div
                onClick={() => setExpandedColumn(isExpanded ? null : col)}
                className="px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-gray-50 transition-colors"
              >
                <span className="w-6 h-6 rounded-lg bg-blue-100 text-xs flex items-center justify-center text-blue-600 font-medium shrink-0">
                  {index + 1}
                </span>
                <span className="flex-1 truncate text-sm font-medium text-gray-700">
                  {col}
                </span>
                <span className={`
                  inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs
                  ${config.engine === 'llm' ? 'bg-blue-100 text-blue-600' : 'bg-violet-100 text-violet-600'}
                `}>
                  {config.engine === 'llm' ? <RobotOutlined /> : <ClusterOutlined />}
                  {config.engine === 'llm' ? 'LLM' : 'BERTopic'}
                </span>
                <DownOutlined className={`text-gray-400 text-xs transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
              </div>
              
              {/* Expanded Config Panel */}
              {isExpanded && (
                <div className="px-4 py-4 bg-gray-50/70 border-t border-gray-100">
                  <div className="space-y-4">
                    {/* Engine Selection */}
                    <div>
                      <div className="text-xs font-medium text-gray-500 mb-2">分析引擎</div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => updateColumnConfig(col, 'engine', 'llm')}
                          className={`
                            flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm transition-all
                            ${config.engine === 'llm' 
                              ? 'bg-blue-500 text-white shadow-sm' 
                              : 'bg-white text-gray-600 border border-gray-200 hover:border-blue-300'
                            }
                          `}
                        >
                          <RobotOutlined />
                          LLM
                        </button>
                        <button
                          onClick={() => updateColumnConfig(col, 'engine', 'bertopic')}
                          className={`
                            flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm transition-all
                            ${config.engine === 'bertopic' 
                              ? 'bg-violet-500 text-white shadow-sm' 
                              : 'bg-white text-gray-600 border border-gray-200 hover:border-violet-300'
                            }
                          `}
                        >
                          <ClusterOutlined />
                          BERTopic
                        </button>
                      </div>
                    </div>
                    
                    {/* Sample Size - Only for LLM */}
                    {config.engine === 'llm' && (
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-xs font-medium text-gray-500">样本数量</span>
                          <span className="text-xs text-blue-600 font-medium">{config.sampleSize} 条</span>
                        </div>
                        <Slider
                          min={10}
                          max={200}
                          step={10}
                          value={config.sampleSize}
                          onChange={(v) => updateColumnConfig(col, 'sampleSize', v)}
                          className="!my-0"
                        />
                      </div>
                    )}
                    
                    {config.engine === 'bertopic' && (
                      <div className="px-3 py-2 bg-violet-50 rounded-lg">
                        <p className="text-xs text-violet-600 flex items-center gap-1">
                          <CheckCircleOutlined />
                          使用全量数据进行聚类分析
                        </p>
                      </div>
                    )}
                    
                    {/* Max Codes */}
                    <div>
                      <div className="text-xs font-medium text-gray-500 mb-2">最大主题数</div>
                      <InputNumber
                        min={3}
                        max={30}
                        value={config.maxCodes}
                        onChange={(v) => updateColumnConfig(col, 'maxCodes', v)}
                        size="small"
                        className="!w-full"
                        addonAfter="个"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Hint */}
      <div className="mt-3 text-xs text-gray-400 text-center">
        💡 点击展开可修改每列的分析参数，默认使用 LLM 引擎
      </div>
    </div>
  );

  // Step 2: Confirmation
  const renderConfirmStep = () => (
    <div className="py-4">
      {/* Summary Header */}
      <div className="text-center mb-6">
        <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
          <PlayCircleOutlined className="text-2xl text-white" />
        </div>
        <h3 className="text-lg font-medium text-gray-800">准备开始分析</h3>
        <p className="text-sm text-gray-400 mt-1">将对 {selectedColumns.length} 个列进行主题提取</p>
      </div>

      {/* Config Summary Cards */}
      <div className="max-h-56 overflow-y-auto space-y-2">
        {selectedColumns.map((col, index) => {
          const config = columnConfigs[col];
          return (
            <div 
              key={col}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100"
            >
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-lg bg-blue-100 text-xs flex items-center justify-center text-blue-600 font-medium">
                  {index + 1}
                </span>
                <span className="text-sm font-medium text-gray-700 truncate max-w-[180px]">
                  {col}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className={`
                  inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium
                  ${config.engine === 'llm' ? 'bg-blue-100 text-blue-600' : 'bg-violet-100 text-violet-600'}
                `}>
                  {config.engine === 'llm' ? <RobotOutlined /> : <ClusterOutlined />}
                  {config.engine === 'llm' ? 'LLM' : 'BERTopic'}
                </span>
                <span className="text-gray-400">
                  {config.engine === 'llm' ? `${config.sampleSize}条` : '全量'}
                </span>
                <span className="text-gray-400">
                  ≤{config.maxCodes}主题
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Warning for large batch */}
      {selectedColumns.length > 3 && (
        <div className="mt-4 p-3 bg-amber-50 rounded-xl border border-amber-100">
          <p className="text-xs text-amber-600">
            ⚠️ 选择了多个列，分析将依次执行，可能需要一些时间
          </p>
        </div>
      )}
    </div>
  );

  const stepContent = [renderUploadStep, renderConfigStep, renderConfirmStep];

  return (
    <Modal
      title={
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-sm">
            <ClusterOutlined className="text-white text-base" />
          </div>
          <div>
            <div className="text-base font-semibold text-gray-800">新建聚类测试</div>
            <div className="text-xs font-normal text-gray-400">对比不同引擎的主题提取效果</div>
          </div>
        </div>
      }
      open={visible}
      onCancel={handleCancel}
      width={600}
      className="cluster-test-modal"
      footer={
        <div className="flex justify-between pt-2">
          <Button 
            disabled={currentStep === 0}
            onClick={() => setCurrentStep(s => s - 1)}
            className="!rounded-lg !border-gray-200 !text-gray-600 hover:!border-gray-300 hover:!text-gray-700"
          >
            上一步
          </Button>
          <div className="space-x-2">
            <Button 
              onClick={handleCancel}
              className="!rounded-lg !border-gray-200 !text-gray-600 hover:!border-gray-300"
            >
              取消
            </Button>
            {currentStep === 2 ? (
              <Button 
                type="primary" 
                icon={<PlayCircleOutlined />}
                onClick={handleSubmit}
                loading={submitting}
                disabled={selectedColumns.length === 0}
                className="!rounded-lg !bg-blue-500 hover:!bg-blue-600 !border-blue-500 !shadow-sm"
              >
                开始分析
              </Button>
            ) : (
              <Button 
                type="primary"
                disabled={!canProceed()}
                onClick={() => setCurrentStep(s => s + 1)}
                className="!rounded-lg !bg-blue-500 hover:!bg-blue-600 !border-blue-500 !shadow-sm disabled:!bg-gray-100 disabled:!border-gray-200 disabled:!text-gray-400"
              >
                下一步
              </Button>
            )}
          </div>
        </div>
      }
      destroyOnClose
    >
      {/* Progress Steps */}
      <div className="flex items-center justify-center gap-2 py-4 mb-2">
        {[
          { title: '选择列', icon: <TableOutlined /> },
          { title: '配置参数', icon: <SettingOutlined /> },
          { title: '开始分析', icon: <PlayCircleOutlined /> },
        ].map((step, index) => (
          <React.Fragment key={index}>
            <div 
              className={`
                flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all
                ${currentStep === index 
                  ? 'bg-blue-500 text-white shadow-sm' 
                  : currentStep > index 
                    ? 'bg-blue-100 text-blue-600' 
                    : 'bg-gray-100 text-gray-400'
                }
              `}
            >
              {step.icon}
              <span className="hidden sm:inline">{step.title}</span>
            </div>
            {index < 2 && (
              <div className={`w-8 h-0.5 rounded ${currentStep > index ? 'bg-blue-300' : 'bg-gray-200'}`} />
            )}
          </React.Fragment>
        ))}
      </div>
      
      {stepContent[currentStep]()}
    </Modal>
  );
};

export default ClusterTestModal;
