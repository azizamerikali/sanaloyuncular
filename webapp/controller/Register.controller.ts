import BaseController from "./BaseController";
import MessageBox from "sap/m/MessageBox";
import MessageToast from "sap/m/MessageToast";
import CheckBox from "sap/m/CheckBox";
import JSONModel from "sap/ui/model/json/JSONModel";
import Event from "sap/ui/base/Event";
import UserService from "../service/UserService";
import ConsentService from "../service/ConsentService";
import AuthService from "../service/AuthService";
import { cities } from "../model/Cities";
import FileUploader from "sap/ui/unified/FileUploader";
import { isValidIBANNumber } from "../utils/iban";
import Dialog from "sap/m/Dialog";
import Button from "sap/m/Button";
import Text from "sap/m/Text";
import VBox from "sap/m/VBox";
import Input from "sap/m/Input";
import ApiClient from "../service/ApiClient";
/**
 * @namespace com.openui5.webdb.controller
 */
export default class Register extends BaseController {
	private _legalTextTemplate: string = "";
	private _approvedLegalText: string = "";

	public onInit(): void {
		this.getView().setModel(new JSONModel(cities), "cities");
		
		// 1. Initialize completely fresh newMember model BEFORE route match
		this.resetNewMemberModel();

		// 2. Attach route synchronously so we don't miss the initial fire!
		this.getRouter().getRoute("register").attachPatternMatched(this.onRouteMatched, this);
		
		// 3. Fire and forget async initializations
		this.loadConsentText();
		this.loadLegalTemplate();
	}

	private async loadLegalTemplate(): Promise<void> {
		try {
			const url = sap.ui.require.toUrl("com/openui5/webdb/controller/legal_text.txt");
			const response = await fetch(url);
			this._legalTextTemplate = await response.text();
		} catch (e) {
			console.error("Legal text template failed to load", e);
		}
	}
	private async loadConsentText(): Promise<void> {
		try {
			let consentText = await ConsentService.getConsentText();
			const today = new Date().toLocaleDateString("tr-TR");
			
			// Replace static date pattern (e.g., 2025-01-01) with current date
			consentText = consentText.replace(/\d{4}-\d{2}-\d{2}/g, today);
			
			const appDataModel = new JSONModel({ consentText: consentText });
			this.getView().setModel(appDataModel, "appData");
		} catch (e) {
			console.error("Consent text failed to load", e);
		}
	}

	private resetNewMemberModel(): void {
		this.getView().setModel(new JSONModel({
			firstName: "",
			lastName: "",
			email: "",
			phone: "",
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
			profilePicture: "",
			photoFront: "",
			photoRight: "",
			photoLeft: "",
			activeSlot: "front",
			isCameraActive: false,
			isGoogleAuthPending: true,
			isGoogleAuthCompleted: false
		}), "newMember");
	}

	private async onRouteMatched(): Promise<void> {
		// Init GIS inside Register page
		await this.loadGoogleScript();
		const google = (window as any).google;
		if (google) {
			google.accounts.id.initialize({
				client_id: "50993658634-7hoto049cjs26qks8m8pd87juoj96h11.apps.googleusercontent.com",
				callback: this.handleGoogleCredentialResponse.bind(this)
			});
			const tryRender = (attempts = 0) => {
				const btnContainer = document.getElementById("googleButtonContainerReg");
				if (btnContainer) {
					google.accounts.id.renderButton(btnContainer, { 
						theme: "outline", 
						size: "large", 
						type: "standard", 
						width: "350",
						text: "continue_with"
					});
				} else if (attempts < 15) {
					setTimeout(() => tryRender(attempts + 1), 300);
				}
			};
			tryRender();
		}

		// Pull drafted info from Login controller 404 proxy
		const draftModel = this.getOwnerComponent().getModel("googleRegisterDraft") as JSONModel;
		if (draftModel) {
			const draft = draftModel.getData();
			if (draft.email) {
				const fullName = `${draft.firstName || ""} ${draft.lastName || ""}`.trim();
				
				// Open legal consent dialog BEFORE pre-filling form
				const bApproved = await this.openLegalConsentDialog(draft.email, fullName, true);
				
				if (bApproved) {
					const newMemberModel = this.getView().getModel("newMember") as JSONModel;
					newMemberModel.setProperty("/email", draft.email);
					newMemberModel.setProperty("/firstName", draft.firstName || "");
					newMemberModel.setProperty("/lastName", draft.lastName || "");
					newMemberModel.setProperty("/isGoogleAuthPending", false);
					newMemberModel.setProperty("/isGoogleAuthCompleted", true);
					newMemberModel.refresh(true);
					this.updateIbanList();
				}
			}
			// Clean up model payload
			this.getOwnerComponent().setModel(new JSONModel({}), "googleRegisterDraft");
		}
	}

	private loadGoogleScript(): Promise<void> {
		return new Promise((resolve) => {
			if ((window as any).google && (window as any).google.accounts) {
				resolve();
				return;
			}
			const script = document.createElement("script");
			script.src = "https://accounts.google.com/gsi/client";
			script.async = true;
			script.defer = true;
			script.onload = () => resolve();
			document.head.appendChild(script);
		});
	}

	private async handleGoogleCredentialResponse(response: any): Promise<void> {
		const idToken = response.credential;
		const result = await AuthService.googleLogin(idToken);
		
		if (result.success && result.user) {
			// This person is already registered!
			MessageToast.show("Bu hesapla zaten kayıtlısınız, giriş yapılıyor.");
			const user = result.user;
			const oComponent = this.getOwnerComponent();
			const oRootView = oComponent.getRootControl();
			const oAppController = oRootView.getController() as any;
			if (oAppController && oAppController.loginSuccess) {
				oAppController.loginSuccess(user.firstName, user.lastName, user.email, user.role, user.profilePicture);
			}
			switch (user.role) {
				case "admin": this.getRouter().navTo("adminDashboard", {}, undefined, true); break;
				case "client": this.getRouter().navTo("clientDashboard", {}, undefined, true); break;
				default: this.getRouter().navTo("dashboard", {}, undefined, true); break;
			}
		} else if (result.notFound && result.googlePayload) {
			const payload = result.googlePayload;
			const fullName = `${payload.firstName || ""} ${payload.lastName || ""}`.trim();
			
			// Open legal consent dialog BEFORE pre-filling form
			const bApproved = await this.openLegalConsentDialog(payload.email || "", fullName, true);
			
			if (bApproved) {
				// User approved, pre-fill fields and show the form
				const newMemberModel = this.getView().getModel("newMember") as JSONModel;
				newMemberModel.setProperty("/email", payload.email || "");
				newMemberModel.setProperty("/firstName", payload.firstName || "");
				newMemberModel.setProperty("/lastName", payload.lastName || "");
				newMemberModel.setProperty("/isGoogleAuthPending", false);
				newMemberModel.setProperty("/isGoogleAuthCompleted", true);
				newMemberModel.refresh(true);
				MessageToast.show("Google bilgileri doğrulandı. Lütfen formu tamamlayın.");
				this.updateIbanList();
			} else {
				// User cancelled (handled inside dialog with navTo)
				return;
			}
		} else {
			MessageToast.show(result.error || "Google Girişi Başarısız.");
		}
	}

	// Dynamic Field Logic mapped from AdminMembers
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
			if (data.parentName?.trim()) {
				list.push({ name: data.parentName.trim() });
			}
		} else {
			const fullName = `${data.firstName || ''} ${data.lastName || ''}`.trim();
			if (fullName) {
				list.push({ name: fullName });
			}
		}
		oModel.setProperty("/ibanHolderList", list);
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

	// Camera Logic
	public async onStartCamera(): Promise<void> {
		const oModel = this.getView().getModel("newMember") as JSONModel;
		
		try {
			const stream = await navigator.mediaDevices.getUserMedia({ 
				video: { 
					facingMode: "user",
					width: { ideal: 640 },
					height: { ideal: 480 }
				} 
			});
			
			oModel.setProperty("/isCameraActive", true);
			
			// Small delay for UI to render video element
			setTimeout(() => {
				const video = document.getElementById("videoPlayer") as HTMLVideoElement;
				if (video) {
					video.srcObject = stream;
					(this as any)._cameraStream = stream;
				}
			}, 500);
			
		} catch (error) {
			MessageBox.error("Kamera erişimi reddedildi veya cihazda kamera bulunamadı.");
		}
	}

	public onTakePhoto(): void {
		const video = document.getElementById("videoPlayer") as HTMLVideoElement;
		const canvas = document.getElementById("captureCanvas") as HTMLCanvasElement;
		const oModel = this.getView().getModel("newMember") as JSONModel;

		if (video && canvas) {
			const context = canvas.getContext("2d");
			if (context) {
				// Round capture logic: we capture a square and UI hides the rest
				const size = Math.min(video.videoWidth, video.videoHeight);
				const x = (video.videoWidth - size) / 2;
				const y = (video.videoHeight - size) / 2;
				
				canvas.width = 400; // Fixed size for DB storage
				canvas.height = 400;
				
				context.drawImage(video, x, y, size, size, 0, 0, 400, 400);
				
				const base64 = canvas.toDataURL("image/jpeg", 0.8);
				const sSlot = oModel.getProperty("/activeSlot");
				
				if (sSlot === "front") {
					oModel.setProperty("/photoFront", base64);
					oModel.setProperty("/profilePicture", base64); // Front is main profile pic
					oModel.setProperty("/activeSlot", "right");
					MessageToast.show("Kar\u015f\u0131 \u00e7ekim tamam, \u015fimdi Sa\u011f Profili \u00e7ekebilirsiniz.");
				} else if (sSlot === "right") {
					oModel.setProperty("/photoRight", base64);
					oModel.setProperty("/activeSlot", "left");
					MessageToast.show("Sa\u011f profil tamam, \u015fimdi Sol Profili \u00e7ekebilirsiniz.");
				} else if (sSlot === "left") {
					oModel.setProperty("/photoLeft", base64);
					MessageToast.show("T\u00fcm foto\u011fraflar \u00e7ekildi.");
					this.onStopCamera();
				}
			}
		}
	}

	public onSlotPress(oEvent: Event): void {
		const oAvatar = oEvent.getSource() as any;
		const sTooltip = oAvatar.getTooltip();
		let sSlot = "front";
		if (sTooltip === "Sağ Profil") sSlot = "right";
		if (sTooltip === "Sol Profil") sSlot = "left";
		
		this.getView().getModel("newMember").setProperty("/activeSlot", sSlot);
	}

	private onStopCamera(): void {
		const oModel = this.getView().getModel("newMember") as JSONModel;
		if ((this as any)._cameraStream) {
			(this as any)._cameraStream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
			(this as any)._cameraStream = null;
		}
		oModel.setProperty("/isCameraActive", false);
	}

	// Submission Logic
	public async onRegister(): Promise<void> {
		const consentAccepted = (this.byId("consentCheckbox") as CheckBox).getSelected();
		if (!consentAccepted) {
			MessageBox.warning("Lütfen sözleşmeyi kabul edin.");
			return;
		}

		const oModel = this.getView().getModel("newMember") as JSONModel;
		const oData = oModel.getData();

		if (!oData.firstName || !oData.lastName || !oData.email || !oData.photoFront || !oData.photoRight || !oData.photoLeft || !oData.birthDate || !oData.phone || !oData.city || !oData.iban) {
			MessageBox.warning("Lütfen İsim, Soyisim, Üç Açıdan Fotoğraflar, E-posta, Telefon, Şehir, Doğum Tarihi ve IBAN gibi zorunlu alanları eksiksiz doldurun.");
			return;
		}

		if (oData.isUnder18 && (!oData.parentName || !oData.consentDocument)) {
			MessageBox.warning("18 Yaş altı üyeler için Veli bilgileri ve izin belgesi zorunludur.");
			return;
		}

		if (oData.ibanState === "Error" || oData.ibanState === "Warning") {
			MessageBox.warning("Lütfen geçerli bir IBAN numarası giriniz.");
			return;
		}

		const payload = { ...oData };
		delete payload.isUnder18;
		delete payload.ibanState;
		delete payload.ibanStateText;
		delete payload.ibanHolderList;
		delete payload.isCameraActive;
		delete payload.activeSlot;
		delete payload.photoFront;
		delete payload.photoRight;
		delete payload.photoLeft;

		// Add initial photos for the media gallery
		payload.initialPhotos = [
			{ fileName: "Karşı Çekim", fileData: oData.photoFront },
			{ fileName: "Sağ Profil", fileData: oData.photoRight },
			{ fileName: "Sol Profil", fileData: oData.photoLeft }
		];

		payload.id = payload.email; // Use Email as Username
		payload.role = "member";
		payload.status = "pending";
		
		// Optimization: Include legal approval in the same request to avoid race conditions on Vercel
		payload.legalApprove = true;
		payload.legalText = this._approvedLegalText;

		try {
			await UserService.create(payload);
			// No second call needed anymore, handled atomically on backend

			MessageBox.success("Kaydınız başarıyla tamamlandı!", {
				onClose: () => {
					this.getRouter().navTo("login", {}, undefined, true);
				}
			});
		} catch (error: any) {
			MessageBox.error(error.message || "Üye kaydı sırasında bir hata oluştu.");
		}
	}

	private async openLegalConsentDialog(email: string, fullName: string, isPreCheck: boolean = false): Promise<boolean> {
		// Ensure template is loaded before showing dialog
		if (!this._legalTextTemplate) {
			await this.loadLegalTemplate();
		}

		const oBundle = await this.getResourceBundle();
		const sDate = new Date().toLocaleDateString('tr-TR');
		const sCompany = "Ludens Casting";
		
		const sFinalText = (this._legalTextTemplate || "Sözleşme metni yüklenemedi. Lütfen sayfayı yenileyiniz.")
			.replace(/\[ŞİRKET ADI\]/g, sCompany)
			.replace(/\[Ad Soyad\]/g, fullName)
			.replace(/\[Tarih\]/g, sDate)
			.replace(/\[ŞİRKET MERKEZİ İLİ\]/g, "İstanbul");
		
		this._approvedLegalText = sFinalText;

		return new Promise((resolve) => {
			const oDialog = new Dialog({
				title: oBundle.getText("verifyLegalTitle"),
				type: "Message",
				contentWidth: "600px",
				content: new VBox({
					items: [
						new Text({
							text: sFinalText,
							renderWhitespace: true
						})
					]
				}).addStyleClass("sapUiContentPadding"),
				beginButton: new Button({
					text: oBundle.getText("verifyApproveBtn"),
					type: "Emphasized",
					press: () => {
						oDialog.close();
						resolve(true);
					}
				}),
				endButton: new Button({
					text: oBundle.getText("verifyCancelBtn"),
					press: () => {
						oDialog.close();
						this.getRouter().navTo("login", {}, undefined, true);
						resolve(false);
					}
				}),
				afterClose: () => {
					oDialog.destroy();
				}
			});

			oDialog.open();
		});
	}

	public onNavBack(): void {
		this.getRouter().navTo("login", {}, undefined, true);
	}
}
