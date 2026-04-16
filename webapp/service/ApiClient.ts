/**
 * API Client - REST API abstraction layer for SanalOyuncular
 * Replaces the localStorage-based StorageService
 * @namespace com.openui5.webdb.service
 */
// Local dev (localhost): call backend directly on port 3000 to avoid proxy issues.
// Production (Vercel etc.): use relative /api path served by the serverless function.
const isLocalDev = typeof window !== "undefined" &&
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
const API_BASE = isLocalDev ? "http://localhost:3000/api" : "/api";

const ApiClient = {
	getHeaders(): HeadersInit {
		const headers: Record<string, string> = { "Content-Type": "application/json" };
		const token = sessionStorage.getItem("token");
		if (token) {
			headers["Authorization"] = `Bearer ${token}`;
		}
		return headers;
	},

	async get<T>(path: string): Promise<T> {
		const response = await fetch(`${API_BASE}${path}`, {
			headers: this.getHeaders()
		});
		if (!response.ok) {
			let data = null;
			try { data = await response.json(); } catch(e){}
			throw { status: response.status, data, message: `API hatası: ${response.status} ${response.statusText}` };
		}
		return response.json() as Promise<T>;
	},

	async post<T>(path: string, data: unknown): Promise<T> {
		const response = await fetch(`${API_BASE}${path}`, {
			method: "POST",
			headers: this.getHeaders(),
			body: JSON.stringify(data)
		});
		if (!response.ok) {
			let errorData = null;
			try { errorData = await response.json(); } catch(e){}
			throw { status: response.status, data: errorData, message: `API error: ${response.status} ${response.statusText}` };
		}
		return response.json() as Promise<T>;
	},

	async put<T>(path: string, data: unknown): Promise<T> {
		const response = await fetch(`${API_BASE}${path}`, {
			method: "PUT",
			headers: this.getHeaders(),
			body: JSON.stringify(data)
		});
		if (!response.ok) {
			let errorData = null;
			try { errorData = await response.json(); } catch(e){}
			throw { status: response.status, data: errorData, message: `API error: ${response.status} ${response.statusText}` };
		}
		return response.json() as Promise<T>;
	},

	async del<T>(path: string): Promise<T> {
		const response = await fetch(`${API_BASE}${path}`, {
			method: "DELETE",
			headers: this.getHeaders()
		});
		if (!response.ok) {
			let errorData = null;
			try { errorData = await response.json(); } catch(e){}
			throw { status: response.status, data: errorData, message: `API error: ${response.status} ${response.statusText}` };
		}
		return response.json() as Promise<T>;
	}
};

export default ApiClient;
