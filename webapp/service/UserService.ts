import ApiClient from "./ApiClient";
import type { IUser } from "../model/MockData";

/**
 * @namespace com.openui5.webdb.service
 */
const UserService = {
	async getAll(): Promise<IUser[]> {
		return ApiClient.get<IUser[]>("/users");
	},

	async getById(id: string): Promise<IUser | undefined> {
		try {
			return await ApiClient.get<IUser>(`/users/${id}`);
		} catch {
			return undefined;
		}
	},

	async getByRole(role: string): Promise<IUser[]> {
		return ApiClient.get<IUser[]>(`/users?role=${role}`);
	},

	async getByStatus(status: string): Promise<IUser[]> {
		return ApiClient.get<IUser[]>(`/users?status=${status}`);
	},

	async create(user: Partial<IUser>): Promise<IUser> {
		return ApiClient.post<IUser>("/users", user);
	},

	async update(id: string, data: Partial<IUser>): Promise<IUser | null> {
		try {
			return await ApiClient.put<IUser>(`/users/${id}`, data);
		} catch {
			return null;
		}
	},

	async approve(id: string): Promise<IUser | null> {
		return this.update(id, { status: "active" });
	},

	async deactivate(id: string): Promise<IUser | null> {
		return this.update(id, { status: "inactive" });
	},

	async remove(id: string): Promise<boolean> {
		try {
			await ApiClient.del(`/users/${id}`);
			return true;
		} catch {
			return false;
		}
	},

	async getCount(): Promise<number> {
		const data = await ApiClient.get<{ total: number }>("/users/count");
		return data.total;
	},

	async getMemberCount(): Promise<number> {
		const data = await ApiClient.get<{ members: number }>("/users/count");
		return data.members;
	},

	async getPendingCount(): Promise<number> {
		const data = await ApiClient.get<{ pending: number }>("/users/count");
		return data.pending;
	}
};

export default UserService;
