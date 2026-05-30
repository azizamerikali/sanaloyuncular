import BaseController from "../BaseController";
import JSONModel from "sap/ui/model/json/JSONModel";
import Event from "sap/ui/base/Event";
import MessageToast from "sap/m/MessageToast";
import ProjectService from "../../service/ProjectService";
import UserService from "../../service/UserService";
import type { IUser } from "../../model/MockData";
import { API_BASE } from "../../service/ApiClient";

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
		this.byId("noProjectMessage")?.setVisible(true);
		this.byId("actorsGrid")?.setVisible(false);
		
		const oSelect = this.byId("projectSelect") as any;
		if (oSelect) {
			oSelect.setSelectedKey("");
		}

		await this.loadProjects();
	}

	private async loadProjects(): Promise<void> {
		const projects = await ProjectService.getAll();
		this.getView().setModel(new JSONModel({ projects }), "cProjects");
	}

	public async onProjectChange(oEvent: Event): Promise<void> {
		const oSelect = oEvent.getSource() as any;
		this.selectedProjectId = oSelect.getSelectedKey();

		const bHasProject = !!this.selectedProjectId;
		this.byId("noProjectMessage")?.setVisible(!bHasProject);
		this.byId("actorsGrid")?.setVisible(bHasProject);

		if (bHasProject) {
			await this.loadActors();
		}
	}

	private async loadActors(): Promise<void> {
		if (!this.selectedProjectId) return;
		this.getView().setBusy(true);

		try {
			// Fetch all members and assignments for this project
			const [allMembers, assignments] = await Promise.all([
				UserService.getByRole("member"),
				ProjectService.getAssignmentsByProject(this.selectedProjectId)
			]);

			const assignedUserIds = assignments.map(a => a.userId);

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
		if (!this.selectedProjectId) return;

		const oButton = oEvent.getSource() as any;
		const oCtx = oButton.getBindingContext("cActorsData");
		const actor = oCtx.getObject();

		this.getView().setBusy(true);
		try {
			if (actor.isAssigned) {
				// Remove
				await ProjectService.removeMember(this.selectedProjectId, actor.id);
				MessageToast.show("Oyuncu projeden çıkarıldı.");
			} else {
				// Add
				await ProjectService.assignMember(this.selectedProjectId, actor.id);
				MessageToast.show("Oyuncu projeye eklendi.");
			}
			// Refresh list to show updated status
			await this.loadActors();
		} catch (e: any) {
			MessageToast.show("İşlem sırasında bir hata oluştu.");
		} finally {
			this.getView().setBusy(false);
		}
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
