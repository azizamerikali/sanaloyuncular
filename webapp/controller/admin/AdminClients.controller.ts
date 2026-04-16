import BaseController from "../BaseController";
import JSONModel from "sap/ui/model/json/JSONModel";
import MessageToast from "sap/m/MessageToast";
import MessageBox from "sap/m/MessageBox";
import Dialog from "sap/m/Dialog";
import Input from "sap/m/Input";
import Label from "sap/m/Label";
import Button from "sap/m/Button";
import VBox from "sap/m/VBox";
import Event from "sap/ui/base/Event";
import UserService from "../../service/UserService";
import formatter from "../../model/formatter";

/**
 * @namespace com.openui5.webdb.controller.admin
 */
export default class AdminClients extends BaseController {
	public onInit(): void {
		this.getRouter().getRoute("adminClients").attachPatternMatched(this.loadData, this);
	}

	private async loadData(): Promise<void> {
		const users = await UserService.getByRole("client");
		const clients = users.map(c => ({
			...c, statusText: formatter.formatStatus(c.status), statusState: formatter.formatStatusState(c.status)
		}));
		this.getView().setModel(new JSONModel({ clients }), "clientData");
	}

	public onCreateClient(): void {
		const fName = new Input({ placeholder: "Ad" });
		const lName = new Input({ placeholder: "Soyad" });
		const email = new Input({ placeholder: "E-posta", type: "Email" });
		const phone = new Input({ placeholder: "Telefon", type: "Tel" });
		const pwd = new Input({ placeholder: "Şifre" });
		const oDialog = new Dialog({
			title: "Yeni Müşteri",
			content: [new VBox({ items: [new Label({ text: "Ad", required: true }), fName, new Label({ text: "Soyad", required: true }), lName, new Label({ text: "E-posta", required: true }), email, new Label({ text: "Şifre" }), pwd, new Label({ text: "Telefon" }), phone] }).addStyleClass("sapUiSmallMargin")],
			beginButton: new Button({ text: "Oluştur", type: "Emphasized", press: async () => {
				if (!email.getValue().trim() || !fName.getValue().trim()) { MessageBox.warning("E-posta ve Ad gerekli."); return; }
				await UserService.create({ id: email.getValue(), firstName: fName.getValue(), lastName: lName.getValue(), email: email.getValue(), password: pwd.getValue(), phone: phone.getValue(), role: "client", status: "active" });
				MessageToast.show("Müşteri oluşturuldu!"); oDialog.close(); await this.loadData();
			}}),
			endButton: new Button({ text: "İptal", press: () => oDialog.close() }),
			afterClose: () => oDialog.destroy()
		});
		oDialog.open();
	}

	public onDeleteClient(oEvent: Event): void {
		const oCtx = (oEvent.getSource() as any).getBindingContext("clientData");
		const clientId = oCtx.getProperty("id");
		MessageBox.confirm("Bu müşteriyi silmek istediğinize emin misiniz?", {
			onClose: async (a: string) => { if (a === "OK") { await UserService.remove(clientId); MessageToast.show("Müşteri silindi."); await this.loadData(); } }
		});
	}
}
