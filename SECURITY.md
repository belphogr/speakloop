# Security Policy

[中文说明](#中文说明)

## Supported versions

Security fixes are provided for the latest version on the default branch. Releases will list their supported version and checksum when desktop packaging begins.

## Protecting your data and API keys

- Never commit API keys, Azure credentials, personal recommendations, imported videos, subtitles, recordings, or local library files.
- Keep `.env`, `video-library/`, `user-data/`, and `tools/ffmpeg/` out of public repositories. The supplied `.gitignore` already excludes them.
- SpeakLoop keeps provider keys in browser session storage. Close the browser tab when you finish a shared-computer session.
- Only send videos, audio, text, or recordings to an AI provider after you intentionally start the related feature. Review the provider's own terms, privacy policy, and billing before use.
- Download installers only from the project's official GitHub Releases page after releases exist, and verify the published checksum/signature.

## Reporting a vulnerability

Do not open a public issue containing a secret, personal video, API key, exploit details, or a proof-of-concept that could harm users.

Until a dedicated reporting address is published, report a security concern privately to the repository maintainer through GitHub's private vulnerability reporting feature, if enabled. Include:

1. a clear description of the impact;
2. affected version and operating system;
3. safe reproduction steps; and
4. any suggested mitigation.

The maintainer should acknowledge a report within 7 days and provide a status update or fix timeline where possible.

## 中文说明

### 支持版本

默认分支的最新版本会接收安全修复。未来开始发布桌面安装包后，每个 Release 会标注支持版本与校验值。

### 保护数据与 API Key

- 不要把 API Key、Azure 凭据、个人推荐、导入视频、字幕、录音或本地资源库提交到 Git。
- 不要公开 `.env`、`video-library/`、`user-data/` 和 `tools/ffmpeg/`。项目已在 `.gitignore` 中排除它们。
- SpeakLoop 将服务商 Key 放在浏览器会话存储中；在共享电脑上用完后请关闭页面。
- 只有你主动使用对应功能时，视频、音频、文本或录音才会发送给 AI 服务商。使用前请自行确认服务商的条款、隐私政策与计费规则。
- 未来有安装包后，只从项目官方 GitHub Releases 页面下载，并核对公布的校验值或签名。

### 报告安全问题

不要在公开 Issue 中附带密钥、私人视频、API Key、可直接伤害用户的利用细节或完整 PoC。

在发布专用联系邮箱前，如仓库已启用 GitHub 私密漏洞报告，请通过该方式私下联系维护者。报告请包含：

1. 影响说明；
2. 受影响版本与操作系统；
3. 安全的复现步骤；
4. 可行的缓解建议（如有）。

维护者应尽量在 7 天内确认报告，并提供处理进度或修复计划。

