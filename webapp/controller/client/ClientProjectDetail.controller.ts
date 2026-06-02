import BaseController from "../BaseController";
import JSONModel from "sap/ui/model/json/JSONModel";
import MessageToast from "sap/m/MessageToast";
import SelectDialog from "sap/m/SelectDialog";
import StandardListItem from "sap/m/StandardListItem";
import Event from "sap/ui/base/Event";
import AuthService from "../../service/AuthService";
import ProjectService from "../../service/ProjectService";
import UserService from "../../service/UserService";
import MediaService from "../../service/MediaService";
import StorageService from "../../service/StorageService";
import formatter from "../../model/formatter";
import type { IFavorite } from "../../model/MockData";
import { API_BASE } from "../../service/ApiClient";

/**
 * @namespace com.openui5.webdb.controller.client
 */
export default class ClientProjectDetail extends BaseController {
	private projectId: string;

	public onInit(): void {
		this.getRouter().getRoute("clientProjectDetail").attachPatternMatched(this.onRouteMatched, this);
	}

	private async onRouteMatched(oEvent: Event): Promise<void> {
		this.projectId = oEvent.getParameter("arguments").projectId as string;
		await this.loadData();
	}

	private async loadData(): Promise<void> {
		const proj = await ProjectService.getById(this.projectId);
		if (!proj) { this.onNavBack(); return; }
		const assignments = await ProjectService.getAssignmentsByProject(this.projectId);
		
		const members = [];
		for (const a of assignments) {
			const u = await UserService.getById(a.userId);
			if (u) members.push(u);
		}
		
		this.getView().setModel(new JSONModel({
			...proj,
			statusText: formatter.formatStatus(proj.status),
			statusState: formatter.formatStatusState(proj.status),
			assignedMembers: members
		}), "cProjDetailData");
	}

	public async onAssignFavorite(): Promise<void> {
		const user = AuthService.getCurrentUser();
		if (!user) return;
		
		const assignments = await ProjectService.getAssignmentsByProject(this.projectId);
		const assigned = assignments.map(a => a.userId);
		
		// For now showing all active members instead of favorites
		const allMembers = await UserService.getByRole("member");
		const available = allMembers.filter(m => m.status === "active" && !assigned.includes(m.id));
		
		const oModel = new JSONModel(available);
		const oDialog = new SelectDialog({
			title: "Üye Seç",
			noDataText: "Atanabilecek üye yok",
			items: { path: "/", template: new StandardListItem({ title: "{firstName} {lastName}", description: "{email}" }) },
			confirm: async (evt: Event) => {
				const oItem = evt.getParameter("selectedItem") as StandardListItem;
				if (oItem) {
					const ctx = oItem.getBindingContext();
					await ProjectService.assignMember(this.projectId, ctx.getProperty("id"));
					MessageToast.show("Üye atandı!"); await this.loadData();
				}
			}
		});
		oDialog.setModel(oModel);
		oDialog.open();
	}

	public async onRemoveMember(oEvent: Event): Promise<void> {
		const oCtx = (oEvent.getSource() as any).getBindingContext("cProjDetailData");
		await ProjectService.removeMember(this.projectId, oCtx.getProperty("id"));
		MessageToast.show("Üye çıkarıldı."); await this.loadData();
	}

	public async onMemberPress(oEvent: Event): Promise<void> {
		const oCtx = (oEvent.getSource() as any).getBindingContext("cProjDetailData");
		const member = oCtx.getObject();

		const initials = `${member.firstName?.[0] || ""}${member.lastName?.[0] || ""}`.toUpperCase();
		const mediaList = await MediaService.getByUser(member.id);

		const photos = mediaList.map((m: any) => ({ ...m, fileData: "" }));

		const oModel = new JSONModel({
			...member,
			fullName: `${member.firstName} ${member.lastName}`,
			initials,
			photoCount: photos.length,
			photos
		});
		this.getView().setModel(oModel, "memberDetailData");

		(this.byId("memberDetailDialog") as any).open();

		// Arka planda fotoğraf içeriklerini yükle
		photos.forEach(async (photo: any, index: number) => {
			try {
				const content = await MediaService.getContent(photo.id);
				if (content) oModel.setProperty(`/photos/${index}/fileData`, content);
			} catch (_) {}
		});
	}

	public onCloseMemberDetail(): void {
		(this.byId("memberDetailDialog") as any).close();
	}

	public onPhotoPress(oEvent: Event): void {
		const oCtx = (oEvent.getSource() as any).getBindingContext("memberDetailData");
		const src = oCtx.getProperty("fileData");
		if (!src) return;
		this.getView().setModel(new JSONModel({ src }), "photoPreview");
		(this.byId("photoPreviewDialog") as any).open();
	}

	public onClosePhotoPreview(): void {
		(this.byId("photoPreviewDialog") as any).close();
	}

	public formatProfilePicture(profilePicture: string): string {
		if (!profilePicture) {
			return "https://www.sap.com/dam/application/shared/icons/people-icons/sap-icon-customer.png";
		}
		if (profilePicture.startsWith("http") || profilePicture.startsWith("data:")) {
			return profilePicture;
		}
		return `${API_BASE}${profilePicture}`;
	}
}
