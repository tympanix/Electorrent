---
name: electron-ipc
description: >
  Safe Electron IPC patterns for renderer-main communication with preload
  bridges, channel design, replies, and serialization limits.
---

# Skill: Electron IPC

## Purpose

Use this skill when you need to design or implement communication between
Electron's main and renderer processes.

## Core Model

- IPC is how Electron processes exchange messages.
- Define your own channel names with `ipcMain` and `ipcRenderer`.
- Channels are arbitrary and bidirectional, but keep names explicit and scoped.
- In context-isolated apps, expose narrow preload APIs with `contextBridge`
  instead of exposing raw Electron modules to the renderer.

## Default Rules

1. Keep privileged work in the main process.
2. Expose small, task-specific preload APIs such as `openFile()` or
   `setTitle(title)`.
3. Do not expose `ipcRenderer.send`, `ipcRenderer.invoke`, or `ipcRenderer.on`
   directly to renderer code.
4. When forwarding events from preload, strip the Electron event object and pass
   only the data the renderer needs.
5. Prefer namespaced channel names such as `dialog:openFile` for readability.

## Pick the Right Pattern

| Need | Renderer API | Main API | Notes |
|---|---|---|---|
| Fire-and-forget renderer -> main | `ipcRenderer.send` | `ipcMain.on` | Good for commands with no result |
| Request/response renderer -> main | `ipcRenderer.invoke` | `ipcMain.handle` | Preferred two-way pattern |
| Push main -> renderer | preload listener wrapper | `webContents.send` | Main must target a specific window/webContents |
| Renderer -> renderer | relay through main or `MessagePort` | main as broker if needed | No direct IPC channel between renderers |

## Pattern 1: Renderer to Main, One Way

Use this when the renderer triggers a main-process action and does not need a
result.

### Main

```js
ipcMain.on('set-title', (event, title) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  win?.setTitle(title)
})
```

### Preload

```js
contextBridge.exposeInMainWorld('electronAPI', {
  setTitle: (title) => ipcRenderer.send('set-title', title)
})
```

### Renderer

```js
window.electronAPI.setTitle('New title')
```

## Pattern 2: Renderer to Main, Two Way

Use this when the renderer needs a result from the main process. Prefer this
over older reply patterns.

### Main

```js
ipcMain.handle('dialog:openFile', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog()
  return canceled ? undefined : filePaths[0]
})
```

### Preload

```js
contextBridge.exposeInMainWorld('electronAPI', {
  openFile: () => ipcRenderer.invoke('dialog:openFile')
})
```

### Renderer

```js
const filePath = await window.electronAPI.openFile()
```

### Notes

- `invoke`/`handle` is the preferred async request-response model.
- Errors from `ipcMain.handle` are serialized; the renderer does not receive the
  full original error object.

## Pattern 3: Main to Renderer

Use this when the main process needs to push updates into a specific window.

### Main

```js
mainWindow.webContents.send('update-counter', 1)
```

### Preload

```js
contextBridge.exposeInMainWorld('electronAPI', {
  onUpdateCounter: (callback) => {
    ipcRenderer.on('update-counter', (_event, value) => callback(value))
  }
})
```

### Renderer

```js
window.electronAPI.onUpdateCounter((value) => {
  // update UI
})
```

### Replying Back

There is no `invoke` equivalent from main to renderer. If the renderer needs to
reply, send a new message back to the main process on a separate channel.

## Legacy Patterns

Avoid these unless you have a strong compatibility reason:

- `ipcRenderer.send` plus `event.reply` for two-way communication:
  works, but forces manual reply-channel bookkeeping.
- `ipcRenderer.sendSync`: blocks the renderer and hurts responsiveness.

## Security Checklist

- Never hand the renderer unrestricted Electron or Node access.
- Do not expose raw `ipcRenderer` methods over `contextBridge`.
- Wrap listeners so the callback never receives the Electron event object.
- Keep preload APIs minimal and purpose-built.
- Validate inputs in the main process before using privileged APIs.

## Serialization Limits

Electron IPC uses the Structured Clone Algorithm.

- Safe: plain objects, arrays, strings, numbers, booleans, and other structured
  clone compatible values.
- Not safe: DOM objects, Electron objects like `BrowserWindow` or
  `WebContents`, and Node/Electron objects backed by native C++ classes.

Pass serializable data, not live framework objects.

## Quick Guidance

- Need a command without a return value: `send` + `on`
- Need a result: `invoke` + `handle`
- Need to notify a renderer from main: `webContents.send`
- Need renderer-to-renderer: broker via main or use `MessagePort`

## Reference

- https://www.electronjs.org/docs/latest/tutorial/ipc
