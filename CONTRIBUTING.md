# Contributing to SpeakLoop

[中文贡献指南](CONTRIBUTING.zh-CN.md)

Thank you for helping make self-directed English listening and speaking practice more useful for Chinese learners.

## Good areas to improve

- Listening workflows: dictation, progressive reveal, sentence navigation, A–B looping, and subtitle timing.
- Speaking workflows: recording ergonomics, playback comparison, and provider-neutral pronunciation feedback.
- Accessibility, keyboard navigation, responsive layout, and visual polish.
- Local-first privacy, error messages, reliability, and Windows desktop packaging.
- Documentation, translations, test cases, and carefully licensed sample content.

## Before you start

1. Search existing Issues before opening a new one.
2. For a larger feature, open an Issue first and explain the learner problem it solves.
3. Keep changes focused. Do not combine a visual redesign, a server refactor, and unrelated formatting in one pull request.

## Local development

```powershell
git clone <repository-url>
cd speakloop
npm install
```

For the browser development mode, supply your own FFmpeg and FFprobe at:

```text
tools/ffmpeg/bin/ffmpeg.exe
tools/ffmpeg/bin/ffprobe.exe
```

Then run:

```powershell
npm start
```

Open `http://localhost:4173`. Run `npm run check` before opening a pull request.

## Pull request checklist

- Explain what learner problem changed and how to test it.
- Test the changed flow with no API key as well as with the relevant provider configured, when applicable.
- Preserve the local-first model: no background uploads, no hidden analytics, and no unexpected calls to paid APIs.
- Keep user-facing Chinese copy natural and concise; update English copy where the feature is documented.
- Update README or installation documentation when setup, behaviour, privacy, or a provider changes.
- Do not commit generated build output, `node_modules/`, or binary tools.

## Privacy and safety rules

Never commit or attach to a public Issue / PR:

- API keys, Azure credentials, tokens, `.env` files, or browser-session data;
- personal videos, recordings, subtitles, bookmarks, or recommendation lists;
- files under `video-library/`, `user-data/`, `artifacts/`, `tools/ffmpeg/`, or `vendor/`;
- a private media link, another person's voice recording, or other personal information.

Use a short, openly licensed sample video or a synthetic placeholder when a reproducible example is needed.

## Reporting bugs and proposing features

For bugs, include the SpeakLoop version, Windows version, the steps to reproduce, expected result, actual result, and a redacted error message or screenshot if useful.

For feature proposals, describe the listening or speaking difficulty first. A feature should make the practice loop clearer, faster, safer, or more motivating—not merely add a button.

Security concerns should follow the private reporting route in [SECURITY.md](SECURITY.md), not a public Issue.

## Licence

By contributing code, you agree that your contribution is provided under this repository's [MIT License](LICENSE). Third-party tools and bundled FFmpeg have separate notices; see [third-party notices](docs/THIRD_PARTY_NOTICES.md).

