#!/usr/bin/env node

import { Command } from 'commander'
import { BrowserWindow } from 'electron'
import { writeFile } from 'fs/promises'
import { parse } from './shape/occ'

const program = new Command()

program
.command('convert')
.arguments('<files...>')
.option('--save <path>')
.action(async (files: string[], { save = './commit.json' }) => {
try {
    for (const file of files) {
        if (file.toLowerCase().endsWith('.stp')) {
            const entities = await parse(file, save)
            await writeFile(save, JSON.stringify({ entities }))
        } else {
            throw Error(`parsing file ${file} not supported`)
        }
    }
} catch (err) {
    console.error(err)
    process.exit(-1)
}
})

program
.command('cast')
.arguments('<url>')
.action(async (url: string) => {
try {
    const { app, protocol, BrowserWindow, ipcMain, desktopCapturer } = await import('electron')

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

    let win: BrowserWindow
    app.whenReady().then(() => {
        win = new BrowserWindow({
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: false,
            }
        })
        win.setMenuBarVisibility(false)
        win.webContents.openDevTools({ mode: 'detach' })
        win.loadURL(url)
    })

    app.on('window-all-closed', () => {
        if (process.platform !== 'darwin') {
            app.quit()
        }
    })

    ipcMain.handle('desktop-get-sources', async (_, opts) => {
        return desktopCapturer.getSources(opts)
    })
} catch (err) {
    console.error(err)
    process.exit(-1)
}
})

program.on('command:*', () => {
    program.outputHelp()
    process.exit(1)
})

program.parse(process.argv)
