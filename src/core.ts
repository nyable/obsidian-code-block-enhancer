import {
    debounce,
    getIcon,
    MarkdownPostProcessorContext,
    MarkdownView,
    Menu,
    Notice
} from 'obsidian';
import CodeBlockEnhancer from './main';
import domToImage from 'dom-to-image-more';
import { v4 as uuidv4 } from 'uuid';
import { parseLineRange, isMonoSpaceUnicode, queryVisibleElement } from './util';
import { i18n } from './i18n';

const DEFAULT_LANG = '';
const LANG_REG = /^language-/;
const LINE_SPLIT_MARK = '\n';

interface CodeBlockMeta {
    /**
     * 自己生成的代码块唯一ID
     */
    cbeId: string;
    /**
     * 代码块语言
     */
    langName: string;
    /**
     * 代码块的内容行数,不包括开始和结尾的```
     */
    lineSize: number;
    /**
     * 总字数
     */
    textSize: number;
    /**
     * 原始参数中的el
     */
    el: HTMLElement;
    /**
     * 代码块中的pre标签,从el中获取
     */
    pre: HTMLElement;
    /**
     *  代码块中的code标签,从el中获取
     */
    code: HTMLElement;
    /**
     * 顶部的header元素
     */
    header: HTMLElement;
    /**
     * 每一行的内容数组
     */
    contentList: string[];
    /**
     * 应该高亮的行
     */
    highlightLines: number[];
}

interface BaseLineInfo {
    updated: boolean;
    minWidth: number;
    maxWidth: number;
    lineHeight: number;
    codeWidth: number;
    tabSize: number;
}

export enum CLS {
    /**
     * 最外层的类
     */
    ROOT = 'cbe',
    /**
     * 有行号时会在pre和code上加上,用来强制生效一些样式
     */
    HAS_LINENUMBER = 'cbe-has-linenumber',
    /**
     * 代码块顶部区域,包括语言名和工具栏
     */
    HEADER = 'cbe-header',
    /**
     * 语言名
     */
    H_LANG_NAME = 'cbe-language-name',
    /**
     * 工具栏
     */
    H_TOOLBAR = 'cbe-toolbar',
    /**
     * 行号
     */
    LN_WRAP = 'cbe-linenum-wrap',
    /**
     * 一整行
     */
    LN_LINE = 'cbe-line',
    /**
     * 显示行号用
     */
    LN_NUM = 'cbe-linenum',
    /**
     * 行高亮
     */
    LN_HIGHLIGHT = 'cbe-line-highlight',
    /**
     * obsidian自带的类 可点击的按钮
     */
    OB_CLICKABLE = 'clickable-icon',
    /**
     * 工具栏中的按钮
     */
    H_TOOL_BTN = 'cbe-toolbar-btn',
    /**
     * 启用替换复制按钮后在最外层加的类
     */
    HAS_COPYBTN = 'cbe-has-copy-btn',
    /**
     * 启用折叠按钮后在最外层加的类
     */
    HAS_COLLAPSED = 'cbe-collapsed',
    DEFAULT_LANG = 'language-text'
}
export enum CbeCssVar {
    codeFontSize = '--cb-font-size',
    headerHeight = '--cb-top-height',
    linenumBg = '--cb-linenum-bg',
    linenumBorder = '--cb-linenum-border',
    linenumColor = '--cb-linenum-color',
    linenumHighlightColor = '--cb-linenum-highlight-color',
    codeBg = '--cb-code-bg'
}
export enum ATTR {
    CBE_ID = 'cbe-id'
}

const BASE_LINE_INFO: BaseLineInfo = {
    updated: false,
    minWidth: 0,
    maxWidth: 0,
    lineHeight: 0,
    codeWidth: 0,
    tabSize: 4
};

export class CodeBlockPlus {
    private plugin: CodeBlockEnhancer;
    private observerCache: IntersectionObserver[] = [];
    private metaCache: Map<string, CodeBlockMeta> = new Map<string, CodeBlockMeta>();
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
            plugin.settings.excludeLangs.some((eLangName) =>
                code.classList.contains(`language-${eLangName}`)
            )
        ) {
            return;
        }

        let lang = DEFAULT_LANG;
        code.classList.forEach((value, key, parent) => {
            if (LANG_REG.test(value)) {
                lang = value.replace('language-', '');
                return;
            }
        });

        const pre = code.parentElement as HTMLElement;
        const div = pre.parentElement as HTMLElement;

        // Add default language style when lang is empty
        if (!code.classList.toString().includes('language-')) {
            pre.classList.add(CLS.DEFAULT_LANG);
            code.classList.add(CLS.DEFAULT_LANG);
        }

        // 增加一个插件特定的类
        div.classList.add(CLS.ROOT);

        // 增加一个顶部的元素
        const header = createEl('div', { cls: CLS.HEADER });
        el.append(header);

        const textContent = code.textContent as string;

        const contentList: string[] = textContent.split(LINE_SPLIT_MARK);
        const lineSize = contentList.length - 1;
        const textSize = textContent.length;

        const cbMeta: CodeBlockMeta = {
            cbeId: uuidv4(),
            langName: lang,
            lineSize,
            pre,
            code,
            el: el,
            contentList,
            header: header,
            textSize: textSize,
            highlightLines: []
        };

        const { showLineNumber, useContextMenu } = plugin.settings;

        // add header
        this.addHeader(ctx, cbMeta);
        // add line number
        if (showLineNumber) {
            this.addLineNumber(ctx, cbMeta);
        }
        // add context menu
        if (useContextMenu) {
            this.addContextMenu(ctx, cbMeta);
        }
    }

    addContextMenu(ctx: MarkdownPostProcessorContext, cbMeta: CodeBlockMeta) {
        const { el, code } = cbMeta;
        this.plugin.registerDomEvent(el, 'contextmenu', (event) => {
            const target = event.target as HTMLElement;
            if (target.tagName == 'CODE') {
                const contextMenu = new Menu();
                contextMenu.addItem((item) => {
                    item.setTitle(i18n.t('contextMenu.label.CopyAll'))
                        .setIcon('copy')
                        .onClick((e) => {
                            navigator.clipboard.writeText(code.textContent || '').then(() => {
                                new Notice(i18n.t('common.notice.copySuccess'));
                            });
                        });
                });
                if (cbMeta.lineSize > 30) {
                    contextMenu.addItem((item) => {
                        item.setTitle(i18n.t('contextMenu.label.ToTop'))
                            .setIcon('arrow-up-to-line')
                            .onClick((e) => {
                                el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            });
                    });
                    contextMenu.addItem((item) => {
                        item.setTitle(i18n.t('contextMenu.label.ToBottom'))
                            .setIcon('arrow-down-to-line')
                            .onClick((e) => {
                                el.scrollIntoView({ behavior: 'smooth', block: 'end' });
                            });
                    });
                }
                contextMenu.showAtMouseEvent(event);
            }
        });
    }

    private addHeader(ctx: MarkdownPostProcessorContext, cbMeta: CodeBlockMeta): void {
        const { langName, header } = cbMeta;
        const { showLangName, showCollapseBtn, enableCbeCopyBtn, showCodeSnap } =
            this.plugin.settings;
        if (showLangName) {
            header.append(createEl('div', { cls: CLS.H_LANG_NAME, text: langName }));
        }

        const btCls = [CLS.OB_CLICKABLE, CLS.H_TOOL_BTN];

        const toolbar = createEl('div', { cls: CLS.H_TOOLBAR });
        header.append(toolbar);
        if (showCollapseBtn) {
            const collapseBtn = createSpan(
                { cls: btCls, attr: { 'aria-label': i18n.t('btn.collapse') } },
                (el) => {
                    el.append(getIcon('chevron-down') as Node);
                }
            );
            this.plugin.registerDomEvent(collapseBtn, 'click', (e) => {
                const classList = cbMeta.el.classList;
                classList.toggle(CLS.HAS_COLLAPSED);
            });
            toolbar.append(collapseBtn);
        }

        if (showCodeSnap) {
            const snapBtn = createSpan(
                { cls: btCls, attr: { 'aria-label': i18n.t('btn.codeSnap') } },
                (el) => {
                    el.append(getIcon('camera') as Node);
                }
            );
            this.plugin.registerDomEvent(snapBtn, 'click', (e) => {
                const gap = 8;
                domToImage
                    .toBlob(cbMeta.el, {
                        bgcolor: 'transparent',
                        height: cbMeta.el.offsetHeight + gap * 4,
                        width: cbMeta.el.offsetWidth + gap * 2,
                        style: {
                            margin: `${gap}px`,
                            padding: '0px',
                            position: 'absolute',
                            top: '0px',
                            left: '0px'
                        },
                        // @ts-ignore
                        adjustClonedNode: (node: HTMLElement, clone: HTMLElement, after: any) => {
                            if (!after) {
                                const classList = clone.classList;
                                if (classList) {
                                    if (classList.contains(CLS.H_TOOLBAR)) {
                                        clone.style.display = 'none';
                                    }
                                    if (classList.contains(CLS.HEADER)) {
                                        clone.style.borderRadius = '4px';
                                        const size = '1em';
                                        const btnGroup = createDiv();
                                        btnGroup.style.display = 'flex';
                                        btnGroup.style.width = '6em';
                                        btnGroup.style.alignSelf = 'center';
                                        btnGroup.style.padding = '0 1em';
                                        btnGroup.style.gap = '8px';
                                        const bgColors = ['#ff5f57', '#ffbd2e', '#28c940'];
                                        bgColors.forEach((color) => {
                                            const btn = document.createElement('div');
                                            btn.style.width = size;
                                            btn.style.height = size;
                                            btn.style.borderRadius = '50%';
                                            btn.style.backgroundColor = color;
                                            btnGroup.append(btn);
                                        });
                                        clone.append(btnGroup);
                                    }
                                    if (classList.contains(CLS.H_LANG_NAME)) {
                                        clone.style.flex = '1';
                                        clone.style.textAlign = 'right';
                                        clone.style.paddingRight = '1em';
                                        clone.style.fontSize = '1em';
                                        clone.style.fontWeight = 'bold';
                                    }
                                }
                            }
                            return clone;
                        }
                    })
                    .then((b) => {
                        navigator.clipboard.write([new ClipboardItem({ 'image/png': b })]);
                        new Notice(i18n.t('common.notice.copySuccess'));
                    });
            });
            toolbar.append(snapBtn);
        }

        if (enableCbeCopyBtn) {
            cbMeta.el.classList.add(CLS.HAS_COPYBTN);
            const copyBtn = createSpan(
                { cls: btCls, attr: { 'aria-label': i18n.t('btn.copy') } },
                (el) => {
                    el.append(getIcon('copy') as Node);
                }
            );
            this.plugin.registerDomEvent(copyBtn, 'click', (e) => {
                navigator.clipboard.writeText(cbMeta.code.textContent || '').then(() => {
                    new Notice(i18n.t('common.notice.copySuccess'));
                });
            });
            toolbar.append(copyBtn);
        }
    }

    /**
     * 更新行号信息
     */
    updateLineNumber() {
        BASE_LINE_INFO.updated = false;
        const codeBlocks = queryVisibleElement(`div.${CLS.HAS_LINENUMBER}>pre>code`);

        codeBlocks.forEach(async (code: HTMLElement, index: number) => {
            if (index == 0) {
                await this.updateBaseLineInfo(code);
            }
            const uuid = code.getAttribute(ATTR.CBE_ID);
            if (uuid) {
                const cbMeta = this.metaCache.get(uuid);
                if (cbMeta) {
                    cbMeta.pre
                        .querySelectorAll(`.${CLS.LN_LINE}`)
                        .forEach((line: HTMLElement, i: number) => {
                            this.setLineNumStyle(line, cbMeta, i);
                        });
                }
            }
        });
    }

    /**
     * 更新缓存的文字信息;
     * 感觉可以改成每个代码块第一行时计算,然后缓存给这个代码块后续使用,到最后一行时移除缓存
     */
    updateBaseLineInfo(target: Element) {
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                if (target) {
                    const tempSpan = createEl('span');
                    target.append(tempSpan);

                    tempSpan.style.display = 'inline-block';
                    tempSpan.innerText = 'A';
                    BASE_LINE_INFO.minWidth = tempSpan.getBoundingClientRect().width;
                    tempSpan.innerText = '好';
                    BASE_LINE_INFO.maxWidth = tempSpan.getBoundingClientRect().width;

                    tempSpan.style.display = 'block';
                    tempSpan.innerText = 'A好';
                    const rect = tempSpan.getBoundingClientRect();
                    BASE_LINE_INFO.lineHeight = rect.height;
                    BASE_LINE_INFO.codeWidth = target.getBoundingClientRect().width;

                    tempSpan.remove();
                    if (BASE_LINE_INFO.lineHeight != 0) {
                        BASE_LINE_INFO.updated = true;
                    }
                    BASE_LINE_INFO.tabSize = parseInt(getComputedStyle(target).tabSize) || 4;
                    console.debug(BASE_LINE_INFO, 'over!');
                }
                resolve(null);
            }, 200);
        });
    }
    private setLineNumStyle(line: HTMLElement, cbMeta: CodeBlockMeta, i: number) {
        this.setLineNumStyleByCharCode(line, cbMeta, i);
    }
    /**
     * 使用HTMLElement的getBoundingClientRect计算行号高度
     * @param line 行号对应的element
     * @param cbMeta 元数据
     * @param i 行号索引
     */
    private setLineNumStyleByElement(line: HTMLElement, cbMeta: CodeBlockMeta, i: number) {
        // 这个span可以放到外面去，让整个代码块共用一个,但是性能好像差不了多少，主要是getBoundingClientRect对于性能影响比较大
        const tempSpan = createEl('span');
        tempSpan.style.display = 'block';
        tempSpan.style.visibility = 'hidden';
        cbMeta.code.append(tempSpan);
        const text = cbMeta.contentList[i];
        tempSpan.innerText = text || 'A';
        const h = tempSpan.getBoundingClientRect().height;
        line.style.height = h + 'px';
        tempSpan.remove();
    }
    /**
     * 按字的宽度来计算行的高度,应该会有一定的误差,会被字号影响,但是大多数情况还是比较准的
     * @param line 行号对应的element
     * @param cbMeta 元数据
     * @param i 行号索引
     */
    private setLineNumStyleByCharCode(line: HTMLElement, cbMeta: CodeBlockMeta, i: number) {
        const { codeWidth, maxWidth, minWidth, lineHeight, tabSize } = BASE_LINE_INFO;

        const text = cbMeta.contentList[i];
        const perLineMinSize = Math.floor(codeWidth / maxWidth);
        const length = text.length;

        let h = lineHeight;
        if (length > perLineMinSize) {
            let currentWidth = 0;
            let size = 1;
            for (let i = 0; i < length; i++) {
                const char = text.charCodeAt(i);
                let charWidth = 0;
                if (char == 9) {
                    charWidth = minWidth * tabSize;
                } else {
                    charWidth = isMonoSpaceUnicode(char) ? minWidth : maxWidth;
                }
                currentWidth += charWidth;
                if (currentWidth > codeWidth) {
                    size++;
                    currentWidth = charWidth;
                }
            }
            h = size * lineHeight;
        }
        line.style.height = h + 'px';
    }

    /**
     * 为代码块添加行号
     * @param plugin 插件
     * @param cbMeta 代码块数据
     */
    private addLineNumber(ctx: MarkdownPostProcessorContext, cbMeta: CodeBlockMeta) {
        const { pre, code, lineSize, cbeId, el } = cbMeta;

        const wrap = createEl('div', { cls: CLS.LN_WRAP });
        pre.append(wrap);

        el.classList.add(CLS.HAS_LINENUMBER);
        // pre.classList.add(CLS.HAS_LINENUMBER);
        // code.classList.add(CLS.HAS_LINENUMBER);

        pre.setAttribute(ATTR.CBE_ID, cbeId);
        code.setAttribute(ATTR.CBE_ID, cbeId);

        this.metaCache.set(cbeId, cbMeta);

        const mutationOb = new MutationObserver(
            debounce((mutations) => {
                Array.from({ length: lineSize }, (v, k) => k).forEach((i) => {
                    const line = createEl('div', {
                        cls: [CLS.LN_LINE],
                        attr: { linenum: i + 1 }
                    });
                    const linunum = createEl('div', {
                        cls: [CLS.LN_NUM],
                        attr: { linenum: i + 1 }
                    });

                    line.append(linunum);
                    wrap.append(line);
                });

                const observer = new IntersectionObserver((entries, observer) => {
                    entries.forEach(async (entry) => {
                        if (entry.isIntersecting) {
                            const code = entry.target;
                            if (BASE_LINE_INFO.updated == false) {
                                await this.updateBaseLineInfo(code);
                            }
                            const lines = wrap.children;
                            const firstLine =
                                this.plugin.app.workspace
                                    .getActiveViewOfType(MarkdownView)
                                    ?.editor.getLine(
                                        ctx.getSectionInfo(cbMeta.el)?.lineStart || 0
                                    ) || '';
                            const highlightLines = parseLineRange(firstLine);
                            Array.from(lines).forEach((line: HTMLElement, i) => {
                                line.classList.toggle(
                                    CLS.LN_HIGHLIGHT,
                                    highlightLines.includes(i + 1)
                                );
                                this.setLineNumStyle(line, cbMeta, i);
                            });
                        }
                    });
                });
                observer.observe(code);

                this.observerCache.push(observer);

                mutationOb.disconnect();
            }, 500)
        );
        mutationOb.observe(pre, { attributes: false, childList: true });
    }

    clearObserverCache() {
        this.observerCache.forEach((ob) => {
            if (ob) {
                ob.disconnect();
            }
        });
        this.observerCache = [];
    }
}
