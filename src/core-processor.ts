import { Menu, type MarkdownPostProcessorContext } from 'obsidian';
import CodeBlockEnhancer from './main';
import { i18n } from './i18n';
import { CLS } from './constant';
import { mount, unmount } from 'svelte';
import CbeHeader from 'src/ui/CbeHeader.svelte';
import CbeLineNumber from 'src/ui/CbeLineNumber.svelte';
import { copyText } from './util';
// import { v4 as uuidv4 } from 'uuid';

const DEFAULT_LANG = '';
const LANG_REG = /^language-/;
const LINE_SPLIT_MARK = '\n';

export const unmountCallbackCache = new Map<string, (() => void)[]>();

export class CoreCodeBlockPostProcessor {
    private plugin: CodeBlockEnhancer;
    constructor(plugin: CodeBlockEnhancer) {
        this.plugin = plugin;
    }

    enhanceCodeBlock(el: HTMLElement, ctx: MarkdownPostProcessorContext) {
        const plugin = this.plugin;
        const code = el.querySelector('pre > code') as HTMLElement;
        // only change pre>code
        if (!code) {
            return;
        }
        // return when lang is in exclude list
        if (
            plugin.settings.excludeLangs.some((eLangName: string) =>
                code.classList.contains(`language-${eLangName}`)
            )
        ) {
            return;
        }
        const language =
            Array.from(code.classList)
                .find((value) => LANG_REG.test(value))
                ?.replace(LANG_REG, '') || DEFAULT_LANG;

        // 给代码块增加一个插件特定的类
        const pre = code.parentElement as HTMLElement;
        pre.classList.add(CLS.ROOT);
        // 如果代码块中没有language-则增加一个默认的,为了统一样式,不然没设置语言的时候会有问题
        if (!code.classList.toString().includes('language-')) {
            pre.classList.add('language-none');
            code.classList.add('language-none');
        }

        const textContent = code.textContent || '';
        const lineTextList: string[] = textContent.split(LINE_SPLIT_MARK);
        const lineCount = lineTextList.length - 1;
        const textSize = textContent.length;
        const cbeInfo: CbeInfo = {
            el: el,
            pre: pre,
            code: code,
            language: language,
            lineCount: lineCount,
            textSize: textSize,
            lineTextList: lineTextList
        };
        // 增加一个顶部的元素
        const header = mount(CbeHeader, {
            target: pre,
            props: { settings: plugin.settings, cbeInfo: cbeInfo }
        });
        // 行号
        const lineNumber = mount(CbeLineNumber, {
            target: pre,
            props: { settings: plugin.settings, cbeInfo: cbeInfo }
        });
        const path = ctx.sourcePath;
        const callbackList = unmountCallbackCache.get(path) || [];
        const callbackFn = () => {
            unmount(header);
            unmount(lineNumber);
        };
        callbackList.push(callbackFn);
        unmountCallbackCache.set(path, callbackList);
        // add context menu
        if (plugin.settings.useContextMenu) {
            this.addContextMenu(ctx, cbeInfo);
        }
    }

    addContextMenu(ctx: MarkdownPostProcessorContext, cbeInfo: CbeInfo) {
        const { pre, code } = cbeInfo;
        this.plugin.registerDomEvent(code, 'contextmenu', (event) => {
            event.preventDefault();
            const target = event.target as HTMLElement;
            const selection = window.getSelection();
            if (['CODE', 'SPAN'].includes(target.tagName.toUpperCase())) {
                const contextMenu = new Menu();
                if (selection && selection.type === 'Range' && selection.rangeCount > 0) {
                    const selText = selection.toString();
                    const trimText = selText.trim();
                    if (trimText.startsWith('http')) {
                        contextMenu.addItem((item) => {
                            item.setTitle(i18n.t('contextMenu.label.Link'))
                                .setIcon('link')
                                .onClick((e) => {
                                    window.open(trimText.split(/\s/)[0], '_blank');
                                });
                        });
                    }

                    contextMenu.addItem((item) => {
                        item.setTitle(i18n.t('contextMenu.label.Copy'))
                            .setIcon('copy')
                            .onClick((e) => {
                                copyText(selText);
                            });
                    });
                }

                contextMenu.addItem((item) => {
                    item.setTitle(i18n.t('contextMenu.label.CopyAll'))
                        .setIcon('copy')
                        .onClick((e) => {
                            copyText(code.textContent);
                        });
                });
                if (pre.getBoundingClientRect().height > window.innerHeight * 0.8) {
                    contextMenu.addItem((item) => {
                        item.setTitle(i18n.t('contextMenu.label.ToTop'))
                            .setIcon('arrow-up-to-line')
                            .onClick((e) => {
                                pre.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            });
                    });
                    contextMenu.addItem((item) => {
                        item.setTitle(i18n.t('contextMenu.label.ToBottom'))
                            .setIcon('arrow-down-to-line')
                            .onClick((e) => {
                                pre.scrollIntoView({ behavior: 'smooth', block: 'end' });
                            });
                    });
                }
                contextMenu.showAtMouseEvent(event);
            }
        });
    }
}
