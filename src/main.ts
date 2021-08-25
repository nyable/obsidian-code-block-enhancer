import { App, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { enhancerCodeBlock } from './core';
import './styles/index.scss'
interface CbEnhancerSettings {
	excludeLangs: string[];
	showLangName: boolean;
	showLineNumber: boolean;
}

const DEFAULT_SETTINGS: CbEnhancerSettings = {
	excludeLangs: ['todoist'],
	showLangName: true,
	showLineNumber: true
}
export default class CodeBlockEnhancer extends Plugin {
	settings: CbEnhancerSettings;

	async onload () {
		await this.loadSettings();
		await this.addSettingTab(new CbEnhancerSettingsTab(this.app, this))
		this.registerMarkdownPostProcessor(async (el, ctx) => {
			await enhancerCodeBlock(el, ctx, this)
		})
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
		containerEl.createEl('h2', { text: 'Code Block Enhancer Settings' })
		new Setting(containerEl)
			.setName('Exclude language list')
			.setDesc("Copy button does't display for excluded options")
			.addTextArea(text => text
				.setPlaceholder('Enter exclude language list,separated by ",": todoist,mindmap,...')
				.setValue(pluginSetting.excludeLangs.join(','))
				.onChange(async (value) => {
					pluginSetting.excludeLangs = value.split(',');
					await this.plugin.saveSettings();
				}))
		new Setting(containerEl)
			.setName('Show language name')
			.setDesc('Enable this options will display language name in left')
			.addToggle(cb => {
				cb
					.setValue(pluginSetting.showLangName)
					.onChange(async (isEnable) => {
						pluginSetting.showLangName = isEnable
						await this.plugin.saveSettings()
					})
			})
		new Setting(containerEl)
			.setName('Show line number')
			.setDesc('Enable this options will display line number')
			.addToggle(cb => {
				cb
					.setValue(pluginSetting.showLineNumber)
					.onChange(async (isEnable) => {
						pluginSetting.showLineNumber = isEnable
						await this.plugin.saveSettings()
					})
			})
	}
}
