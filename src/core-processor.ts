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
import { ATTR, CLS, LineClickMode, LinenumHoverMode } from './constant';

const DEFAULT_LANG = '';
const LANG_REG = /^language-/;
const LINE_SPLIT_MARK = '\n';

const BASE_LINE_INFO: BaseLineInfo = {
    updated: false,
    minWidth: 0,
    maxWidth: 0,
    lineHeight: 0,
    codeWidth: 0,
    tabSize: 4
};

export class CoreCodeBlockPostProcessor {
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
        // const div = pre.parentElement as HTMLElement;

        // Add default language style when lang is empty
        if (!code.classList.toString().includes('language-')) {
            pre.classList.add(CLS.DEFAULT_LANG);
            code.classList.add(CLS.DEFAULT_LANG);
        }

        // 增加一个插件特定的类
        pre.classList.add(CLS.ROOT);

        // 增加一个顶部的元素
        const header = createEl('div', { cls: CLS.HEADER });
        pre.append(header);

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
                            copyText(code.textContent);
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
        const { langName, header, pre, code } = cbMeta;
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
                const classList = pre.classList;
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
                domToImage
                    //@ts-ignore
                    .toCanvas(pre, {
                        style: {
                            margin: '0px'
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
                    .then((b: HTMLCanvasElement) => {
                        const nCanvas = document.createElement('canvas');
                        const nCtx = nCanvas.getContext('2d');
                        const mw = 32;
                        const mh = 32;

                        nCanvas.width = b.width + mw;
                        nCanvas.height = b.height + mh;
                        if (nCtx) {
                            const gradient = nCtx.createLinearGradient(
                                0,
                                0,
                                nCanvas.width,
                                nCanvas.height
                            );
                            ['#ffafbd', '#ffc3a0', '#ffccbc', '#d1c4e9', '#c5e1a5'].forEach(
                                (color, index, arr) => {
                                    gradient.addColorStop(index / (arr.length - 1), color);
                                }
                            );
                            nCtx.fillStyle = gradient;
                            nCtx.fillRect(0, 0, nCanvas.width, nCanvas.height);
                            // 设置阴影属性
                            nCtx.shadowColor = 'rgba(0, 0, 0, 0.2)';
                            nCtx.shadowBlur = 10;
                            nCtx.shadowOffsetX = -5;
                            nCtx.shadowOffsetY = 5;

                            nCtx.drawImage(b, mw / 2, mh / 2, b.width, b.height);
                            nCanvas.toBlob((nblob) => {
                                if (nblob) {
                                    navigator.clipboard
                                        .write([new ClipboardItem({ 'image/png': nblob })])
                                        .then(() => {
                                            new Notice(i18n.t('common.notice.copySuccess'));
                                        });
                                }
                            });
                        }
                        // navigator.clipboard
                        //     .write([new ClipboardItem({ 'image/png': b })])
                        //     .then(() => {
                        //         new Notice(i18n.t('common.notice.copySuccess'));
                        //     });
                    });
            });
            toolbar.append(snapBtn);
        }

        if (enableCbeCopyBtn) {
            pre.classList.add(CLS.HAS_COPYBTN);
            const copyBtn = createSpan(
                { cls: btCls, attr: { 'aria-label': i18n.t('btn.copy') } },
                (el) => {
                    el.append(getIcon('copy') as Node);
                }
            );
            this.plugin.registerDomEvent(copyBtn, 'click', (e) => {
                copyText(code.textContent);
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
        const { pre, code, lineSize, cbeId } = cbMeta;
        const { linenumHoverMode, linenumClickMode } = this.plugin.settings;

        pre.classList.add(CLS.HAS_LINENUMBER);

        const wrap = createEl('div', { cls: CLS.LN_WRAP });
        if (LineClickMode.None != linenumClickMode) {
            this.plugin.registerDomEvent(wrap, 'click', (evt) => {
                const target = evt.target;
                if (target instanceof HTMLElement && target.classList.contains(CLS.LN_NUM)) {
                    const lineEl = target.parentElement as HTMLElement;
                    const attrNum = lineEl.getAttribute(ATTR.LINENUM);
                    if (attrNum == null) {
                        return;
                    }
                    const lineIndex = parseInt(attrNum) - 1;
                    if (LineClickMode.Copy == linenumClickMode) {
                        const text = cbMeta.contentList[lineIndex];
                        copyText(text);
                    } else if (LineClickMode.Highlight == linenumClickMode) {
                        lineEl.classList.toggle(CLS.LN_HIGHLIGHT2);
                    }
                }
            });
        }

        pre.append(wrap);

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
                        attr: { [ATTR.LINENUM]: i + 1 }
                    });
                    if (linenumHoverMode === LinenumHoverMode.Highlight) {
                        line.classList.add(CLS.LN_ON_HOVER);
                    }
                    const linunum = createEl('div', {
                        cls: [CLS.LN_NUM],
                        attr: { [ATTR.LINENUM]: i + 1 }
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

function copyText(text: string | null) {
    if (text) {
        navigator.clipboard.writeText(text).then(() => {
            new Notice(i18n.t('common.notice.copySuccess'));
        });
    }
}
