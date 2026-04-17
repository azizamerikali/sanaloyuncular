import BaseController from "../BaseController";
import MessageToast from "sap/m/MessageToast";
import MessageBox from "sap/m/MessageBox";
import FileUploader from "sap/ui/unified/FileUploader";
import CheckBox from "sap/m/CheckBox";
import Button from "sap/m/Button";
import { API_BASE } from "../../service/ApiClient";

/**
 * @namespace com.openui5.webdb.controller.admin
 */
export default class AdminSystem extends BaseController {

	public onInit(): void {
		this.getRouter().getRoute("adminSystem").attachPatternMatched(this.onRouteMatched, this);
	}

	private onRouteMatched(): void {
		// Reset state
		const fileUploader = this.byId("dbFileUploader") as FileUploader;
		if (fileUploader) {
			fileUploader.clear();
		}
		const checkbox = this.byId("confirmRestore") as CheckBox;
		if (checkbox) {
			checkbox.setSelected(false);
		}
		const button = this.byId("restoreButton") as Button;
		if (button) {
			button.setEnabled(false);
		}
	}

	public onFileChange(): void {
		this.updateRestoreButtonState();
	}

	public onConfirmationChange(): void {
		this.updateRestoreButtonState();
	}

	private updateRestoreButtonState(): void {
		const fileUploader = this.byId("dbFileUploader") as FileUploader;
		const checkbox = this.byId("confirmRestore") as CheckBox;
		const button = this.byId("restoreButton") as Button;
		
		if (!fileUploader || !checkbox || !button) return;

		const isConfirmed = checkbox.getSelected();
		const hasFile = !!fileUploader.getValue();
		
		button.setEnabled(isConfirmed && hasFile);
	}

	public onDownloadBackup(): void {
		this.downloadFileWithAuth(`${API_BASE}/system/backup`);
	}

	private async downloadFileWithAuth(url: string): Promise<void> {
		try {
			const response = await fetch(url, {
				headers: {
					"Authorization": `Bearer ${sessionStorage.getItem("token")}`
				}
			});

			if (!response.ok) throw new Error("Yedek indirilemedi.");

			const now = new Date();
			const pad = (n: number) => String(n).padStart(2, "0");
			const ts = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}`;
			const fileName = `SanalOyuncular_Backup_${ts}.sqlite`;

			const blob = await response.blob();
			const blobUrl = window.URL.createObjectURL(blob);
			const link = document.createElement("a");
			link.href = blobUrl;
			link.download = fileName;
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
			window.URL.revokeObjectURL(blobUrl);

			MessageToast.show("Veritabanı yedeği indirildi.");
		} catch (error: any) {
			MessageBox.error(error.message);
		}
	}

	public onRestoreBackup(): void {
		const fileUploader = this.byId("dbFileUploader") as FileUploader;
		const checkbox = this.byId("confirmRestore") as CheckBox;

		if (!fileUploader.getValue()) {
			MessageToast.show("Lütfen bir dosya seçin.");
			return;
		}

		if (!checkbox.getSelected()) {
			MessageToast.show("Lütfen işlemi onaylayın.");
			return;
		}

		MessageBox.warning("Tüm verileriniz silinecek ve yüklenen dosya ile değiştirilecek. Emin misiniz?", {
			actions: [MessageBox.Action.YES, MessageBox.Action.NO],
			onClose: (sAction: string) => {
				if (sAction === MessageBox.Action.YES) {
					this.performRestore();
				}
			}
		});
	}

	private async performRestore(): Promise<void> {
		const fileUploader = this.byId("dbFileUploader") as FileUploader;
		const domRef = fileUploader.getDomRef("fu") as HTMLInputElement;
		const file = domRef.files?.[0];

		if (!file) {
			MessageToast.show("Dosya okunamadı.");
			return;
		}

		this.getView().setBusy(true);

		try {
			const formData = new FormData();
			formData.append("backup", file);

			const response = await fetch(`${API_BASE}/system/restore`, {
				method: "POST",
				headers: {
					"Authorization": `Bearer ${sessionStorage.getItem("token")}`
				},
				body: formData
			});

			const result = await response.json();

			if (!response.ok) throw new Error(result.error || "Geri yükleme başarısız.");

			if (result.restarting) {
				MessageBox.success(
					"Veritabanı geri yüklendi. Sistem yeniden başlatılıyor, lütfen bekleyin...",
					{ onClose: () => { this.pollUntilServerReady(); } }
				);
				this.pollUntilServerReady();
			} else {
				MessageBox.success("Veritabanı başarıyla geri yüklendi! Uygulama yeniden yüklenecek.", {
					onClose: () => { window.location.reload(); }
				});
			}
		} catch (error: any) {
			MessageBox.error(error.message);
		} finally {
			this.getView().setBusy(false);
		}
	}

	// Polls /api/health every 2s until the server responds, then reloads the page.
	// Used after a restore-triggered process restart so we don't reload before the server is up.
	private pollUntilServerReady(attempt: number = 0): void {
		const MAX_ATTEMPTS = 25; // 50 seconds max
		fetch(`${API_BASE}/health`)
			.then(r => {
				if (r.ok) {
					window.location.reload();
				} else {
					throw new Error("not ready");
				}
			})
			.catch(() => {
				if (attempt < MAX_ATTEMPTS) {
					setTimeout(() => this.pollUntilServerReady(attempt + 1), 2000);
				} else {
					MessageToast.show("Sunucu başlatılamadı. Lütfen sayfayı manuel olarak yenileyin.");
				}
			});
	}
}
