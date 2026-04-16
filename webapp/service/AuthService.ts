import ApiClient from "./ApiClient";
import type { IUser } from "../model/MockData";

/**
 * @namespace com.openui5.webdb.service
 */
const SESSION_KEY = "ag_session";

const AuthService = {
	async login(userId: string, password?: string): Promise<IUser | null> {
		try {
			const payload = { userId, password };
			const result = await ApiClient.post<{ token: string, user: IUser }>("/auth/login", payload);
			if (result && result.user) {
				sessionStorage.setItem(SESSION_KEY, JSON.stringify(result.user));
				sessionStorage.setItem("token", result.token);
				return result.user;
			}
			return null;
		} catch (error: any) {
			const message = error.data?.error || error.message || "Giriş başarısız.";
			throw new Error(message);
		}
	},

	async googleLogin(idToken: string): Promise<any> {
		try {
			const result = await ApiClient.post<{ token: string, user: IUser }>("/auth/google", { idToken });
			if (result && result.user) {
				sessionStorage.setItem(SESSION_KEY, JSON.stringify(result.user));
				sessionStorage.setItem("token", result.token);
				return { success: true, user: result.user };
			}
			return { success: false };
		} catch (error: any) {
			if (error.status === 404 && error.data && error.data.googlePayload) {
				return { success: false, notFound: true, googlePayload: error.data.googlePayload };
			}
			return { success: false, error: error.data?.error || error.message || "Google Girişi Başarısız." };
		}
	},

	logout(): void {
		sessionStorage.removeItem(SESSION_KEY);
		sessionStorage.removeItem("token");
	},

	getCurrentUser(): IUser | null {
		try {
			const data = sessionStorage.getItem(SESSION_KEY);
			return data ? JSON.parse(data) as IUser : null;
		} catch {
			return null;
		}
	},

	isLoggedIn(): boolean {
		return this.getCurrentUser() !== null;
	},

	getRole(): string {
		const user = this.getCurrentUser();
		return user ? user.role : "";
	},

	updateSession(user: IUser): void {
		sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
	}
};

export default AuthService;
