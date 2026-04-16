import BaseController from "../BaseController";
import JSONModel from "sap/ui/model/json/JSONModel";
import MessageToast from "sap/m/MessageToast";
import SelectDialog from "sap/m/SelectDialog";
import StandardListItem from "sap/m/StandardListItem";
import Event from "sap/ui/base/Event";
import ProjectService from "../../service/ProjectService";
import UserService from "../../service/UserService";
import formatter from "../../model/formatter";

/**
 * @namespace com.openui5.webdb.controller.admin
 */
export default class AdminProjectDetail extends BaseController {
	private projectId: string;

	public onInit(): void {
		this.getRouter().getRoute("adminProjectDetail").attachPatternMatched(this.onRouteMatched, this);
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
			createdAtFormatted: formatter.formatDate(proj.createdAt),
			assignedMembers: members
		}), "projDetail");
	}

	public async onAssignMember(): Promise<void> {
		const assignments = await ProjectService.getAssignmentsByProject(this.projectId);
		const assigned = assignments.map(a => a.userId);
		const allMembers = await UserService.getByRole("member");
		const available = allMembers.filter(m => m.status === "active" && !assigned.includes(m.id));
		const oModel = new JSONModel(available);
		const oDialog = new SelectDialog({
			title: "Üye Seç",
			items: { path: "/", template: new StandardListItem({ title: "{firstName} {lastName}", description: "{email}" }) },
			confirm: async (evt: Event) => {
				const oItem = evt.getParameter("selectedItem") as StandardListItem;
				if (oItem) {
					const ctx = oItem.getBindingContext();
					const userId = ctx.getProperty("id");
					await ProjectService.assignMember(this.projectId, userId);
					MessageToast.show("Üye atandı!");
					await this.loadData();
				}
			}
		});
		oDialog.setModel(oModel);
		oDialog.open();
	}

	public async onRemoveMember(oEvent: Event): Promise<void> {
		const oCtx = (oEvent.getSource() as any).getBindingContext("projDetail");
		await ProjectService.removeMember(this.projectId, oCtx.getProperty("id"));
		MessageToast.show("Üye projeden çıkarıldı.");
		await this.loadData();
	}
}
