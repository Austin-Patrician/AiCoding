import React, { useState, useMemo } from 'react';
import { Modal, Spin, Tabs, Button, message, Select } from 'antd';
import { 
  RobotOutlined, ClusterOutlined, ClockCircleOutlined,
  FileTextOutlined, BarChartOutlined, DownloadOutlined,
  UnorderedListOutlined, AppstoreOutlined, ExportOutlined,
  TableOutlined
} from '@ant-design/icons';
import * as XLSX from 'xlsx';
import api from '../services/api';

const ClusterResultModal = ({ 
  visible, 
  onCancel, 
  result,   // 单个结果 (兼容旧调用)
  results,  // 多个结果数组 (多列分析)
  loading 
}) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [openingDetail, setOpeningDetail] = useState(false);
  const [selectedColumnIndex, setSelectedColumnIndex] = useState(0);

  // 统一处理：将单个结果转为数组
  const allResults = useMemo(() => {
    if (results && results.length > 0) return results;
    if (result) return [result];
    return [];
  }, [result, results]);

  // 当前选中的列的结果
  const currentResult = allResults[selectedColumnIndex] || null;

  // 重置选中列索引
  React.useEffect(() => {
    if (visible) {
      setSelectedColumnIndex(0);
      setActiveTab('overview');
    }
  }, [visible]);

  if (!visible) return null;

  // 导出 Excel
  const handleExport = () => {
    if (!currentResult?.classified_data) {
      message.warning('没有可导出的分类数据');
      return;
    }

    const themes = Object.keys(currentResult.classified_data);
    const maxLength = Math.max(...themes.map(t => currentResult.classified_data[t].length));

    const rows = [];
    for (let i = 0; i < maxLength; i++) {
      const row = {};
      themes.forEach(theme => {
        row[theme] = currentResult.classified_data[theme][i] || '';
      });
      rows.push(row);
    }

    const ws = XLSX.utils.json_to_sheet(rows, { header: themes });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '分类结果');
    
    const fileName = `${currentResult.column_name}_分类结果_${new Date().toLocaleDateString().replace(/\//g, '-')}.xlsx`;
    XLSX.writeFile(wb, fileName);
    message.success('导出成功');
  };

  // 在新标签页打开分类详情
  const handleOpenDetailPage = async () => {
    if (!currentResult?.classified_data) {
      message.warning('没有可查看的分类数据');
      return;
    }

    setOpeningDetail(true);
    try {
      const res = await api.post('/workshop/classified-data/cache', {
        classified_data: currentResult.classified_data,
        meta: {
          column_name: currentResult.column_name,
          file_name: currentResult.file_name,
          engine: currentResult.engine,
          sample_size: currentResult.sample_size,
          created_at: currentResult.created_at
        }
      });
      
      const cacheId = res.data.cache_id;
      window.open(`/classification-detail?id=${cacheId}`, '_blank');
    } catch (err) {
      console.error('缓存数据失败:', err);
      message.error('打开详情页失败，请重试');
    } finally {
      setOpeningDetail(false);
    }
  };

  // 主题概览视图
  const renderOverviewTab = () => (
    <div className="max-h-[420px] overflow-y-auto space-y-3 pr-1">
      {currentResult?.results?.map((item, index) => (
        <div 
          key={index} 
          className="p-4 bg-white border border-gray-100 rounded-xl hover:border-gray-200 hover:shadow-sm transition-all"
        >
          <div className="flex items-start gap-3">
            <div className={`
              w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs font-semibold
              ${currentResult.engine === 'llm' ? 'bg-blue-100 text-blue-600' : 'bg-violet-100 text-violet-600'}
            `}>
              {index + 1}
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="font-medium text-gray-800 mb-1">{item.code}</div>
              <div className="text-sm text-gray-500 mb-3">{item.description}</div>
              
              {item.keywords && item.keywords.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {item.keywords.slice(0, 8).map((kw, i) => (
                    <span 
                      key={i} 
                      className="inline-flex items-center px-2.5 py-1 bg-gray-50 border border-gray-100 rounded-full text-xs text-gray-600"
                    >
                      {kw}
                    </span>
                  ))}
                  {item.keywords.length > 8 && (
                    <span className="inline-flex items-center px-2.5 py-1 bg-gray-50 border border-gray-100 rounded-full text-xs text-gray-400">
                      +{item.keywords.length - 8}
                    </span>
                  )}
                </div>
              )}
            </div>
            
            {item.count != null && (
              <div className="shrink-0">
                <div className="px-2.5 py-1 bg-green-50 border border-green-100 rounded-full text-xs font-medium text-green-600">
                  {item.count} 条
                </div>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );

  // 分类详情入口
  const renderClassifiedTab = () => {
    if (!currentResult?.classified_data) {
      return (
        <div className="py-16 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
            <UnorderedListOutlined className="text-2xl text-gray-400" />
          </div>
          <p className="text-gray-500">分类详情数据不可用</p>
          <p className="text-sm text-gray-400 mt-1">可能已过期（30天）或缓存服务异常</p>
        </div>
      );
    }

    const stats = Object.entries(currentResult.classified_data).map(([theme, texts]) => ({
      theme,
      count: texts.length,
      percentage: (texts.length / Object.values(currentResult.classified_data).reduce((a, b) => a + b.length, 0) * 100).toFixed(1)
    })).sort((a, b) => b.count - a.count);

    const totalCount = stats.reduce((sum, s) => sum + s.count, 0);

    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-500">
            共 {stats.length} 个分类，{totalCount} 条数据
          </span>
          <div className="flex gap-2">
            <Button 
              icon={<DownloadOutlined />}
              onClick={handleExport}
              className="!rounded-lg"
            >
              导出 Excel
            </Button>
            <Button 
              type="primary" 
              icon={<ExportOutlined />}
              onClick={handleOpenDetailPage}
              loading={openingDetail}
              className="!rounded-lg !bg-blue-500 hover:!bg-blue-600"
            >
              在新标签页查看
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 max-h-[340px] overflow-y-auto pr-1">
          {stats.map((item, idx) => (
            <div 
              key={item.theme}
              className="p-4 border border-gray-100 rounded-xl bg-white hover:border-gray-200 transition-all"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={`
                    w-6 h-6 rounded-lg flex items-center justify-center text-xs font-semibold
                    ${currentResult.engine === 'llm' ? 'bg-blue-100 text-blue-600' : 'bg-violet-100 text-violet-600'}
                  `}>
                    {idx + 1}
                  </span>
                  <span className="font-medium text-gray-700 truncate max-w-[120px]" title={item.theme}>
                    {item.theme}
                  </span>
                </div>
                <span className="text-xs text-gray-400">{item.percentage}%</span>
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all ${
                    currentResult.engine === 'llm' ? 'bg-blue-400' : 'bg-violet-400'
                  }`}
                  style={{ width: `${item.percentage}%` }}
                />
              </div>
              <div className="mt-2 text-sm text-gray-500">{item.count} 条</div>
            </div>
          ))}
        </div>

        <p className="text-xs text-gray-400 text-center pt-2">
          点击「在新标签页查看」可查看完整图表和数据明细
        </p>
      </div>
    );
  };

  return (
    <Modal
      title={
        currentResult && (
          <div className="flex items-center gap-3">
            <div className={`
              w-9 h-9 rounded-xl flex items-center justify-center shadow-sm
              ${currentResult.engine === 'llm' 
                ? 'bg-gradient-to-br from-blue-500 to-blue-600' 
                : 'bg-gradient-to-br from-violet-500 to-violet-600'
              }
            `}>
              {currentResult.engine === 'llm' 
                ? <RobotOutlined className="text-white text-base" /> 
                : <ClusterOutlined className="text-white text-base" />
              }
            </div>
            <div>
              <div className="text-base font-semibold text-gray-800 flex items-center gap-2">
                {allResults.length > 1 ? '多列分析结果' : `${currentResult.engine === 'llm' ? 'LLM' : 'BERTopic'} 分析结果`}
                <span className={`
                  inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium
                  ${currentResult.engine === 'llm' ? 'bg-blue-100 text-blue-600' : 'bg-violet-100 text-violet-600'}
                `}>
                  {currentResult.results?.length || 0} 个主题
                </span>
              </div>
              <div className="text-xs font-normal text-gray-400">
                {allResults.length > 1 ? `共 ${allResults.length} 列` : currentResult.column_name}
              </div>
            </div>
          </div>
        )
      }
      open={visible}
      onCancel={onCancel}
      width={780}
      footer={null}
      className="cluster-result-modal"
    >
      {loading ? (
        <div className="py-16 flex flex-col items-center">
          <Spin size="large" />
          <p className="mt-4 text-gray-400">加载中...</p>
        </div>
      ) : currentResult ? (
        <div>
          {/* 多列时显示列选择器 */}
          {allResults.length > 1 && (
            <div className="mb-4 p-3 bg-blue-50/50 rounded-xl border border-blue-100">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <TableOutlined className="text-blue-500" />
                  <span>选择列：</span>
                </div>
                <div className="flex-1 flex flex-wrap gap-2">
                  {allResults.map((r, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedColumnIndex(idx)}
                      className={`
                        inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-all
                        ${selectedColumnIndex === idx 
                          ? 'bg-blue-500 text-white shadow-sm' 
                          : 'bg-white text-gray-600 border border-gray-200 hover:border-blue-300'
                        }
                      `}
                    >
                      <span className={`
                        w-5 h-5 rounded flex items-center justify-center text-xs font-medium
                        ${selectedColumnIndex === idx 
                          ? 'bg-white/20 text-white' 
                          : r.engine === 'llm' ? 'bg-blue-100 text-blue-600' : 'bg-violet-100 text-violet-600'
                        }
                      `}>
                        {idx + 1}
                      </span>
                      <span className="max-w-[100px] truncate">{r.column_name}</span>
                      <span className={`
                        text-xs px-1.5 py-0.5 rounded
                        ${selectedColumnIndex === idx 
                          ? 'bg-white/20' 
                          : r.engine === 'llm' ? 'bg-blue-50 text-blue-500' : 'bg-violet-50 text-violet-500'
                        }
                      `}>
                        {r.results?.length || 0}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Meta Info Card */}
          <div className="mb-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
              <span className="inline-flex items-center gap-2 text-gray-600">
                <FileTextOutlined className="text-gray-400" />
                {currentResult.file_name}
              </span>
              {allResults.length > 1 && (
                <span className="inline-flex items-center gap-2 text-gray-600">
                  <TableOutlined className="text-gray-400" />
                  {currentResult.column_name}
                </span>
              )}
              <span className="inline-flex items-center gap-2 text-gray-600">
                {currentResult.engine === 'llm' ? <RobotOutlined className="text-blue-400" /> : <ClusterOutlined className="text-violet-400" />}
                {currentResult.engine === 'llm' ? 'LLM' : 'BERTopic'}
              </span>
              <span className="inline-flex items-center gap-2 text-gray-600">
                <BarChartOutlined className="text-gray-400" />
                {currentResult.sample_size === -1 ? '全量数据' : `${currentResult.sample_size} 条样本`}
              </span>
              <span className="inline-flex items-center gap-2 text-gray-500">
                <ClockCircleOutlined className="text-gray-400" />
                {new Date(currentResult.created_at).toLocaleString()}
              </span>
            </div>
          </div>

          {/* Tabs */}
          <Tabs 
            activeKey={activeTab} 
            onChange={setActiveTab}
            items={[
              {
                key: 'overview',
                label: (
                  <span className="flex items-center gap-1.5">
                    <AppstoreOutlined />
                    主题概览
                  </span>
                ),
                children: renderOverviewTab()
              },
              {
                key: 'classified',
                label: (
                  <span className="flex items-center gap-1.5">
                    <UnorderedListOutlined />
                    分类详情
                    {currentResult?.classified_data && (
                      <span className="ml-1 px-1.5 py-0.5 bg-blue-100 text-blue-600 rounded text-xs font-medium">
                        新
                      </span>
                    )}
                  </span>
                ),
                children: renderClassifiedTab()
              }
            ]}
          />
        </div>
      ) : null}
    </Modal>
  );
};

export default ClusterResultModal;
