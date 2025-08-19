import { AIProvider } from '../../common/interfaces'
import { chat } from './chat'
import { generateImage } from './image'

export class PollinationsProvider implements AIProvider {
  name = 'Pollinations'
  version = '1.0.0'
  capabilities = ['chat', 'image-generation', 'text-processing']
  
  public apiKey: string
  public proxyUrl: string
  public textUrl: string
  public imageUrl: string
  
  constructor(config: {
    apiKey: string
    proxyUrl: string
    textUrl: string
    imageUrl: string
  }) {
    this.apiKey = config.apiKey
    this.proxyUrl = config.proxyUrl
    this.textUrl = config.textUrl
    this.imageUrl = config.imageUrl
  }
  
  chat = chat.bind(this)
  generateImage = generateImage.bind(this)
}

// 工厂函数
export function createPollinationsProvider(config: {
  apiKey: string
  proxyUrl: string
  textUrl: string
  imageUrl: string
}) {
  return new PollinationsProvider(config)
}
