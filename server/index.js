import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import path from 'node:path'

dotenv.config({ path: path.resolve(process.cwd(), '.env') })

const app = express()
const port = process.env.PORT || 8787
const apiUrl = 'https://open.bigmodel.cn/api/paas/v4/chat/completions'

app.use(cors())
app.use(express.json({ limit: '1mb' }))

app.post('/api/generate', async (req, res) => {
  try {
    // In dev mode, .env can be edited after server starts; reload as a fallback.
    if (!process.env.ZHIPU_API_KEY) {
      dotenv.config({ path: path.resolve(process.cwd(), '.env'), override: true })
    }
    const apiKey = process.env.ZHIPU_API_KEY
    const { prompt, temperature, max_tokens: maxTokens } = req.body ?? {}

    if (!apiKey) {
      return res
        .status(500)
        .send('缺少 ZHIPU_API_KEY，请在 .env 文件中配置。')
    }

    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).send('请求体缺少 prompt 字段。')
    }

    const normalizedTemperature =
      typeof temperature === 'number'
        ? Math.min(1, Math.max(0, temperature))
        : 0.7

    const normalizedMaxTokens =
      typeof maxTokens === 'number'
        ? Math.min(2000, Math.max(100, Math.floor(maxTokens)))
        : 800

    const upstream = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.ZHIPU_MODEL || 'glm-4-flash',
        stream: true,
        temperature: normalizedTemperature,
        max_tokens: normalizedMaxTokens,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    })

    if (!upstream.ok || !upstream.body) {
      const text = await upstream.text()
      return res.status(upstream.status).send(text || '智谱接口请求失败。')
    }

    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.setHeader('Transfer-Encoding', 'chunked')

    const reader = upstream.body.getReader()
    const decoder = new TextDecoder()
    let pending = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      pending += decoder.decode(value, { stream: true })
      const lines = pending.split('\n')
      pending = lines.pop() ?? ''

      for (const rawLine of lines) {
        const line = rawLine.trim()
        if (!line.startsWith('data:')) continue

        const payload = line.slice(5).trim()
        if (!payload || payload === '[DONE]') continue

        try {
          const json = JSON.parse(payload)
          const text = json?.choices?.[0]?.delta?.content ?? ''
          if (text) res.write(text)
        } catch {
          // Ignore malformed stream frames.
        }
      }
    }

    res.end()
  } catch (error) {
    const message = error instanceof Error ? error.message : '服务异常'
    res.status(500).send(message)
  }
})

app.listen(port, () => {
  console.log(`Zhipu proxy server is running at http://localhost:${port}`)
})
