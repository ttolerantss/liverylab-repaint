const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
// Use original fs module to avoid Electron's asar interception
const fs = require('original-fs');
const { execSync, spawn } = require('child_process');

// Check if running in uninstall mode
// Check command line args OR if the portable exe is named "Uninstall.exe"
// For portable apps, PORTABLE_EXECUTABLE_FILE contains the original exe path
const portableExePath = process.env.PORTABLE_EXECUTABLE_FILE || process.execPath;
const exeName = path.basename(portableExePath).toLowerCase();
const isUninstallMode = process.argv.includes('--uninstall') || exeName === 'uninstall.exe';

console.log('Portable exe path:', portableExePath);
console.log('Exe name:', exeName);
console.log('Uninstall mode:', isUninstallMode);

// Default installation path (use LocalAppData to avoid needing admin privileges)
const defaultInstallPath = path.join(process.env['LOCALAPPDATA'] || path.join(process.env['USERPROFILE'], 'AppData', 'Local'), 'LiveryLab Repaint');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 600,
    height: 450,
    resizable: false,
    frame: false,
    icon: path.join(__dirname, 'assets', 'logol.ico'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // Send mode to renderer
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.send('init', {
      isUninstall: isUninstallMode,
      defaultPath: defaultInstallPath,
      appVersion: app.getVersion()
    });
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  app.quit();
});

// IPC Handlers
ipcMain.on('close-window', () => {
  app.quit();
});

ipcMain.on('minimize-window', () => {
  mainWindow?.minimize();
});

// Browse for install location
ipcMain.handle('browse-location', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    defaultPath: defaultInstallPath
  });

  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

// Get payload path (the app files to install)
function getPayloadPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'app', 'payload');
  } else {
    return path.join(__dirname, '..', 'payload');
  }
}

// Copy directory recursively
function copyDirSync(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// Delete directory recursively
function deleteDirSync(dirPath) {
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
  }
}

// Create Windows shortcut using VBScript (more reliable than PowerShell)
function createShortcut(targetPath, shortcutPath, iconPath, description) {
  const vbsScript = `
Set WshShell = WScript.CreateObject("WScript.Shell")
Set Shortcut = WshShell.CreateShortcut("${shortcutPath}")
Shortcut.TargetPath = "${targetPath}"
Shortcut.IconLocation = "${iconPath},0"
Shortcut.Description = "${description}"
Shortcut.Save
`;

  const vbsPath = path.join(process.env.TEMP, 'create_shortcut.vbs');

  try {
    fs.writeFileSync(vbsPath, vbsScript);
    execSync(`cscript //nologo "${vbsPath}"`, { windowsHide: true });
    fs.unlinkSync(vbsPath);
    return true;
  } catch (err) {
    console.error('Failed to create shortcut:', err);
    return false;
  }
}

// Add to Windows Add/Remove Programs
function registerUninstaller(installPath, installerPath) {
  const regKey = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\LiveryLabRepaint';
  const appVersion = app.getVersion();

  const commands = [
    `reg add "${regKey}" /v DisplayName /t REG_SZ /d "LiveryLab Repaint" /f`,
    `reg add "${regKey}" /v DisplayVersion /t REG_SZ /d "${appVersion}" /f`,
    `reg add "${regKey}" /v Publisher /t REG_SZ /d "LiveryLab" /f`,
    `reg add "${regKey}" /v InstallLocation /t REG_SZ /d "${installPath}" /f`,
    `reg add "${regKey}" /v UninstallString /t REG_SZ /d "\\"${installerPath}\\" --uninstall" /f`,
    `reg add "${regKey}" /v DisplayIcon /t REG_SZ /d "${path.join(installPath, 'LiveryLab Repaint.exe')}" /f`,
    `reg add "${regKey}" /v NoModify /t REG_DWORD /d 1 /f`,
    `reg add "${regKey}" /v NoRepair /t REG_DWORD /d 1 /f`
  ];

  for (const cmd of commands) {
    try {
      execSync(cmd, { windowsHide: true });
    } catch (err) {
      console.error('Registry command failed:', cmd, err);
    }
  }
}

// Remove from Windows Add/Remove Programs
function unregisterUninstaller() {
  try {
    execSync('reg delete "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\LiveryLabRepaint" /f', { windowsHide: true });
  } catch (err) {
    console.error('Failed to remove registry entry:', err);
  }
}

// Install the application
ipcMain.handle('install', async (event, installPath) => {
  try {
    const payloadPath = getPayloadPath();

    // Check if payload exists
    if (!fs.existsSync(payloadPath)) {
      return { success: false, error: 'Installation files not found' };
    }

    // Send progress updates
    const sendProgress = (percent, status) => {
      mainWindow?.webContents.send('install-progress', { percent, status });
    };

    sendProgress(10, 'Creating installation directory...');

    // Create install directory
    if (!fs.existsSync(installPath)) {
      fs.mkdirSync(installPath, { recursive: true });
    }

    sendProgress(20, 'Copying files...');

    // Copy payload to install location
    copyDirSync(payloadPath, installPath);

    sendProgress(60, 'Creating shortcuts...');

    const exePath = path.join(installPath, 'LiveryLab Repaint.exe');
    const iconPath = exePath;

    // Create Desktop shortcut
    const desktopPath = path.join(process.env['USERPROFILE'], 'Desktop', 'LiveryLab Repaint.lnk');
    createShortcut(exePath, desktopPath, iconPath, 'LiveryLab Repaint');

    // Create Start Menu shortcut
    const startMenuDir = path.join(process.env['APPDATA'], 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'LiveryLab');
    if (!fs.existsSync(startMenuDir)) {
      fs.mkdirSync(startMenuDir, { recursive: true });
    }
    const startMenuPath = path.join(startMenuDir, 'LiveryLab Repaint.lnk');
    createShortcut(exePath, startMenuPath, iconPath, 'LiveryLab Repaint');

    sendProgress(80, 'Registering application...');

    // Copy installer to install location for uninstall
    // Use PORTABLE_EXECUTABLE_FILE for portable apps (points to actual .exe, not extracted temp)
    const installerDest = path.join(installPath, 'Uninstall.exe');
    const originalExe = process.env.PORTABLE_EXECUTABLE_FILE || process.execPath;
    console.log('Copying installer from:', originalExe, 'to:', installerDest);
    if (app.isPackaged && fs.existsSync(originalExe)) {
      fs.copyFileSync(originalExe, installerDest);
    }

    // Register in Add/Remove Programs
    registerUninstaller(installPath, installerDest);

    sendProgress(100, 'Installation complete!');

    return { success: true, exePath };
  } catch (err) {
    console.error('Installation failed:', err);
    return { success: false, error: err.message };
  }
});

// Uninstall the application
ipcMain.handle('uninstall', async () => {
  try {
    const sendProgress = (percent, status) => {
      mainWindow?.webContents.send('install-progress', { percent, status });
    };

    // Get install location from registry
    let installPath;
    try {
      const result = execSync('reg query "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\LiveryLabRepaint" /v InstallLocation', { windowsHide: true });
      const match = result.toString().match(/InstallLocation\s+REG_SZ\s+(.+)/);
      if (match) {
        installPath = match[1].trim();
      }
    } catch (err) {
      installPath = defaultInstallPath;
    }

    sendProgress(10, 'Removing shortcuts...');

    // Remove Desktop shortcut
    const desktopPath = path.join(process.env['USERPROFILE'], 'Desktop', 'LiveryLab Repaint.lnk');
    if (fs.existsSync(desktopPath)) {
      fs.unlinkSync(desktopPath);
    }

    // Remove Start Menu shortcuts
    const startMenuDir = path.join(process.env['APPDATA'], 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'LiveryLab');
    if (fs.existsSync(startMenuDir)) {
      deleteDirSync(startMenuDir);
    }

    sendProgress(30, 'Removing registry entries...');

    // Remove from Add/Remove Programs
    unregisterUninstaller();

    sendProgress(50, 'Removing application data...');

    // Remove AppData folder (license and downloaded models)
    const appDataPath = path.join(process.env['APPDATA'], 'LiveryLabRepaint');
    if (fs.existsSync(appDataPath)) {
      deleteDirSync(appDataPath);
      console.log('Removed AppData folder:', appDataPath);
    }

    sendProgress(70, 'Removing application files...');

    // Remove application files (but not the uninstaller itself yet)
    if (fs.existsSync(installPath)) {
      const entries = fs.readdirSync(installPath);
      for (const entry of entries) {
        if (entry !== 'Uninstall.exe') {
          const entryPath = path.join(installPath, entry);
          if (fs.statSync(entryPath).isDirectory()) {
            deleteDirSync(entryPath);
          } else {
            fs.unlinkSync(entryPath);
          }
        }
      }
    }

    sendProgress(90, 'Cleaning up...');

    // Schedule self-deletion using cmd
    const uninstallerPath = path.join(installPath, 'Uninstall.exe');
    const batchContent = `
      @echo off
      timeout /t 2 /nobreak > nul
      rmdir /s /q "${installPath}"
      del "%~f0"
    `;
    const batchPath = path.join(process.env['TEMP'], 'liverylab_cleanup.bat');
    fs.writeFileSync(batchPath, batchContent);
    spawn('cmd', ['/c', batchPath], { detached: true, windowsHide: true, stdio: 'ignore' }).unref();

    sendProgress(100, 'Uninstallation complete!');

    return { success: true };
  } catch (err) {
    console.error('Uninstallation failed:', err);
    return { success: false, error: err.message };
  }
});

// Launch the installed application
ipcMain.on('launch-app', (event, exePath) => {
  if (fs.existsSync(exePath)) {
    spawn(exePath, [], { detached: true, stdio: 'ignore' }).unref();
  }
  app.quit();
});
