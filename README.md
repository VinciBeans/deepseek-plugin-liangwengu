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

1. **npm `latest`**（0.1.3-alpha.2，与 `next` 同步）— 兼容 dsh v0.1.2-alpha.1 ~ v0.1.3-alpha.2：
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
- **实时倒计时:** 标签下方显示当前时段剩余时间，每秒刷新，到点自动切换。
- **跨天谷期:** 周五 18:00 起连续到周一 09:00，最长 63 小时，超过 24 小时按天显示。
- **官方定价与综合单价:** 鼠标悬停标签颜色加深，点击展开详情菜单——上半部分是 DeepSeek 官方价目表（按当前时段显示空闲/高峰档），下半部分用本会话的缓存命中率等用量算出综合单价（元/亿 tokens）。
- **固定北京时间:** 用 Asia/Shanghai 计算，与你浏览器所在时区无关。
- **夜间模式:** 跟随 DSH 主题自动切换配色。

## 显示规则

| 日期 | 时段 | 显示 |
| --- | --- | --- |
| 周一至周五 | 09:00–12:00、14:00–18:00 | 梁文峰 |
| 周一至周五 | 其余时间 | 梁文谷 |
| 周六、周日 | 全天 | 梁文谷 |

## 定价与综合单价

点击标签展开的详情菜单分上下两部分。

**上半部分 · 官方定价。** DeepSeek 官方价目表（元/百万 tokens），按当前时段显示对应档位——空闲时段单价恰为高峰时段的一半，而高峰时段正是本插件判定的「梁文峰」时段（北京时间周一至周五 09:00–12:00、14:00–18:00）。价目表内置在 `src/client/pricing.ts`，来源为 [DeepSeek 官方定价页](https://api-docs.deepseek.com/zh-cn/quick_start/pricing)；价格以官方页面为准，变动时更新该文件即可。

> **flash 系列调价（到点自动生效）**：按官方通知，北京时间 **2026-09-10 12:00** 起 flash 系列（`deepseek-v4-flash`、`deepseek-v4-flash-vision-exp`）空闲时段调整为 **命中 0.02 / 未命中 1 / 输出 4 元**，高峰时段为 2 倍；`deepseek-v4-pro` 不受影响。价目表按「生效时间分档」记录，菜单每秒重算，到点自动切换为新价、无需重载页面；调价前菜单会提前显示「2026-09-10 12:00 起本模型调价」的提示。

**下半部分 · 本会话综合单价。** 读取当前会话的 `tokenUsage` 投影（未命中输入 / 缓存读取 / 缓存写入 / 输出四个互斥桶），给出：

- **缓存命中率** = 缓存读取 ÷（未命中输入 + 缓存读取 + 缓存写入）
- **综合单价** = Σ(各桶 token 数 × 该桶单价) ÷ 总 token 数 × 1e8，单位 **元/亿 tokens**

也就是用本会话自己的输入配比加权出的混合单价：缓存命中率越高，综合单价越接近缓存命中价；纯输出会话则等于输出价。计价模型默认取当前会话模型（`modelSelection` 投影），若它不在官方价目表中，菜单会明确提示并改用 V4-Flash 计价，同时允许点击上方模型行切换计价模型。金额按当前时段单价估算，跨时段的历史用量不做分段还原。

## 兼容性

- **dsh v0.1.2-alpha.1 ~ rc.1（支持）:** 本插件面向 `dsh-v0.1.2-alpha.1` ~ `dsh-v0.1.2-alpha.5` 五个 tag 共同的客户端插件契约构建——`dsh.client` 声明、`window.__ModuleLoader__.load({ id, factory })` 形状、`ctx.slots.inject / register` 注册面、会话标题栏 `conversation.session.header.utilities` 槽位与平台 seed 表（react）五个版本上逐字一致（alpha.4 / alpha.5 的模块系统仅版本号与 web 包 `./invariant` 导出清理，契约未变）。
- **dsh v0.1.2-rc.1（支持）:** `dsh-v0.1.2-alpha.5..dsh-v0.1.2-rc.1` 逐行核对，整个仓库只有全仓包 `package.json` 版本号变更（非 `package.json` 文件零变化、非版本行零变化），插件消费的契约面与 alpha.5 逐字一致；`conversation.session.header.utilities` 槽位、`slots` 服务与 react 平台 seed 均在 rc.1 tag 上复核。
- **dsh v0.1.3-alpha.1 ~ v0.1.3-alpha.2（支持）:** 两个 tag 上逐项复核，插件消费的契约面与 rc.1 一致——`packages/client/ui-slots/src`、`packages/client/ui-renderer/src` 与 `packages/client/web/src`（平台 seed 表）零改动，`conversation.session.header.utilities` 槽位声明与 `ConversationSession.tsx` 渲染点零改动，`apps/cli/src/plugin.ts` 的 `dsh.bundle.patch` 解析不变；`packages/client/modules` 仅把 `dsh.client` 声明类型集中到 `@deepseek-ai/dsh-package-manifest/types`，校验语义不变。另在 0.1.3-alpha.2 的真实 `SlotRegistry` 上跑通注册 → 渲染 → 卸载（条目 id/order/component 与 fiber 清理均符合预期）。
- CI 在 alpha.1 ~ alpha.5、rc.1 与 0.1.3-alpha.1 ~ alpha.2 共八个 tag 上分别执行 typecheck + build + test（见 `.github/workflows/ci.yml` 的矩阵）。
- **0.1.1-rc.2 及更早（不支持）:** 该代使用 `@deepseek-ai/dsh-client-runtime`，客户端上下文契约不同（非 cordis `Context`），本插件不兼容。
- 浏览器 bundle 运行时只 require `react` 与 `react/jsx-runtime`（均在平台 seed 表内），无其他运行时依赖；`@deepseek-ai/*` 全部为 type-only 引用，不在 bundle 中。

验证：`npm run typecheck`（`ctx.slots` 增广经 tsconfig `paths` 固定到本包安装的 cordis 拷贝）、`npm test`（时段/倒计时逻辑冒烟）。

## License

MIT
