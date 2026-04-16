import BaseController from "../BaseController";
import JSONModel from "sap/ui/model/json/JSONModel";
import MessageToast from "sap/m/MessageToast";
import Event from "sap/ui/base/Event";
import AuthService from "../../service/AuthService";
import UserService from "../../service/UserService";
import MediaService from "../../service/MediaService";
import StorageService from "../../service/StorageService";
import type { IFavorite } from "../../model/MockData";

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
		const members = [];
		for (const m of activeMembers) {
			const photoCount = await MediaService.getCountByUser(m.id);
			members.push({
				...m,
				photoCount: photoCount.toString(),
				isFavorite: false // Favorites API needs standalone service
			});
		}
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
}
