const STORAGE_KEYS = {
  TOKEN: 'apkastore_auth_token',
  USER: 'apkastore_user_profile',
  ROLE: 'apkastore_user_role',
  SHOP: 'apkastore_shop_data',
};

const memoryStorage: Record<string, string> = {};

export const storage = {
  setItem: (key: string, value: string): void => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
      } else {
        memoryStorage[key] = value;
      }
    } catch (e) {
      memoryStorage[key] = value;
    }
  },

  getItem: (key: string): string | null => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(key);
      }
      return memoryStorage[key] || null;
    } catch (e) {
      return memoryStorage[key] || null;
    }
  },

  removeItem: (key: string): void => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
      }
      delete memoryStorage[key];
    } catch (e) {
      delete memoryStorage[key];
    }
  },

  clear: (): void => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(STORAGE_KEYS.TOKEN);
        window.localStorage.removeItem(STORAGE_KEYS.USER);
        window.localStorage.removeItem(STORAGE_KEYS.ROLE);
        window.localStorage.removeItem(STORAGE_KEYS.SHOP);
      }
      Object.keys(memoryStorage).forEach((k) => delete memoryStorage[k]);
    } catch (e) {
      // silent
    }
  },

  KEYS: STORAGE_KEYS,
};
