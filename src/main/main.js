const { app, BrowserWindow, ipcMain, dialog, Menu, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');

// Configure auto-updater
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

// Increase memory limit for large PSD files (4GB)
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=4096');

// Get the correct path for assets in both development and packaged app
function getAssetPath(assetName) {
  // Try multiple possible paths
  const possiblePaths = [
    path.join(__dirname, '../assets', assetName),  // Development
    path.join(process.resourcesPath, 'app', 'src', 'assets', assetName),  // Packaged without asar
    path.join(app.getAppPath(), 'src', 'assets', assetName),  // Alternative packaged path
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      console.log('Found asset at:', p);
      return p;
    }
  }

  console.error('Asset not found:', assetName);
  console.error('Tried paths:', possiblePaths);
  return possiblePaths[0]; // Return first path as fallback
}

function createWindow() {
  // Remove the menu bar
  Menu.setApplicationMenu(null);

  const iconPath = getAssetPath('logol.ico');
  console.log('Icon path:', iconPath);

  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'LiveryLab Repaint',
    icon: iconPath,
    frame: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  // Handle external links - open in default browser instead of in-app
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    // Open external URLs in default browser
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
      return { action: 'deny' }; // Prevent opening in app
    }
    return { action: 'allow' };
  });

  // Also handle navigation attempts (clicking links)
  mainWindow.webContents.on('will-navigate', (event, url) => {
    // Get the current URL of the app
    const appUrl = mainWindow.webContents.getURL();

    // If navigating to an external URL, open in browser instead
    if (url.startsWith('http://') || url.startsWith('https://')) {
      if (!url.startsWith('file://')) {
        event.preventDefault();
        shell.openExternal(url);
      }
    }
  });
}

app.whenReady().then(() => {
  createWindow();

  // Check for updates after a short delay (let the app load first)
  setTimeout(() => {
    if (app.isPackaged) {
      autoUpdater.checkForUpdates().catch(err => {
        console.log('Update check failed:', err.message);
      });
    }
  }, 3000);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Auto-updater events
autoUpdater.on('update-available', (info) => {
  console.log('Update available:', info.version);
  const win = getMainWindow();
  if (win) {
    win.webContents.send('update-available', {
      version: info.version,
      releaseNotes: info.releaseNotes
    });
  }
});

autoUpdater.on('update-not-available', () => {
  console.log('App is up to date');
});

autoUpdater.on('download-progress', (progress) => {
  const win = getMainWindow();
  if (win) {
    win.webContents.send('update-download-progress', {
      percent: progress.percent,
      transferred: progress.transferred,
      total: progress.total
    });
  }
});

autoUpdater.on('update-downloaded', (info) => {
  console.log('Update downloaded:', info.version);
  const win = getMainWindow();
  if (win) {
    win.webContents.send('update-downloaded', {
      version: info.version
    });
  }
});

autoUpdater.on('error', (err) => {
  console.error('Auto-updater error:', err.message);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Helper to get the main window reliably
function getMainWindow() {
  // Try focused window first, then fall back to first available window
  return BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
}

// IPC handlers for window controls
ipcMain.on('minimize-window', (event) => {
  console.log('IPC: minimize-window received');
  const win = getMainWindow();
  if (win) {
    win.minimize();
    console.log('Window minimized');
  } else {
    console.error('No window found to minimize');
  }
});

ipcMain.on('maximize-window', (event) => {
  console.log('IPC: maximize-window received');
  const win = getMainWindow();
  if (win) {
    if (win.isMaximized()) {
      win.unmaximize();
      console.log('Window unmaximized');
    } else {
      win.maximize();
      console.log('Window maximized');
    }
  } else {
    console.error('No window found to maximize');
  }
});

ipcMain.on('close-window', (event) => {
  console.log('IPC: close-window received');
  const win = getMainWindow();
  if (win) {
    win.close();
    console.log('Window closed');
  } else {
    console.error('No window found to close');
  }
});

// IPC handlers for auto-updater
ipcMain.on('download-update', () => {
  console.log('Starting update download...');
  autoUpdater.downloadUpdate();
});

ipcMain.on('install-update', () => {
  console.log('Installing update and restarting...');
  autoUpdater.quitAndInstall();
});

ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

// IPC handler for opening texture file dialog
ipcMain.handle('open-psd-dialog', async () => {
  const result = await dialog.showOpenDialog({
    title: 'Select Texture File',
    filters: [
      { name: 'Image Files', extensions: ['psd', 'png', 'jpg', 'jpeg'] },
      { name: 'Photoshop Files', extensions: ['psd'] },
      { name: 'PNG Files', extensions: ['png'] },
      { name: 'JPEG Files', extensions: ['jpg', 'jpeg'] }
    ],
    properties: ['openFile']
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return result.filePaths[0];
});
