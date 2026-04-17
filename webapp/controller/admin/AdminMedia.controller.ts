import BaseController from "../BaseController";
import JSONModel from "sap/ui/model/json/JSONModel";
import MessageToast from "sap/m/MessageToast";
import MessageBox from "sap/m/MessageBox";
import Event from "sap/ui/base/Event";
import Filter from "sap/ui/model/Filter";
import FilterOperator from "sap/ui/model/FilterOperator";
import ListBinding from "sap/ui/model/ListBinding";
import Dialog from "sap/m/Dialog";
import Button from "sap/m/Button";
import Image from "sap/m/Image";
import MediaService from "../../service/MediaService";
import UserService from "../../service/UserService";
import formatter from "../../model/formatter";

/**
 * @namespace com.openui5.webdb.controller.admin
 */
export default class AdminMedia extends BaseController {
	private _previewDialog: Dialog | null = null;

	public onInit(): void {
		this.getRouter().getRoute("adminMedia").attachPatternMatched(this.loadData, this);
	}

	private async loadData(): Promise<void> {
		const mediaList = await MediaService.getAll();
		const media = [];
		for (const m of mediaList) {
			const user = await UserService.getById(m.userId);
			media.push({ 
				...m, 
				memberName: user ? `${user.firstName} ${user.lastName}` : "-", 
				createdAtFormatted: formatter.formatDate(m.createdAt) 
			});
		}
		this.getView().setModel(new JSONModel({ media }), "mediaPoolData");
	}

	public onSearch(oEvent: Event): void {
		const sQuery = oEvent.getParameter("newValue") || oEvent.getParameter("query") || "";
		const oTable = this.getView().byId("adminMediaTable") as any;
		const oBinding = oTable.getBinding("items") as ListBinding;
		
		if (sQuery) {
			const oFilter = new Filter({
				filters: [
					new Filter("fileName", FilterOperator.Contains, sQuery),
					new Filter("memberName", FilterOperator.Contains, sQuery)
				],
				and: false
			});
			oBinding.filter([oFilter]);
		} else {
			oBinding.filter([]);
		}
	}

	public onImagePress(oEvent: Event): void {
		const oAvatar = oEvent.getSource() as any;
		const sSrc = oAvatar.getSrc();
		const sTitle = oAvatar.getBindingContext("mediaPoolData").getProperty("fileName");

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
				}),
				afterClose: () => {
					// Don't destroy, just reuse
				}
			});
			this.getView().addDependent(this._previewDialog);
		} else {
			this._previewDialog.setTitle(sTitle);
			(this._previewDialog.getContent()[0] as Image).setSrc(sSrc);
		}

		this._previewDialog.open();
	}

	public onDeleteMedia(oEvent: Event): void {
		const oCtx = (oEvent.getSource() as any).getBindingContext("mediaPoolData");
		const mediaId = oCtx.getProperty("id");
		MessageBox.confirm("Bu medyayı silmek istediğinize emin misiniz?", {
			onClose: async (a: string) => { 
				if (a === "OK") { 
					await MediaService.remove(mediaId); 
					MessageToast.show("Medya silindi."); 
					await this.loadData(); 
				} 
			}
		});
	}
}
