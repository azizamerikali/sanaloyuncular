import BaseController from "../BaseController";
import JSONModel from "sap/ui/model/json/JSONModel";
import AuthService from "../../service/AuthService";
import UserService from "../../service/UserService";
import ProjectService from "../../service/ProjectService";
import StorageService from "../../service/StorageService";
import type { IFavorite } from "../../model/MockData";

/**
 * @namespace com.openui5.webdb.controller.client
 */
export default class ClientDashboard extends BaseController {
	public onInit(): void {
		this.getRouter().getRoute("clientDashboard").attachPatternMatched(this.loadData, this);
	}

	private async loadData(): Promise<void> {
		const user = AuthService.getCurrentUser();
		if (!user) return;
		
		const allProjects = await ProjectService.getAll();
		const projects = allProjects.filter(p => p.createdBy === user.id);
		
		const members = await UserService.getByRole("member");
		const activeMembersCount = members.filter(m => m.status === "active").length;

		this.getView().setModel(new JSONModel({
			favCount: "0", // Favorites API to be implemented correctly if used
			projCount: projects.length.toString(),
			memberCount: activeMembersCount.toString()
		}), "cDashData");
	}

	public onNavToProjects(): void {
		this.getRouter().navTo("clientProjects");
	}

	public onNavToMembers(): void {
		this.getRouter().navTo("clientMembers");
	}
}
