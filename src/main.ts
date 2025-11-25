import { App, debounce, Plugin, PluginSettingTab, Setting, TFile } from 'obsidian';
import { unmountCallbackCache, CoreCodeBlockPostProcessor } from './core-processor';
import { i18n } from './i18n';
import { CbeCssVar, LineClickMode, LinenumHoverMode as LineHoverMode } from './constant';
import { boxSizeStore } from './store';
import { ColorPicker } from './ui/ColorPicker';

const DEFAULT_SETTINGS: CbeSettings = {
    excludeLangs: ['todoist'],
    useContextMenu: true,
    showLineNumber: true,
    linenumFontColor: 'var(--code-normal)',
    linenumHighlightColor: 'rgba(255, 255, 0, 0.1)',
    linenumHighlightColorTemp: 'rgba(64, 224, 208, 0.2)',
    linenumHighlightColorHover: 'rgba(138, 92, 245, 0.15)',
    showLangName: true,
    showCollapseBtn: true,
    showCodeSnap: true,
    codeFontSize: '16px',
    linenumHoverMode: LineHoverMode.None,
    linenumClickMode: LineClickMode.Highlight
};
export default class CodeBlockEnhancerPlugin extends Plugin {
    settings!: CbeSettings;

    async setCssVar() {
        const settings = this.settings;

        const { linenumFontColor, linenumHighlightColor, linenumHighlightColorTemp, linenumHighlightColorHover, codeFontSize } = settings;

        type CbeStringKeys = {
            [K in keyof CbeSettings]: CbeSettings[K] extends string ? K : never;
        }[keyof CbeSettings];
        const blankToDefaultKeys: CbeStringKeys[] = [
            'codeFontSize',
            'linenumFontColor',
            'linenumHighlightColor',
            'linenumHighlightColorTemp',
            'linenumHighlightColorHover'
        ];

        blankToDefaultKeys.forEach((key) => {
            if (!(settings[key] && settings[key].trim())) {
                settings[key] = DEFAULT_SETTINGS[key];
            }
        });
        document.body.style.setProperty(CbeCssVar.linenumColor, linenumFontColor);
        document.body.style.setProperty(CbeCssVar.linenumHighlightColor, linenumHighlightColor);
        document.body.style.setProperty(CbeCssVar.linenumHighlightColorTemp, linenumHighlightColorTemp);
        document.body.style.setProperty(CbeCssVar.linenumHighlightColorHover, linenumHighlightColorHover);
        document.body.style.setProperty(CbeCssVar.codeFontSize, codeFontSize);
        await this.saveSettings();
    }
    async onload() {
        await this.loadSettings();
        this.addSettingTab(new CbeSettingsTab(this.app, this));
        this.setCssVar();
        const workspace = this.app.workspace;
        workspace.onLayoutReady(() => {
            const cbp = new CoreCodeBlockPostProcessor(this);
            this.registerMarkdownPostProcessor((el, ctx) => {
                cbp.enhanceCodeBlock(el, ctx);
            });
            this.registerEvent(
                workspace.on(
                    'resize',
                    debounce(
                        () => {
                            boxSizeStore.update((boxSize) => {
                                boxSize.oldHeight = boxSize.height;
                                boxSize.oldWidth = boxSize.width;
                                boxSize.height = window.innerHeight;
                                boxSize.width = window.innerWidth;
                                return boxSize;
                            });
                        },
                        250,
                        true
                    )
                )
            );

            this.registerEvent(
                workspace.on('layout-change', () => {
                    const markdownLeaves = this.app.workspace.getLeavesOfType('markdown');
                    const openMarkdownPaths = markdownLeaves
                        .map((leaf) => {
                            const view = leaf.view as any;
                            return (view?.file as TFile)?.path;
                        })
                        .filter((path) => !!path);

                    for (const [key, value] of unmountCallbackCache) {
                        if (!openMarkdownPaths.contains(key)) {
                            value.forEach((cb) => cb());
                            unmountCallbackCache.delete(key);
                        }
                    }
                })
            );
        });

        console.log('Load Code Block Enhancer Plugin!');
    }

    onunload() {
        unmountCallbackCache.forEach((callbackList) => callbackList.forEach((cb) => cb()));
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
        this.createColorPickerSetting(
            containerEl,
            'linenumFontColor',
            i18n.t('settings.linenumFontColor.name'),
            i18n.t('settings.linenumFontColor.desc')
        );
        this.createColorPickerSetting(
            containerEl,
            'linenumHighlightColor',
            i18n.t('settings.linenumHighlightColor.name'),
            i18n.t('settings.linenumHighlightColor.desc')
        );
        this.createColorPickerSetting(
            containerEl,
            'linenumHighlightColorTemp',
            i18n.t('settings.linenumHighlightColorTemp.name'),
            i18n.t('settings.linenumHighlightColorTemp.desc')
        );
        this.createColorPickerSetting(
            containerEl,
            'linenumHighlightColorHover',
            i18n.t('settings.linenumHighlightColorHover.name'),
            i18n.t('settings.linenumHighlightColorHover.desc')
        );

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

    /**
     * 创建带颜色选择器和透明度滑块的设置项
     * @param containerEl el
     * @param key  keyof CbeSettings
     * @param name name
     * @param desc desc
     */
    private createColorPickerSetting<K extends keyof CbeSettings>(
        containerEl: HTMLElement,
        key: K,
        name: string | DocumentFragment,
        desc: string | DocumentFragment
    ) {
        const pluginSetting = this.plugin.settings;
        const currentValue = pluginSetting[key] as string;
        const defaultValue = DEFAULT_SETTINGS[key] as string;

        const setting = new Setting(containerEl).setName(name).setDesc(desc);

        // 使用 ColorPicker 组件
        new ColorPicker(setting.controlEl, {
            initialValue: currentValue,
            defaultValue: defaultValue,
            showReset: true,
            onChange: async (color) => {
                pluginSetting[key] = color as any;
                await this.plugin.setCssVar();
            }
        });
    }
}
