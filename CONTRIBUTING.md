# Contributing

## 开发

安装依赖，类型依赖见下：

```sh
npm install --legacy-peer-deps
npm run typecheck     # tsc --noEmit
npm run build         # 生成 lib/index.js + lib/client.js + lib/types
npm test              # 三个测试串行执行，全部读构建产物 lib/client.js
```

测试分层（都通过 `window.__ModuleLoader__` 加载已构建的 bundle，验的是发布产物）：

- `test/time-slot.test.mjs` — 峰/谷判定、倒计时与剩余时间
- `test/pricing.test.mjs` — 价目表数值、调价生效时刻取档、综合单价与格式化
- `test/menu.test.mjs` — jsdom 里真实渲染组件：菜单展开/外部点击收起/Esc 收起，并在调价前后两个伪造时刻断言菜单显示对应档位（`react-dom` + `jsdom` 仅测试用）

类型依赖说明：客户端类型（`@deepseek-ai/cordis` 的 `Context`、
`@deepseek-ai/dsh-client-ui-conversation/client` 的会话标题栏槽位声明、
`@deepseek-ai/dsh-client-ui-renderer/client` 的 `slots` 服务声明、
`@deepseek-ai/dsh-token-meter/client` 的 `tokenUsage` 投影、
`@deepseek-ai/dsh-api-session-controller/types` 的 `modelSelection` 投影与
`UseProjection`）尚未发布到 npm，因此 `package.json` 的 devDeps 用
`file:../../deepseek-harness/packages/...` 指向本地 DSH 仓库检出
（该检出需先执行 `pnpm build:lib` 生成 `lib/types`）。harness 检出
更新后需重新 `npm install --legacy-peer-deps` 刷新；`@deepseek-ai/cordis`
取 npm 版本，与 harness 当前 vendor 的版本保持一致（现为 4.0.2）。

`tsconfig.json` 的 `paths` 把 `@deepseek-ai/cordis` 固定到本包安装的拷贝：
不固定时，`file:`/junction 布局下 ui-renderer 的 d.ts 会把 cordis 解析到
harness vendor（其 `lib/types` 是未入库的构建产物），与插件 import 的
`Context` 分裂成两个模块身份，`Context.slots` 增广失效（TS2339）。

CI（`.github/workflows/ci.yml`）按矩阵在 `dsh-v0.1.2-alpha.1` ~ `alpha.5`、
`dsh-v0.1.2-rc.1` 与 `dsh-v0.1.3-alpha.1` ~ `alpha.2` 八个 tag 上分别执行
typecheck + build + test，各自 pin 到固定 commit。

## 构建产物

`lib/` 随仓库提交，克隆即可安装使用；改 `src/` 后重新构建。

## 工作原理

用固定 UTC+8 纯算术取北京时间；峰期为工作日 09:00–12:00 与 14:00–18:00，谷期连续到下一峰期开始。
胶囊注册在 DSH 客户端的 `conversation.session.header.utilities` 槽位（`order: -1`），
每秒对齐秒边界刷新，随 Cordis 生命周期清理。

## 定价数据

官方价目表与综合单价计算都在 `src/client/pricing.ts`。每个模型的 `revisions` 按 `effectiveFrom`
（UTC 毫秒）升序列出各次调价，`rateAt` / `activeRevision` / `nextRevision` 解析某一时刻生效的档位；
高峰价恒为空闲价的 2 倍（官方规则），测试会校验这条不变量。

新增一次调价：按 [官方定价页](https://api-docs.deepseek.com/zh-cn/quick_start/pricing) 在对应模型的
`revisions` 末尾追加一条（`effectiveFrom` 用 `Date.UTC(...)` 表示北京时间），并同步
`test/pricing.test.mjs` 的期望值。已排期的调价无需其他改动——菜单每秒重算，到点自动切换。
