# Third-party notices

## FFmpeg (Windows desktop distribution)

The Windows desktop package is configured to include an **LGPL shared** FFmpeg build in `resources/ffmpeg`. The build must include its own licence files and source/build reference when a release is assembled.

The planned source is BtbN FFmpeg-Builds, `win64-lgpl-shared`. FFmpeg explains that optional GPL components change the licence that applies to a build; do not replace this bundle with a GPL-enabled build unless the release licence review is updated.

- FFmpeg legal information: <https://ffmpeg.org/legal.html>
- Selected build family: <https://github.com/BtbN/FFmpeg-Builds/releases>

SpeakLoop invokes `ffmpeg.exe` and `ffprobe.exe` as separate local processes. FFmpeg is not part of SpeakLoop's MIT-licensed source code.

This notice is release guidance, not legal advice.

