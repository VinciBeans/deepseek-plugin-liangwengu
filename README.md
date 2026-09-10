<div align="center">

# 梁文谷

**在 DeepSeek Harness 里显示当前算力错峰时段，并实时倒计时剩余时间**

装上它，会话窗口会显示现在该用梁文峰还是梁文谷，以及距离切换便宜算力时段还剩多久。

<p align="center">
  <a href="https://www.npmjs.com/package/liangwengu">
    <img src="https://img.shields.io/npm/v/liangwengu?style=flat&colorA=000000&colorB=000000" />
  </a>
  <a href="https://github.com/VinciBeans/deepseek-plugin-liangwengu/blob/main/LICENSE">
    <img src="https://img.shields.io/github/license/VinciBeans/deepseek-plugin-liangwengu?style=flat&colorA=000000&colorB=000000" />
  </a>
</p>

</div>

## Install

需要已安装 DSH，并至少成功启动过一次 Web GUI。从 npm 安装（按 dist-tag 选择）：

1. **npm `latest`**（0.1.3-alpha.2，与 `next` 同步）— 兼容 dsh v0.1.3-alpha.1 ~ v0.1.5-rc.1：
   ```sh
   dsh plugin --profile web add liangwengu
   # 等价写法：dsh plugin --profile web add liangwengu@next
   ```
2. **npm `alpha`**（0.1.2-alpha.5）— 与 `latest` 同一契约代，保守通道：
   ```sh
   dsh plugin --profile web add liangwengu@alpha
   ```

旧代 `0.1.1-rc.2` 不再挂在任何 dist-tag 上，仅可按确切版本安装（不兼容，见「兼容性」）。

源码安装（GitHub Release `v0.1.3-alpha.2` 即当前源码版）：`dsh plugin --profile web add .`。

## Quickstart

```sh
dsh plugin --profile web add liangwengu
dsh --profile web --dump-config          # 看到 liangwengu 层即安装成功
# 重启 dsh web，打开会话，标题栏右侧出现时段胶囊
```

## 它能做什么

- **当前时段:** 工作日 09:00–12:00 与 14:00–18:00 显示「梁文峰」，其余时间含整个周末显示「梁文谷」。
- **实时倒计时:** 时段标签右侧跟随显示剩余时间，每秒刷新，到点自动切换。
- **跨天谷期:** 周五 18:00 起连续到周一 09:00，最长 63 小时，超过 24 小时按天显示。
- **账户余额:** 胶囊下半行常驻显示 DeepSeek 账户余额（如「余额 ¥110.00」），每 5 秒经宿主半侧查询一次；余额不足或账户不可用时转红并带 ⚠，查询失败时保留上次成功值并转黄提示。
- **官方定价、综合单价与余额详情:** 鼠标悬停标签颜色加深，点击展开详情菜单——依次是 DeepSeek 官方价目表（按当前时段显示空闲/高峰档）、本会话缓存命中率算出的综合单价（元/亿 tokens），最下方是账户余额详情（各币种总可用 / 未过期赠金 / 充值余额 / 可用性 / 更新时间，带手动刷新）。
- **固定北京时间:** 用 Asia/Shanghai 计算，与你浏览器所在时区无关。
- **夜间模式:** 跟随 DSH 主题自动切换配色。

## 显示规则

| 日期 | 时段 | 显示 |
| --- | --- | --- |
| 周一至周五 | 09:00–12:00、14:00–18:00 | 梁文峰 |
| 周一至周五 | 其余时间 | 梁文谷 |
| 周六、周日 | 全天 | 梁文谷 |

## 定价与综合单价

点击标签展开的详情菜单自上而下分三块：**官方定价** → **本会话综合单价** → **账户余额**。

**第一块 · 官方定价。** DeepSeek 官方价目表（元/百万 tokens），按当前时段显示对应档位——空闲时段单价恰为高峰时段的一半，而高峰时段正是本插件判定的「梁文峰」时段（北京时间周一至周五 09:00–12:00、14:00–18:00）。价目表内置在 `src/client/pricing.ts`，来源为 [DeepSeek 官方定价页](https://api-docs.deepseek.com/zh-cn/quick_start/pricing)；价格以官方页面为准，变动时更新该文件即可。

> 价格是**数据**（每个模型的 `revisions` 按生效时间分档），而闲/忙时段的**窗口是代码**（`src/client/time-slot.ts` 的 `PEAK_SLOTS`）。若官方调整折扣时段，需要改代码而不只是加一行数据；只调整价格则加一条 revision 即可。

> **flash 系列调价（到点自动生效）**：按官方通知，北京时间 **2026-09-10 12:00** 起 flash 系列（`deepseek-v4-flash`、`deepseek-v4-flash-vision-exp`、`deepseek-flash`）空闲时段调整为 **命中 0.02 / 未命中 1 / 输出 4 元**，高峰时段为 2 倍；`deepseek-v4-pro` 不受影响。价目表按「生效时间分档」记录，菜单每秒重算，到点自动切换为新价、无需重载页面；调价前菜单会提前显示「2026-09-10 12:00 起本模型调价」的提示。

> **V4.1-Flash（`deepseek-flash`）**：与 flash 系列同价，价目表里直接复用同一组 `revisions`，因此本次 flash 系列调价同样覆盖它。

**第二块 · 本会话综合单价。** 读取当前会话的 `tokenUsage` 投影（未命中输入 / 缓存读取 / 缓存写入 / 输出四个互斥桶），给出：

- **缓存命中率** = 缓存读取 ÷（未命中输入 + 缓存读取 + 缓存写入）
- **综合单价** = Σ(各桶 token 数 × 该桶单价) ÷ 总 token 数 × 1e8，单位 **元/亿 tokens**

也就是用本会话自己的输入配比加权出的混合单价：缓存命中率越高，综合单价越接近缓存命中价；纯输出会话则等于输出价。计价模型默认取当前会话模型（`modelSelection` 投影），若它不在官方价目表中，菜单会明确提示并改用 V4-Flash 计价，同时允许点击上方模型行切换计价模型。金额按当前时段单价估算，跨时段的历史用量不做分段还原。

## 账户余额

胶囊下半行常驻显示当前 DeepSeek 账户余额（`GET /user/balance`）。

- **密钥不进浏览器:** 宿主半侧（`src/index.ts`）在 Connection 的共享 `/api` 通道上注册一条精确路由 `POST /api/liangwengu.balance`；浏览器半侧只 POST 这条同源路由，真正的 key 由宿主经 DSH 凭据服务按引用解析（与 DeepSeek 模型适配器同一条链），因此 Web Models 页存储或轮换的 key 下一次轮询即生效，key 从不下发到页面。
- **轮询与退避:** 默认 5 秒一次；连续失败按 `max((k+1)×interval, k×10s)` 退避（k≥3 固定 30 秒），任一次成功即恢复。页面隐藏时暂停，重新可见立即查一次。定时器带 **±10% 抖动**，宿主侧还有 **1.5 秒合并窗口**——多个标签页同刻轮询只产生一次上游查询（失败也共享，避免把一次故障放大成 N 次重试）。
- **失败保留旧值:** 查询失败不会清空余额，而是保留上一次成功值并把该行转黄（⚠）提示「陈旧」；从未成功过时显示 `查询中…` / `未配置密钥` / `查询失败`。
- **低余额告警:** 任一币种 `total_balance` 低于阈值（默认 10）或 `is_available=false` 时，余额行转红并显示 ⚠。仅样式提醒，不做系统通知。
- **多币种:** 协议允许 `balance_infos` 有多条，非零条目全部显示（如 `¥110.00 · $5.00`）。
- **构建戳与自诊断:** 两个半侧都带一份源码指纹（构建时对 `src/` 取哈希），但指纹本身不出现在界面上——只有两侧**不一致**时（宿主进程与页面来自不同构建），菜单底部才多出一条黄色提示「重启 dsh web 并刷新页面」。宿主半侧没加载余额路由时（HTTP 404，通常就是宿主进程比产物旧），菜单直接说明原因与处理办法，而不是抛一句通道错误。

**第三块 · 余额详情（菜单最下方）。** 标题右侧是手动刷新按钮（查询中禁用）；每个币种一行「`CNY 总可用` + 金额」，其下一行给出「未过期赠金 / 充值余额」，金额低于阈值时转红；再下面一行是「可用：可调用 / 不可调用 · 更新于 HH:MM:SS」。没有任何金额可显示时（未配置密钥、查询失败、首次查询中），这里给出对应的原因与处理办法，而不是空白。轮询失败时该区块保留上一次成功值并额外标出失败原因；仅当两个半侧来自不同构建时，这里才会多出一条版本不一致的提示。

宿主半侧的配置项写在 `cordis.patch.yml` 该行的 `config` 下，全部可选：`intervalMs`（默认 5000，最小 1000）、`lowBalanceThreshold`（默认 10）、`apiKeyEnv`（默认 `DEEPSEEK_API_KEY`）、`baseUrl`（默认 `https://api.deepseek.com`）。宿主把生效值随每次响应下发给浏览器半侧，改配置无需重新构建。

两点口径说明：阈值按**币种单位**直接比较（同一个数字对 CNY 与 USD 都生效，不按汇率折算）；界面文案只有中文——合并 `dsh-deepseek-balance` 时没有一并引入它的设置卡片、中英双语与 toast 通知，配置只能改上面的 YAML。

## 架构

宿主半侧只做一件事：把 DeepSeek 账户余额安全地送到浏览器（Connection 共享 `/api` 通道上的精确路由 + 凭据服务按引用解析 key）；浏览器半侧是唯一渲染面（会话标题栏胶囊 + 点击展开的详情菜单）；`lib/` 是提交入库的构建产物，CI 用 `git diff --exit-code -- lib` 防漂移。

进程拓扑、模块与构建、客户端组件数据流、一次余额轮询的时序图，以及各目录职责与消费的 DSH 契约面，见 [`docs/architecture.md`](docs/architecture.md)。

## 兼容性

**兼容性政策：** 本插件只跟随当前一代 dsh 客户端插件契约（`dsh.client` 声明 + `window.__ModuleLoader__.load({ id, factory })` + `ctx.slots` 注册面 + 平台 seed 表）。上游一旦出现破坏性变更，插件**只跟进新版本，不再为旧版本维护兼容性**：不保留兼容分支、不做双份实现、不为旧版本回溯修复；被放弃的版本会从下面的「支持」列表移出，同时从 CI 矩阵删除。

### 支持

- **dsh v0.1.5-alpha.1 ~ v0.1.5-rc.1（支持）:** 三个 tag 上插件消费的契约面与 0.1.3-alpha.2 逐字一致——`packages/client/ui-renderer/src`（`slots` 服务与 `SlotRegistry.inject / register`）、`packages/llm/token-meter/src/usage-projection.ts`（`tokenUsage` 四桶）、`packages/api/session-controller/src/model-selection-projection.ts`（`lastUsed` / `next` → `.provider` / `.model`）、`apps/cli/src/plugin.ts`（`dsh.bundle.patch` 解析）、`packages/client/modules/src/client/manifest.ts` 与 `packages/client/web/src/boot.ts`（`dsh.client` 校验与加载器模板）在各 tag 上零改动；`packages/client/ui-slots/src` 仅新增 `ResourceProtocolMap`。`conversation.session.header.utilities` 槽位声明与 `ConversationSession.tsx` 渲染点未动（0.1.5 新增的是它右侧的 `conversation.session.header.corner` 槽），列表排序仍按 `order` 升序，因此 `order: -1` 依然把胶囊排在导出按钮左侧。期间 `'conversation'` 槽改名为 `'main.conversation'`、平台模块新增 `@deepseek-ai/dsh-client-ui-dockkit`、`ClientModuleRegistry` 的 `webServer` 变为可选——本插件都不使用，故不受影响。`vendor/cordis` 在各 tag 上是同一棵树（`@deepseek-ai/cordis` 4.0.2，与本包 devDep 固定版本一致）。已实测：在 0.1.5-rc.1 的真实类型声明（其 `lib/types` 含 rc.1 才有的 `main.conversation`、`header.corner`、`ResourceProtocolMap`）上通过 typecheck，并在该版本上通过 build + test。
- **dsh v0.1.3-alpha.1 ~ v0.1.3-alpha.2（支持）:** 两个 tag 上逐项复核，插件消费的契约面与当时的基线 0.1.2-rc.1 一致——`packages/client/ui-slots/src`、`packages/client/ui-renderer/src` 与 `packages/client/web/src`（平台 seed 表）零改动，`conversation.session.header.utilities` 槽位声明与 `ConversationSession.tsx` 渲染点零改动，`apps/cli/src/plugin.ts` 的 `dsh.bundle.patch` 解析不变；`packages/client/modules` 仅把 `dsh.client` 声明类型集中到 `@deepseek-ai/dsh-package-manifest/types`，校验语义不变。另在 0.1.3-alpha.2 的真实 `SlotRegistry` 上跑通注册 → 渲染 → 卸载（条目 id/order/component 与 fiber 清理均符合预期）。
- CI 在 0.1.3-alpha.1 ~ alpha.2 与 0.1.5-alpha.1、alpha.2、rc.1 共五个 tag 上分别执行 typecheck + build + test（见 `.github/workflows/ci.yml` 的矩阵）。
- **宿主半侧依赖 Connection:** 余额通道注册在 Connection 的共享 `/api` 通道上，因此宿主半侧声明 `inject = ['connection']`——0.1.5-rc.1 的该接口为 `connection.fetch.register({ path: '/api/…', methods, requestBody, fetch })`。没有该服务的 profile（如 headless）不会激活宿主半侧，胶囊余额行会显示「查询失败」，其余功能与浏览器半侧的加载不受影响。
- 浏览器 bundle 运行时只 require `react` 与 `react/jsx-runtime`（均在平台 seed 表内），无其他运行时依赖；`@deepseek-ai/*` 全部为 type-only 引用，不在 bundle 中。

### 不再支持

- **dsh v0.1.2-alpha.1 ~ v0.1.2-rc.1（兼容性已放弃）:** 这一代曾随 0.1.3 之前的契约验证并列入支持矩阵，现已**显式放弃**：不再验证、不再修复，CI 矩阵中的对应 tag 已删除，README 也不再作任何承诺。请升级到 0.1.3-alpha.1 及以上版本使用本插件。
- **0.1.1-rc.2 及更早（不支持）:** 该代使用 `@deepseek-ai/dsh-client-runtime`，客户端上下文契约不同（非 cordis `Context`），本插件不兼容。

验证：`npm run typecheck`（`ctx.slots` 增广经 tsconfig `paths` 固定到本包安装的 cordis 拷贝）、`npm run build` + `npm test`（时段/倒计时/定价/菜单冒烟）。

## License

MIT
