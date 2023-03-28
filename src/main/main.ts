import {app, BrowserWindow, ipcMain} from 'electron';
import express from 'express';
import {address} from 'ip';
import path from 'path';
import request from 'request';
import {getWindowSizeSettings, getWindowPositionSettings, saveWindowPos, saveWindowSize} from './storage';
import {failedToLoadAPI} from './errorTable';
import {themes,mapThemes} from './filesConfiguration.json';
import { autoUpdater } from "electron-updater"
const version = app.getVersion();
/* Creating an express app. */
const expressApp = express();
/* Creating a server that listens on port 9093. */
expressApp
    .listen(9093, () => {
        console.log('API Started');
    })
    .on('error', () => {
        throw failedToLoadAPI;
    });
/* A route that is used to get a gif from the server. */
expressApp.get('/getGif/:gif/:themeID', (req, res) => {
    const {gif, themeID} = req.params;
    const theme = themes[themeID];
    const gifPath = theme.gifs[gif];
    res.sendFile(`${gifPath}`, { root : path.join(__dirname,'../renderer/')});
});
expressApp.get('/getTrack/:track/:themeID', (req, res) => {
    const {track, themeID} = req.params;
    const theme = mapThemes[themeID];
    const trackPath = theme.trackMaps[track];
    res.sendFile(`${trackPath}`, { root : path.join(__dirname,'../renderer/')});
});
/* A route that is used to change the GIF on the Pixoo64. */
expressApp.get('/getGifPixoo/:themeID/:gif.gif/', (req, res) => {
    const {gif, themeID} = req.params;
    const theme = themes[themeID];
    /* Checking if the theme is compatible with Pixoo64. If it isn't, it sends a 400 error. */
    if (theme.compatibleWith.Pixoo64 !== true) {
        res.statusCode = 400;
        res.send("Theme requested doesn't support Pixoo64");
        return;
    }
    const gifPath = theme.gifs.pixoo64[gif];
    res.sendFile(`${gifPath}`, { root : path.join(__dirname,'../renderer/')});
});
/* A route that is used to change the GIF on the Pixoo64. */
expressApp.get('/pixoo/:themeID/:ip/:gif.gif', (req, res) => {
    const {gif, themeID, ip} = req.params;
    const theme = themes[themeID];
    /* Checking if the theme is compatible with Pixoo64. If it isn't, it sends a 400 error. */
    if (theme.compatibleWith.Pixoo64 !== true) {
        res.statusCode = 400;
        res.send("Theme requested doesn't support Pixoo64");
        return;
    }
    /* Sending a POST request to the Pixoo64. */
    request.post(
        `http://${ip}:80/post`,
        {
            json: {
                Command: 'Device/PlayTFGif',
                FileType: 2,
                FileName: `http://${address()}:9093/getGifPixoo/${themeID}/${gif}.gif`,
            },
        },
        /* A callback function that is called when the request is completed. */
        (err, response, body) => {
            if (err) {
                res.statusCode = 500;
                res.send('Failed to change GIF on Pixoo64');
                return;
            }
            if (response.headers['content-type'] !== 'application/json') {
                res.statusCode = 500;
                res.send('Unexpected content type in response');
                return;
            }
            const responseBody = JSON.parse(body);
            if (responseBody.error_code !== 0) {
                res.statusCode = 500;
                res.send('Failed to change GIF on Pixoo64');
                return;
            }
            res.send('OK');
        }
    );
});


let mainWindow:BrowserWindow
/**
 * `createWindow` is a function that takes three arguments: `width`, `height`, and `title`, and returns
 * a new `BrowserWindow` object
 * @param {number} width - The width of the window in pixels.
 * @param {number} height - The height of the window in pixels.
 * @param {string} title - The title of the window.
 * @returns A BrowserWindow object.
 */
function createWindow(width: number, height: number, windowPositionX: number, windowPositionY: number, title: string) {
     mainWindow = new BrowserWindow({
        width: width,
        height: height,
        title: title,
        x: windowPositionX,
        y: windowPositionY,
        frame: true,
        transparent: false,
        titleBarStyle: 'hidden',
        /* Setting the icon of the window. */
        icon: path.join(__dirname,'../../build/icon.png'),
        alwaysOnTop: false,
        autoHideMenuBar: true,
        /* Hiding the window until it is ready to be shown. */
        show: false,
        webPreferences: {
            preload: path.join(__dirname, '../preload/preload.js'),
            nodeIntegration:true
        },
    });
  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
    if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
        mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
    } else {
        mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
    }
    // Event listeners on the window
    mainWindow.webContents.on('did-finish-load', () => {
        mainWindow.show();
        if (version.includes('dev')) mainWindow.webContents.openDevTools({mode: 'detach'});
    });

    mainWindow.on('moved', () => saveWindowPos(mainWindow.getPosition()));
    /* Saving the window size when the window is resized. */
    mainWindow.on('resized', () => saveWindowSize(mainWindow.getSize()));
    /* Setting the minimum size of the window to 426x240. */
    mainWindow.setMinimumSize(256, 256);

    mainWindow.on('close', function () {
        mainWindow = null // Clean up your window object.
     })

    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (url === 'https://github.com/LapsTimeOFF/DigiFlag_F1MV') {
            return {
                action: 'allow',
                overrideBrowserWindowOptions: {
                    frame: true,
                    backgroundColor: '#131416',
                },
            };
        }
        else if (url.includes('index.html')) {
            return {
                action: 'allow',
                overrideBrowserWindowOptions: {
                    frame: false,
                    transparent: true,
                    fullscreenable: false,
                    minWidth:256,
                    minHeight:256,
                    webPreferences:{
                        nodeIntegration:true,
                        preload: path.join(__dirname, '../preload/preload.js'),
                    }
                },
            };
        }
        else {
            return {
                action: 'deny'
            };
        }
    });
    return mainWindow;
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.whenReady().then(() => {
    autoUpdater.checkForUpdatesAndNotify()
    const windowSize = getWindowSizeSettings();
    const windowPosition = getWindowPositionSettings();

    if (version.includes('dev')) console.log('WindowSize: ', windowSize);
    if (version.includes('dev')) console.log('WindowPosition: ', windowPosition);

    createWindow(windowSize[0], windowSize[1], windowPosition[0], windowPosition[1], 'DigiFlag - ' + version);
    app.on('activate', () => {
        // On OS X it's common to re-create a window in the app when the
        // dock icon is clicked and there are no other windows open.
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow(windowSize['0'], windowSize[1], windowPosition[0], windowPosition[1], 'DigiFlag - ' + version);
        }
    });
});
// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

ipcMain.handle('get-version',async()=>{
    return app.getVersion()
})