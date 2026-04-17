import BaseController from "../BaseController";
import JSONModel from "sap/ui/model/json/JSONModel";
import Filter from "sap/ui/model/Filter";
import FilterOperator from "sap/ui/model/FilterOperator";
import ApiClient from "../../service/ApiClient";
import Dialog from "sap/m/Dialog";
import Button from "sap/m/Button";
import ScrollContainer from "sap/m/ScrollContainer";
import Text from "sap/m/Text";

declare const jspdf: any;

/**
 * @namespace com.openui5.webdb.controller.admin
 */
export default class AdminLegal extends BaseController {

	public async onInit(): Promise<void> {
		this.loadRecords();
		
		// Load jsPDF library dynamically for PDF export
		if (typeof jspdf === "undefined") {
			sap.ui.dom.includeScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js", "jspdf-lib");
		}
	}

	private async loadRecords(): Promise<void> {
		const oPage = this.byId("adminLegalPage");
		oPage?.setBusy(true);
		try {
			const results = await ApiClient.get("/admin-legal/legal-records");
			this.getView().setModel(new JSONModel(results), "legalRecords");
		} catch (error) {
			console.error("Failed to load legal records", error);
		} finally {
			oPage?.setBusy(false);
		}
	}

	public onRefresh(): void {
		this.loadRecords();
	}

	public onSearch(oEvent: any): void {
		const sQuery = oEvent.getParameter("query");
		const oTable = this.byId("legalRecordsTable") as any;
		const oBinding = oTable.getBinding("items");

		if (sQuery) {
			const aFilters = [
				new Filter("email", FilterOperator.Contains, sQuery),
				new Filter("firstName", FilterOperator.Contains, sQuery),
				new Filter("lastName", FilterOperator.Contains, sQuery)
			];
			oBinding.filter(new Filter({ filters: aFilters, and: false }));
		} else {
			oBinding.filter([]);
		}
	}

	public onViewText(oEvent: any): void {
		const oContext = oEvent.getSource().getBindingContext("legalRecords");
		const oData = oContext.getObject();

		const oDialog = new Dialog({
			title: `${oData.firstName} ${oData.lastName} - Sözleşme Metni`,
			contentWidth: "700px",
			contentHeight: "500px",
			type: "Message",
			content: new ScrollContainer({
				height: "100%",
				width: "100%",
				vertical: true,
				content: new Text({
					text: oData.contractContent,
					renderWhitespace: true
				})
			}).addStyleClass("sapUiContentPadding"),
			endButton: new Button({
				text: "Kapat",
				press: () => oDialog.close()
			}),
			afterClose: () => oDialog.destroy()
		});

		oDialog.open();
	}

	public async onDownloadPDF(oEvent: any): Promise<void> {
		const oContext = oEvent.getSource().getBindingContext("legalRecords");
		const oData = oContext.getObject();

		if (typeof jspdf === "undefined") {
			sap.m.MessageToast.show("PDF kütüphanesi yükleniyor, lütfen birazdan tekrar deneyin.");
			return;
		}

		try {
			const { jsPDF } = jspdf;
			const doc = new jsPDF();
			
			// PDF Generation with basic formatting
			doc.setFontSize(16);
			doc.text("Kullanıcı Sözleşmesi Onay Belgesi", 10, 20);
			
			doc.setFontSize(10);
			doc.text(`Onaylayan: ${oData.firstName} ${oData.lastName}`, 10, 30);
			doc.text(`E-posta: ${oData.email}`, 10, 35);
			doc.text(`Onay Tarihi: ${new Date(oData.approvedAt).toLocaleString("tr-TR")}`, 10, 40);
			doc.text(`IP Adresi: ${oData.ipAddress}`, 10, 45);
			doc.text(`---------------------------------------------------------------------------------------------------`, 10, 50);

			doc.setFontSize(8);
			const splitText = doc.splitTextToSize(oData.contractContent, 180);
			doc.text(splitText, 10, 60);

			doc.save(`Sozlesme_${oData.firstName}_${oData.lastName}_${oData.id}.pdf`);
			sap.m.MessageToast.show("PDF başarıyla oluşturuldu.");
		} catch (error) {
			console.error("PDF generation failed", error);
			sap.m.MessageToast.show("PDF oluşturulurken bir hata oluştu.");
		}
	}
}
