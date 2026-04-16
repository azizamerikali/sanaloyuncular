import BaseController from "../BaseController";
import JSONModel from "sap/ui/model/json/JSONModel";
import MessageToast from "sap/m/MessageToast";
import MessageBox from "sap/m/MessageBox";
import Dialog from "sap/m/Dialog";
import Input from "sap/m/Input";
import Label from "sap/m/Label";
import Select from "sap/m/Select";
import Item from "sap/ui/core/Item";
import Button from "sap/m/Button";
import VBox from "sap/m/VBox";
import Event from "sap/ui/base/Event";
import PaymentService from "../../service/PaymentService";
import UserService from "../../service/UserService";
import ProjectService from "../../service/ProjectService";
import formatter from "../../model/formatter";

/**
 * @namespace com.openui5.webdb.controller.admin
 */
export default class AdminPayments extends BaseController {
	public onInit(): void {
		this.getRouter().getRoute("adminPayments").attachPatternMatched(this.loadData, this);
	}

	private async loadData(): Promise<void> {
		const paymentList = await PaymentService.getAll();
		const payments = [];
		for (const p of paymentList) {
			const user = await UserService.getById(p.userId);
			const proj = await ProjectService.getById(p.projectId);
			payments.push({
				...p,
				memberName: user ? user.firstName + " " + user.lastName : "-",
				projectName: proj ? proj.name : "-",
				grossFormatted: formatter.formatCurrency(p.grossAmount),
				deductionFormatted: formatter.formatCurrency(p.deduction),
				netFormatted: formatter.formatCurrency(p.netAmount),
				statusText: formatter.formatStatus(p.status),
				statusState: formatter.formatStatusState(p.status)
			});
		}
		this.getView().setModel(new JSONModel({ payments }), "payListData");
	}

	public async onCreatePayment(): Promise<void> {
		const users = await UserService.getByRole("member");
		const members = users.filter(m => m.status === "active");
		const projects = await ProjectService.getAll();
		const memberSelect = new Select({ items: members.map(m => new Item({ key: m.id, text: m.firstName + " " + m.lastName })) });
		const projectSelect = new Select({ items: projects.map(p => new Item({ key: p.id, text: p.name })) });
		const grossInput = new Input({ type: "Number", placeholder: "Brüt tutar" });
		const dedInput = new Input({ type: "Number", placeholder: "Kesinti" });

		const oDialog = new Dialog({
			title: "Yeni Ödeme",
			content: [new VBox({ items: [
				new Label({ text: "Üye" }), memberSelect,
				new Label({ text: "Proje" }), projectSelect,
				new Label({ text: "Brüt Ücret" }), grossInput,
				new Label({ text: "Kesinti" }), dedInput
			]}).addStyleClass("sapUiSmallMargin")],
			beginButton: new Button({ text: "Oluştur", type: "Emphasized", press: async () => {
				await PaymentService.create({
					userId: memberSelect.getSelectedKey(),
					projectId: projectSelect.getSelectedKey(),
					grossAmount: parseFloat(grossInput.getValue()) || 0,
					deduction: parseFloat(dedInput.getValue()) || 0
				});
				MessageToast.show("Ödeme oluşturuldu!"); oDialog.close(); await this.loadData();
			}}),
			endButton: new Button({ text: "İptal", press: () => oDialog.close() }),
			afterClose: () => oDialog.destroy()
		});
		oDialog.open();
	}

	public async onMarkPaid(oEvent: Event): Promise<void> {
		const oCtx = (oEvent.getSource() as any).getBindingContext("payListData");
		await PaymentService.update(oCtx.getProperty("id"), { status: "paid" });
		MessageToast.show("Ödeme durumu güncellendi!"); await this.loadData();
	}

	public onDeletePayment(oEvent: Event): void {
		const oCtx = (oEvent.getSource() as any).getBindingContext("payListData");
		const paymentId = oCtx.getProperty("id");
		MessageBox.confirm("Bu ödemeyi silmek istediğinize emin misiniz?", {
			onClose: async (a: string) => { if (a === "OK") { await PaymentService.remove(paymentId); MessageToast.show("Ödeme silindi."); await this.loadData(); } }
		});
	}
}
