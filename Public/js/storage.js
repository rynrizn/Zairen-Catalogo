const STORAGE_KEY = 'zairen-catalog-draft';

const CatalogStorage = {
  save(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      return true;
    } catch (e) {
      console.error('Error saving to localStorage', e);
      return false;
    }
  },
  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.error('Error loading from localStorage', e);
      return null;
    }
  },
  clear() {
    localStorage.removeItem(STORAGE_KEY);
  },
  export() {
    const data = this.load();
    if (!data) {
        alert("No hay datos locales para exportar. Guarda primero.");
        return;
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'products.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
};
