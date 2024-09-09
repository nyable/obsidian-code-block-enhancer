import { App, debounce, MarkdownView, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { disconnectObserver, enhanceCodeBlock, updateLineInfo } from './core';

// import { CODE_CACHE, disconnectObserver, enhanceCodeBlock, updateLineInfo } from './TestProcessor';
import './styles/index.scss';
interface CbEnhancerSettings {
  /**
   * 排除的语言
   */
  excludeLangs: string[];
  /**
   * 是否展示语言名称
   */
  showLangName: boolean;
  /**
   * 是否展示行号
   */
  showLineNumber: boolean;
  /**
   * 是否增强右键菜单栏
   */
  useContextMenu: boolean;
}

const DEFAULT_SETTINGS: CbEnhancerSettings = {
  excludeLangs: ['todoist'],
  showLangName: true,
  showLineNumber: true,
  useContextMenu: true
};

export default class CodeBlockEnhancer extends Plugin {
  settings: CbEnhancerSettings;

  async onload() {
    await this.loadSettings();
    this.addSettingTab(new CbEnhancerSettingsTab(this.app, this));
    this.registerMarkdownPostProcessor((el, ctx) => {
      enhanceCodeBlock(el, ctx, this);
    });

    this.app.workspace.on(
      'resize',
      debounce(() => {
        updateLineInfo();
      }, 350)
    );

    console.log('Load Code Block Enhancer Plugin');
  }

  onunload() {
    disconnectObserver();
    console.log('Unloading Code Block Enhancer Plugin');
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}

class CbEnhancerSettingsTab extends PluginSettingTab {
  plugin: CodeBlockEnhancer;

  constructor(app: App, plugin: CodeBlockEnhancer) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    let { containerEl } = this;
    const pluginSetting = this.plugin.settings;
    containerEl.empty();
    containerEl.createEl('h2', {
      text: `Code Block Enhancer Settings ${this.plugin.manifest.version}`
    });
    new Setting(containerEl)
      .setName('Exclude language list')
      .setDesc('Will not be enhanced in these languages')
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
      .setDesc('Enable this options will show language name')
      .addToggle((cb) => {
        cb.setValue(pluginSetting.showLangName).onChange(async (isEnable) => {
          pluginSetting.showLangName = isEnable;
          await this.plugin.saveSettings();
        });
      });
    new Setting(containerEl)
      .setName('Show line number')
      .setDesc('Enable this options will show line number')
      .addToggle((cb) => {
        cb.setValue(pluginSetting.showLineNumber).onChange(async (isEnable) => {
          pluginSetting.showLineNumber = isEnable;
          await this.plugin.saveSettings();
        });
      });
    new Setting(containerEl)
      .setName('Use ContextMenu')
      .setDesc('Replace default contextmenu when right-click in code block')
      .addToggle((cb) => {
        cb.setValue(pluginSetting.useContextMenu).onChange(async (isEnable) => {
          pluginSetting.useContextMenu = isEnable;
          await this.plugin.saveSettings();
        });
      });
  }
}
