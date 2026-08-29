# Contributing

## 开发

安装依赖，类型依赖见下：

```sh
npm install --legacy-peer-deps
npm run typecheck     # tsc --noEmit
npm run build         # 生成 lib/index.js + lib/client.js + lib/types
npm test              # 时段/倒计时冒烟测试
```

类型依赖说明：客户端类型（`@deepseek-ai/cordis` 的 `Context`、
`@deepseek-ai/dsh-client-ui-conversation/client` 的会话标题栏槽位声明、
`@deepseek-ai/dsh-client-ui-renderer/client` 的 `slots` 服务声明）在 dsh-0.1.2-alpha.1 发布前
尚未推送到 npm，因此 `package.json` 的 devDeps 用 `file:../../deepseek-harness/packages/client/...`
指向本地 DSH 仓库检出（该检出需先执行 `pnpm build:lib:client` 生成 `lib/types`）。
`file:` 依赖是安装时拷贝语义，harness 检出更新后需重新 `npm install --legacy-peer-deps`。

## 构建产物

`lib/` 随仓库提交，克隆即可安装使用；改 `src/` 后重新构建。

## 工作原理

用固定 UTC+8 纯算术取北京时间；峰期为工作日 09:00–12:00 与 14:00–18:00，谷期连续到下一峰期开始。
胶囊注册在 DSH 客户端的 `conversation.session.header.utilities` 槽位（`order: -1`），
每秒对齐秒边界刷新，随 Cordis 生命周期清理。
