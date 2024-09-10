import { App, debounce, MarkdownView, Plugin, PluginSettingTab, Setting } from 'obsidian';
import './styles/index.scss';
import { CodeBlockPlus } from './core';
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
   * 是否增强右键菜单栏
   */
  useContextMenu: boolean;
  /**
   * 是否展示行号
   */
  showLineNumber: boolean;
}

const DEFAULT_SETTINGS: CbEnhancerSettings = {
  excludeLangs: ['todoist'],
  showLangName: true,
  useContextMenu: true,
  showLineNumber: true
};

export default class CodeBlockEnhancer extends Plugin {
  settings: CbEnhancerSettings;
  codeBlockPlus: CodeBlockPlus;
  async onload() {
    await this.loadSettings();
    this.addSettingTab(new CbEnhancerSettingsTab(this.app, this));
    const cbp = (this.codeBlockPlus = new CodeBlockPlus(this));
    this.registerMarkdownPostProcessor((el, ctx) => {
      cbp.enhanceCodeBlock(el, ctx);
    });
    this.app.workspace.on(
      'resize',
      debounce(() => {
        cbp.updateLineNumber();
      }, 350)
    );
    console.log('Load Code Block Enhancer Plugin');
  }

  onunload() {
    if (this.codeBlockPlus) {
      this.codeBlockPlus.clearObserverCache();
    }

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
    document.body.style.setProperty('--cb-linenum-color', '')
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

    new Setting(containerEl)
      .setName('Use ContextMenu')
      .setDesc('Enhance the right-click menu in code block preview mode')
      .addToggle((cb) => {
        cb.setValue(pluginSetting.useContextMenu).onChange(async (isEnable) => {
          pluginSetting.useContextMenu = isEnable;
          await this.plugin.saveSettings();
        });
      });

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
  }
}
