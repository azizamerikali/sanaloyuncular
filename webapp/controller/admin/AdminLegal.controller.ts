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

		// Safe check for jsPDF
		const jspdfLib = (window as any).jspdf || (window as any).jsPDF;

		if (!jspdfLib) {
			sap.m.MessageToast.show("PDF kütüphanesi yükleniyor, lütfen birazdan tekrar deneyin.");
			return;
		}

		try {
			// Extract constructor reliably
			const jsPDFConstructor = jspdfLib.jsPDF || jspdfLib;
			const doc = new jsPDFConstructor();
			
			// Helper to normalize Turkish characters for default PDF fonts
			const normalizeText = (text: string) => {
				return (text || "")
					.replace(/ğ/g, "g").replace(/Ğ/g, "G")
					.replace(/ü/g, "u").replace(/Ü/g, "U")
					.replace(/ş/g, "s").replace(/Ş/g, "S")
					.replace(/ı/g, "i").replace(/İ/g, "I")
					.replace(/ö/g, "o").replace(/Ö/g, "O")
					.replace(/ç/g, "c").replace(/Ç/g, "C");
			};

			// PDF Generation - Refined for single page fit
			doc.setFont("helvetica", "bold");
			doc.setFontSize(12);
			doc.text("Kullanici Sozlesmesi Onay Belgesi", 10, 12);
			
			doc.setFont("helvetica", "normal");
			doc.setFontSize(8);
			doc.text(`Onaylayan: ${normalizeText(oData.firstName)} ${normalizeText(oData.lastName)}`, 10, 18);
			doc.text(`E-posta: ${oData.email}`, 10, 22);
			doc.text(`Onay Tarihi: ${new Date(oData.approvedAt).toLocaleString("tr-TR")}`, 10, 26);
			doc.text(`IP Adresi: ${oData.ipAddress}`, 10, 30);
			doc.text("---------------------------------------------------------------------------------------------------", 10, 34);

			doc.setFontSize(6.8);
			const safeContent = normalizeText(oData.contractContent || "Icerik bulunamadi.");
			const splitText = doc.splitTextToSize(safeContent, 188);
			
			// Start point moved up to allow more lines
			doc.text(splitText, 10, 40);

			doc.save(`Sozlesme_${normalizeText(oData.firstName)}_${oData.id}.pdf`);
			sap.m.MessageToast.show("PDF başarıyla oluşturuldu.");
		} catch (error) {
			console.error("PDF generation failed", error);
			sap.m.MessageToast.show("PDF oluşturulurken bir hata oluştu.");
		}
	}
}
