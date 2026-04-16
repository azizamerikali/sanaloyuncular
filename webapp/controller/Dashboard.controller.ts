import BaseController from "./BaseController";
import JSONModel from "sap/ui/model/json/JSONModel";
import UserService from "../service/UserService";
import ProjectService from "../service/ProjectService";
import PaymentService from "../service/PaymentService";
import MediaService from "../service/MediaService";
import AuthService from "../service/AuthService";
import formatter from "../model/formatter";

/**
 * @namespace com.openui5.webdb.controller
 */
export default class Dashboard extends BaseController {
	public formatter = formatter;

	public onInit(): void {
		this.getRouter().getRoute("dashboard").attachPatternMatched(this.onRouteMatched, this);
	}

	private async onRouteMatched(): Promise<void> {
		const user = AuthService.getCurrentUser();
		if (!user) return;

		let projects = await ProjectService.getAll();
		if (user.role === "member") {
			const assignments = await ProjectService.getAssignmentsByUser(user.id);
			projects = projects.filter(p => assignments.some(a => a.projectId === p.id));
		}
		
		const payments = user.role === "member"
			? await PaymentService.getByUser(user.id)
			: await PaymentService.getAll();

		const mediaCount = user.role === "member" 
			? await MediaService.getCountByUser(user.id) 
			: await MediaService.getCount();
			
		const totalAmount = user.role === "member"
			? payments.reduce((sum, p) => sum + p.netAmount, 0)
			: (await PaymentService.getTotalPaid()) + (await PaymentService.getTotalUnpaid());

		const oModel = new JSONModel({
			projectCount: projects.length.toString(),
			paymentCount: payments.length.toString(),
			mediaCount: mediaCount.toString(),
			paidTotal: formatter.formatCurrency(totalAmount),
			recentProjects: projects.slice(0, 5),
			recentPayments: payments.slice(0, 5)
		});
		this.getView().setModel(oModel, "dashData");
	}

	public onMediaPress(): void {
		this.getRouter().navTo("memberPhotos");
	}

	public onProjectPress(): void {
		this.getRouter().navTo("memberProjects");
	}

	public onPaymentPress(): void {
		this.getRouter().navTo("memberPayments");
	}
}
