import type {SuiteConfiguration} from "sap/ui/test/starter/config";
export default {
	name: "QUnit test suite for the UI5 Application: com.openui5.webdb",
	defaults: {
		page: "ui5://test-resources/com/openui5/webdb/Test.qunit.html?testsuite={suite}&test={name}",
		qunit: {
			version: 2
		},
		sinon: {
			version: 4
		},
		ui5: {
			language: "EN",
			theme: "sap_horizon"
		},
		coverage: {
			only: ["com/openui5/webdb/"],
			never: ["test-resources/com/openui5/webdb/"]
		},
		loader: {
			paths: {
				"com/openui5/webdb": "../"
			}
		}
	},
	tests: {
		"unit/unitTests": {
			title: "Unit tests for com.openui5.webdb"
		},
		"integration/opaTests": {
			title: "Integration tests for com.openui5.webdb"
		}
	}
} satisfies SuiteConfiguration;