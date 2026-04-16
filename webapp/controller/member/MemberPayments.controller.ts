import BaseController from "../BaseController";
import JSONModel from "sap/ui/model/json/JSONModel";
import AuthService from "../../service/AuthService";
import PaymentService from "../../service/PaymentService";
import ProjectService from "../../service/ProjectService";
import formatter from "../../model/formatter";

/**
 * @namespace com.openui5.webdb.controller.member
 */
export default class MemberPayments extends BaseController {
	public onInit(): void {
		this.getRouter().getRoute("memberPayments").attachPatternMatched(this.onRouteMatched, this);
	}

	private async onRouteMatched(): Promise<void> {
		const user = AuthService.getCurrentUser();
		if (!user) return;
		const paymentList = await PaymentService.getByUser(user.id);
		const payments = [];
		for (const p of paymentList) {
			const proj = await ProjectService.getById(p.projectId);
			payments.push({
				...p,
				projectName: proj ? proj.name : "-",
				grossFormatted: formatter.formatCurrency(p.grossAmount),
				deductionFormatted: formatter.formatCurrency(p.deduction),
				netFormatted: formatter.formatCurrency(p.netAmount),
				statusText: formatter.formatStatus(p.status),
				statusState: formatter.formatStatusState(p.status)
			});
		}
		this.getView().setModel(new JSONModel({ payments }), "payData");
	}
}
