import { App, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import './styles/index.scss'
interface CbEnhancerSettings {
	excludeLangs: string[];
	displayLangName: boolean;
}

const DEFAULT_SETTINGS: CbEnhancerSettings = {
	excludeLangs: [],
	displayLangName: true
}
export default class CodeBlockEnhancer extends Plugin {
	settings: CbEnhancerSettings;

	async onload () {
		console.log('loading Code Block Enhancer Plugin');

		await this.loadSettings()
		await this.addSettingTab(new CbEnhancerSettingsTab(this.app, this))
	}

	onunload () {
		console.log('Unloading Code Block Enhancer Plugin');
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
		let { containerEl } = this
		const pluginSetting = this.plugin.settings
		containerEl.empty()
		containerEl.createEl('h2', { text: 'Code Block Copy Setting' })
		new Setting(containerEl)
			.setName('Exclude Language List')
			.setDesc("Copy button does't display for excluded options")
			.addTextArea(text => text
				.setPlaceholder('Enter exclude language list,separated by ",": todoist,mindmap,...')
				.setValue(pluginSetting.excludeLangs.join(','))
				.onChange(async (value) => {
					pluginSetting.excludeLangs = value.split(',');
					await this.plugin.saveSettings();
				}))
		new Setting(containerEl)
			.setName('Display Language Name')
			.setDesc('Enable this options will display language name in left')
			.addToggle(cb => {
				cb
					.setValue(pluginSetting.displayLangName)
					.onChange(async (isEnable) => {
						pluginSetting.displayLangName = isEnable
						await this.plugin.saveSettings()
					})
			})
	}
}
