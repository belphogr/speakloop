import { app, BrowserWindow, dialog, shell, session } from 'electron';
import { access, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const sourceRoot = dirname(dirname(fileURLToPath(import.meta.url)));
let localServer;

function appResource(relativePath) {
  return app.isPackaged ? join(app.getAppPath(), relativePath) : join(sourceRoot, relativePath);
}

async function hasFile(path) {
  try { await access(path); return true; } catch { return false; }
}

async function createWindow(port) {
  const window = new BrowserWindow({
    width: 1440, height: 960, minWidth: 980, minHeight: 720, show: false, autoHideMenuBar: true, backgroundColor: '#071116',
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) shell.openExternal(url);
    return { action: 'deny' };
  });
  window.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(`http://127.0.0.1:${port}/`)) event.preventDefault();
  });
  window.webContents.on('did-fail-load', (_event, code, description, url) => {
    console.error(`SpeakLoop window failed to load (${code}): ${description} ${url}`);
  });
  window.once('ready-to-show', () => window.show());
  await window.loadURL(`http://127.0.0.1:${port}/`);
}

app.whenReady().then(async () => {
  const dataRoot = app.getPath('userData');
  const ffmpegBin = app.isPackaged ? join(process.resourcesPath, 'ffmpeg', 'bin') : join(sourceRoot, 'vendor', 'ffmpeg', 'bin');
  process.env.SPEAKLOOP_PROJECT_DIR = sourceRoot;
  process.env.SPEAKLOOP_DATA_DIR = dataRoot;
  process.env.SPEAKLOOP_PUBLIC_DIR = appResource('public');
  process.env.SPEAKLOOP_FFMPEG_DIR = ffmpegBin;
  await mkdir(dataRoot, { recursive: true });

  if (!(await hasFile(join(ffmpegBin, 'ffmpeg.exe'))) || !(await hasFile(join(ffmpegBin, 'ffprobe.exe')))) {
    await dialog.showMessageBox({
      type: 'error', title: 'SpeakLoop 缺少媒体组件', message: '没有找到随软件提供的 FFmpeg 组件。视频转写暂不可用。',
      detail: '请从官方 GitHub Release 重新下载完整安装包；开发模式请将 LGPL FFmpeg 放入 vendor/ffmpeg/bin/。'
    });
  }
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => callback(permission === 'media'));
  const { startSpeakLoopServer } = await import(pathToFileURL(appResource('server.mjs')).href);
  localServer = await startSpeakLoopServer(0);
  await createWindow(localServer.port);
}).catch((error) => { console.error('SpeakLoop startup failed:', error); dialog.showErrorBox('SpeakLoop 无法启动', error?.message || String(error)); app.quit(); });

app.on('window-all-closed', () => app.quit());
app.on('before-quit', () => localServer?.server?.close());

