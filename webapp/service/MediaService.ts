import ApiClient from "./ApiClient";
import type { IMedia } from "../model/MockData";

/**
 * @namespace com.openui5.webdb.service
 */
const MediaService = {
	async getAll(): Promise<IMedia[]> {
		return ApiClient.get<IMedia[]>("/media");
	},

	async getById(id: string): Promise<IMedia | undefined> {
		const all = await this.getAll();
		return all.find(m => m.id === id);
	},

	async getByUser(userId: string): Promise<IMedia[]> {
		return ApiClient.get<IMedia[]>(`/media?userId=${userId}`);
	},

	async create(media: Partial<IMedia>): Promise<IMedia> {
		return ApiClient.post<IMedia>("/media", media);
	},

	async remove(id: string): Promise<boolean> {
		try {
			await ApiClient.del(`/media/${id}`);
			return true;
		} catch {
			return false;
		}
	},

	async getCount(): Promise<number> {
		const data = await ApiClient.get<{ count: number }>("/media/count");
		return data.count;
	},

	async getCountByUser(userId: string): Promise<number> {
		const data = await ApiClient.get<{ count: number }>(`/media/count?userId=${userId}`);
		return data.count;
	},

	async getContent(id: string): Promise<string | null> {
		try {
			const data = await ApiClient.get<{ fileData: string }>(`/media/${id}/content`);
			return data.fileData;
		} catch {
			return null;
		}
	}
};

export default MediaService;
