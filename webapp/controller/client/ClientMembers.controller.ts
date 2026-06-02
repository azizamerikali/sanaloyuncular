import BaseController from "../BaseController";
import JSONModel from "sap/ui/model/json/JSONModel";
import MessageToast from "sap/m/MessageToast";
import Event from "sap/ui/base/Event";
import AuthService from "../../service/AuthService";
import UserService from "../../service/UserService";
import MediaService from "../../service/MediaService";
import StorageService from "../../service/StorageService";
import type { IFavorite } from "../../model/MockData";
import { API_BASE } from "../../service/ApiClient";
import Dialog from "sap/m/Dialog";

// ── Member photo slider (module-level state) ────────────────────────────────
let _mPhotos: string[] = [];
let _mIndex = 0;

function _mRender(): void {
	const img = document.getElementById("so-member-img") as HTMLImageElement | null;
	const counter = document.getElementById("so-member-counter") as HTMLElement | null;
	if (!img) return;
	img.style.opacity = "0";
	setTimeout(() => {
		img.src = _mPhotos[_mIndex] || "";
		if (counter) counter.textContent = `${_mIndex + 1} / ${_mPhotos.length}`;
		img.style.opacity = "1";
	}, 150);
}

(window as any).soMemberPrev = () => {
	if (_mPhotos.length === 0) return;
	_mIndex = (_mIndex - 1 + _mPhotos.length) % _mPhotos.length;
	_mRender();
};
(window as any).soMemberNext = () => {
	if (_mPhotos.length === 0) return;
	_mIndex = (_mIndex + 1) % _mPhotos.length;
	_mRender();
};
(window as any).soMemberDownload = () => {
	const src = _mPhotos[_mIndex];
	if (!src) return;
	const link = document.createElement("a");
	link.href = src;
	const mimeMatch = src.match(/^data:image\/(\w+);base64,/);
	const ext = mimeMatch ? mimeMatch[1] : "jpg";
	link.download = `uye_fotograf_${_mIndex + 1}.${ext}`;
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
};
// ────────────────────────────────────────────────────────────────────────────

/**
 * @namespace com.openui5.webdb.controller.client
 */
export default class ClientMembers extends BaseController {
	public onInit(): void {
		this.getRouter().getRoute("clientMembers").attachPatternMatched(this.loadData, this);
	}

	private async loadData(): Promise<void> {
		const user = AuthService.getCurrentUser();
		if (!user) return;
		const allMembers = await UserService.getByRole("member");
		const activeMembers = allMembers.filter(m => m.status === "active");
		
		const favs = StorageService.get<IFavorite[]>("favorites") || [];
		const userFavs = favs.filter(f => f.clientId === user.id).map(f => f.memberId);

		const members = [];
		for (const m of activeMembers) {
			const photoCount = await MediaService.getCountByUser(m.id);
			members.push({
				...m,
				initials: `${m.firstName?.[0] || ""}${m.lastName?.[0] || ""}`.toUpperCase(),
				photoCount: photoCount.toString(),
				isFavorite: userFavs.includes(m.id)
			});
		}

		members.sort((a, b) => {
			if (a.isFavorite && !b.isFavorite) return -1;
			if (!a.isFavorite && b.isFavorite) return 1;
			
			const nameA = `${a.firstName || ""} ${a.lastName || ""}`.toLowerCase();
			const nameB = `${b.firstName || ""} ${b.lastName || ""}`.toLowerCase();
			return nameA.localeCompare(nameB);
		});

		this.getView().setModel(new JSONModel({ members }), "cMembersData");
	}

	public onToggleFavorite(oEvent: Event): void {
		const user = AuthService.getCurrentUser();
		if (!user) return;
		const oCtx = (oEvent.getSource() as any).getBindingContext("cMembersData");
		const memberId = oCtx.getProperty("id") as string;
		const favs = StorageService.get<IFavorite[]>("favorites") || [];
		const idx = favs.findIndex(f => f.clientId === user.id && f.memberId === memberId);
		if (idx >= 0) {
			favs.splice(idx, 1);
			MessageToast.show("Favorilerden çıkarıldı.");
		} else {
			favs.push({ id: StorageService.generateId(), clientId: user.id, memberId });
			MessageToast.show("Favorilere eklendi!");
		}
		StorageService.set("favorites", favs);
		this.loadData();
	}

	public formatProfilePicture(profilePicture: string): string {
		if (!profilePicture) {
			return "";
		}
		if (profilePicture.startsWith("http") || profilePicture.startsWith("data:")) {
			return profilePicture;
		}
		return `${API_BASE}${profilePicture}`;
	}

	public async onNavigateToMemberDetail(oEvent: Event): Promise<void> {
		const oCtx = (oEvent.getSource() as any).getBindingContext("cMembersData");
		const member = oCtx.getObject();

		const oDialog = this.byId("memberDetailDialog") as Dialog;
		const oHtml = this.byId("memberPhotosHtml") as any;
		const oNoPhotos = this.byId("memberNoPhotosBox") as any;

		this.getView().setBusy(true);
		try {
			const mediaList = await MediaService.getByUser(member.id);

			if (!mediaList || mediaList.length === 0) {
				oHtml.setVisible(false);
				oNoPhotos.setVisible(true);
			} else {
				oHtml.setVisible(true);
				oNoPhotos.setVisible(false);
				_mPhotos = new Array(mediaList.length).fill("");
				_mIndex = 0;
			}

			oDialog.setTitle(`${member.firstName} ${member.lastName} - Fotoğraflar`);
			oDialog.open();

			if (mediaList && mediaList.length > 0) {
				mediaList.forEach(async (photo: any, index: number) => {
					try {
						const content = await MediaService.getContent(photo.id);
						if (content) {
							_mPhotos[index] = content;
							if (index === _mIndex) _mRender();
						}
					} catch (e) {
						console.error("Fotoğraf yüklenemedi:", photo.id, e);
					}
				});
			}
		} catch {
			MessageToast.show("Fotoğraflar yüklenirken hata oluştu.");
		} finally {
			this.getView().setBusy(false);
		}
	}

	public onCloseMemberDetail(): void {
		(this.byId("memberDetailDialog") as Dialog).close();
	}
}
