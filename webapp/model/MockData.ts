/**
 * Initial mock data and TypeScript interfaces for SanalOyuncular
 * @namespace com.openui5.webdb.model
 */

export interface IUser {
	id: string;
	firstName: string;
	lastName: string;
	email: string;
	phone?: string;
	address?: string;
	password?: string;
	birthDate?: string;
	parentName?: string;
	consentDocument?: string; // base64
	iban?: string;
	ibanHolder?: string;
	city?: string;
	actingTraining?: string;
	actingExperience?: string;
	profilePicture?: string; // base64
	role: string;
	status: string; // 'pending' | 'active' | 'inactive'
	createdAt: string;
}

export interface IMedia {
	id: string;
	userId: string;
	fileName: string;
	filePath: string;
	fileData?: string;
	createdAt: string;
}

export interface IConsent {
	id: string;
	userId: string;
	version: string;
	acceptedAt: string;
	ipAddress: string;
}

export interface IProject {
	id: string;
	name: string;
	description: string;
	createdBy: string;
	status: string;
	createdAt: string;
}

export interface IAssignment {
	id: string;
	projectId: string;
	userId: string;
}

export interface IPayment {
	id: string;
	userId: string;
	projectId: string;
	date: string;
	grossAmount: number;
	deduction: number;
	netAmount: number;
	status: string;
}

export interface IFavorite {
	id: string;
	clientId: string;
	memberId: string;
}

const MockData = {
	users: [
		{ id: "admin1", firstName: "Ahmet", lastName: "Yılmaz", email: "admin@antigravity.com", phone: "05321234567", address: "İstanbul, Beşiktaş", role: "admin", status: "active", createdAt: "2025-01-15T10:00:00Z" },
		{ id: "member1", firstName: "Elif", lastName: "Kaya", email: "elif@email.com", phone: "05339876543", address: "İstanbul, Kadıköy", role: "member", status: "active", createdAt: "2025-02-01T09:00:00Z" },
		{ id: "member2", firstName: "Can", lastName: "Demir", email: "can@email.com", phone: "05341112233", address: "Ankara, Çankaya", role: "member", status: "active", createdAt: "2025-02-15T11:00:00Z" },
		{ id: "member3", firstName: "Zeynep", lastName: "Arslan", email: "zeynep@email.com", phone: "05354445566", address: "İzmir, Alsancak", role: "member", status: "pending", createdAt: "2025-03-20T14:00:00Z" },
		{ id: "member4", firstName: "Burak", lastName: "Öztürk", email: "burak@email.com", phone: "05367778899", address: "Antalya, Lara", role: "member", status: "inactive", createdAt: "2025-01-20T08:00:00Z" },
		{ id: "client1", firstName: "Mert", lastName: "Aydın", email: "mert@agency.com", phone: "05381122334", address: "İstanbul, Şişli", role: "client", status: "active", createdAt: "2025-02-10T10:00:00Z" },
		{ id: "client2", firstName: "Selin", lastName: "Çelik", email: "selin@brand.com", phone: "05392233445", address: "İstanbul, Levent", role: "client", status: "active", createdAt: "2025-03-01T09:00:00Z" }
	] as IUser[],

	media: [
		{ id: "med1", userId: "member1", fileName: "istanbul_bogaz.jpg", filePath: "/photos/istanbul_bogaz.jpg", createdAt: "2025-02-05T10:00:00Z" },
		{ id: "med2", userId: "member1", fileName: "portrait_01.jpg", filePath: "/photos/portrait_01.jpg", createdAt: "2025-02-10T11:00:00Z" },
		{ id: "med3", userId: "member2", fileName: "ankara_kale.jpg", filePath: "/photos/ankara_kale.jpg", createdAt: "2025-02-20T09:00:00Z" },
		{ id: "med4", userId: "member2", fileName: "product_shot.jpg", filePath: "/photos/product_shot.jpg", createdAt: "2025-03-01T14:00:00Z" },
		{ id: "med5", userId: "member1", fileName: "nature_01.jpg", filePath: "/photos/nature_01.jpg", createdAt: "2025-03-05T08:00:00Z" },
		{ id: "med6", userId: "member3", fileName: "izmir_kordon.jpg", filePath: "/photos/izmir_kordon.jpg", createdAt: "2025-03-22T10:00:00Z" }
	] as IMedia[],

	consents: [
		{ id: "con1", userId: "member1", version: "1.0", acceptedAt: "2025-02-01T09:05:00Z", ipAddress: "192.168.1.10" },
		{ id: "con2", userId: "member2", version: "1.0", acceptedAt: "2025-02-15T11:10:00Z", ipAddress: "192.168.1.20" }
	] as IConsent[],

	projects: [
		{ id: "proj1", name: "İstanbul Tanıtım Kampanyası", description: "İstanbul'un turistik mekanlarının tanıtımı için fotoğraf projesi", createdBy: "client1", status: "active", createdAt: "2025-03-01T10:00:00Z" },
		{ id: "proj2", name: "E-Ticaret Ürün Çekimi", description: "Online mağaza için profesyonel ürün fotoğrafları", createdBy: "admin1", status: "active", createdAt: "2025-03-10T09:00:00Z" },
		{ id: "proj3", name: "Kurumsal Portre Serisi", description: "Şirket çalışanları için kurumsal portre fotoğrafları", createdBy: "client2", status: "completed", createdAt: "2025-02-01T08:00:00Z" }
	] as IProject[],

	assignments: [
		{ id: "asgn1", projectId: "proj1", userId: "member1" },
		{ id: "asgn2", projectId: "proj1", userId: "member2" },
		{ id: "asgn3", projectId: "proj2", userId: "member1" },
		{ id: "asgn4", projectId: "proj3", userId: "member2" }
	] as IAssignment[],

	payments: [
		{ id: "pay1", userId: "member1", projectId: "proj1", date: "2025-03-15", grossAmount: 5000, deduction: 1000, netAmount: 4000, status: "paid" },
		{ id: "pay2", userId: "member2", projectId: "proj1", date: "2025-03-15", grossAmount: 4500, deduction: 900, netAmount: 3600, status: "paid" },
		{ id: "pay3", userId: "member1", projectId: "proj2", date: "2025-03-25", grossAmount: 3000, deduction: 600, netAmount: 2400, status: "unpaid" },
		{ id: "pay4", userId: "member2", projectId: "proj3", date: "2025-02-28", grossAmount: 6000, deduction: 1200, netAmount: 4800, status: "paid" }
	] as IPayment[],

	favorites: [
		{ id: "fav1", clientId: "client1", memberId: "member1" },
		{ id: "fav2", clientId: "client1", memberId: "member2" },
		{ id: "fav3", clientId: "client2", memberId: "member2" }
	] as IFavorite[],

	consentText: "Bu sözleşme, SanalOyuncular üzerinden yüklenen fotoğrafların proje kapsamında kullanılmasına ilişkin koşulları belirler.\n\n1. Yüklenen tüm fotoğrafların telif hakkı üyeye aittir.\n2. Platform, fotoğrafları yalnızca onaylanan projeler kapsamında kullanma hakkına sahiptir.\n3. Her kullanım için üyeye hakediş ödemesi yapılacaktır.\n4. Üye, istediği zaman fotoğraflarını platformdan kaldırabilir.\n5. Bu sözleşme, dijital onay ile kabul edilmiş sayılır.\n\nSürüm: 1.0 | Son güncelleme: 2025-01-01"
};

export default MockData;
