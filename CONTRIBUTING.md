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
`@deepseek-ai/dsh-client-ui-renderer/client` 的 `slots` 服务声明）尚未发布到
npm（alpha.1 ~ alpha.3 系列仍以 `file:` 形式引用），因此 `package.json` 的
devDeps 用 `file:../../deepseek-harness/packages/client/...` 指向本地 DSH 仓库
检出（该检出需先执行 `pnpm build:lib:client` 生成 `lib/types`）。harness 检出
更新后需重新 `npm install --legacy-peer-deps` 刷新。

`tsconfig.json` 的 `paths` 把 `@deepseek-ai/cordis` 固定到本包安装的拷贝：
不固定时，`file:`/junction 布局下 ui-renderer 的 d.ts 会把 cordis 解析到
harness vendor（其 `lib/types` 是未入库的构建产物），与插件 import 的
`Context` 分裂成两个模块身份，`Context.slots` 增广失效（TS2339）。

CI（`.github/workflows/ci.yml`）按矩阵在 `dsh-v0.1.2-alpha.1` / `alpha.2` /
`alpha.3` 三个 tag 上分别执行 typecheck + build + test，各自 pin 到固定 commit。

## 构建产物

`lib/` 随仓库提交，克隆即可安装使用；改 `src/` 后重新构建。

## 工作原理

用固定 UTC+8 纯算术取北京时间；峰期为工作日 09:00–12:00 与 14:00–18:00，谷期连续到下一峰期开始。
胶囊注册在 DSH 客户端的 `conversation.session.header.utilities` 槽位（`order: -1`），
每秒对齐秒边界刷新，随 Cordis 生命周期清理。
