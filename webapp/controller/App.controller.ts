import BaseController from "./BaseController";
import JSONModel from "sap/ui/model/json/JSONModel";
import Event from "sap/ui/base/Event";
import NavigationListItem from "sap/tnt/NavigationListItem";
import NavigationList from "sap/tnt/NavigationList";
import AuthService from "../service/AuthService";

interface NavItem {
	key: string;
	title: string;
	icon: string;
	route: string;
}

const NAV_ITEMS: Record<string, NavItem[]> = {
	admin: [
		{ key: "adminDashboard", title: "adminDashboardTitle", icon: "sap-icon://home", route: "adminDashboard" },
		{ key: "adminMembers", title: "adminMembers", icon: "sap-icon://group", route: "adminMembers" },
		{ key: "adminProjects", title: "adminProjects", icon: "sap-icon://project-definition-triangle-2", route: "adminProjects" },
		{ key: "adminPayments", title: "adminPayments", icon: "sap-icon://money-bills", route: "adminPayments" },
		{ key: "adminClients", title: "adminClients", icon: "sap-icon://customer", route: "adminClients" },
		{ key: "adminMedia", title: "adminMedia", icon: "sap-icon://photo-voltaic", route: "adminMedia" },
		{ key: "adminLegal", title: "adminLegal", icon: "sap-icon://official-service", route: "adminLegal" },
		{ key: "adminSystem", title: "settings", icon: "sap-icon://settings", route: "adminSystem" }
	],
	member: [
		{ key: "dashboard", title: "dashboardTitle", icon: "sap-icon://home", route: "dashboard" },
		{ key: "memberProfile", title: "memberProfile", icon: "sap-icon://person-placeholder", route: "memberProfile" },
		{ key: "memberPhotos", title: "memberPhotos", icon: "sap-icon://camera", route: "memberPhotos" },
		{ key: "memberProjects", title: "memberProjects", icon: "sap-icon://project-definition-triangle-2", route: "memberProjects" },
		{ key: "memberPayments", title: "memberPayments", icon: "sap-icon://money-bills", route: "memberPayments" }
	],
	client: [
		{ key: "clientDashboard", title: "dashboardTitle", icon: "sap-icon://home", route: "clientDashboard" },
		{ key: "clientMembers", title: "clientMembers", icon: "sap-icon://group", route: "clientMembers" },
		{ key: "clientProjects", title: "clientProjects", icon: "sap-icon://project-definition-triangle-2", route: "clientProjects" }
	]
};

/**
 * @namespace com.openui5.webdb.controller
 */
export default class App extends BaseController {
	public onInit(): void {
		this.getView().addStyleClass(this.getOwnerComponent().getContentDensityClass());

		const oRouter = this.getRouter();
		oRouter.attachRouteMatched(this.onRouteMatched, this);
	}

	private getAppViewModel(): JSONModel {
		return this.getOwnerComponent().getModel("appView") as JSONModel;
	}

	private onRouteMatched(oEvent: Event): void {
		const sRouteName = (oEvent.getParameter("name") as string) || "";
		const isAuthPage = sRouteName === "login" || sRouteName === "register";
		const oAppView = this.getAppViewModel();

		// On first routed event, check if already logged in from previous session
		if (!isAuthPage && !AuthService.isLoggedIn()) {
			this.getRouter().navTo("login", {}, undefined, true);
			return;
		}

		if (isAuthPage && AuthService.isLoggedIn()) {
			// Already logged in, restore session state
			const user = AuthService.getCurrentUser();
			if (user) {
				this.setLoggedInState(user.firstName, user.lastName, user.email, user.role, user.profilePicture);
				this.navigateByRole(user.role);
				return;
			}
		}

		oAppView.setProperty("/showShell", !isAuthPage);
		if (!isAuthPage) {
			oAppView.setProperty("/selectedKey", sRouteName);
			// Ensure navigation is built if coming from a direct URL
			if (!oAppView.getProperty("/isLoggedIn") && AuthService.isLoggedIn()) {
				const user = AuthService.getCurrentUser();
				if (user) {
					this.setLoggedInState(user.firstName, user.lastName, user.email, user.role, user.profilePicture);
				}
			}
		}
	}

	private setLoggedInState(firstName: string, lastName: string, email: string, role: string, profilePicture?: string): void {
		const oAppView = this.getAppViewModel();
		oAppView.setProperty("/isLoggedIn", true);
		oAppView.setProperty("/showShell", true);
		oAppView.setProperty("/currentRole", role);
		oAppView.setProperty("/currentUserName", firstName + " " + lastName);
		oAppView.setProperty("/currentUserEmail", email);
		
		let sInitials = "";
		if (firstName && lastName) {
			sInitials = (firstName.charAt(0) + lastName.charAt(0)).toUpperCase();
		} else if (email) {
			sInitials = email.substring(0, 2).toUpperCase();
		}
		oAppView.setProperty("/userInitials", sInitials);
		oAppView.setProperty("/userProfilePicture", profilePicture || "");
		this.buildNavigation(role);
	}

	private async buildNavigation(role: string): Promise<void> {
		const oNavList = this.byId("navList") as NavigationList;
		if (!oNavList) return;
		oNavList.destroyItems();

		const oBundle = await this.getResourceBundle();
		const items = NAV_ITEMS[role] || [];
		items.forEach((item: NavItem) => {
			oNavList.addItem(new NavigationListItem({
				text: oBundle.getText(item.title) || item.title,
				icon: item.icon,
				key: item.key
			}));
		});
	}

	private navigateByRole(role: string): void {
		switch (role) {
			case "admin":
				this.getRouter().navTo("adminDashboard", {}, undefined, true);
				break;
			case "client":
				this.getRouter().navTo("clientDashboard", {}, undefined, true);
				break;
			default:
				this.getRouter().navTo("dashboard", {}, undefined, true);
				break;
		}
	}

	public onNavItemSelect(oEvent: Event): void {
		const oItem = oEvent.getParameter("item") as NavigationListItem;
		const sKey = oItem.getKey();

		if (sKey === "logout") {
			this.onLogout();
			return;
		}

		const role = this.getAppViewModel().getProperty("/currentRole");
		const items = NAV_ITEMS[role] || [];
		const navItem = items.find((i: NavItem) => i.key === sKey);
		if (navItem) {
			this.getRouter().navTo(navItem.route);
		}
	}

	public onToggleSideNav(): void {
		const oAppView = this.getAppViewModel();
		oAppView.setProperty("/sideExpanded", !oAppView.getProperty("/sideExpanded"));
	}

	public onLogout(): void {
		AuthService.logout();
		const oAppView = this.getAppViewModel();
		oAppView.setProperty("/isLoggedIn", false);
		oAppView.setProperty("/showShell", false);
		oAppView.setProperty("/currentRole", "");
		oAppView.setProperty("/currentUserName", "");
		oAppView.setProperty("/currentUserEmail", "");
		oAppView.setProperty("/userInitials", "");
		oAppView.setProperty("/userProfilePicture", "");
		this.getRouter().navTo("login", {}, undefined, true);
	}

	/**
	 * Called from Login controller after successful login
	 */
	public loginSuccess(firstName: string, lastName: string, email: string, role: string, profilePicture?: string): void {
		this.setLoggedInState(firstName, lastName, email, role, profilePicture);
	}
}
