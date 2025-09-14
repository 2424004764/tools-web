import { ChatMessage, ChatOptions, ChatResponse } from '../../common/interfaces'

export async function chat(
  this: any,
  messages: ChatMessage[], 
  options?: ChatOptions
): Promise<ChatResponse> {
  if (!this.apiKey || !this.proxyUrl) {
    throw new Error('API配置不完整')
  }

  // 构建 OpenAI 兼容的请求体
  const requestBody = {
    model: options?.model || 'google/gemma-3-27b',
    messages: messages.map(msg => ({
      role: msg.role,
      content: msg.content
    })),
    temperature: options?.temperature || 0.7,
    max_tokens: options?.maxTokens || 2000,
    stream: options?.stream || false
  }

  try {
    if (options?.stream && options?.onChunk) {
      console.log('开始流式输出请求', this.apiKey);
      
      // 使用 fetch API 处理流式响应
      const response = await fetch(
        `${this.proxyUrl}?path=api/v1/chat/completions&target=${this.baseUrl}&params=_t=${Date.now()}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody),
          signal: options.signal // 传递终止信号
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
          // 检查是否被终止
          if (options.signal?.aborted) {
            throw new DOMException('流式请求被终止', 'AbortError');
          }

          const { done, value } = await reader.read();
          
          if (done) {
            console.log('流式读取完成');
            break;
          }

          // 解码数据块
          const chunk = decoder.decode(value, { stream: true });
          buffer += chunk;
          
          // 处理完整的行
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // 保留最后一个可能不完整的行
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6).trim();
              
              if (data === '[DONE]') {
                console.log('收到结束标记');
                break;
              }
              
              try {
                const parsed = JSON.parse(data);
                console.log('解析的流式数据:', parsed);
                
                if (parsed.choices && parsed.choices[0] && parsed.choices[0].delta) {
                  const delta = parsed.choices[0].delta;
                  const content = delta.content;
                  const reasoning = delta.reasoning_content;
                  
                  if (content || reasoning) {
                    if (content) {
                      fullContent += content;
                      console.log('发送内容块:', content);
                    }
                    if (reasoning) {
                      console.log('发送思考过程块:', reasoning);
                    }
                    // 立即调用回调函数，传递两个参数
                    options.onChunk!(content || '', reasoning);
                  }
                }
              } catch (e) {
                console.log('解析流式数据失败:', e, '数据:', data);
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      console.log('流式输出最终内容:', fullContent);

      return {
        content: fullContent.trim(),
        model: requestBody.model,
        usage: {
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0
        }
      };
    } else {
      console.log('使用非流式输出');
      
      // 非流式输出处理（使用fetch代替axios）
      const response = await fetch(
        `${this.proxyUrl}?path=api/v1/chat/completions&target=${this.baseUrl}&params=_t=${Date.now()}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody),
          signal: options?.signal // 也支持非流式请求的终止
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      // 处理 OpenAI 兼容的响应格式
      let content = '';
      if (data && data.choices && data.choices.length > 0) {
        content = data.choices[0].message?.content || '';
      } else if (typeof data === 'string') {
        content = data;
      } else {
        content = String(data);
      }

      return {
        content: content.trim(),
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
      console.log('AiTools请求被终止');
      throw error; // 重新抛出终止错误
    }
    console.error('AiTools API 调用失败:', error);
    throw new Error('AI服务暂时不可用，请稍后重试');
  }
}
