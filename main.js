const { app, BrowserWindow } = require('electron');
const { ipcMain } = require('electron')

const { dialog } = require('electron')
const fs = require('fs');

ipcMain.handle('save file', async (event, arg) => {
  // let coord = "";
  // dialog.showMessageBox({ message: "Which coordinate?", type: "question", buttons: ["opencv", "opengl"] }).then(result => {
  //   if (result.response === 0) {
  //     console.log("Use OpenCV");
  //     coord = "cv";
  //   } else if (result.response === 1) {
  //     console.log("Use OpenGL");
  //     coord = "gl";
  //   }
  // });

  outputFilePath = dialog.showSaveDialogSync({ title: "save camera extrinsic json", defaultPath: "./cam_extrinsic.json" });
  try {
    fs.writeFileSync(outputFilePath, JSON.stringify(arg, null, 2), 'utf-8');
  }
  catch (e) {
    console.log("Save failed.")
  }
})


let mainWindow;

// Chrome by default black lists certain GPUs because of bugs.
// if your are not able to view webgl try enabling --ignore-gpu-blacklist option
// But, this will make electron/chromium less stable.
app.commandLine.appendSwitch('--ignore-gpu-blacklist');

// Quit when all windows are closed.
app.on('window-all-closed', function () {
  app.quit();
});

// This method will be called when Electron has done everything
// initialization and ready for creating browser windows.
app.on('ready', function () {
  // Create the browser window.
  mainWindow = new BrowserWindow({ width: 1200, height: 800, frame: true, webPreferences: { nodeIntegration: true, contextIsolation: false } });

  // and load the index.html of the app.
  mainWindow.loadURL('file://' + __dirname + '/index.html');
  // mainWindow.loadFile('index.html');

  // Emitted when the window is closed.
  mainWindow.on('closed', function () {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null;
  });
});
