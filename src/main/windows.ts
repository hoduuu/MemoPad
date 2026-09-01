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
  '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';
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
