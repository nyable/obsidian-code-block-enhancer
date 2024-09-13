import { App, debounce, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { CbeCssVar, CodeBlockPlus } from './core';

// Remember to rename these classes and interfaces!

interface CbeSettings {
    /**
     * 排除的语言
     */
    excludeLangs: string[];
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
    /**
     * 是否展示语言名称
     */
    showLangName: boolean;
    /**
     * 是否展示代码块折叠按钮
     */
    showCollapseBtn: boolean;
}

const DEFAULT_SETTINGS: CbeSettings = {
    excludeLangs: ['todoist'],
    useContextMenu: true,
    showLineNumber: true,
    linenumFontColor: 'var(--code-normal)',
    linenumHighlightColor: 'rgba(255, 255, 0, 0.1)',
    showLangName: true,
    showCollapseBtn: true
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
            .setDesc('The languages in the list will be ignored and not processed')
            .addTextArea((text) => {
                text.setPlaceholder('Split by `,` (like `todoist,other,...`)')
                    .setValue(pluginSetting.excludeLangs.join(','))
                    .onChange(async (value) => {
                        pluginSetting.excludeLangs = value.split(',');
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
        this.createSimpleToggle(
            containerEl,
            'showLineNumber',
            'Display line numbers',
            'After enabling, line numbers will be displayed'
        );
        new Setting(containerEl)
            .setName('Line number font color')
            .setDesc(
                'Set the font color of the line numbers, like `#ed9c9fcc/rgba(237,156,159,0.8)/var(--code-normal)`'
            )
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
            .setDesc('Set the line highlight color, like `#FFFF001A/rgba(255, 255, 0, 0.1)`')
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
        new Setting(containerEl).setName('Header').setHeading();

        this.createSimpleToggle(
            containerEl,
            'showLangName',
            'Display language names',
            'After enabling, the language names will be displayed at the top'
        );

        this.createSimpleToggle(
            containerEl,
            'showCollapseBtn',
            'Display the collapse button',
            'After enabling, code blocks can be collapsed'
        );
    }

    /**
     * 创建一个简单的开关设置,并且在切换时自动保存
     * @param containerEl el
     * @param key  keyof CbeSettings
     * @param name name
     * @param desc desc
     */
    private createSimpleToggle<K extends keyof CbeSettings>(
        containerEl: HTMLElement,
        key: K,
        name: string | DocumentFragment,
        desc: string | DocumentFragment
    ) {
        const pluginSetting = this.plugin.settings;
        new Setting(containerEl)
            .setName(name)
            .setDesc(desc)
            .addToggle((cb) => {
                cb.setValue(pluginSetting[key] as boolean).onChange(async (value: any) => {
                    pluginSetting[key] = value;
                    await this.plugin.saveSettings();
                });
            });
    }
}
