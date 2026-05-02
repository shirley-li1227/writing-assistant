const apiUrl = 'https://open.bigmodel.cn/api/paas/v4/chat/completions'

interface Env {
  ZHIPU_API_KEY?: string
  ZHIPU_MODEL?: string
}

function corsHeaders(): HeadersInit {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
}

export async function onRequestOptions(): Promise<Response> {
  return new Response(null, { status: 204, headers: corsHeaders() })
}

export async function onRequestPost(context: {
  request: Request
  env: Env
}): Promise<Response> {
  const { request, env } = context

  try {
    const apiKey = env.ZHIPU_API_KEY
    let body: Record<string, unknown>
    try {
      body = (await request.json()) as Record<string, unknown>
    } catch {
      return new Response('请求体不是有效的 JSON。', {
        status: 400,
        headers: { 'Content-Type': 'text/plain; charset=utf-8', ...corsHeaders() },
      })
    }

    const prompt = body.prompt
    const temperature = body.temperature
    const maxTokens = body.max_tokens

    if (!apiKey) {
      return new Response('缺少 ZHIPU_API_KEY，请在 Cloudflare Pages 环境变量中配置。', {
        status: 500,
        headers: { 'Content-Type': 'text/plain; charset=utf-8', ...corsHeaders() },
      })
    }

    if (!prompt || typeof prompt !== 'string') {
      return new Response('请求体缺少 prompt 字段。', {
        status: 400,
        headers: { 'Content-Type': 'text/plain; charset=utf-8', ...corsHeaders() },
      })
    }

    const normalizedTemperature =
      typeof temperature === 'number' ? Math.min(1, Math.max(0, temperature)) : 0.7

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
        model: env.ZHIPU_MODEL || 'glm-4-flash',
        stream: true,
        temperature: normalizedTemperature,
        max_tokens: normalizedMaxTokens,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!upstream.ok || !upstream.body) {
      const text = await upstream.text()
      return new Response(text || '智谱接口请求失败。', {
        status: upstream.status,
        headers: { 'Content-Type': 'text/plain; charset=utf-8', ...corsHeaders() },
      })
    }

    const encoder = new TextEncoder()
    const decoder = new TextDecoder()
    const reader = upstream.body.getReader()

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        let pending = ''
        try {
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
                const json = JSON.parse(payload) as {
                  choices?: Array<{ delta?: { content?: string } }>
                }
                const text = json?.choices?.[0]?.delta?.content ?? ''
                if (text) controller.enqueue(encoder.encode(text))
              } catch {
                // Ignore malformed stream frames.
              }
            }
          }
        } catch (error) {
          controller.error(error)
          return
        } finally {
          reader.releaseLock()
        }
        controller.close()
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        ...corsHeaders(),
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : '服务异常'
    return new Response(message, {
      status: 500,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', ...corsHeaders() },
    })
  }
}
