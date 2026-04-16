import BaseController from "../BaseController";
import JSONModel from "sap/ui/model/json/JSONModel";
import MessageToast from "sap/m/MessageToast";
import MessageBox from "sap/m/MessageBox";
import Event from "sap/ui/base/Event";
import MediaService from "../../service/MediaService";
import UserService from "../../service/UserService";
import formatter from "../../model/formatter";

/**
 * @namespace com.openui5.webdb.controller.admin
 */
export default class AdminMedia extends BaseController {
	public onInit(): void {
		this.getRouter().getRoute("adminMedia").attachPatternMatched(this.loadData, this);
	}

	private async loadData(): Promise<void> {
		const mediaList = await MediaService.getAll();
		const media = [];
		for (const m of mediaList) {
			const user = await UserService.getById(m.userId);
			media.push({ ...m, memberName: user ? user.firstName + " " + user.lastName : "-", createdAtFormatted: formatter.formatDate(m.createdAt) });
		}
		this.getView().setModel(new JSONModel({ media }), "mediaPoolData");
	}

	public onDeleteMedia(oEvent: Event): void {
		const oCtx = (oEvent.getSource() as any).getBindingContext("mediaPoolData");
		const mediaId = oCtx.getProperty("id");
		MessageBox.confirm("Bu medyayı silmek istediğinize emin misiniz?", {
			onClose: async (a: string) => { if (a === "OK") { await MediaService.remove(mediaId); MessageToast.show("Medya silindi."); await this.loadData(); } }
		});
	}
}
