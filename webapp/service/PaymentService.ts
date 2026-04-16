import ApiClient from "./ApiClient";
import type { IPayment } from "../model/MockData";

/**
 * @namespace com.openui5.webdb.service
 */
const PaymentService = {
	async getAll(): Promise<IPayment[]> {
		return ApiClient.get<IPayment[]>("/payments");
	},

	async getById(id: string): Promise<IPayment | undefined> {
		try {
			return await ApiClient.get<IPayment>(`/payments/${id}`);
		} catch {
			return undefined;
		}
	},

	async getByUser(userId: string): Promise<IPayment[]> {
		return ApiClient.get<IPayment[]>(`/payments?userId=${userId}`);
	},

	async getByProject(projectId: string): Promise<IPayment[]> {
		return ApiClient.get<IPayment[]>(`/payments?projectId=${projectId}`);
	},

	async create(payment: Partial<IPayment>): Promise<IPayment> {
		return ApiClient.post<IPayment>("/payments", payment);
	},

	async update(id: string, data: Partial<IPayment>): Promise<IPayment | null> {
		try {
			return await ApiClient.put<IPayment>(`/payments/${id}`, data);
		} catch {
			return null;
		}
	},

	async remove(id: string): Promise<boolean> {
		try {
			await ApiClient.del(`/payments/${id}`);
			return true;
		} catch {
			return false;
		}
	},

	async getTotalPaid(): Promise<number> {
		const data = await ApiClient.get<{ totalPaid: number }>("/payments/stats");
		return data.totalPaid;
	},

	async getTotalUnpaid(): Promise<number> {
		const data = await ApiClient.get<{ totalUnpaid: number }>("/payments/stats");
		return data.totalUnpaid;
	},

	async getCount(): Promise<number> {
		const data = await ApiClient.get<{ count: number }>("/payments/stats");
		return data.count;
	}
};

export default PaymentService;
