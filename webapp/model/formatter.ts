/**
 * Formatter utilities for SanalOyuncular
 * @namespace com.openui5.webdb.model
 */
export default {
	formatValue: (sValue: string) => {
		return sValue;
	},

	formatDate: (sDate: string) => {
		if (!sDate) return "";
		return new Date(sDate).toLocaleDateString("tr-TR");
	},

	formatDateTime: (sDate: string) => {
		if (!sDate) return "";
		return new Date(sDate).toLocaleString("tr-TR");
	},

	formatCurrency: (amount: number) => {
		if (amount === undefined || amount === null) return "";
		return new Intl.NumberFormat("tr-TR", { 
			style: "currency", 
			currency: "TRY",
			minimumFractionDigits: 0,
			maximumFractionDigits: 0
		}).format(amount);
	},

	formatStatus: (status: string) => {
		const map: Record<string, string> = {
			active: "Aktif", inactive: "Pasif", pending: "Onay Bekliyor",
			paid: "Ödendi", unpaid: "Ödenmedi", partial: "Kısmi Ödeme", completed: "Tamamlandı"
		};
		return map[status] || status;
	},

	formatStatusState: (status: string) => {
		const map: Record<string, string> = {
			active: "Success", inactive: "Error", pending: "Warning",
			paid: "Success", unpaid: "Error", partial: "Warning", completed: "Information"
		};
		return map[status] || "None";
	},

	formatRole: (role: string) => {
		const map: Record<string, string> = { member: "Üye", admin: "Admin", client: "Müşteri" };
		return map[role] || role;
	},

	formatInitials: (firstName: string, lastName: string) => {
		return ((firstName || "").charAt(0) + (lastName || "").charAt(0)).toUpperCase();
	}
};
