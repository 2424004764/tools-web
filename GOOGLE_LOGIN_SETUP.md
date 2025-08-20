# 谷歌登录配置说明

## 1. 创建谷歌OAuth应用

1. 访问 [Google Cloud Console](https://console.cloud.google.com/)
2. 创建新项目或选择现有项目
3. 启用 Google+ API
4. 在"凭据"页面创建OAuth 2.0客户端ID
5. 设置授权重定向URI（开发环境：http://localhost:5173）

## 2. 配置环境变量

```env
VITE_GOOGLE_CLIENT_ID=your-google-client-id
VITE_GOOGLE_CLIENT_SECRET=your-google-client-secret
```

## 3. 安装依赖

```bash
pnpm add @google-cloud/local-auth googleapis
```

## 4. 注意事项

- 确保在谷歌控制台中添加了正确的重定向URI
- 生产环境需要配置HTTPS域名
- 客户端ID和密钥不要提交到版本控制系统