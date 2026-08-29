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

```sh
dsh plugin --profile web add liangwengu
```

需要已安装 DSH，并至少成功启动过一次 Web GUI。

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
- **固定北京时间:** 用 Asia/Shanghai 计算，与你浏览器所在时区无关。
- **夜间模式:** 跟随 DSH 主题自动切换配色。

## 显示规则

| 日期 | 时段 | 显示 |
| --- | --- | --- |
| 周一至周五 | 09:00–12:00、14:00–18:00 | 梁文峰 |
| 周一至周五 | 其余时间 | 梁文谷 |
| 周六、周日 | 全天 | 梁文谷 |

## 兼容性

- **npm 正式版 0.1.1-rc.2:** 适配 npm 上的 dsh 0.1.1-rc.2（client-runtime 一代）。
- **开发版 0.1.2-alpha.1:** main 分支，适配 dsh GitHub 最新版 0.1.2-alpha.1（cordis-Context 一代）。

## License

MIT
