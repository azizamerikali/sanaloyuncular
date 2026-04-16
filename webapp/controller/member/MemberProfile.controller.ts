import BaseController from "../BaseController";
import JSONModel from "sap/ui/model/json/JSONModel";
import MessageToast from "sap/m/MessageToast";
import AuthService from "../../service/AuthService";
import UserService from "../../service/UserService";
import formatter from "../../model/formatter";

/**
 * @namespace com.openui5.webdb.controller.member
 */
export default class MemberProfile extends BaseController {
	public onInit(): void {
		this.getRouter().getRoute("memberProfile").attachPatternMatched(this.onRouteMatched, this);
	}

	private async onRouteMatched(): Promise<void> {
		const user = AuthService.getCurrentUser();
		if (!user) return;
		const remoteUser = await UserService.getById(user.id);
		const fresh = remoteUser || user;
		const oModel = new JSONModel({
			...fresh,
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
			address: data.address
		});
		AuthService.updateSession({ ...AuthService.getCurrentUser(), ...data });
		MessageToast.show("Profil güncellendi!");
	}
}
