import BaseController from "../BaseController";
import JSONModel from "sap/ui/model/json/JSONModel";
import MessageToast from "sap/m/MessageToast";
import MessageBox from "sap/m/MessageBox";
import Dialog from "sap/m/Dialog";
import Input from "sap/m/Input";
import TextArea from "sap/m/TextArea";
import Label from "sap/m/Label";
import Text from "sap/m/Text";
import Button from "sap/m/Button";
import VBox from "sap/m/VBox";
import Event from "sap/ui/base/Event";
import AuthService from "../../service/AuthService";
import ProjectService from "../../service/ProjectService";
import formatter from "../../model/formatter";

/**
 * @namespace com.openui5.webdb.controller.admin
 */
export default class AdminProjects extends BaseController {
	public onInit(): void {
		this.getRouter().getRoute("adminProjects").attachPatternMatched(this.loadData, this);
	}

	private async loadData(): Promise<void> {
		const allProjects = await ProjectService.getAll();
		const projects = [];
		for (const p of allProjects) {
			const assignments = await ProjectService.getAssignmentsByProject(p.id);
			const memberCount = assignments.length;
			const maxMembers = p.maxMembers || 0;
			projects.push({
				...p,
				statusText: formatter.formatStatus(p.status),
				statusState: formatter.formatStatusState(p.status),
				createdAtFormatted: formatter.formatDate(p.createdAt),
				memberCount: memberCount.toString(),
				membersLabel: maxMembers > 0 ? `${memberCount} / ${maxMembers}` : memberCount.toString(),
				budgetFormatted: formatter.formatCurrency((p.royaltyFee || 0) * memberCount)
			});
		}
		this.getView().setModel(new JSONModel({ projects }), "projListData");
	}

	public onCreateProject(): void {
		const nameInput = new Input({ placeholder: "Proje adı" });
		const descInput = new TextArea({ placeholder: "Açıklama", rows: 3 });
		const feeInput = new Input({ value: "1000", type: "Number" as any });
		const maxInput = new Input({ value: "10", type: "Number" as any });
		const oDialog = new Dialog({
			title: "Yeni Proje",
			content: [
				new VBox({ items: [
					new Label({ text: "Proje Adı", required: true }), nameInput,
					new Label({ text: "Açıklama" }), descInput,
					new Label({ text: "Üye Telif Ücreti (₺)" }), feeInput,
					new Label({ text: "Seçilecek Max Üye" }), maxInput,
					new Label({ text: "Toplam Bütçe" }),
					new Text({ text: "Üye eklendikçe hesaplanır (₺0)" })
				] }).addStyleClass("sapUiSmallMargin")
			],
			beginButton: new Button({
				text: "Oluştur", type: "Emphasized",
				press: async () => {
					const name = nameInput.getValue().trim();
					if (!name) { MessageBox.warning("Proje adı gerekli."); return; }
					const royaltyFee = parseFloat(feeInput.getValue()) || 0;
					const maxMembers = parseInt(maxInput.getValue(), 10) || 0;
					const user = AuthService.getCurrentUser();
					await ProjectService.create({ name, description: descInput.getValue(), createdBy: user ? user.id : "", royaltyFee, maxMembers });
					MessageToast.show("Proje oluşturuldu!");
					oDialog.close(); await this.loadData();
				}
			}),
			endButton: new Button({ text: "İptal", press: () => oDialog.close() }),
			afterClose: () => oDialog.destroy()
		});
		oDialog.open();
	}

	public onDeleteProject(oEvent: Event): void {
		const oCtx = (oEvent.getSource() as any).getBindingContext("projListData");
		const projectId = oCtx.getProperty("id");
		MessageBox.confirm("Bu projeyi silmek istediğinize emin misiniz?", {
			onClose: async (a: string) => {
				if (a === "OK") { 
					await ProjectService.remove(projectId); 
					MessageToast.show("Proje silindi."); 
					await this.loadData(); 
				}
			}
		});
	}

	public onProjectPress(oEvent: Event): void {
		const oCtx = (oEvent.getSource() as any).getBindingContext("projListData");
		this.getRouter().navTo("adminProjectDetail", { projectId: oCtx.getProperty("id") });
	}
}
