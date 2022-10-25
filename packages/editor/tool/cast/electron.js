const { app, protocol, BrowserWindow, ipcMain, desktopCapturer } = require('electron')

// https://github.com/electron/electron/issues/4280
process.setFdLimit(65535)

// https://stackoverflow.com/questions/44658269/electron-how-to-allow-insecure-https
app.commandLine.appendSwitch('ignore-certificate-errors')

// https://github.com/electron/electron/issues/23254
app.commandLine.appendSwitch('webrtc-max-cpu-consumption-percentage', '100')

// https://forum.babylonjs.com/t/electron-babylonjs-webgpu-not-working-yet/23544/10
app.commandLine.appendSwitch('enable-unsafe-webgpu')

// https://github.com/electron/electron/issues/15448
protocol.registerSchemesAsPrivileged([{
    scheme: 'http',
    privileges: {
        bypassCSP: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
    }
}])

/**
 * @type BrowserWindow
 */
let win
app.whenReady().then(() => {
    win = new BrowserWindow({
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        }
    })
    win.setMenuBarVisibility(false)
    if (process.env.OPEN_DEV_TOOLS) {
        win.webContents.openDevTools({ mode: 'detach' })
    }
    win.loadURL(process.env.STARTUP_URL)
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

ipcMain.handle('desktop-get-sources', async (_, opts) => {
    return desktopCapturer.getSources(opts)
})

