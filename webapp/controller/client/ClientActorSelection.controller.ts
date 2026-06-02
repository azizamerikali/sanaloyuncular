import BaseController from "../BaseController";
import JSONModel from "sap/ui/model/json/JSONModel";
import Event from "sap/ui/base/Event";
import MessageToast from "sap/m/MessageToast";
import ProjectService from "../../service/ProjectService";
import UserService from "../../service/UserService";
import MediaService from "../../service/MediaService";
import type { IUser } from "../../model/MockData";
import { API_BASE } from "../../service/ApiClient";
import Dialog from "sap/m/Dialog";

/**
 * @namespace com.openui5.webdb.controller.client
 */
export default class ClientActorSelection extends BaseController {
	private selectedProjectId: string = "";

	public onInit(): void {
		this.getRouter().getRoute("clientActorSelection").attachPatternMatched(this.onRouteMatched, this);
	}

	private async onRouteMatched(): void {
		// Reset view state
		this.selectedProjectId = "";
		
		const oSelect = this.byId("projectSelect") as any;
		if (oSelect) {
			oSelect.setSelectedKey("");
		}

		await Promise.all([
			this.loadProjects(),
			this.loadActors()
		]);
	}

	private async loadProjects(): Promise<void> {
		const projects = await ProjectService.getAll();
		this.getView().setModel(new JSONModel({ projects }), "cProjects");
	}

	public async onProjectChange(oEvent: Event): Promise<void> {
		const oSelect = oEvent.getSource() as any;
		this.selectedProjectId = oSelect.getSelectedKey();

		// Reload actors to reflect new assignments
		await this.loadActors();
	}

	private async loadActors(): Promise<void> {
		this.getView().setBusy(true);

		try {
			// Fetch all members
			const allMembers = await UserService.getByRole("member");
			
			let assignedUserIds: string[] = [];
			if (this.selectedProjectId) {
				const assignments = await ProjectService.getAssignmentsByProject(this.selectedProjectId);
				assignedUserIds = assignments.map(a => a.userId);
			}

			const activeActors = allMembers
				.filter(m => m.status === "active")
				.map(m => {
					return {
						...m,
						isAssigned: assignedUserIds.includes(m.id)
					};
				});

			this.getView().setModel(new JSONModel({ actors: activeActors }), "cActorsData");
		} catch (e: any) {
			MessageToast.show("Oyuncular yüklenirken bir hata oluştu.");
		} finally {
			this.getView().setBusy(false);
		}
	}

	public async onToggleAssignment(oEvent: Event): Promise<void> {
		if (!this.selectedProjectId) {
			MessageToast.show("İşlem yapmadan önce lütfen yukarıdan bir proje seçin!");
			return;
		}

		const oButton = oEvent.getSource() as any;
		const oCtx = oButton.getBindingContext("cActorsData");
		const actor = oCtx.getObject();

		this.getView().setBusy(true);
		try {
			if (actor.isAssigned) {
				// Remove
				await ProjectService.removeMember(this.selectedProjectId, actor.id);
				MessageToast.show(`${actor.firstName} projeden çıkarıldı.`);
			} else {
				// Add
				await ProjectService.assignMember(this.selectedProjectId, actor.id);
				MessageToast.show(`${actor.firstName} projeye eklendi.`);
			}
			// Refresh list to show updated status
			await this.loadActors();
		} catch (e: any) {
			MessageToast.show("İşlem sırasında bir hata oluştu.");
		} finally {
			this.getView().setBusy(false);
		}
	}

	public async onActorImagePress(oEvent: Event): Promise<void> {
		const oImage = oEvent.getSource() as any;
		const oCtx = oImage.getBindingContext("cActorsData");
		const actor = oCtx.getObject();

		this.getView().setBusy(true);
		try {
			const mediaList = await MediaService.getByUser(actor.id);
			let photos = mediaList;
			
			const oDialog = this.byId("actorDetailDialog") as Dialog;
			const oCarousel = this.byId("actorPhotosCarousel") as any;
			const oNoPhotosBox = this.byId("noPhotosBox") as any;
			
			if (photos && photos.length > 0) {
				oCarousel.setVisible(true);
				oNoPhotosBox.setVisible(false);
			} else {
				oCarousel.setVisible(false);
				oNoPhotosBox.setVisible(true);
			}

			this.getView().setModel(new JSONModel({ photos }), "cPhotosData");
			oDialog.setTitle(`${actor.firstName} ${actor.lastName} - Fotoğraflar`);
			oDialog.open();

		} catch (e: any) {
			MessageToast.show("Fotoğraflar yüklenirken bir hata oluştu.");
		} finally {
			this.getView().setBusy(false);
		}
	}

	public onCloseDetailDialog(): void {
		const oDialog = this.byId("actorDetailDialog") as Dialog;
		oDialog.close();
	}

	public formatProfilePicture(profilePicture: string): string {
		if (!profilePicture) {
			// Default placeholder if no picture
			return "https://www.sap.com/dam/application/shared/icons/people-icons/sap-icon-customer.png";
		}
		// If it's already a full URL, return it. Otherwise prepend API_BASE
		if (profilePicture.startsWith("http") || profilePicture.startsWith("data:")) {
			return profilePicture;
		}
		return `${API_BASE}${profilePicture}`;
	}
}
