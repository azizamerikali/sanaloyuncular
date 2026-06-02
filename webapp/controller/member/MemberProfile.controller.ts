import BaseController from "../BaseController";
import JSONModel from "sap/ui/model/json/JSONModel";
import MessageToast from "sap/m/MessageToast";
import MessageBox from "sap/m/MessageBox";
import Dialog from "sap/m/Dialog";
import ActionSheet from "sap/m/ActionSheet";
import Button from "sap/m/Button";
import Event from "sap/ui/base/Event";
import AuthService from "../../service/AuthService";
import UserService from "../../service/UserService";
import formatter from "../../model/formatter";

/**
 * @namespace com.openui5.webdb.controller.member
 */
export default class MemberProfile extends BaseController {
	private _galleryInput: HTMLInputElement | null = null;
	private _stream: MediaStream | null = null;

	public onInit(): void {
		this.getRouter().getRoute("memberProfile").attachPatternMatched(this.onRouteMatched, this);
		this._createGalleryInput();
	}

	public onExit(): void {
		this._galleryInput?.remove();
		this._stopStream();
	}

	private _createGalleryInput(): void {
		const input = document.createElement("input");
		input.type = "file";
		input.accept = "image/jpeg,image/png";
		input.style.display = "none";
		input.addEventListener("change", (e) => this._handleFileSelected(e));
		document.body.appendChild(input);
		this._galleryInput = input;
	}

	private async onRouteMatched(): Promise<void> {
		const user = AuthService.getCurrentUser();
		if (!user) return;
		const remoteUser = await UserService.getById(user.id);
		const fresh = remoteUser || user;

		// Sunucudan profil fotoğrafı gelmediyse session'dakini koru
		const profilePicture = fresh.profilePicture || user.profilePicture || "";

		const oModel = new JSONModel({
			...fresh,
			profilePicture,
			statusText: formatter.formatStatus(fresh.status),
			statusState: formatter.formatStatusState(fresh.status),
			createdAtFormatted: formatter.formatDate(fresh.createdAt)
		});
		this.getView().setModel(oModel, "profileData");
	}

	public async onSaveProfile(): Promise<void> {
		const oModel = this.getView().getModel("profileData") as JSONModel;
		const data = oModel.getData();
		await UserService.update(data.id, {
			firstName: data.firstName,
			lastName: data.lastName,
			email: data.email,
			phone: data.phone,
			address: data.address,
			profilePicture: data.profilePicture
		});
		AuthService.updateSession({ ...AuthService.getCurrentUser(), ...data });
		MessageToast.show("Profil güncellendi!");
	}

	public onUploadPress(oEvent: Event): void {
		const oActionSheet = this.byId("uploadActionSheet") as ActionSheet;
		oActionSheet.openBy(oEvent.getSource() as Button);
	}

	public async onCameraCapture(): Promise<void> {
		if (!navigator.mediaDevices?.getUserMedia) {
			MessageToast.show("Tarayıcınız kamera erişimini desteklemiyor. Dosya seçici açılıyor.");
			this._openGalleryFallback();
			return;
		}

		try {
			const stream = await navigator.mediaDevices.getUserMedia({
				video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } }
			});
			this._stream = stream;

			const oDialog = this.byId("cameraDialog") as Dialog;
			oDialog.open();
		} catch (err: any) {
			if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
				MessageBox.error("Kamera erişimi reddedildi.");
			} else {
				this._openGalleryFallback();
			}
		}
	}

	public onCameraDialogAfterOpen(): void {
		const video = document.getElementById("so-profile-video") as HTMLVideoElement;
		if (video && this._stream) {
			video.srcObject = this._stream;
		}
	}

	public onCameraDialogAfterClose(): void {
		this._stopStream();
	}

	public onCapturePhoto(): void {
		const video = document.getElementById("so-profile-video") as HTMLVideoElement;
		const canvas = document.getElementById("so-profile-canvas") as HTMLCanvasElement;

		if (!video || !canvas || video.videoWidth === 0) return;

		canvas.width = video.videoWidth;
		canvas.height = video.videoHeight;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;
		ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

		const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
		(this.byId("cameraDialog") as Dialog).close();

		const oModel = this.getView().getModel("profileData") as JSONModel;
		oModel.setProperty("/profilePicture", dataUrl);
	}

	public onCloseCamera(): void {
		(this.byId("cameraDialog") as Dialog).close();
	}

	private _stopStream(): void {
		if (this._stream) {
			this._stream.getTracks().forEach(t => t.stop());
			this._stream = null;
		}
		const video = document.getElementById("so-profile-video") as HTMLVideoElement | null;
		if (video) video.srcObject = null;
	}

	public onGallerySelect(): void {
		this._openGalleryFallback();
	}

	private _openGalleryFallback(): void {
		if (this._galleryInput) {
			this._galleryInput.value = "";
			this._galleryInput.click();
		}
	}

	private _handleFileSelected(e: globalThis.Event): void {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		if (file.size > 5 * 1024 * 1024) {
			MessageToast.show("Fotoğraf 5 MB'dan büyük olamaz.");
			return;
		}

		const reader = new FileReader();
		reader.onload = (readerEvent) => {
			const fileData = readerEvent.target?.result as string;
			const oModel = this.getView().getModel("profileData") as JSONModel;
			oModel.setProperty("/profilePicture", fileData);
		};
		reader.readAsDataURL(file);
	}
}
