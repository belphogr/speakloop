# SpeakLoop 0.1.0 — Private release notes

[中文版本](RELEASE_NOTES_v0.1.0.zh-CN.md)

> Status: private test release. This build is not public and is not code-signed. Do not redistribute it or upload it outside the private repository before the maintainer completes release review.

## Download asset

| File | Size | SHA-256 |
| --- | ---: | --- |
| `SpeakLoop-Setup-0.1.0.exe` | 153.2 MiB | `AE6A98C5D112EBFB9C898C78657D5F074BEDB0621340A53AE68244B13634E68E` |

Verify the checksum in PowerShell before installing:

```powershell
Get-FileHash .\SpeakLoop-Setup-0.1.0.exe -Algorithm SHA256
```

## Included in 0.1.0

- Windows desktop installer with Start menu and desktop shortcut support.
- Bundled LGPL-compatible FFmpeg for local audio extraction; no separate FFmpeg setup for normal users.
- Local video library, subtitle persistence, bookmarks, and personal recommendation storage.
- English transcription with OpenAI or Zhipu AI; Chinese translation with OpenAI, Zhipu AI, or DeepSeek.
- Sentence replay, sentence looping, adjustable speed, seeking, A–B loop, blind dictation, and progressive reveal.
- Local recording and original-audio → personal-recording comparison.
- Optional Azure Speech pronunciation assessment.
- Deep/light/system theme options and a SpeakLoop desktop icon.

## Installation and data

Install to a folder you control. Personal learning data is stored in `%APPDATA%\SpeakLoop`, separate from the app installation. It includes imported videos, subtitle records, bookmarks, and personal recommendations.

If you are upgrading from a local development copy, copy the contents of its `video-library/` and `user-data/` folders into `%APPDATA%\SpeakLoop\video-library/` and `%APPDATA%\SpeakLoop\user-data/` while SpeakLoop is closed. Keep the original folders as a backup.

## Known limitations

- This private test installer is not code-signed. Windows may show a reputation or publisher warning; do not bypass warnings for any installer not obtained from the private repository release.
- Windows x64 only. macOS and Linux builds are not provided.
- Automatic English transcription requires the user's own OpenAI or Zhipu AI key. DeepSeek is translation-only.
- Azure pronunciation feedback is optional and may incur provider charges.
- API keys are kept only for the current app session. Close the app to clear them.
- Personal recommendation refresh requires the user to configure their own Codex scheduled task; recommendations are not shared or bundled with the app.
- There is no automatic in-app updater in this version.

## Privacy and licences

Videos, recordings, subtitles, bookmarks, and personal recommendations remain local unless the user deliberately starts an API-backed action. Review [SECURITY.md](../SECURITY.md) and [third-party notices](THIRD_PARTY_NOTICES.md). SpeakLoop code is MIT-licensed; the bundled FFmpeg distribution has its own LGPL notice.

## Feedback for this private test

Report the Windows version, a short reproduction path, expected behaviour, actual behaviour, and a redacted screenshot or error message when useful. Never attach a key, personal recording, private media link, or imported video to an Issue.

