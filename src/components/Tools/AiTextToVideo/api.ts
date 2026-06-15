// AI文生视频 API 服务层

export interface VideoGenerateOptions {
  apiKey: string
  topic: string
  duration: number
  aspectRatio: string
  autoGeneratePrompt: boolean
  durationOptions: Array<{ value: number; frames: number }>
  aspectRatioOptions: Array<{ value: string; width: number; height: number }>
}

export interface ImageToVideoOptions {
  apiKey: string
  images: string[]
  prompt: string
  duration: number
  aspectRatio: string
  autoOptimize: boolean
  durationOptions: Array<{ value: number; frames: number }>
  aspectRatioOptions: Array<{ value: string; width: number; height: number }>
}

export interface TextToImageOptions {
  apiKey: string
  model: string
  prompt: string
  aspectRatio: string
  count: number
  aspectRatioOptions: Array<{ value: string; width: number; height: number }>
}

export interface ImageToImageOptions {
  apiKey: string
  model: string
  sourceImage: string
  prompt: string
  strength: number
  aspectRatio: string
  count: number
  aspectRatioOptions: Array<{ value: string; width: number; height: number }>
}

export interface ChatOptions {
  apiKey: string
  model: string
  messages: Array<{ role: string; content: string }>
}

// 生成优化后的提示词
export async function generateOptimizedPrompt(apiKey: string, topic: string): Promise<string> {
  const response = await fetch('/api/agnes-chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'agnes-2.0-flash',
      messages: [
        {
          role: 'user',
          content: `请将以下主题扩展为专业的视频生成提示词(英文)，要求：
1. 详细描述主体、动作、场景细节
2. 包含镜头运动描述(tracking shot, close-up, wide angle等)
3. 包含光照描述(golden hour, soft lighting, dramatic等)
4. 包含视觉风格(cinematic, realistic, dreamy等)
5. 只输出英文提示词，不要其他内容

主题：${topic}`
        }
      ]
    })
  })

  if (!response.ok) {
    throw new Error('提示词生成失败')
  }

  const data = await response.json()
  return data.choices[0].message.content.trim()
}

// 提交视频生成任务
export async function submitVideoTask(
  apiKey: string,
  prompt: string,
  frames: number,
  width: number,
  height: number,
  images?: string[]
): Promise<string> {
  const body: any = {
    model: 'agnes-video-v2.0',
    prompt,
    num_frames: frames,
    frame_rate: 24,
    width,
    height
  }

  if (images && images.length > 0) {
    body.extra_body = { image: images }
  }

  const response = await fetch('/api/agnes-video', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(body)
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.error?.message || '视频生成任务提交失败')
  }

  const data = await response.json()
  return data.video_id
}

// 轮询查询视频状态
export async function pollVideoStatus(
  apiKey: string,
  videoId: string,
  onProgress?: (status: string) => void
): Promise<string> {
  while (true) {
    await new Promise(resolve => setTimeout(resolve, 5000))

    const statusResponse = await fetch(`/api/agnes-video-status?video_id=${encodeURIComponent(videoId)}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    })

    if (!statusResponse.ok) {
      const errorText = await statusResponse.text()
      throw new Error(`查询视频状态失败: ${errorText}`)
    }

    const statusData = await statusResponse.json()
    const status = statusData.status

    if (onProgress) {
      onProgress(status)
    }

    if (status === 'completed') {
      // API返回的视频URL在remixed_from_video_id字段
      return statusData.remixed_from_video_id || statusData.video_url
    } else if (status === 'failed') {
      throw new Error('视频生成失败')
    }
  }
}

// 生成图片
export async function generateImage(options: TextToImageOptions): Promise<string[]> {
  const selectedAspectRatio = options.aspectRatioOptions.find(r => r.value === options.aspectRatio)!

  const response = await fetch('/api/agnes-image-generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${options.apiKey}`
    },
    body: JSON.stringify({
      model: options.model,
      prompt: options.prompt,
      size: `${selectedAspectRatio.width}x${selectedAspectRatio.height}`,
      extra_body: {
        response_format: 'url'
      }
    })
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.error?.message || '图片生成失败')
  }

  const data = await response.json()
  return data.data.map((item: any) => item.url)
}

// 图生图
export async function editImage(options: ImageToImageOptions): Promise<string[]> {
  const selectedAspectRatio = options.aspectRatioOptions.find(r => r.value === options.aspectRatio)!

  const response = await fetch('https://apihub.agnes-ai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${options.apiKey}`
    },
    body: JSON.stringify({
      model: options.model,
      prompt: options.prompt,
      size: `${selectedAspectRatio.width}x${selectedAspectRatio.height}`,
      extra_body: {
        image: [options.sourceImage],
        response_format: 'url'
      }
    })
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.error?.message || '图片生成失败')
  }

  const data = await response.json()
  return data.data.map((item: any) => item.url)
}

// AI对话（流式）
export async function chatStream(
  options: ChatOptions,
  onChunk: (content: string) => void
): Promise<string> {
  const response = await fetch('/api/agnes-chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${options.apiKey}`
    },
    body: JSON.stringify({
      model: options.model,
      messages: options.messages,
      stream: true
    })
  })

  if (!response.ok) {
    throw new Error('对话请求失败')
  }

  const reader = response.body?.getReader()
  if (!reader) {
    throw new Error('无法获取响应流')
  }

  const decoder = new TextDecoder()
  let fullContent = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    const chunk = decoder.decode(value, { stream: true })
    const lines = chunk.split('\n').filter(line => line.trim())

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6)
        if (data === '[DONE]') continue

        try {
          const json = JSON.parse(data)
          const content = json.choices?.[0]?.delta?.content
          if (content) {
            fullContent += content
            onChunk(fullContent)
          }
        } catch (e) {
          // 忽略解析错误
        }
      }
    }
  }

  return fullContent
}

// 简化的图生图接口（用于宠物头像）
export async function generateImageToImage(
  apiKey: string,
  sourceImage: string,
  prompt: string,
  _strength: number = 0.7
): Promise<{ images: string[] }> {
  const response = await fetch('https://apihub.agnes-ai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'agnes-image-2.1-flash',
      prompt: prompt,
      size: '1024x1024',
      extra_body: {
        image: [sourceImage],
        response_format: 'url'
      }
    })
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.error?.message || '图片生成失败')
  }

  const data = await response.json()
  return {
    images: data.data.map((item: any) => item.url)
  }
}

// 简化的对话接口（流式，用于应用）
export async function sendChatMessageStream(
  apiKey: string,
  message: string,
  model: string = 'agnes-2.0-flash',
  onChunk: (content: string) => void
): Promise<string> {
  const response = await fetch('https://apihub.agnes-ai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model,
      messages: [
        { role: 'user', content: message }
      ],
      temperature: 0.7,
      stream: true
    })
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.error?.message || '对话请求失败')
  }

  const reader = response.body?.getReader()
  if (!reader) {
    throw new Error('无法获取响应流')
  }

  const decoder = new TextDecoder()
  let fullContent = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    const chunk = decoder.decode(value, { stream: true })
    const lines = chunk.split('\n').filter(line => line.trim())

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6)
        if (data === '[DONE]') continue

        try {
          const json = JSON.parse(data)
          const content = json.choices?.[0]?.delta?.content
          if (content) {
            fullContent += content
            onChunk(fullContent)
          }
        } catch (e) {
          // 忽略解析错误
        }
      }
    }
  }

  return fullContent
}

// 支持图片的对话接口（流式）
export async function sendChatMessageWithImageStream(
  apiKey: string,
  textMessage: string,
  imageBase64: string,
  model: string = 'agnes-2.0-flash',
  onChunk: (content: string) => void
): Promise<string> {
  const response = await fetch('https://apihub.agnes-ai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: imageBase64
              }
            },
            {
              type: 'text',
              text: textMessage
            }
          ]
        }
      ],
      temperature: 0.7,
      stream: true
    })
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.error?.message || '对话请求失败')
  }

  const reader = response.body?.getReader()
  if (!reader) {
    throw new Error('无法获取响应流')
  }

  const decoder = new TextDecoder()
  let fullContent = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    const chunk = decoder.decode(value, { stream: true })
    const lines = chunk.split('\n').filter(line => line.trim())

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6)
        if (data === '[DONE]') continue

        try {
          const json = JSON.parse(data)
          const content = json.choices?.[0]?.delta?.content
          if (content) {
            fullContent += content
            onChunk(fullContent)
          }
        } catch (e) {
          // 忽略解析错误
        }
      }
    }
  }

  return fullContent
}
