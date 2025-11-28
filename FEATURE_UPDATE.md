# 功能更新：每列独立配置编码模式

## 更新内容

### 前端改进 (CodingPage.jsx)

1. **数据结构重构**
   - `columnCodeMapping` → `columnConfigs`
   - 每列独立存储：`{mode, engine, maxCodes, codeLibrary}`

2. **UI 优化**
   - ✅ 使用 Collapse 折叠面板展示多列配置
   - ✅ 每列卡片显示配置状态 Badge（已配置/需选择编码库/未配置）
   - ✅ 支持批量配置：一键应用同一设置到所有列
   - ✅ 支持复制配置：快速复制单列配置
   - ✅ 自动验证：固定模式检查编码库，开放模式检查参数

3. **新增功能**
   - 批量配置弹窗：选择模式和引擎，应用到所有列
   - 配置状态可视化：绿色徽章（已配置）/橙色（警告）/红色（错误）
   - 配置复制：点击复制按钮将配置复制到剪贴板

### 后端改进 (tasks.py)

1. **数据模型更新**
   ```python
   class ColumnConfig(BaseModel):
       mode: str  # "fixed" or "open"
       engine: Optional[str] = "llm"
       max_codes: Optional[int] = 10
       codes: Optional[List[Dict[str, str]]] = []
   
   class TaskRequest(BaseModel):
       column_configs: Dict[str, ColumnConfig]  # 每列独立配置
   ```

2. **处理逻辑优化**
   - 每列从 `column_configs[column_name]` 读取独立配置
   - 支持每列使用不同的编码模式（开放/固定）
   - 支持每列使用不同的引擎（LLM/BERTopic）
   - 进度显示包含列名和配置模式

## 使用场景

### 场景 1：混合编码模式
- 问题1（满意度）：固定编码 → 使用预设的 5 级满意度
- 问题2（开放反馈）：开放编码 (LLM) → AI 自动提炼主题
- 问题3（产品评价）：开放编码 (BERTopic) → 聚类发现模式

### 场景 2：批量开放编码
- 选择 10 列开放题
- 点击"批量配置"
- 选择"开放编码 + LLM"
- 一键应用到所有列

### 场景 3：大量列配置
- 选择 15 列
- 使用 Collapse 折叠面板，默认全部折叠
- 逐个展开需要修改的列进行配置
- 使用配置状态徽章快速识别未完成的配置

## 技术优势

1. **灵活性**：每列独立配置，满足复杂问卷需求
2. **效率**：批量配置减少重复操作
3. **可维护性**：配置状态可视化，易于检查
4. **扩展性**：为未来添加更多配置项（采样率、提示词模板等）打下基础

## API 变更

### 旧格式
```json
{
  "columns_to_code": ["Q1", "Q2"],
  "mode": "open",
  "engine": "llm",
  "max_codes": 10
}
```

### 新格式
```json
{
  "column_configs": {
    "Q1": {
      "mode": "fixed",
      "codes": [{"code": "满意", "description": "满意"}]
    },
    "Q2": {
      "mode": "open",
      "engine": "llm",
      "max_codes": 10
    }
  }
}
```
