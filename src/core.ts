import { debounce, MarkdownPostProcessorContext, MarkdownView } from 'obsidian';
import CodeBlockEnhancer from './main';

import { v4 as uuidv4 } from 'uuid';
import { isMonoSpaceUnicode, queryVisibleElement } from './util';

const DEFAULT_LANG_ATTR = 'language-text';
const DEFAULT_LANG = '';
const LANG_REG = /^language-/;
const LINE_SPLIT_MARK = '\n';

interface CodeBlockMeta {
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
    LN_HIGHLIGHT = 'cbe-line-highlight'
}
export enum CbeCssVar {
    fontSize = '--cb-font-size',
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
    codeWidth: 0
};

function extraLine(input: string) {
    const result: number[] = [];
    if (!input) {
        return result;
    }
    const match = input.match(/\{([^}]+)\}/);

    if (!match) {
        return result;
    }

    const rangeString = match[1]; // 提取花括号内的内容
    const parts = rangeString.split(','); // 按逗号分割

    parts.forEach((part) => {
        const range = part.split('-'); // 检查是否有范围
        if (range.length === 1) {
            // 单个数字，直接转为整数并添加到结果中
            result.push(parseInt(range[0], 10));
        } else if (range.length === 2) {
            // 范围，展开并添加到结果中
            const start = parseInt(range[0], 10);
            const end = parseInt(range[1], 10);
            for (let i = start; i <= end; i++) {
                result.push(i);
            }
        }
    });

    return result;
}

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
            pre.classList.add(DEFAULT_LANG_ATTR);
        }

        // 增加一个插件特定的类
        div.classList.add(CLS.ROOT);

        // 增加一个顶部的元素
        const header = createEl('div', { cls: CLS.HEADER });
        pre.append(header);

        const textContent = code.textContent as string;

        const contentList: string[] = textContent.split(LINE_SPLIT_MARK);
        const lineSize = contentList.length - 1;
        const textSize = textContent.length;

        const cbMeta: CodeBlockMeta = {
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

        const { showLangName, showLineNumber } = plugin.settings;

        // create lang name tip in left
        if (showLangName) {
            this.addLanguageName(ctx, cbMeta);
        }
        // add line number
        if (showLineNumber) {
            this.addLineNumber(ctx, cbMeta);
        }
    }

    private getTabSize() {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (this.plugin.app.vault as any)?.config.tabSize || 4;
    }

    private addLanguageName(ctx: MarkdownPostProcessorContext, cbMeta: CodeBlockMeta): void {
        const { langName, header } = cbMeta;
        header.append(createEl('div', { cls: CLS.H_LANG_NAME, text: langName }));
        header.append(createEl('div', { cls: CLS.H_TOOLBAR }));
    }

    /**
     * 更新行号信息
     */
    updateLineNumber() {
        BASE_LINE_INFO.updated = false;
        const codeBlocks = queryVisibleElement(`pre.${CLS.HAS_LINENUMBER}>code`);
        codeBlocks.forEach((code: HTMLElement, index: number) => {
            if (index == 0) {
                this.updateBaseLineInfo(code);
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
            console.debug(BASE_LINE_INFO, 'over!');
        }
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
        const { codeWidth, maxWidth, minWidth, lineHeight } = BASE_LINE_INFO;

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
                    charWidth = minWidth * this.getTabSize();
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
        const { pre, code, lineSize } = cbMeta;

        const wrap = createEl('div', { cls: CLS.LN_WRAP });
        pre.append(wrap);

        pre.classList.add(CLS.HAS_LINENUMBER);
        code.classList.add(CLS.HAS_LINENUMBER);

        const uuid = uuidv4();
        pre.setAttribute(ATTR.CBE_ID, uuid);
        code.setAttribute(ATTR.CBE_ID, uuid);

        this.metaCache.set(uuid, cbMeta);

        const mutationOb = new MutationObserver(
            debounce((mutations) => {
                Array.from({ length: lineSize }, (v, k) => k).forEach((i) => {
                    const line = createEl('div', {
                        cls: [CLS.LN_LINE],
                        attr: { idx: i }
                    });
                    const linunum = createEl('div', {
                        cls: [CLS.LN_NUM],
                        attr: { idx: i }
                    });

                    line.append(linunum);
                    wrap.append(line);
                });

                const observer = new IntersectionObserver((entries, observer) => {
                    entries.forEach((entry) => {
                        if (entry.isIntersecting) {
                            const code = entry.target;
                            if (BASE_LINE_INFO.updated == false) {
                                this.updateBaseLineInfo(code);
                            }
                            const lines = wrap.children;
                            const firstLine =
                                this.plugin.app.workspace
                                    .getActiveViewOfType(MarkdownView)
                                    ?.editor.getLine(
                                        ctx.getSectionInfo(cbMeta.el)?.lineStart || 0
                                    ) || '';
                            const highlightLines = extraLine(firstLine);
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
