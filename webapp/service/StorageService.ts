/**
 * localStorage abstraction layer for SanalOyuncular
 * @namespace com.openui5.webdb.service
 */
const STORAGE_PREFIX = "ag_";

const StorageService = {
	get<T>(key: string): T | null {
		try {
			const data = localStorage.getItem(STORAGE_PREFIX + key);
			return data ? JSON.parse(data) as T : null;
		} catch {
			return null;
		}
	},

	set(key: string, value: unknown): void {
		localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
	},

	remove(key: string): void {
		localStorage.removeItem(STORAGE_PREFIX + key);
	},

	generateId(): string {
		return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
	},

	initIfEmpty(key: string, defaultData: unknown): void {
		if (this.get(key) === null) {
			this.set(key, defaultData);
		}
	},

	clearAll(): void {
		const keys: string[] = [];
		for (let i = 0; i < localStorage.length; i++) {
			const k = localStorage.key(i);
			if (k && k.startsWith(STORAGE_PREFIX)) {
				keys.push(k);
			}
		}
		keys.forEach(k => localStorage.removeItem(k));
	}
};

export default StorageService;
