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

function App() {
  const [mode, setMode] = useState<WritingMode>('continue')
  const [input, setInput] = useState('')
  const [result, setResult] = useState('')
  const [currentPrompt, setCurrentPrompt] = useState('')
  const [temperature, setTemperature] = useState(0.7)
  const [maxTokens, setMaxTokens] = useState(200)
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
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          prompt,
          temperature,
          max_tokens: maxTokens,
        }),
      })

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
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 md:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8">
          <h1 className="bg-gradient-to-r from-cyan-300 via-blue-300 to-violet-300 bg-clip-text text-3xl font-bold text-transparent md:text-4xl">
            智能写作助手
          </h1>
          <p className="mt-3 text-sm text-slate-300 md:text-base">
            选择写作模式，输入你的想法，实时生成高质量内容。
          </p>
        </header>

        <main className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl shadow-cyan-900/20 backdrop-blur">
            <form className="space-y-5" onSubmit={handleGenerate}>
              <label className="block space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold tracking-wide text-slate-100">
                    写作模式
                  </span>
                  <span className="rounded-full border border-cyan-400/25 bg-cyan-400/10 px-2 py-0.5 text-xs text-cyan-200">
                    6 种模式
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-700/90 bg-slate-950/90 p-2 md:grid-cols-3">
                  {modeOptions.map((item) => {
                    const isActive = mode === item.value
                    return (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => setMode(item.value)}
                        className={`rounded-lg px-3 py-2 text-xs font-medium transition md:text-sm ${isActive
                            ? 'bg-gradient-to-r from-cyan-400 to-violet-400 text-slate-900 shadow-lg shadow-cyan-500/20'
                            : 'bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-slate-100'
                          }`}
                      >
                        {item.label}
                      </button>
                    )
                  })}
                </div>
                <p className="text-xs text-slate-400">
                  当前选择将决定提示词结构与输出风格。
                </p>
              </label>

              <label className="block space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold tracking-wide text-slate-100">
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
                  className="min-h-72 w-full resize-y rounded-xl border border-slate-700/90 bg-slate-950/90 px-4 py-3 text-sm leading-7 text-slate-100 shadow-inner shadow-slate-950/40 outline-none transition duration-200 placeholder:text-slate-500 hover:border-slate-500 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/30"
                />
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>描述越清晰，生成结果越贴合预期</span>
                  <span>{input.trim().length} 字</span>
                </div>
              </label>

              <div className="rounded-xl border border-slate-800 bg-slate-950/60">
                <button
                  type="button"
                  onClick={() => setShowAdvanced((previous) => !previous)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-slate-200 transition hover:text-cyan-300"
                >
                  <span>高级设置</span>
                  <span className="text-slate-400">
                    {showAdvanced ? '收起' : '展开'}
                  </span>
                </button>

                {showAdvanced ? (
                  <div className="space-y-4 border-t border-slate-800 px-4 py-4">
                    <label className="block space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-slate-200">
                          创意度 (temperature)
                        </span>
                        <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-cyan-300">
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
                        <span className="font-medium text-slate-200">
                          输出长度 (max_tokens)
                        </span>
                        <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-violet-300">
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
                className="inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-cyan-400 to-violet-400 px-4 py-3 text-sm font-semibold text-slate-900 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? '生成中...' : `生成${modeLabelMap[mode]}`}
              </button>
            </form>

            <div className="mt-5 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-200">历史记录</h3>
                <span className="text-xs text-slate-500">{historyList.length} 条</span>
              </div>
              <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                {historyList.length > 0 ? (
                  historyList.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelectHistory(item)}
                      className="group w-full rounded-lg border border-slate-800 bg-slate-900/70 p-2 text-left transition hover:border-cyan-500/40"
                    >
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span className="truncate text-xs text-slate-400">
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
                          className="rounded px-1.5 py-0.5 text-xs text-slate-500 transition hover:bg-rose-500/20 hover:text-rose-300"
                        >
                          删除
                        </span>
                      </div>
                      <p className="line-clamp-2 text-xs text-slate-300">
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

          <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl shadow-violet-900/20 backdrop-blur">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">生成结果</h2>
              <span className="text-xs text-slate-400">Markdown 实时渲染</span>
            </div>

            {error ? (
              <div className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
                {error}
              </div>
            ) : null}

            {currentPrompt ? (
              <div className="mb-4 rounded-lg border border-slate-800 bg-slate-950/70 p-3">
                <p className="mb-1 text-xs uppercase tracking-wide text-slate-500">
                  使用的提示词
                </p>
                <p className="line-clamp-4 whitespace-pre-wrap text-xs text-slate-300">
                  {currentPrompt}
                </p>
              </div>
            ) : null}

            <article className="prose prose-invert prose-headings:text-slate-100 prose-p:text-slate-200 prose-a:text-cyan-300 prose-strong:text-white max-w-none h-[36rem] overflow-y-auto rounded-xl border border-slate-800 bg-slate-950/70 p-4 text-sm leading-7">
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
                        <div className="my-4 overflow-hidden rounded-lg border border-slate-700 bg-slate-900">
                          <div className="flex items-center justify-between border-b border-slate-700 px-3 py-2">
                            <span className="text-xs text-slate-400">
                              {className?.replace('language-', '') || 'code'}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopyCode(codeText)}
                              className="rounded bg-slate-800 px-2 py-1 text-xs text-slate-200 transition hover:bg-slate-700"
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
                <p className="text-slate-400">
                  生成内容将在这里实时显示。当前模式：
                  <strong className="ml-1 text-slate-200">{modeLabelMap[mode]}</strong>
                </p>
              )}
            </article>
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={handleCopyResult}
                disabled={!result.trim()}
                className="rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs text-slate-200 transition hover:border-cyan-400 hover:text-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
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
