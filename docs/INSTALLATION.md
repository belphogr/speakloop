# Installing SpeakLoop

[中文](INSTALLATION.zh-CN.md)

## Current release status

SpeakLoop is a local Windows desktop application, not a GitHub Pages site. A Windows installer has been built, but it is not public yet. It will first be tested in a private GitHub repository and private Release.

Until a public Release exists, do not download a similarly named installer from another source.

## Install the Windows desktop app

When a Release is available:

1. Download `SpeakLoop-Setup-<version>.exe` only from the repository's GitHub Releases page.
2. Check the SHA-256 checksum published in the Release notes.
3. Run the installer and select an installation folder. Leave **Create a desktop shortcut** enabled if you want one.
4. Launch SpeakLoop from the desktop or Start menu.

The installer includes the app runtime and an LGPL-compatible FFmpeg distribution. No Node.js or separate FFmpeg installation is needed for normal use.

### Where your learning data lives

Installed apps keep imported videos, subtitle records, bookmarks, and personal recommendations under `%APPDATA%\SpeakLoop`, not in the installation folder. Uninstalling the app does not automatically remove those personal files.

## Run from source (developers)

Use this path only to contribute, inspect code, or run an unreleased development copy.

### What you need

- Windows 10 or Windows 11
- [Node.js 18 LTS or newer](https://nodejs.org/)
- An FFmpeg build containing both `ffmpeg.exe` and `ffprobe.exe`
- An internet connection only for AI actions or downloading a recommendation; normal video playback and local data storage are local

## Source setup

1. Clone or download this repository. After publishing, replace the placeholder below with the repository address:

   ```powershell
   git clone <repository-url>
   cd speakloop-ielts
   ```

2. Install project dependencies:

   ```powershell
   npm install
   ```

3. Install FFmpeg, then place its two executable files exactly here:

   ```text
   speakloop-ielts/
   └─ tools/
      └─ ffmpeg/
         └─ bin/
            ├─ ffmpeg.exe
            └─ ffprobe.exe
   ```

   The `tools/ffmpeg/` folder is deliberately excluded from Git because a binary distribution is large and has its own licence obligations. Do not delete other project files when adding or replacing FFmpeg.

4. Start the local service from the project root:

   ```powershell
   npm start
   ```

5. Open `http://localhost:4173` in a modern browser. Keep the PowerShell window running while you use SpeakLoop.

6. In SpeakLoop, open **Settings → API 设置** only if you want automatic transcription, translation, or Azure pronunciation assessment. A video can still be imported and played without an AI key.

## First-use checklist

- Import a video you are entitled to download and keep.
- Use **AI 自动转写** with your own OpenAI or Zhipu AI key to make English subtitles.
- Use **翻译中文** only when Chinese support helps; OpenAI, Zhipu AI, and DeepSeek are supported for translation.
- Allow microphone permission in the browser if you want to record yourself.
- Your imported videos, subtitles, bookmarks, and personal recommendations remain under `video-library/` and `user-data/` on this computer. They are ignored by Git.

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| `ffmpeg` or `ffprobe` cannot be found | Check both filenames and the exact `tools/ffmpeg/bin/` path, then restart `npm start`. |
| The page does not open | Confirm the terminal says it is listening on port 4173, then use `http://localhost:4173` rather than opening `public/index.html` directly. |
| Port 4173 is already in use | Stop the other local SpeakLoop process, or change the app port in `server.mjs` before starting. |
| Recording does not start | Allow microphone permission for `localhost` and make sure another program is not exclusively using the microphone. |
| Transcript or translation fails | Check the selected provider, key, network access, provider account quota, and that the action is supported by that provider. DeepSeek is translation-only in SpeakLoop. |

## Licensing and FFmpeg

The source repository does not include an FFmpeg binary. The desktop installer instead bundles an LGPL-compatible shared FFmpeg build and includes its licence file. See [third-party notices](THIRD_PARTY_NOTICES.md).

Do not replace the release bundle with the GPL-enabled FFmpeg build from this development workspace. If you change the FFmpeg distribution, review its licence and update the release notices before publishing.

SpeakLoop source code is released under the [MIT License](../LICENSE). This note is practical release guidance, not legal advice.

