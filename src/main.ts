import { App, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import './styles/index.scss'
interface CbEnhancerSettings {
	excludeLangList: string[];
	displayLangName: boolean;
}

const DEFAULT_SETTINGS: CbEnhancerSettings = {
	excludeLangList: [],
	displayLangName: true
}
export default class CodeBlockEnhancer extends Plugin {
	settings: CbEnhancerSettings;

	async onload () {
		await this.loadSettings()
		await this.addSettingTab(new CbEnhancerSettingsTab(this.app, this))
	}

	onunload () {
		console.log('unloading plugin');
	}

	async loadSettings () {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings () {
		await this.saveData(this.settings);
	}
}


class CbEnhancerSettingsTab extends PluginSettingTab {
	plugin: CodeBlockEnhancer;

	constructor(app: App, plugin: CodeBlockEnhancer) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display (): void {
		let { containerEl } = this;

	}
}
