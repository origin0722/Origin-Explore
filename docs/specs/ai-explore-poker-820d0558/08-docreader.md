# 08 — DocReader（本地文档库 + 分栏阅读器 + 划词问 AI）

文件: `src/components/sites/ai-explore-poker-820d0558/doc-reader.tsx`（"use client"）
**单文件导出 2 个组件**: `DocLibrary`（文档库视图）+ `DocReader`（分栏阅读器）
Shell 按 useApp().activeDocId 切换: `"__library__"` → DocLibrary; `doc-xxx` → DocReader; null → 聊天/欢迎

## 依赖
- doc-parser.ts: extractTextFromFile(file)→{kind,content} / kindFromName / kindLabel / isParseable / ACCEPTED_EXTENSIONS
- term-detect.ts: detectTerms(text, limit?)→TermCandidate[]{term,score,kind}
- mock.ts: GLOSSARY（词典解释）/ findTerm / genericTermSummary; useApp(): documents/addDocument/removeDocument/activeDocId/setActiveDocId/openDocQuestion/termStates/markTermState

## DocLibrary（主区全宽视图, 顶部工具栏 + 网格/列表）
```
<div className="h-full w-full flex flex-col">
  ├─ 工具栏（px-6 py-4 border-b border-divider flex items-center justify-between）:
  │   <h2 className="text-lg font-bold">本地文档</h2>
  │   <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-btn-std hover:bg-btn-std-hover rounded-full text-sm">
  │     <Upload size 15/> 上传文档
  │     <input type="file" className="hidden" accept=".pdf,.docx,.md,.markdown,.txt,.html,.htm" multiple
  │            onChange={handleFiles}/>
  │   </label>
  ├─ 空态（无 documents）: flex-1 居中（FileText size 40 text-text-quaternary + 文案 "还没有文档" +
  │     "支持 PDF / Word / Markdown / TXT / HTML，解析全部在本地完成" text-text-tertiary text-sm）
  └─ 列表（flex-1 overflow-y-auto scrollbar-card-std px-6 py-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3）:
      documents.map:
      <div className="group bg-card-std rounded-2xl border border-std p-4 hover:border-brand/40 transition-colors cursor-pointer"
           onClick={() => setActiveDocId(doc.id)}>
        <div className="flex items-start justify-between gap-2">
          <span kind 徽章 text-[10px] rounded px-1.5 py-0.5 border border-std text-text-tertiary>{kindLabel(doc.kind)}</span>
          <button Trash2 size 14 text-text-quaternary hover:text-destructive opacity-0 group-hover:opacity-100
                  onClick={(e)=>{e.stopPropagation(); removeDocument(doc.id)}}/>
        </div>
        <p className="mt-2 text-sm font-semibold truncate">{doc.name}</p>
        <p className="text-[10px] text-text-quaternary mt-1">{(doc.content.length/1000).toFixed(1)}k 字符 · {日期}</p>
      </div>
```
- handleFiles: for each file → extractTextFromFile → isParseable? addDocument({id, name, kind, content, addedAt}) : toast"文件解析为空"
  （显示解析中状态: 按钮内 Loader2 animate-spin; 逐文件顺序处理）

## DocReader（分栏: 左侧论文文本 + 右侧问答列）
```
<div className="h-full w-full flex flex-col">
  ├─ 工具栏（h-12 px-4 border-b border-divider flex items-center gap-3）:
  │   <button 返回（ArrowLeft size 16）→ setActiveDocId("__library__")>
  │   <span className="text-sm font-semibold truncate">{doc.name}</span>
  │   <span kind 徽章/>
  │   <span 右侧统计 text-xs text-text-quaternary>已识别 {terms.length} 个术语</span>
  ├─ 正文区（flex-1 overflow-y-auto scrollbar-card-std px-6 py-6）: <div className="max-w-[760px] mx-auto">
  │    <h1 className="text-xl font-bold mb-4">{doc.name}</h1>
  │    渲染 <HighlightedText text={doc.content} terms={terms}/>（见下）
  └─ 右侧问答列（absolute? 用 flex: 桌面 w-[420px] border-l border-divider bg-bg/40; 移动端 fixed bottom-0 抽屉）
```
**分栏实现（桌面）**: 正文 flex-1 + 问答列 w-[420px]（外层 flex; 问答列可折叠: 顶部 ChevronRight 窄条 20px 收起/展开）
**移动端**: 正文全宽; 问答列 = fixed inset-x-0 bottom-0 top-1/3 z-30 bg-modal-std rounded-t-2xl shadow-card 底部抽屉
（点术语 → 抽屉打开; 拖动下滑/点外部关闭; 内容同桌面问答列）

### HighlightedText（术语高亮, 组件内私有）
```
candidates = detectTerms(content, 60) —— 打开文档时 useMemo 一次
按词长降序建正则（| 连接, 全部转义, 中英文都匹配; 避免短词吞长词）
content.split(regex) → 片段数组; 命中片段的词 → <button className="doc-term ...">高亮</button>
高亮样式（按 termStates[term] 区分）:
  unseen:    text-brand border-b border-brand/50 hover:bg-brand/10（可点击）
  asked:     text-text-secondary border-b border-text-tertiary/50（已问过, 弱化）
  mastered:  text-text-tertiary（已掌握, 不再高亮交互）
点击 unseen/asked 术语 → openTermPanel(term)
```
- 术语面板（问答列内容）:
```
├─ 头部: [kind 徽章: 词典命中"词典" / 启发式"候选"] + 术语名 + 关闭 X（桌面收起列 / 移动关闭抽屉）
├─ 内容（overflow-y-auto scrollbar-card-std p-4）:
│   glossary 命中: GLOSSARY 的 explain（一行）+ "点击问 AI 获得完整讲解" 
│   始终显示 <button className="w-full mt-3 py-2 rounded-full bg-brand text-black text-sm font-medium">问 AI：这是什么？</button>
│     → openDocQuestion(term, doc.name)（自动建"论文：xxx"项目 + 新 turn + mock 回答）
│   （findTerm(term) 命中时也显示术语树摘要预览）
└─ 划词区（正文 onMouseUp 选区长度>0 → 底部弹出小条 "问 AI" 按钮 → 同 openDocQuestion）
```
- 问答列默认收起（窄条）; 点术语/划词问 AI → 展开
- 中文文案; 阅读区样式: text-text-content leading-7 text-[15px] whitespace-pre-wrap

## 参考
- 原站文档功能在登录墙后, 布局自由（分栏是设计树已定决策）
