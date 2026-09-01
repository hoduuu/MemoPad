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
  'iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAGe0lEQVR4nO2WTWxcVxXHf+e+9+aNHTue2mM7jZO4+XASHBsSUlGRD1Laoki0W2dDUcUaiYoFsLS96QeIBYsKAYsAy1qiZYFUgWgbtUBQUglB4tQfiZ34I7YTe4w9npn3dQ+LN3acuuNGsCxH70n3vXvvOf977v98wOddpNaEKrI+W3PR5vU1fohsndpekSKqj2SzhgibIav2m/9KjWq/UdV1bY8ASIUqeFWkX9X096fGq3pqwq0aTMfLyy83NYr/tnhmt8ZJIqkCRLTqSt3Y8GAMxkSSWFipPE/GKcgO98+aNOacyuzSxYbOX7+q2m9EBu0nAbgPhn1GZCiJCpkTTlPdOYIAPBdEq8Y2oD78JoAP4aplZuYUHfue4s70LFL8Bwd75ymu6Ss/+MXrfxX50aU33+xzLlwYSmoA6JaqI7tAE8IkRtVF2ARgs3GwCZh6YXV6jQ9+t4f8qYPcePeP3Fss41fKHGy6nayG+72uwmPfBS4N0QcM1fJAKo7IAcBBjMUxTtWYAoKqggUBjRIxWau2GOL9rI2vj9Zz5cZbvOWt0C7/5vSu97BJp5YDRxpKxvmkna0A3t9wcScIcVCUpLKqIoKug1BNWRNb3KYGdco+9pU82al2YneJXe8M03RohY7uYY4c9jH5XZTmDdmIBPiU88ODEHl6IKkedS+agDgiTgZxMxjHx7i+GM/HSAbT4KMViF9twZ3dTWiXmBsblTkpsM+7zJmnMhz4ypPgZqlUDPWR1swFLqQRICJ67VpfRoQOogTjeuK6OVSQ9TsXC+zwRFcT7E+bcGZaNYwXWRy9yWRxSq93XZZz38rTe+aE0tAMtkRQdsjGbGH/QwAGBvoFBnX/rj2tWG0nTohWF7BRBRFRRCBWMTt9cQstal9rFne+jTC6z+LIODdXJ7l+5G+cfjGvXzz7JNqQF3EympSXCQOPliQ9QV9NAMeGZRAQcfaZrFtHEFs/15HmCBHBoviqdinC/qQJd+FxjaL7LI6OMb46yfCRy5x+qZWeU18WGprTLK6WsFIhqmTw48gCvP/G9S0JKSVhXxqCGaNH8T2SUslGhekqcxVxDa7bJvbnberNtBPpPVm48THjK7cY6b7C6Rdb6Pnql9CG5pQ7NgSJZH7qLlHlOFlr422vYF1EzHEAx/VUcrvYSJROLOF4o2bPH6MSfMzC768zXp5kovcjzn67jaOnTqM728FWkLCoNijI1EczjIxP49W34EWVlANPA5c+DcBAlSQiJ9AEqxgxrgCIAUKrWb+T4uoYk/kPuOPO6nzviJz9zuMcPtmrmusSKd0hmBumcHtG7k6tMDpWYe/ZLi0t1pNJ7ifr9rd4II2AQVuYeDmH2m4qMSZNNZok4NSr/OldmLhyjeOZvzMxfRP3fMCzzx5gX08X1DcjpVFKt65y79Y8d2cDbs0KnQfbNdfRwfSUS53YaJsr6DMwlOxo9rtN1rRQiSyIWFUcD4pL6MXfjiFzH0rnNzztfSbPoRP7JdPcgrUGQ8TanRHmR2a5PWu5u+hox4FWOdLdwlxjHi27eCbZLgxTAho4pZ6LLQVWRNz1xEeS8MOX1vSJth4ad+8Wp6ERcFFVjB/DyjLjVyeYmIwIyOqh7rzs3p/XfEcjYzaPGwieS7gNgGPVyhI+J9KAkwVE1vsZGlpUjr9wFmKUJIIkhCQkKq3K4s05/dd7/2R+pqL5jla6j7TSuqdZs7kc5OtZup3DDy3W6HZXcEEBFm/d+KVXXnjGJOqocTDGgBgE1FoFLDaOCEtlithlu80RXe94RFRy5xoZOMobFOnGgQt1tvVAWmHaP3znD6x2vBSKr9XGYWIjFaIKordZpdqN7ERG8dpfsEz44DtY6xPMeiToaq0uMR2QauceRPR8N28StC2oCEBHVfjUD3xuI7l18/leHNf7+0toKKoaYtN+wApa0KlqR9B/rNToF5IhgAIPiohhj+NrcmPeFOl9ux1uq/mYPAAwwKINWz1358Vrvme/GVjZHSSyq1qR9nqKqoihqEUXTxlWENGaF9Em5I0bUiLF+tj65l60rFQrLfwEYGh7eUhW3NosnT3oXe17YUY4C8ep8yYSBuHW+NAKunxEnCsXJZATAicON/WtrkLgZjb1QkyDUyAt0aSHQq2+/sfYbqNR0wWZRandv/Is8Uld8AMSD+l9b42dYlIc/PVvh/+XzLP8B+NqFWAPwlL4CAAAAAElFTkSuQmCC';
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
