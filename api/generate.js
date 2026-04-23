const apiUrl = 'https://open.bigmodel.cn/api/paas/v4/chat/completions'

export const config = {
  runtime: 'nodejs',
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed')
    return
  }

  try {
    const apiKey = process.env.ZHIPU_API_KEY
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body ?? {}
    const { prompt, temperature, max_tokens: maxTokens } = body

    if (!apiKey) {
      res.status(500).send('缺少 ZHIPU_API_KEY，请在 Vercel 环境变量中配置。')
      return
    }

    if (!prompt || typeof prompt !== 'string') {
      res.status(400).send('请求体缺少 prompt 字段。')
      return
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
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!upstream.ok || !upstream.body) {
      const text = await upstream.text()
      res.status(upstream.status).send(text || '智谱接口请求失败。')
      return
    }

    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.setHeader('Cache-Control', 'no-cache, no-transform')
    res.setHeader('Connection', 'keep-alive')
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
          if (text) {
            res.write(text)
          }
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
}
