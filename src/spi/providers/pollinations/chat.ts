import { ChatMessage, ChatOptions, ChatResponse } from '../../common/interfaces'

export async function chat(
  this: any,
  messages: ChatMessage[],
  options?: ChatOptions
): Promise<ChatResponse> {
  if (!this.apiKey || !this.proxyUrl || !this.textUrl) {
    throw new Error('API配置不完整')
  }

  // 构建 OpenAI 兼容的请求体
  const requestBody = {
    model: options?.model || 'nova-fast',
    messages: messages.map(msg => ({
      role: msg.role,
      content: msg.content
    })),
    temperature: options?.temperature || 0.7,
    max_tokens: options?.maxTokens || 2000,
    stream: options?.stream || false,
    seed: Math.floor(Math.random() * 100000000) // 添加随机种子
  }

  try {
    if (options?.stream && options?.onChunk) {
      console.log('开始Pollinations流式输出请求');

      // 使用 fetch API 处理流式响应
      const response = await fetch(
        `${this.proxyUrl}?target=${this.textUrl}/v1/chat/completions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          },
          body: JSON.stringify(requestBody),
          signal: options.signal
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('无法获取响应流');
      }

      const decoder = new TextDecoder();
      let fullContent = '';
      let buffer = '';

      try {
        while (true) {
          if (options.signal?.aborted) {
            throw new DOMException('流式请求被终止', 'AbortError');
          }

          const { done, value } = await reader.read();

          if (done) {
            console.log('Pollinations流式读取完成');
            break;
          }

          const chunk = decoder.decode(value, { stream: true });
          buffer += chunk;

          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6).trim();

              if (data === '[DONE]') {
                console.log('Pollinations收到结束标记');
                break;
              }

              try {
                const parsed = JSON.parse(data);
                console.log('Pollinations解析的流式数据:', parsed);

                if (parsed.choices && parsed.choices[0] && parsed.choices[0].delta) {
                  const delta = parsed.choices[0].delta;
                  const content = delta.content;
                  const reasoning = delta.reasoning_content;

                  if (content || reasoning) {
                    if (content) {
                      fullContent += content;
                      console.log('Pollinations发送内容块:', content);
                    }
                    if (reasoning) {
                      console.log('Pollinations发送思考过程块:', reasoning);
                    }
                    options.onChunk!(content || '', reasoning);
                  }
                }
              } catch (e) {
                console.log('Pollinations解析流式数据失败:', e, '数据:', data);
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      const cleanResponse = fullContent
        .replace(/^回答：/, '')
        .replace(/^AI助手：/, '')
        .trim();

      console.log('Pollinations流式输出最终内容:', cleanResponse);

      return {
        content: cleanResponse || '抱歉，我没有理解您的问题，请重新描述一下。',
        model: requestBody.model,
        usage: {
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0
        }
      };
    } else {
      console.log('Pollinations使用非流式输出');

      const response = await fetch(
        `${this.proxyUrl}?target=${this.textUrl}/v1/chat/completions&_t=${Date.now()}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          },
          body: JSON.stringify(requestBody),
          signal: options?.signal
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      let content = '';
      if (data && data.choices && data.choices.length > 0) {
        content = data.choices[0].message?.content || '';
      } else if (typeof data === 'string') {
        content = data;
      } else {
        content = String(data);
      }

      const cleanResponse = content
        .replace(/^回答：/, '')
        .replace(/^AI助手：/, '')
        .trim();

      return {
        content: cleanResponse || '抱歉，我没有理解您的问题，请重新描述一下。',
        model: requestBody.model,
        usage: {
          promptTokens: data?.usage?.prompt_tokens || 0,
          completionTokens: data?.usage?.completion_tokens || 0,
          totalTokens: data?.usage?.total_tokens || 0
        }
      };
    }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'name' in error && (error as any).name === 'AbortError') {
      console.log('Pollinations请求被终止');
      throw error;
    }
    console.error('Pollinations API 调用失败:', error);
    throw new Error('AI服务暂时不可用，请稍后重试');
  }
}

