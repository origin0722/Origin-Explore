# R7 像素级 QA — 交接文档（2026-08-13）

> ✅ **本阶段已收尾**：下方 5 条待办全部完成，功能开发与 bug 修复见 `r8-dev-handoff.md`。
> 关键结论：① "255px 框" = 使用指南按钮 + 「?」按钮行；② "绿点" = 居中思维宇宙入口按钮；③ 输入条 = 单行 62px；④ 术语卡片位置错/关不掉 = 居中动画误用于右锚定卡片。
>
> 本文件保留 R7 全部关键发现与未完成任务记录，供新 agent 无缝接手。

## 一、已完成：聊天空状态大字精确对齐 ✅

**原站大字真相（JS chunk `js-chunks/325.d6ed379f062f939c.js` 权威证据）：**

```jsx
<h1 className="font-bruno-ace font-normal text-center content-brand shadow-brand select-none"
    style={{ fontSize: m ? "72px" : c < 480 ? "96px" : "128px", lineHeight: 同 }}>
  Explore
</h1>
```

- **字体**：Bruno Ace（next/font，`font-bruno-ace`），font-weight 400（**不要加 bold**）
- **字号**：桌面 128px（移动 72px / <480 96px）——**已实测验证：克隆 128px 渲染 bbox 592×121 @中心(723.5,368)，与原站 state-newproj1.png 的 592×123 @(724,368) 完全一致**
- **颜色**：纯色 `#13e425`（content-brand）+ **shadow-brand glow**（`0 0 24px rgba(19,228,37,0.35)`）——**不是 linear-gradient！** 之前用渐变实现导致右侧字符变暗、比例失真
- **lineHeight = fontSize**（1 倍）

**克隆实现位置**：`src/components/sites/ai-explore-poker-820d0558/chat-card.tsx` 空状态（turns.length === 0）：

```tsx
<div className="flex h-full flex-col items-center justify-center -translate-y-[28px]">
  <h1 className="font-bruno-ace select-none text-brand"
      style={{ fontSize: "128px", lineHeight: 1,
               textShadow: "0 0 24px rgba(19, 228, 37, 0.35)" }}>
    Explore
  </h1>
  <p className="mt-10 text-sm text-text-tertiary">输入问题，开始你的探索</p>
</div>
```

- `-translate-y-[28px]` 让大字中心到 y≈368（之前 -translate-y-16 太高）
- 关键教训：**Bruno Ace 必须显式用 `font-bruno-ace` 类**，否则 fallback 到 Geist（当时 110px Inter 渲染 E 横条比例 3.0 vs 原站 5.75，误导了分析）
- 移动端大字（390×844）尚未按 72px/96px 逻辑对齐 —— 见待办

## 二、原站"新项目空聊天"真实结构（state-newproj1.png 逐像素分析）

**state-newproj1.png = 新项目空聊天**（非欢迎页；欢迎页 state-main.png 是 650px 欢迎卡，无大字、无输入条）。布局（1440×900）：

| 元素 | 位置 | 规格 |
|---|---|---|
| 大字 "Explore" | 笔画 y307-412，行盒 y304-432 | Bruno Ace 128px，纯 #13e425 + glow |
| 标题 "Welcome to Explore" | y432-450，x400-690 | 灰色文字（lum 85-135），非纯白 |
| 圆角框 | y470-507，x445-700（255×37px）+ 40×40 圆按钮 x720-760 | 框内文字 y490-505：灰色 7 字符（x470-560）+ 白色 7 字符（x610-700，**内容未辨认**） |
| 绿色圆点 | x702-737，y766-800（36×34px） | 纯 #13e425，中心 (720,783)，输入条上方 39px，**性质未确认** |
| 输入条 | y822-882（**60px 高**），x225-1215（990px 宽居中 720） | 左侧按钮（x230-460 块）+ placeholder（x490-1000）+ 右侧发送按钮（x1090-1200） |

**与克隆的差异（d-newproj 7.01% 的来源）：**
1. **输入条**：原站 60px 高 @y822-882；克隆 94px @y806-900 —— 高度/位置需修
2. **绿色圆点** @(720,783)：克隆没有 —— 需确认性质后实现
3. **"Welcome to Explore" 标题 + 255px 框**：克隆没有 —— 性质未确认（见下）
4. 侧边栏差异 = 有意保留（中文文案、4 按钮 vs 5 按钮）

## 三、未解之谜（新 agent 优先攻克）

### 3.1 255px 框的性质（y470-507）
- JS chunk 里大字下方的按钮行是：`<button class="px-6 py-2 bg-btn-std ...">使用指南/How to Use</button> + <button class="w-10 h-10 rounded-full ..."><Icon 20px></button>`（flex gap-4）
- 但截图框是 255px 宽 + 40px 圆钮，gap ~20px —— **对不上**（按钮行应 ~138px 宽）
- 框内文字：y490-505 处灰色 7 字符（x470-560）+ 白色 7 字符（x610-700，`## ## ## # # # ### ##` 模式），疑似 "Explore" + 未知词，需要更高分辨率辨认
- **推荐**：直接看 `js-chunks/325.d6ed379f062f939c.js` 里含 `centerX`/`centerY` 的组件（大字容器 = `absolute flex flex-col items-center gap-12 left:centerX top:centerY translate(-50%,-50%)`），它可能不是空聊天而是"思维卡片"组件；空聊天状态另有组件

### 3.2 绿色圆点（y766-800, x702-737）
36×34 纯绿圆 @(720,783)，在输入条上方。可能是 FAB 类按钮/状态指示。查 chunk 里 `position` 相关或直接继续 probe。

### 3.3 原站 live 弹窗墙
原站当前（2026-08-13）每次加载弹 4-6 层弹窗（设置向导 + 登录 + sync conflict + 订阅支付 + "prefer afdian?"），**Escape / mouse.click / el.click() 全部无效**（弹窗为 React 受控且多层堆叠，点击被上层吞）。已放弃 live 探测，改用存档截图 + JS chunk 分析。

**原站 localStorage keys（已 dump，`scripts/live-storage-dump.cjs`）**：
- `settings-storage`：`{"state":{"settingsSchemaVersion":3,...,"theme":"Default (暗色)","language":"en","sendShortcut":"ctrl-enter",...},"version":0}`
- `resident-storage`：`{"state":{"storageMode":"local"},"version":0}`（数据存本地 IndexedDB）
- `explore-idb-migration-v1`：`done`；`byok-credentials-storage`、`ui-state-storage`（`isLeftPanelCollapsed`）
- 聊天数据在 **IndexedDB**（不在 localStorage）。无登录态 → 无法跳过订阅/登录弹窗

## 四、工具链与命令

| 用途 | 命令 |
|---|---|
| 像素 diff（场景可选） | `node scripts/qa-pixel.mjs [scene]` → `qa-out/<scene>.png` + `.diff.png`（pink=原站独有/cyan=克隆独有）+ `report.json` |
| 大字 bbox 验证 | `node scripts/font-check.cjs`（本地克隆，纯色笔画 g>190 口径，128px 期望 592×121 @(723,368)） |
| 原站存档图分析 | `node -e "..."` + pngjs（scripts 里有大量现成 ASCII 片段可复用） |
| Edge headless 注意 | 必须 `--edge-skip-compat-layer-relaunch`；live 原站曾忽略 viewport（渲染 1600×1000），现在 1440 正常 |
| heredoc 陷阱 | Bash heredoc 会吞反斜杠 → 用 Write 工具写脚本文件（`C:\\Program Files` 必须双反斜杠） |

**场景清单（qa-pixel.mjs）**：d-welcome / d-settings / d-welcome-main / d-newproj / d-chat / d-chat-reply / m-main / m-fab
**基准图**：`docs/design-references/ai-explore-poker-820d0558/chat-6ea4b827/`（29 张 PNG + legend/map txt 权威 DOM 记录）

## 五、当前 diff 快照与待办

上次全场景（大字修复前）：
- d-settings 6.30% · d-newproj **9.56%→7.01%**（大字修复后）· d-chat 9.92% · d-chat-reply 9.96% · m-main 2.97% · d-welcome 3.29% · d-welcome-main 4.03%

**待办（按优先级）：**
1. 辨认 255px 框 + 绿点性质（chunk 分析 → 实现或判定为其他状态）
2. 输入条对齐：60px 高 @y822-882（改 shell.tsx 输入条容器 + input-area 高度）；注意原站输入条只在聊天状态显示（克隆已是）
3. 移动端大字字号（72px/96px 逻辑）+ m-main/m-fab 复查
4. 全场景最终 diff + `npm run build` + `npx tsc --noEmit` 收尾
5. 清理 scripts 临时文件（live-*.cjs 可留作工具）

## 六、本次已改文件

- `src/components/sites/ai-explore-poker-820d0558/chat-card.tsx` — 大字：`font-bruno-ace` + 128px + 纯色 #13e425 + textShadow glow + `-translate-y-[28px]`（去掉了错误的 linear-gradient / font-bold / letterSpacing）
- `scripts/font-check.cjs` — 纯色笔画 bbox 测量工具（含 h1 font 加载检查）
- `scripts/live-title-probe.cjs` / `live-font-probe.cjs` / `live-storage-dump.cjs` — live 探测工具（弹窗墙内已失效，保留备用）
