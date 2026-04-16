import BaseController from "../BaseController";
import JSONModel from "sap/ui/model/json/JSONModel";
import MessageToast from "sap/m/MessageToast";
import MessageBox from "sap/m/MessageBox";
import Event from "sap/ui/base/Event";
import Filter from "sap/ui/model/Filter";
import FilterOperator from "sap/ui/model/FilterOperator";
import ListBinding from "sap/ui/model/ListBinding";
import Table from "sap/m/Table";
import Dialog from "sap/m/Dialog";
import UserService from "../../service/UserService";
import formatter from "../../model/formatter";
import { cities } from "../../model/Cities";
import FileUploader from "sap/ui/unified/FileUploader";
import { isValidIBANNumber } from "../../utils/iban";

/**
 * @namespace com.openui5.webdb.controller.admin
 */
export default class AdminMembers extends BaseController {
	public onInit(): void {
		this.getView().setModel(new JSONModel(cities), "cities");
		this.getRouter().getRoute("adminMembers").attachPatternMatched(this.loadData, this);
	}

	private async loadData(): Promise<void> {
		const users = await UserService.getByRole("member");
		const members = users.map(m => ({
			...m,
			statusText: formatter.formatStatus(m.status),
			statusState: formatter.formatStatusState(m.status),
			createdAtFormatted: formatter.formatDate(m.createdAt)
		}));
		this.getView().setModel(new JSONModel({ members }), "membersData");
	}

	public onSearchMembers(oEvent: Event): void {
		const sQuery = oEvent.getParameter("newValue") as string;
		const oTable = this.byId("adminMembersTable") as Table;
		const oBinding = oTable.getBinding("items") as ListBinding;
		const aFilters = sQuery ? [
			new Filter({
				filters: [
					new Filter("firstName", FilterOperator.Contains, sQuery),
					new Filter("lastName", FilterOperator.Contains, sQuery),
					new Filter("email", FilterOperator.Contains, sQuery)
				],
				and: false
			})
		] : [];
		oBinding.filter(aFilters);
	}

	public async onApprove(oEvent: Event): Promise<void> {
		const oCtx = (oEvent.getSource() as any).getBindingContext("membersData");
		await UserService.approve(oCtx.getProperty("id"));
		MessageToast.show(oCtx.getProperty("firstName") + " onaylandı!");
		await this.loadData();
	}

	public async onDeactivate(oEvent: Event): Promise<void> {
		const oCtx = (oEvent.getSource() as any).getBindingContext("membersData");
		await UserService.deactivate(oCtx.getProperty("id"));
		MessageToast.show(oCtx.getProperty("firstName") + " pasifleştirildi.");
		await this.loadData();
	}

	public async onDeleteMember(oEvent: Event): Promise<void> {
		const oCtx = (oEvent.getSource() as any).getBindingContext("membersData");
		const memberId = oCtx.getProperty("id");
		const firstName = oCtx.getProperty("firstName");
		
		MessageBox.confirm(`${firstName} isimli üyeyi sistemden kalıcı olarak silmek istediğinize emin misiniz?`, {
			title: "Üye Sil",
			onClose: async (sAction: string) => {
				if (sAction === MessageBox.Action.OK) {
					try {
						await UserService.remove(memberId);
						MessageToast.show(`${firstName} başarıyla silindi.`);
						await this.loadData();
					} catch (e: any) {
						MessageToast.show(e.message || "Silme işlemi başarısız oldu.");
					}
				}
			}
		});
	}

	public onMemberPress(oEvent: Event): void {
		const oCtx = (oEvent.getSource() as any).getBindingContext("membersData");
		this.getRouter().navTo("adminMemberDetail", { memberId: oCtx.getProperty("id") });
	}

	public onOpenAddMember(): void {
		const oView = this.getView();
		oView.setModel(new JSONModel({
			firstName: "",
			lastName: "",
			email: "",
			phone: "",
			password: "",
			birthDate: "",
			parentName: "",
			consentDocument: "",
			iban: "",
			ibanHolder: "",
			ibanHolderList: [],
			city: "",
			actingTraining: "",
			actingExperience: "",
			isUnder18: false,
			ibanState: "None",
			ibanStateText: "",
			status: "active",
			role: "member"
		}), "newMember");

		this.updateIbanList();

		const oDialog = this.byId("addMemberDialog") as Dialog;
		oDialog.open();
	}

	public onNameChange(oEvent: Event): void {
		const oInput = oEvent.getSource() as any;
		const sPath = oInput.getBinding("value")?.getPath();
		if (sPath) (this.getView().getModel("newMember") as JSONModel).setProperty(sPath, oInput.getValue());
		this.updateIbanList();
	}

	public onParentNameChange(oEvent: Event): void {
		const oInput = oEvent.getSource() as any;
		(this.getView().getModel("newMember") as JSONModel).setProperty("/parentName", oInput.getValue());
		this.updateIbanList();
	}

	public async onConsentFileChange(oEvent: Event): Promise<void> {
		const oFileUploader = oEvent.getSource() as FileUploader;
		let aFiles = oEvent.getParameter("files") as FileList;
		if (!aFiles || aFiles.length === 0) {
			const domRef = oFileUploader.getDomRef("fu") as HTMLInputElement;
			if (domRef) aFiles = domRef.files as FileList;
		}

		if (aFiles && aFiles.length > 0) {
			const file = aFiles[0];
			const reader = new FileReader();
			reader.onload = (e) => {
				const base64 = e.target?.result as string;
				(this.getView().getModel("newMember") as JSONModel).setProperty("/consentDocument", base64);
			};
			reader.readAsDataURL(file);
		} else {
			(this.getView().getModel("newMember") as JSONModel).setProperty("/consentDocument", "");
		}
	}

	public onBirthDateChange(oEvent: Event): void {
		const sValue = (oEvent.getParameter("value") as string);
		if (!sValue) return;
		const birthDate = new Date(sValue);
		const today = new Date();
		let age = today.getFullYear() - birthDate.getFullYear();
		const m = today.getMonth() - birthDate.getMonth();
		if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
			age--;
		}
		
		const oModel = this.getView().getModel("newMember") as JSONModel;
		oModel.setProperty("/isUnder18", age < 18);
		
		// Eğer veli bilgisi silinecekse vs.
		if (age >= 18) {
			oModel.setProperty("/parentName", "");
			oModel.setProperty("/consentDocument", "");
		}
		this.updateIbanList();
	}

	private updateIbanList(): void {
		const oModel = this.getView().getModel("newMember") as JSONModel;
		const data = oModel.getData();
		const list: any[] = [];
		if (data.isUnder18) {
			if (data.parentName.trim()) {
				list.push({ name: data.parentName.trim() });
			}
		} else {
			const fullName = `${data.firstName || ''} ${data.lastName || ''}`.trim();
			if (fullName) {
				list.push({ name: fullName });
			}
		}
		oModel.setProperty("/ibanHolderList", list);
		// Auto select if only one option exists
		if (list.length === 1 && data.ibanHolder !== list[0].name) {
			oModel.setProperty("/ibanHolder", list[0].name);
		} else if (list.length === 0) {
			oModel.setProperty("/ibanHolder", "");
		}
	}

	public onIbanChange(oEvent: Event): void {
		const oInput = oEvent.getSource() as any;
		let sValue = oInput.getValue().replace(/\s+/g, "").toUpperCase();
		const oModel = this.getView().getModel("newMember") as JSONModel;
		
		// Sadece TR IBAN algıla ve Math modülüne pasla
		if (!sValue) {
			oModel.setProperty("/ibanState", "None");
			oModel.setProperty("/ibanStateText", "");
			return;
		}

		if (sValue.length > 34) {
			sValue = sValue.substring(0, 34);
			oInput.setValue(sValue);
		}

		if (isValidIBANNumber(sValue)) {
			// valid format and valid checksum
			oModel.setProperty("/ibanState", "Success");
			oModel.setProperty("/ibanStateText", "");
		} else {
			if (sValue.length >= 15) {
				oModel.setProperty("/ibanState", "Error");
				oModel.setProperty("/ibanStateText", "IBAN geçersiz! Checksum hatalı.");
			} else {
				oModel.setProperty("/ibanState", "Warning");
				oModel.setProperty("/ibanStateText", "Eksik hane.");
			}
		}
		
		oModel.setProperty("/iban", sValue);
	}

	public onCancelAddMember(): void {
		const oDialog = this.byId("addMemberDialog") as Dialog;
		oDialog.close();
	}

	public async onSaveNewMember(): Promise<void> {
		const oModel = this.getView().getModel("newMember") as JSONModel;
		const oData = oModel.getData();

		if (!oData.firstName || !oData.lastName || !oData.email || !oData.birthDate || !oData.phone || !oData.city || !oData.iban) {
			MessageToast.show("Lütfen İsim, E-posta, Telefon, Şehir, Doğum Tarihi ve IBAN gibi zorunlu alanları doldurun.");
			return;
		}

		if (oData.isUnder18 && (!oData.parentName || !oData.consentDocument)) {
			MessageToast.show("18 Yaş altı üyeler için Veli bilgileri ve izin belgesi zorunludur.");
			return;
		}

		if (oData.ibanState === "Error" || oData.ibanState === "Warning") {
			MessageToast.show("Lütfen geçerli bir TR IBAN giriniz.");
			return;
		}

		// Remove UI-only helper fields before sending
		const payload = { ...oData };
		delete payload.isUnder18;
		delete payload.ibanState;
		delete payload.ibanStateText;
		delete payload.ibanHolderList;

		payload.id = payload.email; // Use Email as Username

		try {
			await UserService.create(payload);
			MessageToast.show("Yeni üye başarıyla eklendi.");
			this.onCancelAddMember();
			await this.loadData();
		} catch (error) {
			MessageToast.show("Üye eklenirken bir hata oluştu.");
		}
	}
}
