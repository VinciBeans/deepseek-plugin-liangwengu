# Contributing

## 开发

安装依赖，类型依赖见下：

```sh
npm install --legacy-peer-deps
npm run typecheck     # tsc --noEmit
npm run build         # 生成 lib/index.js + lib/client.js + lib/types
npm test              # 三个测试串行执行，全部读构建产物 lib/client.js
```

若 `npm install` 报 `Ineffective mark-compacts`（`file:` 类型依赖让依赖图很大），加
`NODE_OPTIONS=--max-old-space-size=6144` 再跑；CI 已设该变量。

测试分层（都通过 `window.__ModuleLoader__` 加载已构建的 bundle，验的是发布产物）：

- `test/time-slot.test.mjs` — 峰/谷判定、倒计时与剩余时间
- `test/pricing.test.mjs` — 价目表数值、调价生效时刻取档、综合单价与格式化
- `test/balance.test.mjs` — 余额路由常量、轮询退避与抖动、状态机（成功/失败保留旧值/引用计数）与胶囊显示规则
- `test/host.test.mjs` — 直接 import `lib/index.js` 驱动宿主半侧 `apply`：注册的精确路由、成功/失败响应、合并窗口、配置默认值与缺 Connection 时的降级
- `test/menu.test.mjs` — jsdom 里真实渲染组件：菜单展开/外部点击收起/Esc 收起/焦点移入与归还，并在调价前后两个伪造时刻断言菜单显示对应档位（余额轮询用进程内 stub 的 `fetch` 顶掉，`react-dom` + `jsdom` 仅测试用）
- `test/react-stub.mjs` — 不渲染的用例共用的 react / jsx-runtime / react-dom 桩；bundle 在 import 期就会调用 `memo`，桩缺了它会直接炸在 import 而不是断言上

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

CI（`.github/workflows/ci.yml`）按矩阵在 `dsh-v0.1.3-alpha.1` ~ `alpha.2` 与
`dsh-v0.1.5-alpha.1`、`alpha.2`、`rc.1` 共五个 tag 上分别执行
typecheck + build + test，各自 pin 到固定 commit。

支持范围与放弃策略见 README 的「兼容性」：`dsh-v0.1.2-alpha.1` ~ `rc.1` 的兼容性
已放弃（矩阵中已删除对应 tag，不再验证与修复）；上游出现破坏性变更时，本插件只
跟进新版本，不为旧版本保留兼容分支——届时同步删除矩阵中的旧 tag 并更新 README，
新版本按 `tag` + `pin`（`git rev-parse <tag>^{commit}`）加进矩阵。

## 构建产物

`lib/` 随仓库提交，克隆即可安装使用；改 `src/` 后重新构建。

两个半侧的生效方式不同：宿主半侧 `lib/index.js` 由 `dsh web` **启动时导入一次**，改完必须重启 web 进程；浏览器半侧 `lib/client.js` 由 client-modules 从磁盘读取并提供给页面，刷新页面即可。宿主半侧比 `lib/index.js` 旧时的典型症状是余额路由 404——胶囊与菜单会显示「宿主半侧没有加载余额路由：宿主进程多半比构建产物旧，重启 dsh web 后生效」。

构建时两个半侧都会注入 `__LWGU_STAMP__`（`scripts/build.mjs` 对 `src/` 下每个文件的相对路径与内容取哈希，行尾统一成 LF）。它必须**只由源码决定**：一旦掺入构建时间或 commit 哈希，CI 里的 `git diff --exit-code -- lib` 就会对同一份源码报出不同产物。这两枚指纹只在**不一致**时才出现在面板上（黄色提示重启 + 刷新）；一致时不显示任何构建字段，正常界面里看不到它。

## 工作原理

用固定 UTC+8 纯算术取北京时间；峰期为工作日 09:00–12:00 与 14:00–18:00，谷期连续到下一峰期开始。
胶囊注册在 DSH 客户端的 `conversation.session.header.utilities` 槽位（`order: -1`），
每秒对齐秒边界刷新，随 Cordis 生命周期清理。

## 余额数据

宿主半侧（`src/index.ts`）在 Connection 的共享 `/api` 通道上注册精确路由
`POST /api/liangwengu.balance`，用凭据服务解析出的 key 调 DeepSeek `GET /user/balance`；
浏览器半侧（`src/client/balance.ts`）轮询这条同源路由，key 不进浏览器。
`src/balance-api.ts` 的请求/解析/错误分类是纯函数，可脱离网络测试。

轮询规则：默认间隔 5 秒，连续失败按 `max((k+1)×interval, k×10s)` 退避（k≥3 固定 30 秒），
成功即清零；页面隐藏暂停。定时器带 ±10% 抖动（`jitteredDelayMs`），宿主侧另有 1.5 秒合并窗口
（`COALESCE_MS`）：每个标签页各跑各的定时器，缺这两层的话 N 个标签就是 N 倍上游查询，失败时
更是 N 倍重试。失败保留上一次成功值，胶囊行转黄提示陈旧，不清空。
路由路径是本插件私有的（不复用 `dsh-deepseek-balance` 的路径）：Connection 对重复的精确路由
直接抛错，两个插件同时安装时各自的通道都要能用。

新增展示项时改 `src/client/balance.ts` 的显示规则并同步 `test/balance.test.mjs`；
若改了路由路径，记得同时改宿主半侧的常量与 `BALANCE_PATH`。

## 定价数据

官方价目表与综合单价计算都在 `src/client/pricing.ts`。每个模型的 `revisions` 按 `effectiveFrom`
（UTC 毫秒）升序列出各次调价，`rateAt` / `activeRevision` / `nextRevision` 解析某一时刻生效的档位；
高峰价恒为空闲价的 2 倍（官方规则），测试会校验这条不变量。

新增一次调价：按 [官方定价页](https://api-docs.deepseek.com/zh-cn/quick_start/pricing) 在对应模型的
`revisions` 末尾追加一条（`effectiveFrom` 用 `Date.UTC(...)` 表示北京时间），并同步
`test/pricing.test.mjs` 的期望值。已排期的调价无需其他改动——菜单每秒重算，到点自动切换。
