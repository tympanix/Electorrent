import { contextBridge, ipcRenderer } from 'electron'

import { IPC_CHANNELS } from '@shared/ipc'
import type { ContextMenuModel, ContextMenuPlacement, ContextMenuSize } from '@shared/ipc-contract'

contextBridge.exposeInMainWorld('contextMenu', {
    onModel(callback: (model: ContextMenuModel) => void) {
        const listener = (_event: Electron.IpcRendererEvent, model: ContextMenuModel) => callback(model)
        ipcRenderer.on(IPC_CHANNELS.contextMenu.model, listener)
        return () => ipcRenderer.removeListener(IPC_CHANNELS.contextMenu.model, listener)
    },
    resize(size: ContextMenuSize) {
        return ipcRenderer.invoke(IPC_CHANNELS.contextMenu.resize, size) as Promise<ContextMenuPlacement>
    },
    hide() {
        return ipcRenderer.invoke(IPC_CHANNELS.contextMenu.hide)
    },
    select(actionId: string) {
        return ipcRenderer.invoke(IPC_CHANNELS.contextMenu.select, { actionId })
    },
})
