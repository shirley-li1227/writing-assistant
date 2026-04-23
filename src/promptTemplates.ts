export type WritingMode =
  | 'continue'
  | 'rewrite'
  | 'expand'
  | 'summary'
  | 'email'
  | 'copywriting'

export const modeOptions: Array<{ value: WritingMode; label: string }> = [
  { value: 'continue', label: '文章续写' },
  { value: 'rewrite', label: '内容改写' },
  { value: 'expand', label: '内容扩展' },
  { value: 'summary', label: '内容总结' },
  { value: 'email', label: '邮件撰写' },
  { value: 'copywriting', label: '文案生成' },
]

export const modeLabelMap: Record<WritingMode, string> = {
  continue: '文章续写',
  rewrite: '内容改写',
  expand: '内容扩展',
  summary: '内容总结',
  email: '邮件',
  copywriting: '文案',
}

const promptBuilders: Record<WritingMode, (input: string) => string> = {
  continue: (input) => `请继续写下面的文章，保持风格一致，内容连贯：
${input.trim()}`,

  rewrite: (input) => `请改写下面的内容，使其更加流畅、专业：
${input.trim()}`,

  expand: (input) => `请扩展下面的内容，增加更多细节和例子：
${input.trim()}`,

  summary: (input) => `请总结下面的内容，提取核心要点：
${input.trim()}`,

  email: (input) => `请写一封正式且友好的邮件，主题和要求如下：
${input.trim()}`,

  copywriting: (input) => `请根据下面信息写一段营销文案，要求风格鲜明、有说服力：
${input.trim()}`,
}

export function buildPrompt(mode: WritingMode, userInput: string): string {
  return promptBuilders[mode](userInput)
}
