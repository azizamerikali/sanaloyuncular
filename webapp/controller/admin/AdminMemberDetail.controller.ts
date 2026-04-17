import BaseController from "../BaseController";
import JSONModel from "sap/ui/model/json/JSONModel";
import Event from "sap/ui/base/Event";
import UserService from "../../service/UserService";
import MediaService from "../../service/MediaService";
import ProjectService from "../../service/ProjectService";
import PaymentService from "../../service/PaymentService";
import formatter from "../../model/formatter";
import { cities } from "../../model/Cities";
import FileUploader from "sap/ui/unified/FileUploader";
import MessageToast from "sap/m/MessageToast";
import { isValidIBANNumber } from "../../utils/iban";
import Dialog from "sap/m/Dialog";
import Button from "sap/m/Button";
import Image from "sap/m/Image";

/**
 * @namespace com.openui5.webdb.controller.admin
 */
export default class AdminMemberDetail extends BaseController {
	private _previewDialog: Dialog | null = null;
	public onInit(): void {
		this.getView().setModel(new JSONModel(cities), "cities");
		this.getRouter().getRoute("adminMemberDetail").attachPatternMatched(this.onRouteMatched, this);
	}

	private async onRouteMatched(oEvent: Event): Promise<void> {
		const memberId = oEvent.getParameter("arguments").memberId as string;
		const user = await UserService.getById(memberId);
		if (!user) { this.onNavBack(); return; }

		const mediaList = await MediaService.getByUser(memberId);
		const photos = mediaList.map(m => ({ ...m, createdAtFormatted: formatter.formatDate(m.createdAt) }));
		
		const assignments = await ProjectService.getAssignmentsByUser(memberId);
		const projects = [];
		for (const a of assignments) {
			const p = await ProjectService.getById(a.projectId);
			if (p) {
				projects.push({ ...p, statusText: formatter.formatStatus(p.status), statusState: formatter.formatStatusState(p.status) });
			}
		}

		const paymentList = await PaymentService.getByUser(memberId);
		const payments = [];
		for (const p of paymentList) {
			const proj = await ProjectService.getById(p.projectId);
			payments.push({ ...p, projectName: proj ? proj.name : "-", netFormatted: formatter.formatCurrency(p.netAmount), statusText: formatter.formatStatus(p.status), statusState: formatter.formatStatusState(p.status) });
		}

		// Compute dynamic states for UI
		let isUnder18 = false;
		if (user.birthDate) {
			const birthDate = new Date(user.birthDate);
			const today = new Date();
			let age = today.getFullYear() - birthDate.getFullYear();
			const m = today.getMonth() - birthDate.getMonth();
			if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
			isUnder18 = age < 18;
		}

		this.getView().setModel(new JSONModel({
			...user,
			password: "", // do not show hash/pass
			isUnder18,
			ibanState: "None",
			ibanStateText: "",
			ibanHolderList: [],
			statusText: formatter.formatStatus(user.status),
			statusState: formatter.formatStatusState(user.status),
			createdAtFormatted: formatter.formatDate(user.createdAt),
			photos, projects, payments,
			photoCount: photos.length.toString(),
			projectCount: projects.length.toString(),
			paymentCount: payments.length.toString()
		}), "detailData");

		this.updateIbanList();
	}

	public onNameChange(oEvent: Event): void { 
		const oInput = oEvent.getSource() as any;
		const sPath = oInput.getBinding("value")?.getPath();
		if (sPath) (this.getView().getModel("detailData") as JSONModel).setProperty(sPath, oInput.getValue());
		this.updateIbanList(); 
	}
	public onParentNameChange(oEvent: Event): void { 
		const oInput = oEvent.getSource() as any;
		(this.getView().getModel("detailData") as JSONModel).setProperty("/parentName", oInput.getValue());
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
				(this.getView().getModel("detailData") as JSONModel).setProperty("/consentDocument", base64);
			};
			reader.readAsDataURL(file);
		} else {
			(this.getView().getModel("detailData") as JSONModel).setProperty("/consentDocument", "");
		}
	}

	public onBirthDateChange(oEvent: Event): void {
		const sValue = (oEvent.getParameter("value") as string);
		if (!sValue) return;
		const birthDate = new Date(sValue);
		const today = new Date();
		let age = today.getFullYear() - birthDate.getFullYear();
		const m = today.getMonth() - birthDate.getMonth();
		if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
		
		const oModel = this.getView().getModel("detailData") as JSONModel;
		oModel.setProperty("/isUnder18", age < 18);
		if (age >= 18) {
			oModel.setProperty("/parentName", "");
			oModel.setProperty("/consentDocument", "");
		}
		this.updateIbanList();
	}

	private updateIbanList(): void {
		const oModel = this.getView().getModel("detailData") as JSONModel;
		const data = oModel.getData();
		const list: any[] = [];
		if (data.isUnder18) {
			if (data.parentName && data.parentName.trim()) list.push({ name: data.parentName.trim() });
		} else {
			const fullName = `${data.firstName || ''} ${data.lastName || ''}`.trim();
			if (fullName) list.push({ name: fullName });
		}
		oModel.setProperty("/ibanHolderList", list);
		if (list.length === 1 && data.ibanHolder !== list[0].name) {
			oModel.setProperty("/ibanHolder", list[0].name);
		} else if (list.length === 0) oModel.setProperty("/ibanHolder", "");
	}

	public onIbanChange(oEvent: Event): void {
		const oInput = oEvent.getSource() as any;
		let sValue = oInput.getValue().replace(/\s+/g, "").toUpperCase();
		const oModel = this.getView().getModel("detailData") as JSONModel;
		
		if (!sValue) {
			oModel.setProperty("/ibanState", "None"); oModel.setProperty("/ibanStateText", ""); return;
		}

		if (sValue.length > 34) {
			sValue = sValue.substring(0, 34); oInput.setValue(sValue);
		}
		
		if (isValidIBANNumber(sValue)) {
			oModel.setProperty("/ibanState", "Success"); oModel.setProperty("/ibanStateText", "");
		} else {
			if (sValue.length >= 15) {
				oModel.setProperty("/ibanState", "Error"); oModel.setProperty("/ibanStateText", "IBAN geçersiz! Checksum hatalı.");
			} else {
				oModel.setProperty("/ibanState", "Warning"); oModel.setProperty("/ibanStateText", "Eksik hane.");
			}
		}
		
		oModel.setProperty("/iban", sValue);
	}

	public async onUpdateProfile(): Promise<void> {
		const oModel = this.getView().getModel("detailData") as JSONModel;
		const oData = oModel.getData();

		if (!oData.firstName || !oData.lastName || !oData.email || !oData.birthDate || !oData.phone || !oData.city || !oData.iban) {
			MessageToast.show("Lütfen İsim, E-posta, Telefon, Şehir, Doğum Tarihi ve IBAN gibi zorunlu alanları doldurun."); return;
		}
		if (oData.isUnder18 && (!oData.parentName || !oData.consentDocument)) {
			MessageToast.show("18 Yaş altı üyeler için Veli bilgileri ve izin belgesi zorunludur."); return;
		}
		if (oData.ibanState === "Error" || oData.ibanState === "Warning") {
			MessageToast.show("Lütfen geçerli bir TR IBAN giriniz."); return;
		}

		const payload = { ...oData };
		delete payload.isUnder18; delete payload.ibanState; delete payload.ibanStateText; delete payload.ibanHolderList;
		delete payload.photos; delete payload.projects; delete payload.payments; delete payload.statusText; delete payload.statusState; delete payload.createdAtFormatted; delete payload.photoCount; delete payload.projectCount; delete payload.paymentCount;

		if (!payload.password) delete payload.password;

		try {
			await UserService.update(payload.id, payload);
			MessageToast.show("Profil başarıyla güncellendi.");
			
			// Refresh header display states implicitly by fetching again
			const refreshedUser = await UserService.getById(payload.id);
			if (refreshedUser) {
				oModel.setProperty("/statusText", formatter.formatStatus(refreshedUser.status));
				oModel.setProperty("/statusState", formatter.formatStatusState(refreshedUser.status));
			}

		} catch (error) {
			MessageToast.show("Profil güncellenirken bir hata oluştu.");
			console.error(error);
		}
	}

	public onImagePress(oEvent: Event): void {
		const oImage = oEvent.getSource() as any;
		const sSrc = oImage.getSrc();
		const sTitle = oImage.getBindingContext("detailData").getProperty("fileName");

		if (!this._previewDialog) {
			this._previewDialog = new Dialog({
				title: sTitle,
				contentWidth: "auto",
				contentHeight: "auto",
				stretch: false,
				content: new Image({
					src: sSrc,
					width: "100%",
					densityAware: false
				}),
				beginButton: new Button({
					text: "Kapat",
					press: () => this._previewDialog?.close()
				})
			});
			this.getView().addDependent(this._previewDialog);
		} else {
			this._previewDialog.setTitle(sTitle);
			(this._previewDialog.getContent()[0] as Image).setSrc(sSrc);
		}

		this._previewDialog.open();
	}
}
