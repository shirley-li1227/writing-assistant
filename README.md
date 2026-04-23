# 智能写作助手 (Writing Assistant)

一个基于 React + TypeScript + Express 的智能写作应用，支持多种写作模式、流式生成、Markdown 渲染、历史记录与复制功能。

## 功能概览

- **6 种写作模式**：文章续写、内容改写、内容扩展、内容总结、邮件撰写、文案生成
- **流式输出**：调用智谱 AI 接口，右侧实时显示生成内容
- **高级设置**：
  - `temperature` 创意度滑块（0-1）
  - `max_tokens` 输出长度滑块（100-2000）
- **Markdown 预览**：支持 GFM 语法
- **代码块增强**：代码块内置“复制代码”按钮
- **结果复制**：支持复制整段生成结果
- **历史记录**：每次生成自动保存到 LocalStorage，支持回看与删除
- **双栏界面**：左侧输入与配置，右侧结果预览（固定高度滚动）

## 技术栈

- **前端**：React 19 + TypeScript + Vite + Tailwind CSS
- **Markdown**：`react-markdown` + `remark-gfm`
- **后端**：Express + CORS + dotenv
- **并行开发**：`concurrently` 同时启动前后端

## 目录结构

```text
writing-assistant/
├─ src/
│  ├─ App.tsx                # 主界面与交互逻辑
│  ├─ promptTemplates.ts     # 6种写作模式提示词模板
│  ├─ index.css              # 全局样式
│  └─ main.tsx
├─ server/
│  └─ index.js               # 智谱 API 代理 + 流式转发
├─ PRD.md
├─ prompts.md
├─ .env.example
├─ package.json
└─ vite.config.ts
```

## 快速开始

### 1) 安装依赖

```bash
npm install
```

### 2) 配置环境变量

复制 `.env.example` 为 `.env`，并填写你的智谱 Key：

```env
ZHIPU_API_KEY=your_zhipu_api_key
ZHIPU_MODEL=glm-4-flash
PORT=8787
```

### 3) 启动开发环境

```bash
npm run dev
```

启动后会同时运行：

- 前端：Vite（默认 `http://localhost:5173`，端口冲突时自动顺延）
- 后端：Express（默认 `http://localhost:8787`）

## 可用脚本

- `npm run dev`：同时启动前后端
- `npm run dev:client`：仅启动前端
- `npm run dev:server`：仅启动后端
- `npm run build`：TypeScript + Vite 生产构建
- `npm run preview`：预览构建产物
- `npm run lint`：运行 ESLint

## API 说明

### `POST /api/generate`

请求体：

```json
{
  "mode": "continue",
  "prompt": "完整提示词",
  "temperature": 0.7,
  "max_tokens": 800
}
```

说明：

- 服务端会将 `temperature` 限制到 `0-1`
- 服务端会将 `max_tokens` 限制到 `100-2000`
- 接口返回流式纯文本，前端边接收边渲染

## 写作模式提示词

`src/promptTemplates.ts` 中内置 6 个提示词函数，统一通过 `buildPrompt(mode, input)` 生成完整提示词。  
如需扩展新模式，只需：

1. 扩展 `WritingMode` 类型
2. 新增 `modeOptions` 选项
3. 在 `promptBuilders` 中实现对应函数

## 常见问题

### 已配置 `ZHIPU_API_KEY` 但仍报错

请确认：

1. `.env` 在项目根目录
2. Key 名称为 `ZHIPU_API_KEY`（无拼写错误）
3. 修改 `.env` 后重启 `npm run dev`（建议）

> 后端已增加兜底重载逻辑，但重启仍是最稳妥方式。

## 安全建议

- 不要把 `.env` 提交到仓库
- 不要在前端直接暴露 `ZHIPU_API_KEY`
- 本项目通过 `server/index.js` 代理调用智谱接口，避免前端泄露密钥
