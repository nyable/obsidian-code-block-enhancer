import { App, debounce, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { CoreCodeBlockPostProcessor } from './core-processor';
import { i18n } from './i18n';
import { CbeCssVar, LineClickMode, LinenumHoverMode as LineHoverMode } from './constant';
import { editorExtensionProvider } from './editor-extensions';

const DEFAULT_SETTINGS: CbeSettings = {
    excludeLangs: ['todoist'],
    useContextMenu: true,
    showLineNumber: true,
    linenumFontColor: 'var(--code-normal)',
    linenumHighlightColor: 'rgba(255, 255, 0, 0.1)',
    showLangName: true,
    showCollapseBtn: true,
    showCodeSnap: true,
    enableCbeCopyBtn: true,
    codeFontSize: '16px',
    linenumHoverMode: LineHoverMode.None,
    linenumClickMode: LineClickMode.None
};
export default class CodeBlockEnhancerPlugin extends Plugin {
    settings: CbeSettings;

    async setCssVar() {
        const settings = this.settings;

        const { linenumFontColor, linenumHighlightColor, codeFontSize } = settings;

        type CbeStringKeys = {
            [K in keyof CbeSettings]: CbeSettings[K] extends string ? K : never;
        }[keyof CbeSettings];
        const blankToDefaultKeys: CbeStringKeys[] = [
            'codeFontSize',
            'linenumFontColor',
            'linenumHighlightColor'
        ];

        blankToDefaultKeys.forEach((key) => {
            if (!(settings[key] && settings[key].trim())) {
                settings[key] = DEFAULT_SETTINGS[key];
            }
        });
        document.body.style.setProperty(CbeCssVar.linenumColor, linenumFontColor);
        document.body.style.setProperty(CbeCssVar.linenumHighlightColor, linenumHighlightColor);
        document.body.style.setProperty(CbeCssVar.codeFontSize, codeFontSize);
        await this.saveSettings();
    }
    async onload() {
        await this.loadSettings();
        this.addSettingTab(new CbeSettingsTab(this.app, this));
        this.setCssVar();

        const cbp = new CoreCodeBlockPostProcessor(this);
        this.registerMarkdownPostProcessor((el, ctx) => {
            cbp.enhanceCodeBlock(el, ctx);
        });
        this.app.workspace.on(
            'resize',
            debounce(() => {
                cbp.updateLineNumber();
            }, 350)
        );
        this.registerEditorExtension(editorExtensionProvider(this));

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
            text: `${i18n.t('plugin.name')} ${this.plugin.manifest.version}`
        });
        new Setting(containerEl).setDesc(i18n.t('settings.desc'));
        // general settings
        new Setting(containerEl).setName(i18n.t('settings.general')).setHeading();
        new Setting(containerEl)
            .setName(i18n.t('settings.excludeLangs.name'))
            .setDesc(i18n.t('settings.excludeLangs.desc'))
            .addTextArea((text) => {
                text.setPlaceholder(i18n.t('settings.excludeLangs.placeholder'))
                    .setValue(pluginSetting.excludeLangs.join(','))
                    .onChange(async (value) => {
                        pluginSetting.excludeLangs = value.split(',');
                        await this.plugin.saveSettings();
                    });
            });
        new Setting(containerEl)
            .setName(i18n.t('settings.codeFontSize.name'))
            .setDesc(i18n.t('settings.codeFontSize.desc'))
            .addText((text) => {
                text.setValue(pluginSetting.codeFontSize).onChange(async (v) => {
                    pluginSetting.codeFontSize = v;
                    await this.plugin.saveSettings();
                });
            });

        this.createSimpleToggle(
            containerEl,
            'useContextMenu',
            i18n.t('settings.useContextMenu.name'),
            i18n.t('settings.useContextMenu.desc')
        );
        // line number settings
        new Setting(containerEl).setName(i18n.t('settings.lineNumber')).setHeading();
        this.createSimpleToggle(
            containerEl,
            'showLineNumber',
            i18n.t('settings.showLineNumber.name'),
            i18n.t('settings.showLineNumber.desc')
        );
        new Setting(containerEl)
            .setName(i18n.t('settings.linenumFontColor.name'))
            .setDesc(i18n.t('settings.linenumFontColor.desc'))
            .addText((cb) => {
                cb.setValue(pluginSetting.linenumFontColor).onChange(async (value) => {
                    pluginSetting.linenumFontColor = value;
                    await this.plugin.setCssVar();
                });
            });
        new Setting(containerEl)
            .setName(i18n.t('settings.linenumHighlightColor.name'))
            .setDesc(i18n.t('settings.linenumHighlightColor.desc'))
            .addText((cb) => {
                cb.setValue(pluginSetting.linenumHighlightColor).onChange(async (value) => {
                    pluginSetting.linenumHighlightColor = value;
                    await this.plugin.setCssVar();
                });
            });

        new Setting(containerEl)
            .setName(i18n.t('settings.linenumHoverMode.name'))
            .setDesc(i18n.t('settings.linenumHoverMode.desc'))
            .addDropdown((cb) => {
                cb.addOptions({
                    [LineHoverMode.None]: i18n.t('settings.linenumHoverMode.opt.None'),
                    [LineHoverMode.Highlight]: i18n.t('settings.linenumHoverMode.opt.Highlight')
                })
                    .setValue(pluginSetting.linenumHoverMode)
                    .onChange(async (value) => {
                        pluginSetting.linenumHoverMode = value;
                        await this.plugin.saveSettings();
                    });
            });
        new Setting(containerEl)
            .setName(i18n.t('settings.linenumClickMode.name'))
            .setDesc(i18n.t('settings.linenumClickMode.desc'))
            .addDropdown((cb) => {
                cb.addOptions({
                    [LineClickMode.None]: i18n.t('settings.linenumClickMode.opt.None'),
                    [LineClickMode.Copy]: i18n.t('settings.linenumClickMode.opt.Copy'),
                    [LineClickMode.Highlight]: i18n.t('settings.linenumClickMode.opt.Highlight')
                })
                    .setValue(pluginSetting.linenumClickMode)
                    .onChange(async (value) => {
                        pluginSetting.linenumClickMode = value;
                        await this.plugin.saveSettings();
                    });
            });
        // header settings
        new Setting(containerEl).setName(i18n.t('settings.headerBar')).setHeading();

        this.createSimpleToggle(
            containerEl,
            'showLangName',
            i18n.t('settings.showLangName.name'),
            i18n.t('settings.showLangName.desc')
        );

        this.createSimpleToggle(
            containerEl,
            'showCollapseBtn',
            i18n.t('settings.showCollapseBtn.name'),
            i18n.t('settings.showCollapseBtn.desc')
        );

        this.createSimpleToggle(
            containerEl,
            'showCodeSnap',
            i18n.t('settings.showCodeSnap.name'),
            i18n.t('settings.showCodeSnap.desc')
        );
        this.createSimpleToggle(
            containerEl,
            'enableCbeCopyBtn',
            i18n.t('settings.enableCbeCopyBtn.name'),
            i18n.t('settings.enableCbeCopyBtn.desc')
        );

        new Setting(containerEl).addButton((cb) => {
            cb.setButtonText(i18n.t('settings.reloadApp'))
                .onClick(() => {
                    window.location.reload();
                })
                .setCta();
        });
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
