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
		const firstNames = new Set<string>();
		const lastNames = new Set<string>();
		const emails = new Set<string>();
		const fileNames = new Set<string>();

		for (const m of mediaList) {
			const user = await UserService.getById(m.userId);
			const status = user ? user.status : "inactive";
			let statusState = "None";
			if (status === "active") statusState = "Success";
			else if (status === "inactive") statusState = "Warning"; // User requested yellow for Passive
			else if (status === "pending") statusState = "Information";

			const item = { 
				...m, 
				memberName: user ? `${user.firstName} ${user.lastName}` : "-",
				firstName: user ? user.firstName : "",
				lastName: user ? user.lastName : "",
				email: user ? user.email : "",
				memberStatus: status,
				memberStatusText: formatter.formatStatus(status),
				statusState: statusState,
				createdAtFormatted: formatter.formatDate(m.createdAt) 
			};
			media.push(item);
			
			if (item.firstName) firstNames.add(item.firstName);
			if (item.lastName) lastNames.add(item.lastName);
			if (item.email) emails.add(item.email);
			if (item.fileName) fileNames.add(item.fileName);
		}

		this.getView().setModel(new JSONModel({ 
			media,
			suggestions: {
				firstNames: Array.from(firstNames).map(s => ({ text: s })),
				lastNames: Array.from(lastNames).map(s => ({ text: s })),
				emails: Array.from(emails).map(s => ({ text: s })),
				fileNames: Array.from(fileNames).map(s => ({ text: s }))
			}
		}), "mediaPoolData");
	}

	public onFilter(): void {
		const oView = this.getView();
		const sName = (oView.byId("filterFirstName") as any).getValue();
		const sSurname = (oView.byId("filterLastName") as any).getValue();
		const sEmail = (oView.byId("filterEmail") as any).getValue();
		const sFile = (oView.byId("filterFileName") as any).getValue();
		const sStatus = (oView.byId("filterStatus") as any).getSelectedKey();

		const aFilters = [];
		if (sName) aFilters.push(new Filter("firstName", FilterOperator.Contains, sName));
		if (sSurname) aFilters.push(new Filter("lastName", FilterOperator.Contains, sSurname));
		if (sEmail) aFilters.push(new Filter("email", FilterOperator.Contains, sEmail));
		if (sFile) aFilters.push(new Filter("fileName", FilterOperator.Contains, sFile));
		
		if (sStatus && sStatus !== "all") {
			aFilters.push(new Filter("memberStatus", FilterOperator.EQ, sStatus));
		}

		const oGallery = this.getView().byId("adminMediaGallery") as any;
		const oBinding = oGallery.getBinding("items") as ListBinding;
		
		if (aFilters.length > 0) {
			oBinding.filter(new Filter({
				filters: aFilters,
				and: true
			}));
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

	public onMemberPress(oEvent: Event): void {
		const oCtx = (oEvent.getSource() as any).getBindingContext("mediaPoolData");
		const userId = oCtx.getProperty("userId");
		this.getRouter().navTo("adminMemberDetail", { memberId: userId });
	}
}
