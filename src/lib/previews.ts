// Tab screenshots in IndexedDB, keyed by normalized URL. The worker writes,
// the panel reads; both share the extension origin's database.

export interface Preview {
  url: string;
  tabId: number;
  blob: Blob;
  width: number;
  height: number;
  capturedAt: number;
}

const STORE = 'previews';
let db: Promise<IDBDatabase> | undefined;

function open(): Promise<IDBDatabase> {
  db ??= new Promise((resolve, reject) => {
    const req = indexedDB.open('tab-triage', 1);
    req.onupgradeneeded = () => {
      const store = req.result.createObjectStore(STORE, { keyPath: 'url' });
      store.createIndex('tabId', 'tabId');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return db;
}

function done<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function store(mode: IDBTransactionMode): Promise<IDBObjectStore> {
  return (await open()).transaction(STORE, mode).objectStore(STORE);
}

export async function putPreview(preview: Preview): Promise<void> {
  await done((await store('readwrite')).put(preview));
}

export async function getPreview(url: string): Promise<Preview | undefined> {
  return done((await store('readonly')).get(url) as IDBRequest<Preview | undefined>);
}

export async function allPreviews(): Promise<Preview[]> {
  return done((await store('readonly')).getAll() as IDBRequest<Preview[]>);
}

export async function deletePreviewsForTab(tabId: number): Promise<void> {
  const s = await store('readwrite');
  const keys = await done(s.index('tabId').getAllKeys(tabId));
  await Promise.all(keys.map((k) => done(s.delete(k))));
}

/** Deletes every preview whose URL is not in `keep`. */
export async function prunePreviews(keep: Set<string>): Promise<void> {
  const s = await store('readwrite');
  const keys = (await done(s.getAllKeys())) as string[];
  await Promise.all(keys.filter((k) => !keep.has(k)).map((k) => done(s.delete(k))));
}
