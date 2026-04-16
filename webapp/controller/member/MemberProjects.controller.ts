import BaseController from "../BaseController";
import JSONModel from "sap/ui/model/json/JSONModel";
import AuthService from "../../service/AuthService";
import ProjectService from "../../service/ProjectService";
import formatter from "../../model/formatter";

/**
 * @namespace com.openui5.webdb.controller.member
 */
export default class MemberProjects extends BaseController {
	public onInit(): void {
		this.getRouter().getRoute("memberProjects").attachPatternMatched(this.onRouteMatched, this);
	}

	private async onRouteMatched(): Promise<void> {
		const user = AuthService.getCurrentUser();
		if (!user) return;
		const assignments = await ProjectService.getAssignmentsByUser(user.id);
		const projects = [];
		for (const a of assignments) {
			const p = await ProjectService.getById(a.projectId);
			if (p) {
				projects.push({
					...p,
					statusText: formatter.formatStatus(p.status),
					statusState: formatter.formatStatusState(p.status),
					createdAtFormatted: formatter.formatDate(p.createdAt)
				});
			}
		}
		this.getView().setModel(new JSONModel({ projects }), "projData");
	}
}
