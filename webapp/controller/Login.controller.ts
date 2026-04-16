import BaseController from "./BaseController";
import MessageToast from "sap/m/MessageToast";
import Event from "sap/ui/base/Event";
import Controller from "sap/ui/core/mvc/Controller";
import Input from "sap/m/Input";
import AuthService from "../service/AuthService";
import UserService from "../service/UserService";
import JSONModel from "sap/ui/model/json/JSONModel";

/**
 * @namespace com.openui5.webdb.controller
 */
export default class Login extends BaseController {

	public async onLoginPress(): Promise<void> {
		const usernameInput = this.byId("usernameInput") as Input;
		const passwordInput = this.byId("passwordInput") as Input;
		
		const userId = usernameInput.getValue().trim();
		const password = passwordInput.getValue().trim();

		if (!userId || !password) {
			MessageToast.show("Lütfen kullanıcı adı ve şifrenizi giriniz.");
			return;
		}

		await this.loginAsUser(userId, password);
	}

	public async onInit(): Promise<void> {
		this.getRouter().getRoute("login").attachPatternMatched(this.onRouteMatched, this);
	}

	private async onRouteMatched(): Promise<void> {
		await this.loadGoogleScript();
		const google = (window as any).google;
		if (google) {
			google.accounts.id.initialize({
				client_id: "50993658634-7hoto049cjs26qks8m8pd87juoj96h11.apps.googleusercontent.com",
				callback: this.handleGoogleCredentialResponse.bind(this)
			});
			setTimeout(() => {
				const btnContainer = document.getElementById("googleButtonContainer");
				if (btnContainer) {
					google.accounts.id.renderButton(btnContainer, { 
						theme: "outline", 
						size: "large", 
						type: "standard", 
						width: "350",
						text: "continue_with"
					});
				}
			}, 500); 
		}
	}

	private loadGoogleScript(): Promise<void> {
		return new Promise((resolve) => {
			if ((window as any).google && (window as any).google.accounts) {
				resolve();
				return;
			}
			const script = document.createElement("script");
			script.src = "https://accounts.google.com/gsi/client";
			script.async = true;
			script.defer = true;
			script.onload = () => resolve();
			document.head.appendChild(script);
		});
	}

	private async handleGoogleCredentialResponse(response: any): Promise<void> {
		const idToken = response.credential;
		const result = await AuthService.googleLogin(idToken);
		
		if (result.success && result.user) {
			const user = result.user;
			const oComponent = this.getOwnerComponent();
			const oRootView = oComponent.getRootControl();
			const oAppController = oRootView.getController() as any;
			if (oAppController && oAppController.loginSuccess) {
				oAppController.loginSuccess(user.firstName, user.lastName, user.email, user.role, user.profilePicture);
			}
			switch (user.role) {
				case "admin": this.getRouter().navTo("adminDashboard", {}, undefined, true); break;
				case "client": this.getRouter().navTo("clientDashboard", {}, undefined, true); break;
				default: this.getRouter().navTo("dashboard", {}, undefined, true); break;
			}
		} else if (result.notFound && result.googlePayload) {
			this.getOwnerComponent().setModel(new JSONModel(result.googlePayload), "googleRegisterDraft");
			MessageToast.show("Google hesabınız kayıtlı değil. Lütfen bilgilerinizi onaylayarak kaydolun.");
			this.getRouter().navTo("register");
		} else {
			MessageToast.show(result.error || "Google Girişi Başarısız.");
		}
	}

	private async loginAsUser(userId: string, password?: string): Promise<void> {
		try {
			const user = await AuthService.login(userId, password);
			if (user) {
				// Get the App controller and notify it
				const oComponent = this.getOwnerComponent();
				const oRootView = oComponent.getRootControl();
				const oAppController = oRootView.getController() as any;
				if (oAppController && oAppController.loginSuccess) {
					oAppController.loginSuccess(user.firstName, user.lastName, user.email, user.role, user.profilePicture);
				}
				// Navigate based on role
				switch (user.role) {
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
			} else {
				MessageToast.show("Giriş başarısız! Kullanıcı aktif değil.");
			}
		} catch (error: any) {
			MessageToast.show(error.message || "Giriş sırasında bir hata oluştu.");
		}
	}

	public onGoToRegister(): void {
		this.getRouter().navTo("register");
	}
}
