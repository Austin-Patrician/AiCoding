# 分类配置功能完整实现

## ✅ 已完成功能

### 前端实现 (CodingPage.jsx)

#### 1. 数据结构扩展
为每列添加三个新配置字段：
```javascript
{
  mode: 'open',
  engine: 'llm',
  maxCodes: 10,
  codeLibrary: null,
  mappingDict: '{}',          // 新增：映射字典
  defaultCode: '',             // 新增：默认分类编码（必填）
  classificationMode: 'ai_only' // 新增：分类配置模式
}
```

#### 2. 分类配置UI组件

**映射字典输入区域**
- JSON格式输入框（monospace字体）
- 实时格式验证（绿色✓/红色⚠️）
- 显示已配置映射规则数量
- 示例：`{"test":"测试","Test":"测试"}`

**默认分类编码（必填）**
- 固定模式：从编码库下拉选择
- 开放模式：手动输入文本
- 必填验证，未填写显示警告状态

**分类配置模式选择器**
6种模式可选，每种模式有详细说明：

| 模式代码 | 模式名称 | 说明 | 适用场景 |
|---------|---------|------|---------|
| `fixed_mapping_only` | 模式1：仅固定编码+映射字典 | 仅使用固定编码库和映射字典匹配 | 仅固定模式可选 |
| `ai_only` | 模式2：全部采用AI编码 | 完全由AI自动生成编码 | 默认模式 |
| `mapping_then_ai` | 模式3：映射字典→剩余AI | 先字典匹配，未匹配交AI | 半自动化场景 |
| `mapping_then_default` | 模式4：映射字典→剩余默认 | 先字典匹配，未匹配归默认 | 简化分类 |
| `fixed_mapping_then_default` | 模式5：固定+映射→剩余默认 | 先固定编码和字典，未匹配归默认 | 确定性分类 |
| `fixed_mapping_then_ai` | 模式6：固定+映射→剩余AI | 先固定编码和字典，未匹配交AI | 混合策略 |

#### 3. 验证逻辑增强
```javascript
// 验证必填项
if (!config.defaultCode) {
  invalidColumns.push(`${col}: 未设置默认分类编码`);
}

// 验证JSON格式
if (config.mappingDict && config.mappingDict !== '{}') {
  try {
    JSON.parse(config.mappingDict);
  } catch (e) {
    invalidColumns.push(`${col}: 映射字典JSON格式错误`);
  }
}
```

#### 4. Payload构建
```javascript
columnConfigsPayload[col] = {
  mode: config.mode,
  engine: config.engine || 'llm',
  max_codes: config.maxCodes || 10,
  codes: [],
  mapping_dict: mappingDict,           // 解析后的字典对象
  default_code: config.defaultCode,    // 默认编码
  classification_mode: config.classificationMode // 分类模式
};
```

### 后端实现 (tasks.py)

#### 1. 数据模型更新
```python
class ColumnConfig(BaseModel):
    mode: str
    engine: Optional[str] = "llm"
    max_codes: Optional[int] = 10
    codes: Optional[List[Dict[str, str]]] = []
    mapping_dict: Optional[Dict[str, str]] = {}      # 新增
    default_code: Optional[str] = ""                  # 新增
    classification_mode: Optional[str] = "ai_only"    # 新增
```

#### 2. 结果记录
处理结果中包含完整配置信息：
```python
all_results[column_name] = {
    "codes": current_codes,
    "results": column_results,
    "config": {
        "mode": col_config.mode,
        "engine": col_config.engine,
        "max_codes": col_config.max_codes,
        "mapping_dict": col_config.mapping_dict,
        "default_code": col_config.default_code,
        "classification_mode": col_config.classification_mode
    }
}
```

## 使用示例

### 场景1：固定编码+映射字典+默认兜底
```javascript
config = {
  mode: 'fixed',
  codeLibrary: '满意度评价',
  mappingDict: '{"很好":"非常满意","还行":"一般","不行":"不满意"}',
  defaultCode: '其他',
  classificationMode: 'fixed_mapping_then_default'
}
```
**工作流程：**
1. 检查是否在固定编码库中（非常满意/满意/一般/不满意/非常不满意）
2. 检查映射字典（"很好"→"非常满意"）
3. 未匹配的全部归入"其他"

### 场景2：纯AI编码
```javascript
config = {
  mode: 'open',
  engine: 'llm',
  maxCodes: 10,
  mappingDict: '{}',
  defaultCode: '其他',
  classificationMode: 'ai_only'
}
```
**工作流程：**
1. AI自动提取10个主题编码
2. AI对所有文本分类

### 场景3：映射优先+AI补充
```javascript
config = {
  mode: 'open',
  engine: 'llm',
  maxCodes: 8,
  mappingDict: '{"产品质量":"质量问题","服务态度":"服务问题"}',
  defaultCode: '其他',
  classificationMode: 'mapping_then_ai'
}
```
**工作流程：**
1. 先用映射字典匹配常见问题
2. 未匹配的交给AI生成编码并分类
3. 仍无法分类的归入"其他"

## UI截图说明

**配置面板展示：**
```
┌─────────────────────────────────────────┐
│ 编码配置                      [批量配置] │
├─────────────────────────────────────────┤
│ ▼ Q1_满意度评价   [✓已配置] [固定编码] │
│   ├─ 编码模式: ⚪开放 ⚫固定             │
│   ├─ 编码库: 满意度评价                 │
│   ├─ ──────────────────────────         │
│   ├─ 分类配置                           │
│   ├─ 映射字典: {"好":"满意"}            │
│   ├─           ✓ 已配置 1 个映射规则    │
│   ├─ 默认编码: [其他 ▼]                 │
│   └─ 分类模式: [模式5: 固定+映射→默认▼]│
│                💡 先用固定编码和...     │
└─────────────────────────────────────────┘
```

## API请求格式

```json
{
  "project_id": "mock-p1",
  "file_id": "abc-123",
  "question_column": "题目",
  "column_configs": {
    "Q1_满意度": {
      "mode": "fixed",
      "engine": "llm",
      "max_codes": 10,
      "codes": [
        {"code": "非常满意", "description": "非常满意"},
        {"code": "满意", "description": "满意"}
      ],
      "mapping_dict": {
        "很好": "非常满意",
        "还行": "一般"
      },
      "default_code": "其他",
      "classification_mode": "fixed_mapping_then_default"
    },
    "Q2_开放反馈": {
      "mode": "open",
      "engine": "llm",
      "max_codes": 8,
      "codes": [],
      "mapping_dict": {},
      "default_code": "其他",
      "classification_mode": "ai_only"
    }
  },
  "generate_charts": true
}
```

## 后续算法实现建议

每种分类模式需要在后端实现对应的分类算法：

### 模式1：fixed_mapping_only
```python
def classify_fixed_mapping_only(text, codes, mapping_dict):
    # 1. 检查映射字典
    if text in mapping_dict:
        return mapping_dict[text]
    
    # 2. 检查固定编码（关键词匹配）
    for code in codes:
        if code['code'] in text:
            return code['code']
    
    # 3. 无匹配则抛出异常
    raise ValueError(f"No match found for: {text}")
```

### 模式2：ai_only
```python
async def classify_ai_only(text, codes):
    # 完全使用LLM分类
    return await classify_text_with_codes(text, codes)
```

### 模式3：mapping_then_ai
```python
async def classify_mapping_then_ai(text, codes, mapping_dict):
    # 1. 先映射字典
    if text in mapping_dict:
        return mapping_dict[text]
    
    # 2. 未匹配交AI
    return await classify_text_with_codes(text, codes)
```

### 模式4：mapping_then_default
```python
def classify_mapping_then_default(text, mapping_dict, default_code):
    # 1. 映射字典匹配
    if text in mapping_dict:
        return mapping_dict[text]
    
    # 2. 未匹配归默认
    return default_code
```

### 模式5：fixed_mapping_then_default
```python
def classify_fixed_mapping_then_default(text, codes, mapping_dict, default_code):
    # 1. 映射字典
    if text in mapping_dict:
        return mapping_dict[text]
    
    # 2. 固定编码关键词匹配
    for code in codes:
        if code['code'] in text:
            return code['code']
    
    # 3. 归默认
    return default_code
```

### 模式6：fixed_mapping_then_ai
```python
async def classify_fixed_mapping_then_ai(text, codes, mapping_dict):
    # 1. 映射字典
    if text in mapping_dict:
        return mapping_dict[text]
    
    # 2. 固定编码关键词匹配
    for code in codes:
        if code['code'] in text:
            return code['code']
    
    # 3. AI分类
    return await classify_text_with_codes(text, codes)
```

## 技术亮点

1. **灵活性**：每列独立配置分类策略
2. **智能验证**：实时JSON格式检查，必填项验证
3. **用户友好**：详细的模式说明，智能的UI交互
4. **可扩展性**：易于添加新的分类模式
5. **数据完整性**：完整记录配置信息用于审计和重现

## 测试建议

1. 测试映射字典JSON格式验证
2. 测试不同分类模式的切换
3. 测试固定/开放模式的默认编码UI切换
4. 测试批量配置功能
5. 测试必填项验证逻辑
