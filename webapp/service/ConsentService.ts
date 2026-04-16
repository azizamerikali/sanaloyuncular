import ApiClient from "./ApiClient";
import type { IConsent } from "../model/MockData";

/**
 * @namespace com.openui5.webdb.service
 */
const ConsentService = {
	async getAll(): Promise<IConsent[]> {
		return ApiClient.get<IConsent[]>("/consents");
	},

	async getByUser(userId: string): Promise<IConsent[]> {
		return ApiClient.get<IConsent[]>(`/consents?userId=${userId}`);
	},

	async hasConsent(userId: string): Promise<boolean> {
		const consents = await this.getByUser(userId);
		return consents.length > 0;
	},

	async create(userId: string, version: string): Promise<IConsent> {
		return ApiClient.post<IConsent>("/consents", { userId, version });
	},

	async getConsentText(): Promise<string> {
		const data = await ApiClient.get<{ text: string }>("/consents/text");
		return data.text;
	},

	async setConsentText(text: string): Promise<void> {
		await ApiClient.put("/consents/text", { text });
	}
};

export default ConsentService;
