<div align="center">

# 梁文谷

**在 DeepSeek Harness 里显示当前算力错峰时段，并实时倒计时剩余时间**

装上它，会话窗口会显示现在该用梁文峰还是梁文谷，以及距离切换便宜算力时段还剩多久。

<p align="center">
  <a href="https://www.npmjs.com/package/liangwengu">
    <img src="https://img.shields.io/npm/v/liangwengu/alpha?style=flat&colorA=000000&colorB=000000" />
  </a>
  <a href="https://github.com/VinciBeans/deepseek-plugin-liangwengu/blob/main/LICENSE">
    <img src="https://img.shields.io/github/license/VinciBeans/deepseek-plugin-liangwengu?style=flat&colorA=000000&colorB=000000" />
  </a>
</p>

</div>

## Install

从 npm 安装（`alpha` dist-tag；当前版本 0.1.2-alpha.4，适配 dsh v0.1.2-alpha.1 ~ alpha.4）：

```sh
dsh plugin --profile web add liangwengu@alpha
```

需要已安装 DSH，并至少成功启动过一次 Web GUI。

npm `latest`（0.1.1-rc.2）仍是旧 client-runtime 代，仅适配 dsh 0.1.1-rc.2；安装它的命令为 `dsh plugin --profile web add liangwengu`。源码安装：`dsh plugin --profile web add .`。

## Quickstart

```sh
dsh plugin --profile web add liangwengu@alpha
dsh --profile web --dump-config          # 看到 liangwengu 层即安装成功
# 重启 dsh web，打开会话，标题栏右侧出现时段胶囊
```

## 它能做什么

- **当前时段:** 工作日 09:00–12:00 与 14:00–18:00 显示「梁文峰」，其余时间含整个周末显示「梁文谷」。
- **实时倒计时:** 标签下方显示当前时段剩余时间，每秒刷新，到点自动切换。
- **跨天谷期:** 周五 18:00 起连续到周一 09:00，最长 63 小时，超过 24 小时按天显示。
- **固定北京时间:** 用 Asia/Shanghai 计算，与你浏览器所在时区无关。
- **夜间模式:** 跟随 DSH 主题自动切换配色。

## 显示规则

| 日期 | 时段 | 显示 |
| --- | --- | --- |
| 周一至周五 | 09:00–12:00、14:00–18:00 | 梁文峰 |
| 周一至周五 | 其余时间 | 梁文谷 |
| 周六、周日 | 全天 | 梁文谷 |

## 兼容性

- **dsh v0.1.2-alpha.1 ~ alpha.4（支持）:** 本插件面向 `dsh-v0.1.2-alpha.1` ~ `dsh-v0.1.2-alpha.4` 四个 tag 共同的客户端插件契约构建——`dsh.client` 声明、`window.__ModuleLoader__.load({ id, factory })` 形状、`ctx.slots.inject / register` 注册面、会话标题栏 `conversation.session.header.utilities` 槽位与平台 seed 表（react）四个版本上逐字一致（alpha.4 的模块系统仅版本号与 web 包 `./invariant` 导出清理，契约未变）。CI 在 alpha.1 ~ alpha.3 三个 tag 上分别执行 typecheck + build + test（见 `.github/workflows/ci.yml` 的矩阵）；alpha.4 已本地核对：对 alpha.4 构建的客户端类型产物执行 `tsc --noEmit` 通过。
- **0.1.1-rc.2 及更早（不支持）:** 该代使用 `@deepseek-ai/dsh-client-runtime`，客户端上下文契约不同（非 cordis `Context`），本插件不兼容。
- 浏览器 bundle 运行时只 require `react` 与 `react/jsx-runtime`（均在平台 seed 表内），无其他运行时依赖；`@deepseek-ai/*` 全部为 type-only 引用，不在 bundle 中。

验证：`pnpm run typecheck`（`ctx.slots` 增广经 tsconfig `paths` 固定到本包安装的 cordis 拷贝）、`pnpm test`（时段/倒计时逻辑冒烟）。

## License

MIT
