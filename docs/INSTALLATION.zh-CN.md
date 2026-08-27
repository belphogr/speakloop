# SpeakLoop 安装说明

[English](INSTALLATION.md)

## 当前发布状态

SpeakLoop 是本地 Windows 桌面软件，不是 GitHub Pages 静态网页。Windows 安装包已经构建完成，但尚未公开；会先在私人 GitHub 仓库与私人 Release 中测试。

在公开 Release 出现前，请不要从其他来源下载同名安装程序。

## 安装 Windows 桌面版

Release 发布后，普通用户按以下方式安装：

1. 只从仓库的 GitHub Releases 页面下载 `SpeakLoop-Setup-<版本号>.exe`。
2. 核对 Release 说明中公布的 SHA-256 校验值。
3. 运行安装程序并选择安装目录；如需桌面入口，保持「创建桌面快捷方式」启用。
4. 从桌面或开始菜单启动 SpeakLoop。

安装包已内置运行环境和 LGPL 兼容的 FFmpeg，普通用户无需安装 Node.js 或单独配置 FFmpeg。

### 练习资料保存在哪里

已安装的软件会将导入视频、字幕记录、收藏和定制推荐保存到 `%APPDATA%\SpeakLoop`，而不是安装目录。卸载软件不会自动删除这些个人资料。

## 源码运行（开发者）

这一方式只适合参与开发、阅读代码或运行尚未发布的开发版本。

### 你需要准备的内容

- Windows 10 或 Windows 11
- [Node.js 18 LTS 或更新版本](https://nodejs.org/)
- 一个同时包含 `ffmpeg.exe` 和 `ffprobe.exe` 的 FFmpeg 发行版
- 仅在调用 AI、下载定制推荐时需要联网；普通视频播放和本地资料保存不依赖持续联网

## 源码运行步骤

1. 克隆或下载本仓库。正式发布后，将下方占位地址替换为仓库地址：

   ```powershell
   git clone <repository-url>
   cd speakloop-ielts
   ```

2. 安装项目依赖：

   ```powershell
   npm install
   ```

3. 安装 FFmpeg，并把两个可执行文件放在以下**准确位置**：

   ```text
   speakloop-ielts/
   └─ tools/
      └─ ffmpeg/
         └─ bin/
            ├─ ffmpeg.exe
            └─ ffprobe.exe
   ```

   `tools/ffmpeg/` 被刻意排除在 Git 之外：二进制体积较大，并且有单独的许可证义务。安装或替换 FFmpeg 时，不需要清空、更不要删除项目中的其他文件。

4. 在项目根目录启动本地服务：

   ```powershell
   npm start
   ```

5. 用现代浏览器打开 `http://localhost:4173`。使用期间请保持 PowerShell 窗口运行。

6. 只有在需要自动转写、翻译或 Azure 发音评测时，才进入软件的「设置 → API 设置」配置自己的 Key；不配置 AI Key 也可以导入、播放和练习视频。

## 首次使用检查清单

- 导入你有权下载、保存和练习的视频。
- 使用自己的 OpenAI 或智谱 AI Key 点击「AI 自动转写」，生成英文字幕。
- 需要中文支持时再点击「翻译中文」；OpenAI、智谱 AI、DeepSeek 都可用于翻译。
- 想录音时，请在浏览器中允许 `localhost` 使用麦克风。
- 导入的视频、字幕、收藏和定制推荐会保存在本机的 `video-library/` 与 `user-data/`，并且已被 Git 忽略。

## 常见问题

| 现象 | 检查方法 |
| --- | --- |
| 找不到 `ffmpeg` 或 `ffprobe` | 检查两个文件名以及 `tools/ffmpeg/bin/` 的准确目录；随后重启 `npm start`。 |
| 页面打不开 | 确认终端显示正在监听 4173 端口；使用 `http://localhost:4173`，不要直接打开 `public/index.html`。 |
| 4173 端口被占用 | 结束另一个本地 SpeakLoop 进程，或启动前在 `server.mjs` 中修改端口。 |
| 录音无法开始 | 允许浏览器向 `localhost` 授予麦克风权限，并检查是否有别的程序独占麦克风。 |
| 转写或翻译失败 | 检查所选服务商、Key、网络、账户额度，以及该服务商是否支持当前操作。SpeakLoop 中 DeepSeek 仅用于翻译。 |

## 许可证与 FFmpeg

源码仓库不会附带 FFmpeg 二进制文件。桌面安装包会改为捆绑 LGPL 兼容的共享版 FFmpeg，并附带其许可证文件；请阅读[第三方声明](THIRD_PARTY_NOTICES.md)。

不要把当前开发环境中的 GPL-enabled FFmpeg 直接替换进 Release 安装包。若更换 FFmpeg 发行版，请先审查许可证并更新 Release 的第三方声明。

SpeakLoop 源代码采用 [MIT 许可证](../LICENSE)。本节是实用的发布提醒，不构成法律意见。

