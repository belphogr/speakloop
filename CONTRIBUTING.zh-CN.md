# 参与改进 SpeakLoop

[English contributing guide](CONTRIBUTING.md)

感谢你帮助 SpeakLoop 更好地服务中国英语学习者的自主听力与口语练习。

## 值得优先改进的方向

- 听力训练：听写、逐层揭晓、逐句导航、A–B 循环与字幕时间轴。
- 口语训练：录音体验、原声与录音对比、服务商无关的发音反馈。
- 无障碍、键盘操作、响应式布局与视觉细节。
- 本地优先的隐私设计、错误提示、稳定性与 Windows 桌面打包。
- 文档、翻译、测试用例与授权清晰的示例内容。

## 开始前

1. 创建新 Issue 前，先搜索已有 Issue。
2. 较大的功能请先创建 Issue，说明它解决了哪一种学习困难。
3. 保持改动聚焦：不要把视觉重做、服务端重构和无关格式调整混在同一个 Pull Request。

## 本地开发

```powershell
git clone <repository-url>
cd speakloop
npm install
```

浏览器开发模式需要自行准备 FFmpeg 与 FFprobe，并放在：

```text
tools/ffmpeg/bin/ffmpeg.exe
tools/ffmpeg/bin/ffprobe.exe
```

随后运行：

```powershell
npm start
```

浏览器打开 `http://localhost:4173`。提交 Pull Request 前请执行 `npm run check`。

## Pull Request 检查清单

- 说明解决了什么学习问题，以及如何验证。
- 涉及 API 时，请分别测试无 Key 状态与配置相应服务商后的流程。
- 保持本地优先：不做后台上传、不加入隐蔽统计，也不意外调用付费 API。
- 中文文案需自然、简洁；如功能已写入英文文档，也应同步更新。
- 若安装、行为、隐私或服务商发生变化，请更新 README 或安装说明。
- 不要提交构建产物、`node_modules/` 或二进制工具。

## 隐私与安全规则

绝不能提交或附在公开 Issue / PR 中的内容：

- API Key、Azure 凭据、Token、`.env` 文件或浏览器会话数据；
- 私人视频、录音、字幕、收藏或定制推荐；
- `video-library/`、`user-data/`、`artifacts/`、`tools/ffmpeg/`、`vendor/` 下的文件；
- 私密媒体链接、他人录音或其他个人信息。

需要可复现示例时，请使用简短、公开授权的视频或合成占位内容。

## 报告问题与提出想法

报告 Bug 时，请提供 SpeakLoop 版本、Windows 版本、复现步骤、预期结果、实际结果；必要时可附去敏后的错误信息或截图。

提出功能时，请先描述它改善的听力或口语困难。一个功能应让练习闭环更清楚、更高效、更安全或更有动力，而不只是多一个按钮。

安全问题请按 [SECURITY.md](SECURITY.md) 的私密渠道处理，不要提交公开 Issue。

## 许可证

提交代码即表示你同意按本仓库的 [MIT 许可证](LICENSE) 提供贡献。第三方工具与随安装包提供的 FFmpeg 有独立声明，请阅读[第三方声明](docs/THIRD_PARTY_NOTICES.md)。

