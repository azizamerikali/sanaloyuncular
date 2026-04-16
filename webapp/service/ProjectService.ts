import ApiClient from "./ApiClient";
import type { IProject, IAssignment } from "../model/MockData";

/**
 * @namespace com.openui5.webdb.service
 */
const ProjectService = {
	async getAll(): Promise<IProject[]> {
		return ApiClient.get<IProject[]>("/projects");
	},

	async getById(id: string): Promise<IProject | undefined> {
		try {
			return await ApiClient.get<IProject>(`/projects/${id}`);
		} catch {
			return undefined;
		}
	},

	async create(proj: Partial<IProject>): Promise<IProject> {
		return ApiClient.post<IProject>("/projects", proj);
	},

	async update(id: string, data: Partial<IProject>): Promise<IProject | null> {
		try {
			return await ApiClient.put<IProject>(`/projects/${id}`, data);
		} catch {
			return null;
		}
	},

	async remove(id: string): Promise<boolean> {
		try {
			await ApiClient.del(`/projects/${id}`);
			return true;
		} catch {
			return false;
		}
	},

	// Assignments
	async getAllAssignments(): Promise<IAssignment[]> {
		return ApiClient.get<IAssignment[]>("/assignments");
	},

	async getAssignmentsByProject(projectId: string): Promise<IAssignment[]> {
		return ApiClient.get<IAssignment[]>(`/assignments?projectId=${projectId}`);
	},

	async getAssignmentsByUser(userId: string): Promise<IAssignment[]> {
		return ApiClient.get<IAssignment[]>(`/assignments?userId=${userId}`);
	},

	async assignMember(projectId: string, userId: string): Promise<IAssignment> {
		return ApiClient.post<IAssignment>("/assignments", { projectId, userId });
	},

	async removeMember(projectId: string, userId: string): Promise<boolean> {
		try {
			await ApiClient.del(`/assignments/${projectId}/${userId}`);
			return true;
		} catch {
			return false;
		}
	},

	async getCount(): Promise<number> {
		const data = await ApiClient.get<{ count: number }>("/projects/count");
		return data.count;
	}
};

export default ProjectService;
