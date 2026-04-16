import BaseController from "../BaseController";
import JSONModel from "sap/ui/model/json/JSONModel";
import MessageToast from "sap/m/MessageToast";
import MessageBox from "sap/m/MessageBox";
import Dialog from "sap/m/Dialog";
import Input from "sap/m/Input";
import TextArea from "sap/m/TextArea";
import Label from "sap/m/Label";
import Button from "sap/m/Button";
import VBox from "sap/m/VBox";
import Event from "sap/ui/base/Event";
import AuthService from "../../service/AuthService";
import ProjectService from "../../service/ProjectService";
import formatter from "../../model/formatter";

/**
 * @namespace com.openui5.webdb.controller.client
 */
export default class ClientProjects extends BaseController {
	public onInit(): void {
		this.getRouter().getRoute("clientProjects").attachPatternMatched(this.loadData, this);
	}

	private async loadData(): Promise<void> {
		const user = AuthService.getCurrentUser();
		if (!user) return;
		
		const allProjects = await ProjectService.getAll();
		const clientProjects = allProjects.filter(p => p.createdBy === user.id);
		
		const projects = [];
		for (const p of clientProjects) {
			const assignments = await ProjectService.getAssignmentsByProject(p.id);
			projects.push({
				...p,
				statusText: formatter.formatStatus(p.status),
				statusState: formatter.formatStatusState(p.status),
				createdAtFormatted: formatter.formatDate(p.createdAt),
				memberCount: assignments.length.toString()
			});
		}
		this.getView().setModel(new JSONModel({ projects }), "cProjData");
	}

	public onCreateProject(): void {
		const nameInput = new Input({ placeholder: "Proje adı" });
		const descInput = new TextArea({ placeholder: "Açıklama", rows: 3 });
		const oDialog = new Dialog({
			title: "Yeni Proje",
			content: [new VBox({ items: [new Label({ text: "Proje Adı", required: true }), nameInput, new Label({ text: "Açıklama" }), descInput] }).addStyleClass("sapUiSmallMargin")],
			beginButton: new Button({ text: "Oluştur", type: "Emphasized", press: async () => {
				const name = nameInput.getValue().trim();
				if (!name) { MessageBox.warning("Proje adı gerekli."); return; }
				const user = AuthService.getCurrentUser();
				await ProjectService.create({ name, description: descInput.getValue(), createdBy: user ? user.id : "" });
				MessageToast.show("Proje oluşturuldu!"); oDialog.close(); await this.loadData();
			}}),
			endButton: new Button({ text: "İptal", press: () => oDialog.close() }),
			afterClose: () => oDialog.destroy()
		});
		oDialog.open();
	}

	public onProjectPress(oEvent: Event): void {
		const oCtx = (oEvent.getSource() as any).getBindingContext("cProjData");
		this.getRouter().navTo("clientProjectDetail", { projectId: oCtx.getProperty("id") });
	}
}
