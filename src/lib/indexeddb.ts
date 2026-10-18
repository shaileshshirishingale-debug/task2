/**
 * Client-side IndexedDB Persistence Layer
 * Mirrors tasks, profile stats, and daily reflections locally in the browser's IndexedDB
 * so progress is preserved across reloads and storage/network errors are handled gracefully.
 */

const DB_NAME = 'questhabit_100day_db';
const DB_VERSION = 1;
const STORE_NAME = 'app_state';

function openDatabase(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      resolve(null);
      return;
    }

    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        console.warn('IndexedDB open warning:', request.error);
        resolve(null);
      };
    } catch (err) {
      console.warn('IndexedDB unavailable:', err);
      resolve(null);
    }
  });
}

export const localPersistence = {
  async save<T>(key: string, value: T): Promise<boolean> {
    try {
      const db = await openDatabase();
      if (!db) {
        // Fallback to localStorage if IndexedDB is restricted
        localStorage.setItem(`qh_fallback_${key}`, JSON.stringify(value));
        return true;
      }

      return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.put({ value, updatedAt: new Date().toISOString() }, key);

        tx.oncomplete = () => {
          db.close();
          resolve(true);
        };
        tx.onerror = () => {
          db.close();
          resolve(false);
        };
      });
    } catch (err) {
      console.warn('Graceful storage fallback on save:', err);
      return false;
    }
  },

  async load<T>(key: string): Promise<T | null> {
    try {
      const db = await openDatabase();
      if (!db) {
        const raw = localStorage.getItem(`qh_fallback_${key}`);
        return raw ? (JSON.parse(raw) as T) : null;
      }

      return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(key);

        req.onsuccess = () => {
          db.close();
          const record = req.result;
          resolve(record ? (record.value as T) : null);
        };
        req.onerror = () => {
          db.close();
          resolve(null);
        };
      });
    } catch (err) {
      console.warn('Graceful storage fallback on load:', err);
      return null;
    }
  },

  async clearAll(): Promise<boolean> {
    try {
      const db = await openDatabase();
      if (db) {
        await new Promise<void>((resolve) => {
          const tx = db.transaction(STORE_NAME, 'readwrite');
          tx.objectStore(STORE_NAME).clear();
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => {
            db.close();
            resolve();
          };
        });
      }
      Object.keys(localStorage).forEach((k) => {
        if (k.startsWith('qh_fallback_')) {
          localStorage.removeItem(k);
        }
      });
      return true;
    } catch (err) {
      console.warn('Graceful storage fallback on clear:', err);
      return false;
    }
  },
};
