'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('browseAnony', {
  getPartition: () => ipcRenderer.invoke('get-partition'),
});
