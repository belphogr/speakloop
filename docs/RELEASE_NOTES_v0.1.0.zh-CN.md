# SpeakLoop 0.1.0 — 私人测试版说明

[English version](RELEASE_NOTES_v0.1.0.md)

> 状态：私人测试 Release。此版本尚未公开，也没有代码签名。在维护者完成发布审查前，请不要转发、重新上传或发布到私人仓库以外的位置。

## 下载文件

| 文件 | 大小 | SHA-256 |
| --- | ---: | --- |
| `SpeakLoop-Setup-0.1.0.exe` | 153.2 MiB | `AE6A98C5D112EBFB9C898C78657D5F074BEDB0621340A53AE68244B13634E68E` |

安装前可在 PowerShell 中核验：

```powershell
Get-FileHash .\SpeakLoop-Setup-0.1.0.exe -Algorithm SHA256
```

## 0.1.0 包含内容

- Windows 桌面安装程序，支持开始菜单与桌面快捷方式。
- 内置 LGPL 兼容的 FFmpeg，用于本机音频提取；普通用户无需额外配置 FFmpeg。
- 本地视频资源库、字幕存档、收藏与个人推荐存储。
- 使用 OpenAI 或智谱 AI 转写英文字幕；使用 OpenAI、智谱 AI 或 DeepSeek 翻译中文。
- 单句播放、单句循环、调速、自由拖动、A–B 循环、盲听写与逐层揭晓。
- 本机录音与「原声 → 我的录音」对比。
- 可选 Azure Speech 发音评测。
- 深色 / 浅色 / 跟随系统主题，以及 SpeakLoop 桌面图标。

## 安装与资料

请选择自己可管理的安装目录。个人学习资料会保存在 `%APPDATA%\SpeakLoop`，与安装目录分离，其中包括导入视频、字幕记录、收藏和定制推荐。

如果你从本地开发版迁移，请在 SpeakLoop 关闭时，将原项目 `video-library/` 与 `user-data/` 中的内容复制到 `%APPDATA%\SpeakLoop\video-library/` 与 `%APPDATA%\SpeakLoop\user-data/`，并保留原文件夹作为备份。

## 已知限制

- 这个私人测试版没有代码签名。Windows 可能出现信誉或发布者提示；对于并非从私人仓库 Release 获得的安装程序，不要绕过任何安全提示。
- 仅提供 Windows x64 版本，暂不提供 macOS 或 Linux 版本。
- 自动英文转写需要用户自己的 OpenAI 或智谱 AI Key；DeepSeek 仅用于翻译。
- Azure 发音评测为可选服务，可能产生服务商费用。
- API Key 仅保留在当前软件会话中，关闭软件后会清除。
- 定制推荐需要用户自行配置 Codex 定时任务；不会随软件共享或打包其他人的推荐。
- 当前没有内置自动更新功能。

## 隐私与许可证

视频、录音、字幕、收藏和定制推荐默认留在本机；只有用户主动发起 API 功能时，相关内容才会发送给服务商。请阅读[安全策略](../SECURITY.md)与[第三方声明](THIRD_PARTY_NOTICES.md)。SpeakLoop 源码采用 MIT 许可证；随包 FFmpeg 有独立 LGPL 声明。

## 私人测试反馈

反馈请说明 Windows 版本、简短复现路径、预期行为与实际行为；必要时可附去敏后的截图或错误文本。绝不要在 Issue 中附 API Key、私人录音、私密媒体链接或导入视频。

