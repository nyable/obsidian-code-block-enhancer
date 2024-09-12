import { App, debounce, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { CbeCssVar, CodeBlockPlus } from './core';

// Remember to rename these classes and interfaces!
interface CbeSettings {
    /**
     * 排除的语言
     */
    excludeLangs: string[];
    /**
     * 是否展示语言名称
     */
    showLangName: boolean;

    /**
     * 是否增强右键菜单栏
     */
    useContextMenu: boolean;
    /**
     * 是否展示行号
     */
    showLineNumber: boolean;
    /**
     * 行号的颜色
     */
    linenumFontColor: string;
    /**
     * 行号高亮的颜色
     */
    linenumHighlightColor: string;
}

const DEFAULT_SETTINGS: CbeSettings = {
    excludeLangs: ['todoist'],
    showLangName: true,
    useContextMenu: true,
    showLineNumber: true,
    linenumFontColor: 'var(--code-normal)',
    linenumHighlightColor: 'rgba(255, 255, 0, 0.1)'
};
export default class CodeBlockEnhancerPlugin extends Plugin {
    settings: CbeSettings;

    private async setCssVar() {
        const settings = this.settings;
        const { linenumFontColor, linenumHighlightColor } = settings;
        if (!linenumFontColor) {
            settings.linenumFontColor = DEFAULT_SETTINGS.linenumFontColor;
        }
        if (!linenumHighlightColor) {
            settings.linenumHighlightColor = DEFAULT_SETTINGS.linenumHighlightColor;
        }
        document.body.style.setProperty(CbeCssVar.linenumColor, settings.linenumFontColor);
        document.body.style.setProperty(
            CbeCssVar.linenumHighlightColor,
            settings.linenumHighlightColor
        );
        await this.saveSettings();
    }
    async onload() {
        await this.loadSettings();
        this.addSettingTab(new CbeSettingsTab(this.app, this));

        this.setCssVar();

        const cbp = new CodeBlockPlus(this);
        this.registerMarkdownPostProcessor((el, ctx) => {
            cbp.enhanceCodeBlock(el, ctx);
        });
        this.app.workspace.on(
            'resize',
            debounce(() => {
                cbp.updateLineNumber();
            }, 350)
        );
        console.log('Load Code Block Enhancer Plugin!');
    }

    onunload() {
        console.log('Unloading Code Block Enhancer Plugin');
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }
}

class CbeSettingsTab extends PluginSettingTab {
    plugin: CodeBlockEnhancerPlugin;

    constructor(app: App, plugin: CodeBlockEnhancerPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        const pluginSetting = this.plugin.settings;
        containerEl.empty();
        containerEl.createEl('h1', {
            text: `Code Block Enhancer Settings ${this.plugin.manifest.version}`
        });
        new Setting(containerEl).setName('General').setHeading();
        new Setting(containerEl)
            .setName('Exclude language list')
            .setDesc('Code blocks excluded from the language will not be processed by the plugin')
            .addTextArea((text) =>
                text
                    .setPlaceholder('Separate by `,` (like `todoist,other,...`)')
                    .setValue(pluginSetting.excludeLangs.join(','))
                    .onChange(async (value) => {
                        pluginSetting.excludeLangs = value.split(',');
                        await this.plugin.saveSettings();
                    })
            );
        new Setting(containerEl)
            .setName('Show language name')
            .setDesc('Display the language name of the code block when enabled')
            .addToggle((cb) => {
                cb.setValue(pluginSetting.showLangName).onChange(async (isEnable) => {
                    pluginSetting.showLangName = isEnable;
                    await this.plugin.saveSettings();
                });
            });

        // new Setting(containerEl)
        //     .setName('Use ContextMenu')
        //     .setDesc('Enhance the right-click menu in code block preview mode')
        //     .addToggle((cb) => {
        //         cb.setValue(pluginSetting.useContextMenu).onChange(async (isEnable) => {
        //             pluginSetting.useContextMenu = isEnable;
        //             await this.plugin.saveSettings();
        //         });
        //     });

        new Setting(containerEl).setName('Line number').setHeading();
        new Setting(containerEl)
            .setName('Show line number')
            .setDesc('Show row numbers when enabled')
            .addToggle((cb) => {
                cb.setValue(pluginSetting.showLineNumber).onChange(async (isEnable) => {
                    pluginSetting.showLineNumber = isEnable;
                    await this.plugin.saveSettings();
                });
            });
        new Setting(containerEl)
            .setName('Line number font color')
            .setDesc('Such as :#ed9c9fcc/rgba(237,156,159,0.8)/var(--code-normal)')
            .addText((cb) => {
                cb.setValue(pluginSetting.linenumFontColor).onChange(async (value) => {
                    pluginSetting.linenumFontColor = value;
                    document.body.style.setProperty(
                        CbeCssVar.linenumColor,
                        pluginSetting.linenumFontColor
                    );
                    await this.plugin.saveSettings();
                });
            });
        new Setting(containerEl)
            .setName('Line highlight color')
            .setDesc('Such as :#FFFF001A/rgba(255, 255, 0, 0.1)')
            .addText((cb) => {
                cb.setValue(pluginSetting.linenumHighlightColor).onChange(async (value) => {
                    pluginSetting.linenumHighlightColor = value;
                    document.body.style.setProperty(
                        CbeCssVar.linenumHighlightColor,
                        pluginSetting.linenumHighlightColor
                    );
                    await this.plugin.saveSettings();
                });
            });
    }
}
