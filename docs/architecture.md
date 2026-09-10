# 梁文谷 — 实现架构

一个 DSH Web 客户端插件，同时有宿主（Node）半侧与浏览器半侧。宿主半侧只做一件事：把 DeepSeek 账户余额安全地送到浏览器；浏览器半侧渲染胶囊（时段 / 倒计时 / 余额）与点击展开的详情菜单（官方价目表 → 本会话综合单价 → 余额详情）。

## 0. 一页速览

```
┌─ 浏览器 ─────────────────────────────────────────────────────────────┐
│  DSH Web shell                                                       │
│   window.__ModuleLoader__.load({ id: 'liangwengu', factory })        │
│            │ platform seed（react / react/jsx-runtime）               │
│            ▼                                                         │
│   lib/client.js  ── apply(ctx) ──► ctx.slots.register(...)           │
│            │                          │                              │
│            │                          ▼                              │
│            │            conversation.session.header.utilities        │
│            │              └─ TimeSlotIndicator（胶囊 + 详情菜单）     │
│            │                     ├─ 每秒 tick：时段 / 倒计时         │
│            │                     ├─ tokenUsage / modelSelection 投影 │
│            │                     └─ balance store（轮询器）           │
│            ▼                                                         │
│   POST /api/liangwengu.balance  （同源，带浏览器鉴权 cookie）         │
└──────────────────────────────┬───────────────────────────────────────┘
                               │ Connection 的共享 /api 通道
┌─ Node（dsh web 进程）────────▼───────────────────────────────────────┐
│  cordis 树（profile bundles + cordis.patch.yml 组合）                │
│    └─ 行 { id: 梁文谷, name: liangwengu }                            │
│         └─ lib/index.js  apply(ctx)  inject: ['connection']          │
│              └─ connection.fetch.register({                          │
│                   path: '/api/liangwengu.balance', methods: ['POST']})│
│                    │ 凭据服务按引用解析 key（回落 process.env）       │
│                    ▼                                                 │
│              GET https://api.deepseek.com/user/balance               │
│                    │                                                 │
│              { ok: true, value: { isAvailable, entries,              │
│                                   pollIntervalMs, lowBalance… } }    │
└──────────────────────────────────────────────────────────────────────┘
```

三条不变量贯穿全图：

1. **API key 永不出宿主**：浏览器只知道同源路由，key 由宿主每次请求时按引用解析。
2. **浏览器半侧零运行时依赖**：bundle 只 `require('react')` 与 `require('react/jsx-runtime')`，其余全部内联或 type-only。
3. **`lib/` 即产物**：仓库提交构建产物，CI 用 `git diff --exit-code -- lib` 防漂移。

## 1. 运行拓扑（进程与契约边界）

```mermaid
flowchart TB
  subgraph Browser["浏览器进程"]
    Shell["DSH Web shell<br/>__DSH_BOOT__ / platform seed"]
    Loader["window.__ModuleLoader__<br/>惰性 CJS 模块表"]
    Bundle["lib/client.js<br/>（已提交的构建产物）"]
    Badge["TimeSlotIndicator<br/>胶囊 + 详情菜单"]
    Store["balance store<br/>轮询 / 退避 / 可见性暂停"]
    Shell --> Loader --> Bundle --> Badge
    Badge --> Store
    Badge -.->|useProjection| Proj["tokenUsage / modelSelection<br/>会话投影"]
  end

  subgraph Node["Node 进程（dsh web）"]
    Patch["cordis.patch.yml<br/>insert 行 { id: 梁文谷 }"]
    Host["lib/index.js<br/>apply(ctx), inject: ['connection']"]
    Conn["Connection 服务<br/>共享 /api 通道 + 鉴权/信任栅栏"]
    Cred["credentials 服务<br/>按引用解析 API key"]
    Patch --> Host
    Host -->|fetch.register| Conn
    Host -->|resolve apiKeyEnv| Cred
  end

  Store -->|"POST /api/liangwengu.balance"| Conn
  Conn -->|"ok / error（均 200，no-store）"| Store
  Host -->|"GET /user/balance（Bearer key）"| DeepSeek["DeepSeek API<br/>api.deepseek.com"]

  CM["client-modules<br/>扫描 dsh.client 声明"] -->|"提供 /plugins/liangwengu/client.js"| Loader
```

要点：

- 宿主半侧注册的是 **Connection 上的精确 Fetch 路由**（不是 `connection.rpc.handle`）：共享 `/api` 载体会先做 Host/Origin 栅栏与浏览器鉴权，再进处理器。
- 路由路径是本插件私有的 `/api/liangwengu.balance`：Connection 对重复的精确路由直接抛错，用私有路径才能与 `dsh-deepseek-balance` 同时安装。
- 宿主半侧声明 `inject: ['connection']`，没有该服务的 profile（headless）不会激活它，浏览器半侧照常加载（余额行显示「查询失败」）。

## 2. 模块与构建

```mermaid
flowchart LR
  subgraph Src["src/"]
    HostTs["index.ts<br/>宿主：配置、凭据、路由"]
    ApiTs["balance-api.ts<br/>GET /user/balance 客户端"]
    CIndex["client/index.tsx<br/>胶囊 + 面板外壳 + apply"]
    CSlot["client/time-slot.ts<br/>时段与倒计时算术"]
    CPricing["client/PricingTable.tsx<br/>① 官方价目表 + 调价预告"]
    CComposite["client/CompositeSection.tsx<br/>② 本会话综合单价"]
    CBalanceSection["client/BalanceSection.tsx<br/>③ 余额详情"]
    CBalance["client/balance.ts<br/>轮询器与显示规则"]
    CPricingMath["client/pricing.ts<br/>价目表数据与计价数学"]
    CStyles["client/styles.ts<br/>样式表"]
    HostTs --> ApiTs
    CIndex --> CSlot
    CIndex --> CPricing
    CIndex --> CComposite
    CIndex --> CBalanceSection
    CIndex --> CStyles
    CPricing --> CPricingMath
    CComposite --> CPricingMath
    CBalanceSection --> CBalance
    CIndex --> CBalance
    CSlot --> CPricingMath
  end

  subgraph Build["scripts/build.mjs"]
    EsbuildHost["esbuild: node / ESM / bundle<br/>无 externals"]
    EsbuildClient["esbuild: browser / CJS / jsx automatic<br/>externals: react, react/jsx-runtime, react-dom, @deepseek-ai/*"]
    Tsc["tsc -p tsconfig.build.json"]
  end

  subgraph Lib["lib/（提交入库）"]
    LIndex["index.js<br/>export { apply, inject }"]
    LClient["client.js<br/>__ModuleLoader__.load 闭包工厂"]
    LTypes["types/**<br/>.d.ts"]
  end

  HostTs --> EsbuildHost --> LIndex
  CIndex --> EsbuildClient --> LClient
  Src --> Tsc --> LTypes

  LIndex -->|package.json main| HostRun["宿主 cordis 树"]
  LClient -->|exports './client'| ClientRun["浏览器 __ModuleLoader__"]
```

`package.json` 的四个消费契约：

| 字段 | 值 | 消费方 |
| --- | --- | --- |
| `main` / `exports["."]` | `lib/index.js` + `lib/types/index.d.ts` | 宿主 cordis Loader |
| `exports["./client"]` | `lib/client.js` | client-modules 的 bundle 路由 |
| `dsh.client.platform` | `web` | client-modules 扫描 |
| `dsh.bundle.patch` | `./cordis.patch.yml` | `dsh plugin add` / profile 组合 |

两个半侧的生效方式不同：宿主半侧 `lib/index.js` 在 `dsh web` 启动时导入一次（改完要重启进程），浏览器半侧由 client-modules 每次从磁盘读给页面（刷新即可）。正因为生效时机不同，构建时会给两个半侧注入同一枚 `__LWGU_STAMP__`（`src/` 的源码指纹），宿主在每次响应里带上它——但指纹只用于**比对**：两侧不一致时菜单才多出一条提示，一致时界面里没有任何构建字段。否则「新前端 + 旧后端」只会表现为一个费解的 404。

## 3. 客户端组件与数据流

```mermaid
flowchart TB
  subgraph Slot["conversation.session.header.utilities（order: -1）"]
    Badge["button.dsh-liangwengu<br/>aria-haspopup=dialog"]
    Line["一行：● 当前时段：梁文峰 · 剩余 01:23:45 | 余额 ￥110.00<br/>余额段 data-tone = ok | low | stale | none"]
    Panel["div.dsh-lwgu-panel（role=dialog, position: fixed）"]
    Badge --> Line
    Badge -->|click| Panel
  end

  subgraph PanelBlocks["菜单三块（自上而下）"]
    P1["① 官方定价：OFFICIAL_MODELS<br/>按当前时段取档 + 调价预告"]
    P2["② 本会话综合单价：tokenUsage 四桶<br/>命中率 / 元每亿 tokens"]
    P3["③ 账户余额：每币种总额 + 赠金/充值<br/>可用性 · 更新时间 · 手动刷新"]
    P1 --> P2 --> P3
  end
  Panel --> P1

  Tick["每秒 tick（对齐秒边界）"] --> Line
  Tick --> P1
  Projections["useProjection('tokenUsage')<br/>useProjection('modelSelection')"] --> P2
  Store["balance store.getSnapshot()"] --> Line
  Store --> P3
  Store -->|refresh| P3
```

菜单的可访问性行为：`role="dialog"` 的**非模态**面板（页面其余部分仍可用，点击外部即关），因此不设 `aria-modal`、也不锁焦点；但打开时焦点会移入面板（`tabIndex={-1}`，`visibility: hidden` 期间无法聚焦，故等定位那一帧之后再聚焦），关闭时归还给打开它的元素——否则键盘用户得先 Tab 穿过整页才能碰到模型行与刷新按钮。

时序（一次余额轮询）：

```mermaid
sequenceDiagram
  participant U as 用户
  participant B as 胶囊组件
  participant S as balance store
  participant C as Connection /api
  participant H as 宿主处理器
  participant K as credentials 服务
  participant D as DeepSeek API

  U->>B: 打开会话（胶囊挂载）
  B->>S: acquire()（引用计数 0→1，立即查一次）
  S->>C: POST /api/liangwengu.balance（同源 + 鉴权 cookie）
  C->>C: Host/Origin 栅栏 + 浏览器鉴权
  C->>H: 精确路由命中
  H->>K: resolve(apiKeyEnv)
  K-->>H: { value: 'sk-…' }
  H->>D: GET /user/balance（Bearer key，10s 超时）
  D-->>H: is_available + balance_infos
  H-->>C: 200 { ok: true, value: { entries, pollIntervalMs, lowBalanceThreshold } }
  C-->>S: JSON
  S->>S: 写状态 + 通知订阅者
  S-->>B: 重渲染 → 行内余额段更新
  S->>S: 排下一次（interval / 退避；页面隐藏则暂停）

  Note over H,D: 任何失败都回 200 { ok:false, error:{ code, message } }<br/>code ∈ no-key | unauthorized | network | api | invalid-response
  Note over S: 失败保留上一次成功值（余额段转黄并标 ⚠），<br/>从未成功则显示 查询中… / 未配置密钥 / 查询失败
  Note over U,S: 菜单里的「刷新」按钮走同一个轮询器（查询中禁用）
```

## 4. 目录职责

| 路径 | 职责 |
| --- | --- |
| `src/index.ts` | 宿主半侧：配置解析与钳制、凭据解析（服务→环境变量）、注册 `/api/liangwengu.balance`、合并窗口、把快照与生效配置一起下发 |
| `src/balance-api.ts` | `GET /user/balance` 的请求、解析、错误分类；纯函数，可脱离网络测试 |
| `src/client/index.tsx` | 胶囊渲染、面板外壳（定位 / 焦点 / 关闭）、`apply` 注册槽位、测试用再导出 |
| `src/client/time-slot.ts` | 北京时间峰谷判定、剩余时间与倒计时格式化（纯算术，无 Intl） |
| `src/client/pricing.ts` | 官方价目表数据（按生效时间分档）、计价数学、档位标签 |
| `src/client/PricingTable.tsx` | 菜单第一块：价目表与调价预告（`memo`，只随档位 / 生效分档 / 选中模型变化） |
| `src/client/CompositeSection.tsx` | 菜单第二块：本会话综合单价（`memo`） |
| `src/client/BalanceSection.tsx` | 菜单第三块：余额详情与手动刷新（`memo`） |
| `src/client/balance.ts` | 引用计数轮询器（退避、抖动、可见性暂停、失败保留旧值）与余额显示规则 |
| `src/client/styles.ts` | 样式表（DSW token + 兜底色，跟随 `body[data-ds-dark-theme]`） |
| `scripts/build.mjs` | 两个半侧的 esbuild 打包 + `tsc` 出 `.d.ts` |
| `cordis.patch.yml` | 把宿主行插进 profile 组合树（`name` 必须是包名，Node 解析才能找到） |
| `lib/**` | 提交入库的构建产物：`index.js` / `client.js` / `types/**` |
| `test/*.mjs` | 全部加载构建产物：时段、计价、余额状态机、宿主路由契约、jsdom 真实渲染；`react-stub.mjs` 是给不渲染的用例共用的 react 桩 |

## 5. 兼容性与契约面

插件消费的 DSH 契约面（`dsh-v0.1.3-alpha.1` ~ `dsh-v0.1.5-rc.1` 上逐字一致）：

| 契约 | 用途 |
| --- | --- |
| `dsh.client` 声明 + `window.__ModuleLoader__.load({ id, factory })` | 浏览器半侧被加载 |
| `ctx.slots.inject / register`（`{ name, id, order }`） | 胶囊挂到会话标题栏 utilities 槽 |
| `PropsRuntime<'conversation.session.header.utilities'>` 的 `useProjection` / `sessionId` | 读会话投影 |
| `@deepseek-ai/dsh-token-meter/client` 的 `tokenUsage` 四桶 | 综合单价 |
| `@deepseek-ai/dsh-api-session-controller/types` 的 `modelSelection` | 默认计价模型 |
| `connection.fetch.register({ path, methods, requestBody, fetch })` | 宿主余额通道 |
| `ctx.get('credentials').resolve(ref)` | API key 解析（与模型适配器同一条链） |
| `@deepseek-ai/cordis` 4.0.2 | `Context` / `Service` / fiber 生命周期 |

放弃兼容与后续策略见 [README「兼容性」](../README.md#兼容性)。
