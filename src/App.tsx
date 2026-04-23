import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  buildPrompt,
  modeLabelMap,
  modeOptions,
} from './promptTemplates'
import type { WritingMode } from './promptTemplates'

type HistoryItem = {
  id: string
  prompt: string
  result: string
  createdAt: string
}

const HISTORY_STORAGE_KEY = 'writing-assistant-history'
const isLocalHost =
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1'
const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL?.trim() || (isLocalHost ? 'http://localhost:8787' : '')
const apiGenerateUrl = apiBaseUrl ? `${apiBaseUrl}/api/generate` : '/api/generate'

function App() {
  const [mode, setMode] = useState<WritingMode>('continue')
  const [input, setInput] = useState('')
  const [result, setResult] = useState('')
  const [currentPrompt, setCurrentPrompt] = useState('')
  const [temperature, setTemperature] = useState(0.7)
  const [maxTokens, setMaxTokens] = useState(800)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [historyList, setHistoryList] = useState<HistoryItem[]>([])
  const [copiedCode, setCopiedCode] = useState('')
  const [copiedResult, setCopiedResult] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const canSubmit = useMemo(
    () => input.trim().length > 0 && !loading,
    [input, loading],
  )

  useEffect(() => {
    try {
      const raw = localStorage.getItem(HISTORY_STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as HistoryItem[]
      if (Array.isArray(parsed)) {
        setHistoryList(parsed)
      }
    } catch {
      // Ignore broken localStorage data.
    }
  }, [])

  useEffect(() => {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(historyList))
  }, [historyList])

  const handleGenerate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canSubmit) return

    setLoading(true)
    setError('')
    setResult('')

    const prompt = buildPrompt(mode, input)
    setCurrentPrompt(prompt)

    try {
      let response = await fetch(apiGenerateUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          prompt,
          temperature,
          max_tokens: maxTokens,
        }),
      })
      if (!response.ok && response.status === 404 && apiGenerateUrl !== '/api/generate') {
        response = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode,
            prompt,
            temperature,
            max_tokens: maxTokens,
          }),
        })
      }

      if (!response.ok || !response.body) {
        const text = await response.text()
        throw new Error(text || '生成失败，请稍后重试。')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let generatedText = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        generatedText += chunk
        setResult((previous) => previous + chunk)
      }

      if (generatedText.trim()) {
        const newItem: HistoryItem = {
          id: crypto.randomUUID(),
          prompt,
          result: generatedText,
          createdAt: new Date().toISOString(),
        }
        setHistoryList((previous) => [newItem, ...previous].slice(0, 30))
      }
    } catch (apiError) {
      const message =
        apiError instanceof Error ? apiError.message : '请求失败，请检查网络。'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const handleSelectHistory = (item: HistoryItem) => {
    setCurrentPrompt(item.prompt)
    setResult(item.result)
    setError('')
  }

  const handleDeleteHistory = (id: string) => {
    setHistoryList((previous) => previous.filter((item) => item.id !== id))
  }

  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code)
      setCopiedCode(code)
      window.setTimeout(() => setCopiedCode(''), 1500)
    } catch {
      // Ignore clipboard errors.
    }
  }

  const handleCopyResult = async () => {
    if (!result.trim()) return
    try {
      await navigator.clipboard.writeText(result)
      setCopiedResult(true)
      window.setTimeout(() => setCopiedResult(false), 1500)
    } catch {
      // Ignore clipboard errors.
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-8 text-slate-800 md:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8">
          <h1 className="bg-gradient-to-r from-cyan-600 via-blue-600 to-violet-600 bg-clip-text text-3xl font-bold text-transparent md:text-4xl">
            智能写作助手
          </h1>
          <p className="mt-3 text-sm text-slate-600 md:text-base">
            选择写作模式，输入你的想法，实时生成高质量内容。
          </p>
        </header>

        <main className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-lg shadow-slate-200/80">
            <form className="space-y-5" onSubmit={handleGenerate}>
              <label className="block space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold tracking-wide text-slate-800">
                    写作模式
                  </span>
                  <span className="rounded-full border border-cyan-300 bg-cyan-50 px-2 py-0.5 text-xs text-cyan-700">
                    6 种模式
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2 md:grid-cols-3">
                  {modeOptions.map((item) => {
                    const isActive = mode === item.value
                    return (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => setMode(item.value)}
                        className={`rounded-lg px-3 py-2 text-xs font-medium transition md:text-sm ${isActive
                          ? 'bg-gradient-to-r from-cyan-500 to-violet-500 text-white shadow-md shadow-cyan-200'
                          : 'bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                          }`}
                      >
                        {item.label}
                      </button>
                    )
                  })}
                </div>
                <p className="text-xs text-slate-500">
                  当前选择将决定提示词结构与输出风格。
                </p>
              </label>

              <label className="block space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold tracking-wide text-slate-800">
                    输入内容
                  </span>
                  <span className="text-xs text-slate-500">
                    支持粘贴长文本
                  </span>
                </div>
                <textarea
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder="请输入你的原始内容、主题或需求..."
                  className="min-h-72 w-full resize-y rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm leading-7 text-slate-800 shadow-inner shadow-slate-100 outline-none transition duration-200 placeholder:text-slate-400 hover:border-slate-400 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-300/40"
                />
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>描述越清晰，生成结果越贴合预期</span>
                  <span>{input.trim().length} 字</span>
                </div>
              </label>

              <div className="rounded-xl border border-slate-200 bg-slate-50">
                <button
                  type="button"
                  onClick={() => setShowAdvanced((previous) => !previous)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-slate-700 transition hover:text-cyan-700"
                >
                  <span>高级设置</span>
                  <span className="text-slate-500">
                    {showAdvanced ? '收起' : '展开'}
                  </span>
                </button>

                {showAdvanced ? (
                  <div className="space-y-4 border-t border-slate-200 px-4 py-4">
                    <label className="block space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-slate-700">
                          创意度 (temperature)
                        </span>
                        <span className="rounded bg-cyan-50 px-2 py-0.5 font-mono text-cyan-700">
                          {temperature.toFixed(2)}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.01}
                        value={temperature}
                        onChange={(event) =>
                          setTemperature(Number(event.target.value))
                        }
                        className="w-full accent-cyan-400"
                      />
                    </label>

                    <label className="block space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-slate-700">
                          输出长度 (max_tokens)
                        </span>
                        <span className="rounded bg-violet-50 px-2 py-0.5 font-mono text-violet-700">
                          {maxTokens}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={100}
                        max={2000}
                        step={10}
                        value={maxTokens}
                        onChange={(event) =>
                          setMaxTokens(Number(event.target.value))
                        }
                        className="w-full accent-violet-400"
                      />
                    </label>
                  </div>
                ) : null}
              </div>

              <button
                type="submit"
                disabled={!canSubmit}
                className="inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-cyan-500 to-violet-500 px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? '生成中...' : `生成${modeLabelMap[mode]}`}
              </button>
            </form>

            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-700">历史记录</h3>
                <span className="text-xs text-slate-500">{historyList.length} 条</span>
              </div>
              <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                {historyList.length > 0 ? (
                  historyList.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelectHistory(item)}
                      className="group w-full rounded-lg border border-slate-200 bg-white p-2 text-left transition hover:border-cyan-300"
                    >
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span className="truncate text-xs text-slate-500">
                          {new Date(item.createdAt).toLocaleString()}
                        </span>
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(event) => {
                            event.stopPropagation()
                            handleDeleteHistory(item.id)
                          }}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault()
                              event.stopPropagation()
                              handleDeleteHistory(item.id)
                            }
                          }}
                          className="rounded px-1.5 py-0.5 text-xs text-slate-500 transition hover:bg-rose-100 hover:text-rose-600"
                        >
                          删除
                        </span>
                      </div>
                      <p className="line-clamp-2 text-xs text-slate-600">
                        {item.prompt}
                      </p>
                    </button>
                  ))
                ) : (
                  <p className="text-xs text-slate-500">暂无历史记录</p>
                )}
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-lg shadow-slate-200/80">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">生成结果</h2>
              <span className="text-xs text-slate-500">Markdown 实时渲染</span>
            </div>

            {error ? (
              <div className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {error}
              </div>
            ) : null}

            {currentPrompt ? (
              <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="mb-1 text-xs uppercase tracking-wide text-slate-500">
                  使用的提示词
                </p>
                <p className="line-clamp-4 whitespace-pre-wrap text-xs text-slate-600">
                  {currentPrompt}
                </p>
              </div>
            ) : null}

            <article className="prose prose-slate prose-headings:text-slate-800 prose-p:text-slate-700 prose-a:text-cyan-700 prose-strong:text-slate-900 max-w-none h-[36rem] overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-7">
              {result ? (
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    code({ inline, className, children, ...props }: any) {
                      const codeText = String(children).replace(/\n$/, '')
                      if (inline) {
                        return (
                          <code className={className} {...props}>
                            {children}
                          </code>
                        )
                      }
                      return (
                        <div className="my-4 overflow-hidden rounded-lg border border-slate-300 bg-white">
                          <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
                            <span className="text-xs text-slate-500">
                              {className?.replace('language-', '') || 'code'}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopyCode(codeText)}
                              className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-700 transition hover:bg-slate-200"
                            >
                              {copiedCode === codeText ? '已复制' : '复制代码'}
                            </button>
                          </div>
                          <pre className="m-0 overflow-x-auto p-3">
                            <code className={className} {...props}>
                              {children}
                            </code>
                          </pre>
                        </div>
                      )
                    },
                  }}
                >
                  {result}
                </ReactMarkdown>
              ) : (
                <p className="text-slate-500">
                  生成内容将在这里实时显示。当前模式：
                  <strong className="ml-1 text-slate-700">{modeLabelMap[mode]}</strong>
                </p>
              )}
            </article>
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={handleCopyResult}
                disabled={!result.trim()}
                className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-700 transition hover:border-cyan-500 hover:text-cyan-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {copiedResult ? '已复制' : '复制结果'}
              </button>
            </div>
          </section>
        </main>
      </div>
    </div>
  )
}

export default App
