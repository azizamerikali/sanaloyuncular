import BaseController from "../BaseController";
import JSONModel from "sap/ui/model/json/JSONModel";
import MessageToast from "sap/m/MessageToast";
import Event from "sap/ui/base/Event";
import UserService from "../../service/UserService";
import ProjectService from "../../service/ProjectService";
import PaymentService from "../../service/PaymentService";
import MediaService from "../../service/MediaService";
import formatter from "../../model/formatter";

/**
 * @namespace com.openui5.webdb.controller.admin
 */
export default class AdminDashboard extends BaseController {
	public onInit(): void {
		this.getRouter().getRoute("adminDashboard").attachPatternMatched(this.loadData, this);
	}

	private async loadData(): Promise<void> {
		const members = await UserService.getByRole("member");
		const pending = members.filter(m => m.status === "pending").map(m => ({
			...m, createdAtFormatted: formatter.formatDate(m.createdAt)
		}));

		const projectCount = await ProjectService.getCount();
		const mediaCount = await MediaService.getCount();
		const clients = await UserService.getByRole("client");
		const totalPaymentCount = await PaymentService.getCount();
		const paidTotal = await PaymentService.getTotalPaid();
		const unpaidTotal = await PaymentService.getTotalUnpaid();
		const totalAmount = paidTotal + unpaidTotal;

		const oModel = new JSONModel({
			memberCount: members.length.toString(),
			pendingCount: pending.length.toString(),
			projectCount: projectCount.toString(),
			mediaCount: mediaCount.toString(),
			clientCount: clients.length.toString(),
			totalPaymentCount: totalPaymentCount.toString(),
			paidTotal: formatter.formatCurrency(paidTotal),
			unpaidTotal: formatter.formatCurrency(unpaidTotal),
			totalAmount: formatter.formatCurrency(totalAmount),
			pendingMembers: pending
		});
		this.getView().setModel(oModel, "adminData");
	}

	public async onApproveMember(oEvent: Event): Promise<void> {
		const oCtx = (oEvent.getSource() as any).getBindingContext("adminData");
		await UserService.approve(oCtx.getProperty("id"));
		MessageToast.show(oCtx.getProperty("firstName") + " onaylandı!");
		await this.loadData();
	}

	public onNavToMembers(): void {
		this.getRouter().navTo("adminMembers");
	}

	public onNavToProjects(): void {
		this.getRouter().navTo("adminProjects");
	}

	public onNavToPayments(): void {
		this.getRouter().navTo("adminPayments");
	}

	public onNavToMedia(): void {
		this.getRouter().navTo("adminMedia");
	}

	public onNavToClients(): void {
		this.getRouter().navTo("adminClients");
	}

	public onMemberPress(oEvent: Event): void {
		const oCtx = (oEvent.getSource() as any).getBindingContext("adminData");
		this.getRouter().navTo("adminMemberDetail", {
			memberId: oCtx.getProperty("id")
		});
	}
}
