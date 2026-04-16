import JSONModel from "sap/ui/model/json/JSONModel";
import BindingMode from "sap/ui/model/BindingMode";
import Device from "sap/ui/Device";

export default {
	createDeviceModel: () => {
		const oModel = new JSONModel(Device);
		oModel.setDefaultBindingMode(BindingMode.OneWay);
		return oModel;
	},

	createAppViewModel: () => {
		const bIsPhone = Device.system.phone;
		const oModel = new JSONModel({
			isLoggedIn: false,
			showShell: false,
			sideExpanded: !bIsPhone,
			selectedKey: "dashboard",
			currentRole: "",
			currentUserName: "",
			userInitials: "",
			busy: false
		});
		oModel.setDefaultBindingMode(BindingMode.TwoWay);
		return oModel;
	}
};
