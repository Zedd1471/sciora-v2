const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("scioraDesktop", {
  isDesktop: true,
  getHotspotInfo: () => ipcRenderer.invoke("get-hotspot-info"),
});

