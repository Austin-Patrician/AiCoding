import React, { useState, useEffect } from 'react';
import { Card, Button, Empty, Tabs, Modal, Form, Select, Upload, Input, Radio, InputNumber, Switch, message, Tag, Row, Col, Collapse, Tooltip, Badge } from 'antd';
import { PlusOutlined, InboxOutlined, BookOutlined, CopyOutlined, CheckCircleOutlined, WarningOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

const { TabPane } = Tabs;
const { Dragger } = Upload;
const { Option } = Select;
const { Panel } = Collapse;

const CodingPage = () => {
  const navigate = useNavigate();
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [form] = Form.useForm();
  
  // Data states
  const [projects, setProjects] = useState([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [fileList, setFileList] = useState([]);
  const [columns, setColumns] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadedFileId, setUploadedFileId] = useState(null);
  
  // Column selection states
  const [selectedColumns, setSelectedColumns] = useState([]);
  const [columnConfigs, setColumnConfigs] = useState({}); // {columnName: {mode, engine, maxCodes, codeLibrary}}
  
  // Code library states
  const [codeLibraries, setCodeLibraries] = useState([]);
  const [codeLibrariesLoading, setCodeLibrariesLoading] = useState(false);

  // 获取项目列表
  const fetchProjects = async () => {
    setProjectsLoading(true);
    try {
      const response = await api.get('/projects/');
      setProjects(response.data);
    } catch (error) {
      console.error('Failed to fetch projects:', error);
      message.error('获取项目列表失败');
    } finally {
      setProjectsLoading(false);
    }
  };

  // 获取编码库列表
  const fetchCodeLibraries = async () => {
    setCodeLibrariesLoading(true);
    try {
      const response = await api.get('/code-libraries/');
      // 转换数据格式以兼容现有逻辑
      const libraries = response.data.map(lib => ({
        id: lib.id,
        name: lib.name,
        codes: lib.codes || []
      }));
      setCodeLibraries(libraries);
    } catch (error) {
      console.error('Failed to fetch code libraries:', error);
      message.error('获取编码库列表失败');
    } finally {
      setCodeLibrariesLoading(false);
    }
  };

  useEffect(() => {
    if (isModalVisible) {
      fetchProjects();
      fetchCodeLibraries();
    }
  }, [isModalVisible]);

  const handleNewAnalysis = () => {
    setIsModalVisible(true);
    form.resetFields();
    setFileList([]);
    setColumns([]);
    setSelectedColumns([]);
    setColumnConfigs({});
    setUploadedFileId(null);
  };

  const handleUpload = async (options) => {
    const { file, onSuccess, onError } = options;
    const formData = new FormData();
    formData.append('file', file);

    setUploading(true);
    try {
      const response = await api.post('/files/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      setUploadedFileId(response.data.file_id);
      setColumns(response.data.columns || []);
      setFileList([{
        uid: file.uid,
        name: file.name,
        status: 'done',
      }]);
      onSuccess(response.data);
      message.success('文件上传并解析成功');
    } catch (error) {
      console.error('Upload error:', error);
      onError(error);
      message.error('文件上传失败: ' + (error.response?.data?.detail || error.message));
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveFile = () => {
    setFileList([]);
    setColumns([]);
    setSelectedColumns([]);
    setColumnConfigs({});
    setUploadedFileId(null);
  };

  const handleColumnSelectionChange = (cols) => {
    setSelectedColumns(cols);
    // 保留已有配置，为新列添加默认配置
    const newConfigs = {};
    cols.forEach(col => {
      if (columnConfigs[col]) {
        newConfigs[col] = columnConfigs[col];
      } else {
        // 新列默认配置：开放编码模式，默认使用 open_then_default 策略
        newConfigs[col] = {
          mode: 'open',
          engine: 'llm',
          maxCodes: 10,
          codeLibrary: null,
          mappingDict: '{}',
          defaultCode: '',
          classificationMode: 'open_then_default'
        };
      }
    });
    setColumnConfigs(newConfigs);
  };

  const handleColumnConfigChange = (columnName, field, value) => {
    const newConfig = {
      ...columnConfigs[columnName],
      [field]: value
    };
    
    // 当切换编码模式时，自动更新分类策略的默认值
    if (field === 'mode') {
      if (value === 'fixed') {
        newConfig.classificationMode = 'fixed_then_default';
      } else {
        // 开放编码模式
        newConfig.classificationMode = 'open_then_default';
      }
    }
    
    setColumnConfigs({
      ...columnConfigs,
      [columnName]: newConfig
    });
  };

  const handleBatchConfig = (config) => {
    const newConfigs = {};
    selectedColumns.forEach(col => {
      // 根据模式确定默认分类策略
      const defaultStrategy = config.mode === 'fixed' ? 'fixed_then_default' : 'open_then_default';
      newConfigs[col] = { 
        ...config,
        mappingDict: config.mappingDict || '{}',
        defaultCode: config.defaultCode || '',
        classificationMode: config.classificationMode || defaultStrategy
      };
    });
    setColumnConfigs(newConfigs);
    message.success('批量配置已应用到所有列');
  };

  const handleCopyConfig = (sourceColumn) => {
    const config = columnConfigs[sourceColumn];
    return () => {
      // 复制到剪贴板
      navigator.clipboard.writeText(JSON.stringify(config));
      message.success('配置已复制');
    };
  };

  const getConfigStatus = (columnName) => {
    const config = columnConfigs[columnName];
    if (!config) return 'error';
    if (config.mode === 'fixed' && !config.codeLibrary) return 'warning';
    if (!config.defaultCode) return 'warning';
    return 'success';
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      
      if (!uploadedFileId) {
        message.error('请先上传文件');
        return;
      }

      if (selectedColumns.length === 0) {
        message.error('请至少选择一列进行编码');
        return;
      }

      // 验证每列配置
      const invalidColumns = [];
      selectedColumns.forEach(col => {
        const config = columnConfigs[col];
        if (!config) {
          invalidColumns.push(`${col}: 未配置`);
        } else if (config.mode === 'fixed' && !config.codeLibrary) {
          invalidColumns.push(`${col}: 未选择编码库`);
        } else if (!config.defaultCode) {
          invalidColumns.push(`${col}: 未设置默认分类编码`);
        }
        
        // 验证映射字典格式
        if (config.mappingDict && config.mappingDict !== '{}') {
          try {
            JSON.parse(config.mappingDict);
          } catch (e) {
            invalidColumns.push(`${col}: 映射字典JSON格式错误`);
          }
        }
      });

      if (invalidColumns.length > 0) {
        message.error(`配置不完整:\n${invalidColumns.join('\n')}`);
        return;
      }

      // Construct payload with per-column configs
      const columnConfigsPayload = {};
      selectedColumns.forEach(col => {
        const config = columnConfigs[col];
        
        // 解析映射字典
        let mappingDict = {};
        try {
          mappingDict = config.mappingDict ? JSON.parse(config.mappingDict) : {};
        } catch (e) {
          console.error(`Failed to parse mapping dict for ${col}:`, e);
        }
        
        columnConfigsPayload[col] = {
          mode: config.mode,
          engine: config.engine || 'llm',
          max_codes: config.maxCodes || 10,
          codes: [],
          mapping_dict: mappingDict,
          default_code: config.defaultCode,
          classification_mode: config.classificationMode
        };

        // 固定编码模式：添加编码库
        if (config.mode === 'fixed' && config.codeLibrary) {
          const library = codeLibraries.find(lib => lib.name === config.codeLibrary);
          if (library) {
            columnConfigsPayload[col].codes = library.codes.map(c => ({ code: c, description: c }));
          }
        }
      });

      const payload = {
        project_id: values.project_id,
        file_id: uploadedFileId,
        question_column: values.question_column,
        column_configs: columnConfigsPayload,
        generate_charts: values.generate_charts !== false
      };

      const response = await api.post('/analysis/tasks', payload);
      message.success('分析任务已创建 (草稿状态)');
      setIsModalVisible(false);
      // Navigate to task list instead of results
      navigate('/coding/tasks');
      
    } catch (error) {
      console.error(error);
      message.error('创建任务失败: ' + (error.response?.data?.detail || error.message));
    }
  };



  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">编码管理</h1>
          <p className="text-gray-500 mt-1">管理和执行问卷数据自动编码分析</p>
        </div>
        <Button 
          type="primary" 
          icon={<PlusOutlined />} 
          size="large"
          onClick={handleNewAnalysis}
        >
          新增分析
        </Button>
      </div>

      <Tabs defaultActiveKey="1" className="bg-white rounded-lg p-4">
        <TabPane tab="分析记录" key="1">
          <div className="py-8">
            <Empty 
              description='暂无分析记录，点击右上角"新增分析"开始'
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          </div>
        </TabPane>
        <TabPane tab="编码库" key="2">
          <div className="text-center py-12">
            <BookOutlined className="text-6xl text-gray-300 mb-4" />
            <p className="text-gray-500 mb-4">编码库已独立管理</p>
            <Button type="primary" onClick={() => navigate('/code-library')}>
              前往编码库管理
            </Button>
          </div>
        </TabPane>
        <TabPane tab="模板管理" key="3">
          <div className="py-8">
            <Empty 
              description="暂无分析模板，可将常用配置保存为模板"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          </div>
        </TabPane>
      </Tabs>

      {/* Quick Start Guide */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-blue-200 hover:shadow-md transition-shadow cursor-pointer" onClick={handleNewAnalysis}>
          <div className="text-center">
            <div className="text-3xl mb-3">📊</div>
            <h3 className="font-semibold text-gray-800 mb-2">固定编码</h3>
            <p className="text-sm text-gray-500">
              预先定义编码类别，AI 按照指定类别进行分类
            </p>
          </div>
        </Card>
        <Card className="border-blue-200 hover:shadow-md transition-shadow cursor-pointer" onClick={handleNewAnalysis}>
          <div className="text-center">
            <div className="text-3xl mb-3">🤖</div>
            <h3 className="font-semibold text-gray-800 mb-2">开放编码 (LLM)</h3>
            <p className="text-sm text-gray-500">
              使用 GPT 从数据中自动提炼主题和类别
            </p>
          </div>
        </Card>
        <Card className="border-blue-200 hover:shadow-md transition-shadow cursor-pointer" onClick={handleNewAnalysis}>
          <div className="text-center">
            <div className="text-3xl mb-3">🔍</div>
            <h3 className="font-semibold text-gray-800 mb-2">开放编码 (聚类)</h3>
            <p className="text-sm text-gray-500">
              使用 BERTopic 聚类发现数据中的潜在模式
            </p>
          </div>
        </Card>
      </div>

      {/* New Analysis Modal */}
      <Modal
        title="新建分析任务"
        open={isModalVisible}
        onOk={handleSubmit}
        onCancel={() => setIsModalVisible(false)}
        width={800}
        okText="开始分析"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          {/* 1. Project Selection */}
          <Form.Item name="project_id" label="所属项目" rules={[{ required: true, message: '请选择项目' }]}>
            <Select 
              placeholder="请选择项目" 
              size="large"
              loading={projectsLoading}
              notFoundContent={projectsLoading ? '加载中...' : '暂无项目，请先创建'}
            >
              {projects.map(p => (
                <Option key={p.id} value={p.id}>{p.name}</Option>
              ))}
            </Select>
          </Form.Item>

          {/* 2. File Upload */}
          <Form.Item label="数据文件" required>
            <Dragger
              customRequest={handleUpload}
              fileList={fileList}
              onRemove={handleRemoveFile}
              accept=".xlsx,.xls"
              maxCount={1}
            >
              <p className="ant-upload-drag-icon"><InboxOutlined /></p>
              <p className="ant-upload-text">点击或拖拽 Excel 文件到此区域上传</p>
              <p className="ant-upload-hint">系统将自动解析表头，支持 .xlsx 和 .xls 格式</p>
            </Dragger>
          </Form.Item>

          {/* 3. Column Selection (Visible after upload) */}
          {columns.length > 0 && (
            <div className="bg-blue-50 p-4 rounded mb-4">
              <div className="text-sm text-gray-600 mb-3">✓ 文件解析成功，共发现 {columns.length} 列数据</div>
              <Form.Item name="question_column" label="题目/ID列" required>
                <Select showSearch placeholder="选择题目列" allowClear>
                  {columns.map(c => <Option key={c} value={c}>{c}</Option>)}
                </Select>
              </Form.Item>
              <Form.Item label="需要编码的列" required>
                <Select 
                  mode="multiple" 
                  showSearch 
                  placeholder="选择需要编码的列（可多选）"
                  value={selectedColumns}
                  onChange={handleColumnSelectionChange}
                >
                  {columns.map(c => <Option key={c} value={c}>{c}</Option>)}
                </Select>
              </Form.Item>
            </div>
          )}

          {/* 4. Per-Column Configuration */}
          {selectedColumns.length > 0 && (
            <div className="border border-gray-200 rounded mb-4 bg-gray-50">
              <div className="p-4 border-b bg-white flex justify-between items-center">
                <div>
                  <h4 className="text-sm font-semibold text-gray-700">编码配置</h4>
                  <p className="text-xs text-gray-500 mt-1">为每一列配置独立的编码规则</p>
                </div>
                <div className="space-x-2">
                  <Button 
                    size="small" 
                    onClick={() => {
                      let batchMode = 'open';
                      let batchEngine = 'llm';
                      
                      Modal.confirm({
                        title: '批量配置',
                        width: 500,
                        content: (
                          <div className="space-y-4 mt-4">
                            <div>
                              <label className="block text-sm font-medium mb-2">编码模式</label>
                              <Radio.Group 
                                defaultValue="open"
                                onChange={(e) => { batchMode = e.target.value; }}
                              >
                                <Radio.Button value="open">开放编码</Radio.Button>
                                <Radio.Button value="fixed">固定编码</Radio.Button>
                              </Radio.Group>
                            </div>
                            <div>
                              <label className="block text-sm font-medium mb-2">生成引擎</label>
                              <Radio.Group 
                                defaultValue="llm"
                                onChange={(e) => { batchEngine = e.target.value; }}
                              >
                                <Radio.Button value="llm">LLM 提炼</Radio.Button>
                                <Radio.Button value="bertopic">BERTopic 聚类</Radio.Button>
                              </Radio.Group>
                            </div>
                            <div className="text-xs text-gray-500 bg-blue-50 p-2 rounded">
                              💡 此配置将应用到所有已选择的列
                            </div>
                          </div>
                        ),
                        onOk: () => {
                          handleBatchConfig({ mode: batchMode, engine: batchEngine, maxCodes: 10, codeLibrary: null });
                        },
                        okText: '应用',
                        cancelText: '取消'
                      });
                    }}
                  >
                    批量配置
                  </Button>
                  <Button size="small" type="link" onClick={() => navigate('/code-library')}>
                    管理编码库 →
                  </Button>
                </div>
              </div>
              
              <div className="p-4">
                <Collapse 
                  defaultActiveKey={selectedColumns.length === 1 ? [selectedColumns[0]] : []}
                  className="bg-transparent"
                >
                  {selectedColumns.map((col) => {
                    const config = columnConfigs[col] || {};
                    const status = getConfigStatus(col);
                    return (
                      <Panel
                        key={col}
                        header={
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{col}</span>
                            <div className="flex items-center space-x-2">
                              {status === 'success' ? (
                                <Badge status="success" text="已配置" />
                              ) : status === 'warning' ? (
                                <Badge status="warning" text="需选择编码库" />
                              ) : (
                                <Badge status="error" text="未配置" />
                              )}
                              <Tag color={config.mode === 'fixed' ? 'blue' : 'green'}>
                                {config.mode === 'fixed' ? '固定编码' : '开放编码'}
                              </Tag>
                            </div>
                          </div>
                        }
                        extra={
                          <Tooltip title="复制配置">
                            <Button 
                              type="text" 
                              size="small" 
                              icon={<CopyOutlined />} 
                              onClick={handleCopyConfig(col)}
                            />
                          </Tooltip>
                        }
                      >
                        <div className="space-y-4 pt-2">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">编码模式</label>
                            <Radio.Group 
                              value={config.mode || 'open'}
                              onChange={(e) => handleColumnConfigChange(col, 'mode', e.target.value)}
                              buttonStyle="solid"
                            >
                              <Radio.Button value="open">开放编码</Radio.Button>
                              <Radio.Button value="fixed">固定编码</Radio.Button>
                            </Radio.Group>
                          </div>

                          {config.mode === 'fixed' ? (
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">选择编码库</label>
                              <Select
                                placeholder="选择编码体系"
                                value={config.codeLibrary}
                                onChange={(value) => handleColumnConfigChange(col, 'codeLibrary', value)}
                                style={{ width: '100%' }}
                                loading={codeLibrariesLoading}
                                notFoundContent={codeLibrariesLoading ? '加载中...' : '暂无编码库，请先创建'}
                              >
                                {codeLibraries.map(lib => (
                                  <Option key={lib.name} value={lib.name}>
                                    {lib.name} ({lib.codes.length}个编码)
                                  </Option>
                                ))}
                              </Select>
                              {config.codeLibrary && (
                                <div className="mt-2 text-xs text-gray-500 p-2 bg-blue-50 rounded">
                                  编码: {codeLibraries.find(l => l.name === config.codeLibrary)?.codes.join(', ')}
                                </div>
                              )}
                            </div>
                          ) : (
                            <Row gutter={16}>
                              <Col span={12}>
                                <label className="block text-sm font-medium text-gray-700 mb-2">最大编码数量</label>
                                <InputNumber
                                  min={3}
                                  max={50}
                                  value={config.maxCodes || 10}
                                  onChange={(value) => handleColumnConfigChange(col, 'maxCodes', value)}
                                  style={{ width: '100%' }}
                                />
                              </Col>
                              <Col span={12}>
                                <label className="block text-sm font-medium text-gray-700 mb-2">生成引擎</label>
                                <Radio.Group
                                  value={config.engine || 'llm'}
                                  onChange={(e) => handleColumnConfigChange(col, 'engine', e.target.value)}
                                >
                                  <Radio value="llm">LLM</Radio>
                                  <Radio value="bertopic">BERTopic</Radio>
                                </Radio.Group>
                              </Col>
                            </Row>
                          )}

                          {/* 分类配置区域 */}
                          <div className="border-t pt-4 mt-4">
                            <h5 className="text-sm font-semibold text-gray-700 mb-3">分类配置</h5>
                            
                            {/* 映射字典 */}
                            <div className="mb-4">
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                映射字典 <span className="text-xs text-gray-500">(JSON格式)</span>
                              </label>
                              <Input.TextArea
                                rows={3}
                                placeholder='{"test":"测试","Test":"测试"}'
                                value={config.mappingDict || '{}'}
                                onChange={(e) => handleColumnConfigChange(col, 'mappingDict', e.target.value)}
                                style={{ fontFamily: 'monospace', fontSize: '12px' }}
                              />
                              {(() => {
                                try {
                                  const parsed = JSON.parse(config.mappingDict || '{}');
                                  const keys = Object.keys(parsed);
                                  if (keys.length > 0) {
                                    return (
                                      <div className="mt-1 text-xs text-green-600">
                                        ✓ 已配置 {keys.length} 个映射规则
                                      </div>
                                    );
                                  }
                                } catch (e) {
                                  return (
                                    <div className="mt-1 text-xs text-red-500">
                                      ⚠️ JSON格式错误
                                    </div>
                                  );
                                }
                                return null;
                              })()}
                            </div>

                            {/* 默认分类编码（必填） */}
                            <div className="mb-4">
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                默认分类编码 <span className="text-red-500">*</span>
                              </label>
                              {config.mode === 'fixed' && config.codeLibrary ? (
                                <Select
                                  placeholder="从编码库中选择默认编码"
                                  value={config.defaultCode}
                                  onChange={(value) => handleColumnConfigChange(col, 'defaultCode', value)}
                                  style={{ width: '100%' }}
                                >
                                  {codeLibraries.find(lib => lib.name === config.codeLibrary)?.codes.map(code => (
                                    <Option key={code} value={code}>{code}</Option>
                                  ))}
                                </Select>
                              ) : (
                                <Input
                                  placeholder="输入默认分类编码（如：其他）"
                                  value={config.defaultCode}
                                  onChange={(e) => handleColumnConfigChange(col, 'defaultCode', e.target.value)}
                                />
                              )}
                            </div>

                            {/* 分类配置模式 */}
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">分类策略</label>
                              <Select
                                value={config.classificationMode || (config.mode === 'fixed' ? 'fixed_then_default' : 'open_then_default')}
                                onChange={(value) => handleColumnConfigChange(col, 'classificationMode', value)}
                                style={{ width: '100%' }}
                              >
                                {config.mode === 'fixed' ? (
                                  <>
                                    <Option value="fixed_then_default">
                                      🎯 确定性匹配 → 未匹配归入默认编码
                                    </Option>
                                    <Option value="fixed_then_ai">
                                      🤖 确定性匹配 → 未匹配用AI分类（批量处理）
                                    </Option>
                                  </>
                                ) : (
                                  <>
                                    <Option value="open_then_default">
                                      🎯 AI生成编码 → 确定性匹配 → 未匹配归入默认编码
                                    </Option>
                                    <Option value="open_then_ai">
                                      🤖 AI生成编码 → 确定性匹配 → 未匹配用AI分类
                                    </Option>
                                  </>
                                )}
                              </Select>
                              <div className="mt-2 text-xs text-gray-600 p-2 bg-gray-50 rounded">
                                {(() => {
                                  const mode = config.classificationMode || (config.mode === 'fixed' ? 'fixed_then_default' : 'open_then_default');
                                  const descriptions = {
                                    'fixed_then_default': '💡 先用固定编码和映射字典进行精确匹配，未匹配的数据全部归入默认编码（快速、确定性）',
                                    'fixed_then_ai': '💡 先用固定编码和映射字典进行精确匹配，未匹配的数据用AI批量分类（50条/批，多线程并发）',
                                    'open_then_default': '💡 AI先生成编码库，然后用生成的编码和映射字典匹配，未匹配的归入默认编码',
                                    'open_then_ai': '💡 AI先生成编码库，然后用生成的编码和映射字典匹配，未匹配的用AI批量分类',
                                    // 向后兼容旧模式
                                    'ai_only': '💡 完全由AI根据文本内容自动生成编码并分类',
                                    'fixed_mapping_only': '💡 仅使用固定编码库和映射字典进行匹配',
                                    'mapping_then_ai': '💡 先用映射字典匹配，未匹配的文本交给AI分类',
                                    'mapping_then_default': '💡 先用映射字典匹配，未匹配的全部归入默认编码',
                                    'fixed_mapping_then_default': '💡 先用固定编码和映射字典匹配，未匹配的归入默认',
                                    'fixed_mapping_then_ai': '💡 先用固定编码和映射字典匹配，未匹配的交给AI'
                                  };
                                  return descriptions[mode] || '';
                                })()}
                              </div>
                            </div>
                          </div>
                        </div>
                      </Panel>
                    );
                  })}
                </Collapse>
              </div>
            </div>
          )}

          {selectedColumns.length === 0 && (
            <div className="text-center py-8 text-gray-400 border border-dashed border-gray-300 rounded mb-4">
              请先上传文件并选择需要编码的列
            </div>
          )}

          {/* 6. Additional Options */}
          <Form.Item name="generate_charts" label="生成可视化图表" valuePropName="checked" initialValue={true}>
            <Switch checkedChildren="开启" unCheckedChildren="关闭" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default CodingPage;
