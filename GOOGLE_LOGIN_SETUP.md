# 谷歌登录配置说明（Cloudflare部署版）

## 1. 创建谷歌OAuth应用

1. 访问 [Google Cloud Console](https://console.cloud.google.com/)
2. 创建新项目或选择现有项目
3. 启用 Google+ API
4. 在"凭据"页面创建OAuth 2.0客户端ID
5. 设置授权重定向URI：
   - 开发环境：`http://localhost:5173`
   - 生产环境：`https://yourdomain.com`

## 2. 配置环境变量

在项目根目录创建 `.env.local` 文件：

```env
VITE_GOOGLE_CLIENT_ID=your-google-client-id
```

## 3. Cloudflare Functions配置

确保 `functions/_routes.json` 包含：

```json
{
  "version": 1,
  "include": ["/proxy/*", "/google-auth"],
  "exclude": []
}
```

## 4. 部署流程

1. 本地开发：`pnpm dev`
2. 部署到Cloudflare：`pnpm run deploy` 或使用Wrangler

## 5. 安全注意事项

- 客户端ID可以公开，但不要暴露客户端密钥
- 生产环境建议启用HTTPS
- 可以在Cloudflare Function中添加更多安全验证
- 考虑添加速率限制防止滥用