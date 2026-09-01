import { BrowserWindow, Tray, Menu, app, nativeImage } from 'electron';
import { join } from 'node:path';
import type { NoteStore } from './store';
import { IPC_CHANNELS } from '../shared/types';
import type { StickyNote } from '../shared/types';
import { toReadableErrorMessage, broadcastChanged } from './ipc';
import { debounce } from '../shared/debounce';

// 32x32 PNG of the app icon (스티커 메모 더미 + 연필), downscaled from build/icon.png and
// embedded as base64 so the tray icon doesn't depend on locating a bundled asset file at
// runtime.
const TRAY_ICON_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAF3UlEQVR4nO2WTWxcVxXHf+e+N58ef8Ue20mcNFLsKokhJiXEpCmqATUSHyoSks2mgCiISEhsukFCUNurCikSKhtIBESVECBnAUhsgli0gNrgVimlTWpsJ7Ed4w/sjO2xxzNv3rv3sBg71J8REmLTHunN0Zt37z3/8z//e++BD+z9brLXR+3rM/R37DLm6h4ze7aMuepE0P8a3f/DdsxOVUVEVHPfOUx18iMEgQMLGI1shO+ZSjY2qkzwKi4qG/HTy1LIN1KVMEJiXqAuIpH+o5GBslNkKxP+zrj6BVB891N8/ykkBM+r/IWhsoQCZt0rOMGvCmE5SzrzVYrBKqnVK9BgmXxz+IrCs9Bj4KrdE4AqIjLgdOTbCQfHTFCwlK0D3YgMqv8JLOAiMBnLu+8oudXP0FRX4s5EDllJ6/kn39a51aNf+8HAH14SOf/K4OCg19vba3cFQH+fwIAWG2JNKSSLVQ9jDLJergfZu4oPHabOEf0NUhezpDsn9FfuutilPGea/gwrJgqDtB5fXmoHXsnevLmp7NsBdNwSgFQy3oJvkq5YUheuVaLLevANBiLwsincW4L88BBHbJrkL/4iy033aWwfo61jGTKnKRVEaqwr71Ts7QCyJyoIrTtEOo6uOefKRW+zXBUiRWqBt5LIi4/g2SSLMyMs5HMcybzOqZOORz9xDufHidY86st2W6idAXSve3FHAMR4Gq/Jrqe/rgEnUOOhf1f0R80YlyQ/Pcb05ARDjdfp/FLE585CbTPOgdGIYrGMlmIkXfBwBh5sQe2Ls1JoI7REq/OiNqxsgphg/tWE/O4oXhhjeWaYiduj3Gj5K+1ftpz77Bm0bj+IhzEBBCtMjk0jUYqU3ZkBs/m1ryK1UnAYkVYCS7ymWRL1rcTrW4lXZzHFg5ieJuar3mZseJgbB69z/FnHuac/jTSdQhTs8hyFyTFu/OZPzM6VJOFVY8K1h5fg5ZcxgKPkTlIb91kpWRU8FCSuFO8LLl/N4uQ13o2/zsyxKT78TIqPfrIT6lqhMEnhzhss3J1hZKRAsRxn36c6KQ4JCc9ZgO6Ojt2P4u7uDV60CzEAKhui8ISLP8tz99Wf03PiLq4hovu7rRw+3oYma6A0Q+EfrzFze4Hb4yH5qJozH2tiqqYZXQP8sMLAlkt0qwhd5Ue7jAtxqIiCeFBYVKpKN/nCk+N0Pn6ElqMHMZk6nFVMHNYmJxh9c5rxWQ+TzPChx/bT2lbLaNBILFCIEe1ZgvUb0Onqt1qQ2MexMUzce6CRTK3y3POnwesC8SFyoCEmXCN3Z4qh39/ifs6n5ZFG2k80UdvSgH+ghtxIPa2RhaQJH6IBQRVZGZ23MXdvOCnlk6Hz1RgjGIOI4FRQZ3FRifLaKvn7yyxM5VicXaK+Nk3n6QNk99fi11RDIg3lAnOzyKMiRO4hDIigly59M3bhwuX5H//6uV9m95U6lxYWQ0FjgkXUoc5h1ICmcDaBcw3EE8eoOlmFn0gwQ4xw1iea9gk1RsFU6zvBKX3ajbliujbcQQKbNXBh+pJVvSxfvPa9a49NDX/fs+VMyVqUSjviZP0OFFARVAQXgM4qKBiRyrO+sPq+dE2Pc6gqya3ysqtE2QxhW0c02DPo9V7ttcGF519w6dpvrJYKzloXA3DqRBXRiscpooKICLJ+XYoRBTCIeoJNpTIsCv+cy80+1fXSxdmNbmtXAAB9fX1mYGDADX69b1/Sw/hhXLxEWTJkMPGymCgmXrwsEsYkiEJJvWeu80PVMKbWD3UlKGvZ4X575YWly7CjCHc1rRwB/zPTXZLduy1/L4hdmur+/n7Z8r59pAiy6wof2Pvd/g09s7SKuGK81gAAAABJRU5ErkJggg==';
const TRAY_ICON_PNG = Buffer.from(TRAY_ICON_PNG_BASE64, 'base64');

const noteWindows = new Map<string, BrowserWindow>();
let listWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;

app.on('before-quit', () => {
  isQuitting = true;
});

export function createListWindow(initialAlwaysOnTop: boolean): BrowserWindow {
  if (listWindow) {
    listWindow.show();
    listWindow.focus();
    return listWindow;
  }
  listWindow = new BrowserWindow({
    width: 360,
    height: 600,
    minWidth: 240,
    minHeight: 300,
    alwaysOnTop: initialAlwaysOnTop,
    frame: false,
    webPreferences: { preload: join(__dirname, '../preload/index.js') },
  });
  loadRendererPage(listWindow, 'list');
  listWindow.on('closed', () => {
    listWindow = null;
  });
  return listWindow;
}

export function openNoteWindow(store: NoteStore, id: string): void {
  const existing = noteWindows.get(id);
  if (existing) {
    existing.show();
    existing.focus();
    persistNoteUpdate(store, id, { isOpen: true });
    return;
  }
  const note = store.getAllNotes().find((n) => n.id === id);
  if (!note) return;

  const win = new BrowserWindow({
    width: note.size.width,
    height: note.size.height,
    x: note.position.x,
    y: note.position.y,
    minWidth: 180,
    minHeight: 120,
    alwaysOnTop: note.alwaysOnTop,
    frame: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      additionalArguments: [`--note-id=${id}`],
    },
  });
  loadRendererPage(win, 'note');

  win.on('close', (event) => {
    if (isQuitting) return;
    if (deleteNoteIfEmpty(store, id)) return;
    event.preventDefault();
    win.hide();
    persistNoteUpdate(store, id, { isOpen: false });
  });
  win.on('closed', () => {
    noteWindows.delete(id);
  });

  // `moved`/`resized` are documented (Electron's own type definitions) as darwin/win32-only and
  // never fire on Linux. `move`/`resize` fire on every platform but fire continuously during a
  // drag, so debounce the persistence and read both position and size together via getBounds().
  const persistBounds = debounce(() => {
    // The window may have been destroyed (e.g. its note deleted from the list) while this
    // debounced write was still pending. getBounds() on a destroyed BrowserWindow throws.
    if (win.isDestroyed()) return;
    const { x, y, width, height } = win.getBounds();
    persistNoteUpdate(store, id, { position: { x, y }, size: { width, height } });
  }, 300);
  win.on('move', persistBounds);
  win.on('resize', persistBounds);

  noteWindows.set(id, win);
  persistNoteUpdate(store, id, { isOpen: true });
}

export function restoreOpenNoteWindows(store: NoteStore): void {
  for (const note of store.getAllNotes()) {
    if (note.isOpen) openNoteWindow(store, note.id);
  }
}

export function setNoteAlwaysOnTop(id: string, value: boolean): void {
  noteWindows.get(id)?.setAlwaysOnTop(value);
}

export function setListAlwaysOnTop(value: boolean): void {
  listWindow?.setAlwaysOnTop(value);
}

export function closeNoteWindow(id: string): void {
  noteWindows.get(id)?.destroy();
}

export function createTray(onOpenList: () => void): void {
  const icon = nativeImage.createFromBuffer(TRAY_ICON_PNG);
  tray = new Tray(icon);
  tray.setToolTip('스티커 메모');
  // Left-click opens the list directly, independent of the context menu, so the tray is never
  // the app's only reachable surface via a single, easy-to-miss interaction.
  tray.on('click', onOpenList);
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: '메모 목록 열기', click: onOpenList },
      { label: '종료', click: () => app.quit() },
    ]),
  );
  setupApplicationMenu();
}

// Minimal application menu whose sole purpose is guaranteeing a platform-standard quit
// accelerator (Cmd+Q / Alt+F4-equivalent via role:'quit') works even if the tray icon is
// somehow unreachable (e.g. not rendered by the desktop environment). Not a full menu bar.
function setupApplicationMenu(): void {
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: '파일',
        submenu: [{ label: '종료', role: 'quit', accelerator: 'CmdOrCtrl+Q' }],
      },
    ]),
  );
}

// A note left completely empty when its window closes is almost always an accidental "new
// note" the user never actually wrote into — deleting it (instead of leaving an empty entry
// behind in the list forever) is the requested default. Only the note's own `content` is
// checked; tags alone don't save it from deletion.
function deleteNoteIfEmpty(store: NoteStore, id: string): boolean {
  const note = store.getAllNotes().find((n) => n.id === id);
  if (!note || note.content !== '') return false;
  try {
    store.deleteNote(id);
    broadcastChanged(store);
    return true;
  } catch (error) {
    const message = toReadableErrorMessage(error);
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send(IPC_CHANNELS.SAVE_ERROR, `저장 실패: ${message}`);
    }
    return false;
  }
}

// Wraps `store.updateNote` the same way `ipc.ts`'s `withSaveErrorHandling` wraps IPC mutations:
// on failure, compute the same readable message and broadcast `SAVE_ERROR` so the renderer's
// existing dismissible banner shows it, instead of letting the write throw uncaught out of an
// Electron event handler (which would otherwise surface as a raw stack-trace dialog).
function persistNoteUpdate(store: NoteStore, id: string, changes: Partial<StickyNote>): void {
  try {
    store.updateNote(id, changes);
  } catch (error) {
    const message = toReadableErrorMessage(error);
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send(IPC_CHANNELS.SAVE_ERROR, `저장 실패: ${message}`);
    }
  }
}

function loadRendererPage(win: BrowserWindow, page: 'list' | 'note'): void {
  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(`${process.env.ELECTRON_RENDERER_URL}/${page}.html`);
  } else {
    win.loadFile(join(__dirname, `../renderer/${page}.html`));
  }
}
