import React, { useState, useEffect } from 'react';
import { 
  Table, Button, Card, Tag, Descriptions, 
  Typography, Space, Divider, Empty 
} from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';

const { Title, Text, Paragraph } = Typography;

const AntiCheatingResultPage = () => {
  const { taskId } = useParams();
  const navigate = useNavigate();
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchResults();
  }, [taskId]);

  const fetchResults = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/anti-cheating/results/${taskId}`);
      setResults(response.data);
    } catch (error) {
      console.error('Failed to fetch results', error);
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: '题目ID',
      dataIndex: 'question_id',
      key: 'question_id',
      width: 120,
    },
    {
      title: '相似度',
      dataIndex: 'similarity',
      key: 'similarity',
      width: 100,
      render: (val) => {
        let color = 'green';
        if (val > 0.9) color = 'red';
        else if (val > 0.8) color = 'orange';
        return <Tag color={color}>{(val * 100).toFixed(1)}%</Tag>;
      },
      sorter: (a, b) => a.similarity - b.similarity,
      defaultSortOrder: 'descend',
    },
    {
      title: '用户 A',
      dataIndex: 'user1_id',
      key: 'user1_id',
      width: 120,
    },
    {
      title: '用户 B',
      dataIndex: 'user2_id',
      key: 'user2_id',
      width: 120,
    },
    {
      title: '内容对比',
      key: 'content',
      render: (_, record) => (
        <div className="grid grid-cols-2 gap-4 text-xs">
          <div className="bg-red-50 p-2 rounded border border-red-100">
            <Text type="secondary" className="block mb-1">用户 {record.user1_id}:</Text>
            <Paragraph ellipsis={{ rows: 3, expandable: true, symbol: '展开' }}>
              {record.content1}
            </Paragraph>
          </div>
          <div className="bg-red-50 p-2 rounded border border-red-100">
            <Text type="secondary" className="block mb-1">用户 {record.user2_id}:</Text>
            <Paragraph ellipsis={{ rows: 3, expandable: true, symbol: '展开' }}>
              {record.content2}
            </Paragraph>
          </div>
        </div>
      )
    }
  ];

  return (
    <div className="p-6">
      <div className="mb-6">
        <Button 
          icon={<ArrowLeftOutlined />} 
          onClick={() => navigate('/anti-cheating')}
          className="mb-4"
        >
          返回列表
        </Button>
        <Title level={2}>检测结果详情</Title>
        <Text type="secondary">共发现 {results.length} 对疑似作弊回答</Text>
      </div>

      <Card>
        <Table 
          columns={columns} 
          dataSource={results} 
          rowKey="id" 
          loading={loading}
          pagination={{ pageSize: 20 }}
          locale={{ emptyText: <Empty description="未发现疑似作弊记录" /> }}
        />
      </Card>
    </div>
  );
};

export default AntiCheatingResultPage;
