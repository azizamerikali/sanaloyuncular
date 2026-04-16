import BaseController from "../BaseController";
import JSONModel from "sap/ui/model/json/JSONModel";
import MessageToast from "sap/m/MessageToast";
import MessageBox from "sap/m/MessageBox";
import Dialog from "sap/m/Dialog";
import ActionSheet from "sap/m/ActionSheet";
import Button from "sap/m/Button";
import Event from "sap/ui/base/Event";
import AuthService from "../../service/AuthService";
import MediaService from "../../service/MediaService";
import formatter from "../../model/formatter";

/**
 * @namespace com.openui5.webdb.controller.member
 */
export default class MemberPhotos extends BaseController {

	private _galleryInput: HTMLInputElement | null = null;
	private _stream: MediaStream | null = null;

	public onInit(): void {
		this.getRouter().getRoute("memberPhotos").attachPatternMatched(this.onRouteMatched, this);
		this._createGalleryInput();
	}

	public onExit(): void {
		this._galleryInput?.remove();
		this._stopStream();
	}

	// ─── Gizli galeri input ───────────────────────────────────────────────────

	private _createGalleryInput(): void {
		const input = document.createElement("input");
		input.type = "file";
		input.accept = "image/jpeg,image/png";
		input.style.display = "none";
		input.addEventListener("change", (e) => this._handleFileSelected(e));
		document.body.appendChild(input);
		this._galleryInput = input;
	}

	// ─── Rota ────────────────────────────────────────────────────────────────

	private onRouteMatched(): void {
		this.loadPhotos();
	}

	private async loadPhotos(): Promise<void> {
		const user = AuthService.getCurrentUser();
		if (!user) return;
		const media = await MediaService.getByUser(user.id);
		const photos = media.map(p => ({
			...p,
			createdAt: formatter.formatDate(p.createdAt)
		}));
		this.getView().setModel(new JSONModel({ photos }), "photosData");
	}

	// ─── Kaynak seçim menüsü ─────────────────────────────────────────────────

	public onUploadPress(oEvent: Event): void {
		const oActionSheet = this.byId("uploadActionSheet") as ActionSheet;
		oActionSheet.openBy(oEvent.getSource() as Button);
	}

	// ─── Kamera ──────────────────────────────────────────────────────────────

	/**
	 * getUserMedia ile kamera akışı başlatır ve dialog'u açar.
	 * Tarayıcı desteklemiyorsa dosya seçici fallback'ine düşer.
	 */
	public async onCameraCapture(): Promise<void> {
		if (!navigator.mediaDevices?.getUserMedia) {
			MessageToast.show("Tarayıcınız kamera erişimini desteklemiyor. Dosya seçici açılıyor.");
			this._openGalleryFallback();
			return;
		}

		try {
			// Önce arka kamera (mobile), yoksa herhangi bir kamera (desktop)
			const stream = await navigator.mediaDevices.getUserMedia({
				video: {
					facingMode: { ideal: "environment" },
					width: { ideal: 1280 },
					height: { ideal: 720 }
				}
			});
			this._stream = stream;

			const oDialog = this.byId("cameraDialog") as Dialog;
			oDialog.open();
		} catch (err: any) {
			if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
				MessageBox.error("Kamera erişimi reddedildi. Lütfen tarayıcı ayarlarından kamera iznini verin.");
			} else {
				MessageToast.show("Kamera açılamadı. Galeriden seçim yapabilirsiniz.");
				this._openGalleryFallback();
			}
		}
	}

	/** Dialog DOM'a render olduktan sonra video stream'i bağla */
	public onCameraDialogAfterOpen(): void {
		const video = document.getElementById("so-camera-video") as HTMLVideoElement;
		if (video && this._stream) {
			video.srcObject = this._stream;
		}
	}

	/** Dialog kapandığında stream'i durdur */
	public onCameraDialogAfterClose(): void {
		this._stopStream();
	}

	/** Anlık kare yakala, JPEG'e çevir ve yükle */
	public onCapturePhoto(): void {
		const video = document.getElementById("so-camera-video") as HTMLVideoElement;
		const canvas = document.getElementById("so-camera-canvas") as HTMLCanvasElement;

		if (!video || !canvas || video.videoWidth === 0) {
			MessageToast.show("Kamera görüntüsü hazır değil, lütfen bekleyin.");
			return;
		}

		canvas.width = video.videoWidth;
		canvas.height = video.videoHeight;

		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		// Video karesi canvas'a yansıt
		ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

		const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
		const fileName = `kamera_${Date.now()}.jpg`;

		// Dialog'u kapat ve stream'i durdur
		(this.byId("cameraDialog") as Dialog).close();

		// Yükle
		this._uploadPhoto(dataUrl, fileName);
	}

	public onCloseCamera(): void {
		(this.byId("cameraDialog") as Dialog).close();
	}

	private _stopStream(): void {
		if (this._stream) {
			this._stream.getTracks().forEach(t => t.stop());
			this._stream = null;
		}
		const video = document.getElementById("so-camera-video") as HTMLVideoElement | null;
		if (video) video.srcObject = null;
	}

	// ─── Galeri / dosya seçici ───────────────────────────────────────────────

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

		if (file.size > 10 * 1024 * 1024) {
			MessageToast.show("Fotoğraf 10 MB'dan büyük olamaz.");
			return;
		}

		const reader = new FileReader();
		reader.onload = async (readerEvent) => {
			const fileData = readerEvent.target?.result as string;
			const fileName = file.name || `fotograf_${Date.now()}.jpg`;
			await this._uploadPhoto(fileData, fileName);
		};
		reader.readAsDataURL(file);
	}

	// ─── Ortak yükleme ───────────────────────────────────────────────────────

	private async _uploadPhoto(fileData: string, fileName: string): Promise<void> {
		const user = AuthService.getCurrentUser();
		if (!user) return;

		try {
			await MediaService.create({
				userId: user.id,
				fileName: fileName,
				filePath: "/photos/" + fileName,
				fileData: fileData
			});
			MessageToast.show("Fotoğraf yüklendi!");
			await this.loadPhotos();
		} catch (error: any) {
			const msg = error?.data?.error || "Yükleme işlemi başarısız.";
			MessageToast.show(msg);
		}
	}

	// ─── Silme & önizleme ────────────────────────────────────────────────────

	public onDeletePhoto(oEvent: Event): void {
		const oContext = (oEvent.getSource() as any).getBindingContext("photosData");
		const photoId = oContext.getProperty("id");
		MessageBox.confirm("Bu fotoğrafı silmek istediğinize emin misiniz?", {
			onClose: async (sAction: string) => {
				if (sAction === "OK") {
					await MediaService.remove(photoId);
					MessageToast.show("Fotoğraf silindi.");
					await this.loadPhotos();
				}
			}
		});
	}

	public onImagePress(oEvent: Event): void {
		const oImage = oEvent.getSource() as any;
		const oCtx = oImage.getBindingContext("photosData");
		const src = oCtx.getProperty("fileData") || "sap-icon://attachment-photo";
		this.getView().setModel(new JSONModel({ src }), "preview");
		(this.byId("imagePreviewDialog") as Dialog).open();
	}

	public onClosePreview(): void {
		(this.byId("imagePreviewDialog") as Dialog).close();
	}
}
