const db = (() => {
  const DB_NAME    = 'SprintLeagueDB';
  const DB_VERSION = 3;

  const SCHEMA = {
    users:   { keyPath: 'id', indexes: [] },
    tasks:   { keyPath: 'id', indexes: [{ name: 'userId', keyPath: 'userId', unique: false }] },
    sprints: { keyPath: 'id', indexes: [{ name: 'userId', keyPath: 'userId', unique: false }] },
    stats:   { keyPath: 'id', indexes: [] },
  };

  let _db = null;

  function init() {
    return new Promise((resolve, reject) => {
      if (_db) { resolve(_db); return; }

      const req = indexedDB.open(DB_NAME, DB_VERSION);

      req.onupgradeneeded = (e) => {
        const idb = e.target.result;
        const upgradeTx = e.target.transaction;

        Object.entries(SCHEMA).forEach(([name, cfg]) => {
          // Drop store if it exists but is missing expected indexes (stale/corrupted)
          if (idb.objectStoreNames.contains(name)) {
            const existing = upgradeTx.objectStore(name);
            const healthy  = cfg.indexes.every(idx => existing.indexNames.contains(idx.name));
            if (!healthy) idb.deleteObjectStore(name);
            else return;
          }
          const store = idb.createObjectStore(name, { keyPath: cfg.keyPath });
          cfg.indexes.forEach(idx =>
            store.createIndex(idx.name, idx.keyPath, { unique: !!idx.unique })
          );
        });
      };

      req.onsuccess = (e) => { _db = e.target.result; resolve(_db); };
      req.onerror   = (e) => reject(e.target.error);
      req.onblocked = ()  => console.warn('[db] Blocked — close other tabs and refresh.');
    });
  }

  function _store(name, mode = 'readonly') {
    if (!_db) throw new Error('[db] Call db.init() before using the database.');
    return _db.transaction([name], mode).objectStore(name);
  }

  function addRecord(storeName, record) {
    return new Promise((resolve, reject) => {
      const key = SCHEMA[storeName]?.keyPath ?? 'id';
      if (!record[key]) {
        reject(new Error(`[db.add] "${storeName}" missing key "${key}" — got: ${JSON.stringify(record)}`));
        return;
      }
      const r = _store(storeName, 'readwrite').add(record);
      r.onsuccess = () => resolve(record);
      r.onerror   = (e) => reject(new Error('[db.add] ' + e.target.error));
    });
  }

  function updateRecord(storeName, record) {
    return new Promise((resolve, reject) => {
      const r = _store(storeName, 'readwrite').put(record);
      r.onsuccess = () => resolve(record);
      r.onerror   = (e) => reject(new Error('[db.put] ' + e.target.error));
    });
  }

  function getRecord(storeName, key) {
    return new Promise((resolve, reject) => {
      const r = _store(storeName).get(key);
      r.onsuccess = (e) => resolve(e.target.result ?? null);
      r.onerror   = (e) => reject(new Error('[db.get] ' + e.target.error));
    });
  }

  function deleteRecord(storeName, key) {
    return new Promise((resolve, reject) => {
      const r = _store(storeName, 'readwrite').delete(key);
      r.onsuccess = () => resolve(true);
      r.onerror   = (e) => reject(new Error('[db.del] ' + e.target.error));
    });
  }

  function getAllRecords(storeName) {
    return new Promise((resolve, reject) => {
      const r = _store(storeName).getAll();
      r.onsuccess = (e) => resolve(e.target.result ?? []);
      r.onerror   = (e) => reject(new Error('[db.getAll] ' + e.target.error));
    });
  }

  function queryByIndex(storeName, indexName, value) {
    return new Promise((resolve, reject) => {
      const r = _store(storeName).index(indexName).getAll(value);
      r.onsuccess = (e) => resolve(e.target.result ?? []);
      r.onerror   = (e) => reject(new Error('[db.idx] ' + e.target.error));
    });
  }

  const api = { init, addRecord, updateRecord, getRecord, deleteRecord, getAllRecords, queryByIndex };
  window.db = api;
  return api;
})();