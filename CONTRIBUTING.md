# Contributing

## 开发

安装依赖，类型依赖见下：

```sh
npm install --legacy-peer-deps
npm run typecheck     # tsc --noEmit
npm run build         # 生成 lib/index.js + lib/client.js + lib/types
npm test              # 五个测试串行执行，全部读构建产物 lib/client.js
```

若 `npm install` 报 `Ineffective mark-compacts`（`file:` 类型依赖让依赖图很大），加
`NODE_OPTIONS=--max-old-space-size=6144` 再跑；CI 已设该变量。

测试分层（都通过 `window.__ModuleLoader__` 加载已构建的 bundle，验的是发布产物）：

- `test/time-slot.test.mjs` — 峰/谷判定（含法定节假日与调休上班日）、倒计时与剩余时间
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

CI（`.github/workflows/ci.yml`）按矩阵在 `dsh-v0.1.3-alpha.1` ~ `alpha.2`、
`dsh-v0.1.5-alpha.1`、`alpha.2`、`rc.1`、`rc.2` 与 `dsh-v0.1.6-alpha.1`、`alpha.2`
共八个 tag 上分别执行 typecheck + build + test，各自 pin 到固定 commit。

支持范围与放弃策略见 README 的「兼容性」：`dsh-v0.1.2-alpha.1` ~ `rc.1` 的兼容性
已放弃（矩阵中已删除对应 tag，不再验证与修复）；上游出现破坏性变更时，本插件只
跟进新版本，不为旧版本保留兼容分支——届时同步删除矩阵中的旧 tag 并更新 README。

加一个新 tag（新版本按 `tag` + `pin`（`git rev-parse <tag>^{commit}`）加进矩阵）：

1. 逐个 diff 插件消费的契约文件，别只看版本号——0.1.5 那一代这些文件逐字未动，
   0.1.6 却重写了客户端模块系统与槽位实现，只有逐个对照声明形状才能判断：
   `dsh.client` 校验（`client/modules/src/client/manifest.ts`）、加载器模板与平台
   seed 表（`client/web/src/boot.ts`、`seed.ts`）、`conversation.session.header.utilities`
   的槽位声明与渲染点（`ui-conversation` 的 `contract/slots.ts`、`skeleton/ConversationSession.tsx`）、
   `tokenUsage` / `modelSelection` 投影、`connection.fetch.register` 与
   `credentials.resolve`、`dsh.bundle.patch` 解析（0.1.6 起在 `packages/boot/plugin-manager`）。
2. 用该 tag 的真实类型声明跑 `npm run typecheck`：本地 devDeps 是 `file:` 指向 harness
   检出的软链，检出切到该 tag 并 `pnpm run build:lib` 后，typecheck 验的就是该 tag；
   若本机检出恰好就是该 tag（工作树只多无关 commit），直接跑即可。
3. 同步 README「兼容性」的支持条目、`ci.yml` 矩阵上方的说明与 `package.json` 的适配范围。

## 构建产物

`lib/` 随仓库提交，克隆即可安装使用；改 `src/` 后重新构建。

两个半侧的生效方式不同：宿主半侧 `lib/index.js` 由 `dsh web` **启动时导入一次**，改完必须重启 web 进程；浏览器半侧 `lib/client.js` 由 client-modules 从磁盘读取并提供给页面，刷新页面即可。宿主半侧比 `lib/index.js` 旧时的典型症状是余额路由 404——胶囊与菜单会显示「宿主半侧没有加载余额路由：宿主进程多半比构建产物旧，重启 dsh web 后生效」。

构建时两个半侧都会注入 `__LWGU_STAMP__`（`scripts/build.mjs` 对 `src/` 下每个文件的相对路径与内容取哈希，行尾统一成 LF）。它必须**只由源码决定**：一旦掺入构建时间或 commit 哈希，CI 里的 `git diff --exit-code -- lib` 就会对同一份源码报出不同产物。这两枚指纹只在**不一致**时才出现在面板上（黄色提示重启 + 刷新）；一致时不显示任何构建字段，正常界面里看不到它。

## 工作原理

用固定 UTC+8 纯算术取北京时间；峰期为正常工作日（周一至周五，且不是法定节假日放假日期）09:00–12:00 与 14:00–18:00，谷期连续到下一峰期开始（跨周末、跨假期同样连续）。
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

## 法定节假日数据

官方口径是「周一至周五（不含中国法定节假日）9:00–12:00、14:00–18:00 为高峰时段，其余时段
含周末及法定节假日全天为空闲时段」，且调休上班的周末同样按空闲时段计费。判定因此是
**规则 + 逐年数据**：峰期规则在 `src/client/time-slot.ts`（`PEAK_SLOTS` 是窗口，`isPeakDay`
判「正常工作日」），放假日期在 `src/client/holidays.ts` 的 `HOLIDAY_SPANS`。

更新次年安排：国务院办公厅一般在头一年 11 月公布（2026 年那份是国办发明电〔2025〕7 号，
2025-11-04 发布），拿到通知后往 `HOLIDAY_SPANS` 追加 `['YYYY-MM-DD', 'YYYY-MM-DD']` 区间，
并同步 `HOLIDAY_SOURCE_URL`、`test/time-slot.test.mjs` 的 `NOTICE_SPANS`。只加数据，判定代码不动。
表里记的是通知的**整天放假区间**（连休两端都算，含其中的周末），不是「法定节假日」本身那几天：
官方按整段假期计费（2026 年中秋 3 天 + 国庆 7 天 = 10 天）。表未覆盖的日期按裸规则判定。

调休上班日（通知里的「上班」条款）**不需要单独一张表**：调休就是用周末换连休，这些日子固定
落在周六/周日，已被「周末全天为谷期」覆盖。`test/time-slot.test.mjs` 用 2026-09-20、10-10
（及它们之后那个周一的 09:00 峰期）锁住这条口径——若哪天把「工作日」改成官方上班日日历，
这两个用例会先炸。
