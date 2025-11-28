import { Card, Radio, Button, Input, List, message, Spin, Space, Switch } from 'antd';
import { useState } from 'react';
import axios from 'axios';

const API_BASE_URL = 'http://127.0.0.1:8000/api/v1';

const ConfigurationPage = ({ fileId, columnName, onNext }) => {
  const [mode, setMode] = useState('fixed'); // 'fixed' or 'open'
  const [engine, setEngine] = useState('llm'); // 'llm' or 'bertopic'
  const [codes, setCodes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [newCode, setNewCode] = useState('');

  const handleAddCode = () => {
    if (newCode.trim()) {
      setCodes([...codes, { code: newCode, description: '' }]);
      setNewCode('');
    }
  };

  const handleExtractCodes = async () => {
    setLoading(true);
    try {
      const endpoint = engine === 'llm' ? '/analysis/extract/llm' : '/analysis/extract/bertopic';
      const response = await axios.post(`${API_BASE_URL}${endpoint}`, {
        file_id: fileId,
        column_name: columnName,
        sample_size: 50
      });
      setCodes(response.data.suggestions);
      message.success('Codes extracted successfully!');
    } catch (error) {
      console.error(error);
      message.error('Failed to extract codes.');
    } finally {
      setLoading(false);
    }
  };

  const handleStartAnalysis = () => {
    if (codes.length === 0) {
      message.warning('Please define at least one code.');
      return;
    }
    onNext({ mode, engine, codes });
  };

  return (
    <div style={{ padding: '24px', maxWidth: '800px', margin: '0 auto' }}>
      <Card title="Configure Analysis">
        <div style={{ marginBottom: '24px' }}>
          <h3>1. Select Coding Mode</h3>
          <Radio.Group value={mode} onChange={e => setMode(e.target.value)}>
            <Radio.Button value="fixed">Fixed Coding (Manual)</Radio.Button>
            <Radio.Button value="open">Open Coding (AI Discovery)</Radio.Button>
          </Radio.Group>
        </div>

        {mode === 'open' && (
          <div style={{ marginBottom: '24px' }}>
            <h3>2. Select Discovery Engine</h3>
            <Radio.Group value={engine} onChange={e => setEngine(e.target.value)}>
              <Radio.Button value="llm">LLM (OpenAI)</Radio.Button>
              <Radio.Button value="bertopic">Clustering (BERTopic)</Radio.Button>
            </Radio.Group>
            <p style={{ color: '#666', marginTop: '8px' }}>
              {engine === 'llm' 
                ? 'Uses GPT to understand semantics and suggest themes. Better for small datasets and nuanced understanding.' 
                : 'Uses BAAI/bge-small-zh-v1.5 embeddings and clustering. Better for large datasets and finding structural patterns.'}
            </p>
            <Button type="primary" onClick={handleExtractCodes} loading={loading}>
              Extract Codes with AI
            </Button>
          </div>
        )}

        <div style={{ marginBottom: '24px' }}>
          <h3>{mode === 'open' ? '3. Review & Edit Codes' : '2. Define Codes'}</h3>
          <Space.Compact style={{ width: '100%', marginBottom: '16px' }}>
            <Input 
              placeholder="Enter code name (e.g., Positive Feedback)" 
              value={newCode}
              onChange={e => setNewCode(e.target.value)}
              onPressEnter={handleAddCode}
            />
            <Button type="primary" onClick={handleAddCode}>Add</Button>
          </Space.Compact>
          
          <List
            bordered
            dataSource={codes}
            renderItem={(item, index) => (
              <List.Item
                actions={[<a key="delete" onClick={() => {
                  const newCodes = [...codes];
                  newCodes.splice(index, 1);
                  setCodes(newCodes);
                }}>Delete</a>]}
              >
                <List.Item.Meta
                  title={item.code}
                  description={item.description}
                />
              </List.Item>
            )}
          />
        </div>

        <div style={{ textAlign: 'right' }}>
          <Button type="primary" size="large" onClick={handleStartAnalysis}>
            Start Analysis
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default ConfigurationPage;
