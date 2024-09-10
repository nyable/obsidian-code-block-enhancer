import { debounce, MarkdownPostProcessorContext, Menu } from 'obsidian';
import CodeBlockEnhancer from './main';

import { v4 as uuidv4 } from 'uuid';
import { isMonoSpaceUnicode, queryVisibleElement } from './util';

const DEFAULT_LANG_ATTR = 'language-text';
const DEFAULT_LANG = '';
const LANG_REG = /^language-/;
const LINE_SPLIT_MARK = '\n';

const CLS = {
  EL: 'cbe',
  HAS_LINENUMBER: 'cbe-has-linenumber',
  LANGUAGE_NAME: 'cbe-language-name',
  LN_WRAP: 'cbe-linenum-wrap',
  LN_GROUP: 'cbe-linenum-group',
  LN_LINE: 'cbe-linenum'
};

const ATTR = {
  CBE_ID: 'cbe-id'
};

const BASE_LINE_INFO: {
  updated: boolean;
  minWidth: number;
  maxWidth: number;
  lineHeight: number;
  codeWidth: number;
} = {
  updated: false,
  minWidth: 0,
  maxWidth: 0,
  lineHeight: 0,
  codeWidth: 0
};

interface CodeBlockMeta {
  /**
   * Language name
   */
  langName: string;
  /**
   * Code block total line size
   */
  lineSize: number;
  /**
   * Total text size
   */
  textSize: number;
  /**
   * Code block el
   */
  el: HTMLElement;
  /**
   * Code block 'pre' HTMLElement
   */
  pre: HTMLElement;
  /**
   * Code block 'code' HTMLElement
   */
  code: HTMLElement;
  contentList: string[];
}

export class CodeBlockPlus {
  private plugin: CodeBlockEnhancer;
  private observerCache: IntersectionObserver[] = [];
  private metaCache: Map<String, CodeBlockMeta> = new Map<String, CodeBlockMeta>();
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

    const pre = code.parentElement;
    const div = pre.parentElement;

    // Add default language style when lang is empty
    if (!code.classList.toString().contains('language-')) {
      pre.classList.add(DEFAULT_LANG_ATTR);
    }

    // 增加一个插件特定的类
    div.classList.add('cbe');

    const textContent = code.textContent;
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
      textSize: textSize
    };

    const { useContextMenu, showLangName, showLineNumber } = plugin.settings;

    // create lang name tip in left
    if (showLangName) {
      this.addLanguageName(ctx, cbMeta);
    }
    // add line number
    if (showLineNumber) {
      this.addLineNumber(ctx, cbMeta);
    }
    //add context menu
    if (useContextMenu) {
      this.addContextMenu(ctx, cbMeta);
    }
  }

  private addLanguageName(ctx: MarkdownPostProcessorContext, cbMeta: CodeBlockMeta): void {
    const { langName, pre } = cbMeta;
    pre.append(createEl('div', { cls: CLS.LANGUAGE_NAME, text: langName }));
  }

  private addContextMenu(ctx: MarkdownPostProcessorContext, cbMeta: CodeBlockMeta) {
    const { pre, code, lineSize } = cbMeta;
    const plugin = this.plugin;
    plugin.registerDomEvent(pre, 'contextmenu', (event) => {
      event.preventDefault();
      const target = <HTMLElement>event.target;
      if (target.tagName !== 'BUTTON') {
        const contextMenu = new Menu(plugin.app);
        const selection = window.getSelection().toString();
        const editView = document.querySelector('.markdown-preview-view');
        const blockHeight = parseFloat(window.getComputedStyle(pre).height);
        const viewHeight = editView.clientHeight;
        const { offsetY, pageY } = event;
        const toBottom = blockHeight - (viewHeight - pageY + offsetY);
        const toTop = offsetY - pageY + 100;
        const eventScrollTop = editView.scrollTop;
        let eRowNum = Math.ceil((offsetY - 16) / 24);
        if (eRowNum < 1) {
          eRowNum = 1;
        } else if (eRowNum > lineSize) {
          eRowNum = lineSize;
        }
        if (selection) {
          contextMenu.addItem((item) => {
            item
              .setTitle('Copy')
              .setIcon('two-blank-pages', 16)
              .onClick((e) => {
                navigator.clipboard.writeText(selection);
              });
          });
        }
        contextMenu.addItem((item) => {
          item
            .setTitle('Copy Block')
            .setIcon('two-blank-pages', 16)
            .onClick(() => {
              navigator.clipboard.writeText(code.textContent);
            });
        });
        contextMenu.addItem((item) => {
          item
            .setTitle('Copy Row')
            .setIcon('two-blank-pages', 16)
            .onClick(() => {
              navigator.clipboard.writeText(cbMeta.contentList[eRowNum - 1]);
            });
        });

        if (blockHeight > viewHeight) {
          if (toTop > 0) {
            contextMenu.addItem((item) => {
              item.setTitle('To Top').onClick((e) => {
                editView.scrollTop = eventScrollTop - toTop;
              });
            });
          }
          if (toBottom > 0) {
            contextMenu.addItem((item) => {
              item.setTitle('To Bottom').onClick((e) => {
                editView.scrollTop = eventScrollTop + toBottom;
              });
            });
          }
        }
        contextMenu.showAtPosition({ x: event.clientX, y: event.clientY });
      }
    });
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
      const cbMeta = this.metaCache.get(uuid);
      if (cbMeta) {
        code.parentElement
          .querySelectorAll(`.${CLS.LN_LINE}`)
          .forEach((line: HTMLElement, i: number) => {
            this.setLineNumStyle(line, cbMeta, i);
          });
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
      const rect = tempSpan.getBoundingClientRect();
      BASE_LINE_INFO.lineHeight = rect.height;
      BASE_LINE_INFO.codeWidth = rect.width;
      tempSpan.remove();
      if (BASE_LINE_INFO.lineHeight != 0) {
        BASE_LINE_INFO.updated = true;
      }
      console.log(BASE_LINE_INFO, 'over!');
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
    const w = tempSpan.getBoundingClientRect().width;
    line.style.height = h + 'px';
    console.log(text, h, w);

    tempSpan.remove();
  }

  /**
   * 按字的宽度来计算行的高度，会有一定的误差，但是大多数情况还是比较准的
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
        const charWidth = isMonoSpaceUnicode(char) ? minWidth : maxWidth;
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
    const wrap = createEl('span', { cls: CLS.LN_WRAP });
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
          wrap.append(createEl('span', { cls: CLS.LN_LINE }));
        });

        const observer = new IntersectionObserver((entries, observer) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              const code = entry.target;
              if (BASE_LINE_INFO.updated == false) {
                this.updateBaseLineInfo(code);
              }
              const lines = code.parentElement.querySelector(`.${CLS.LN_WRAP}`).children;
              Array.from(lines).forEach((line: HTMLElement, i) => {
                this.setLineNumStyle(line, cbMeta, i);
              });
            }
          });
        });
        observer.observe(cbMeta.code);

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
        ob = null;
      }
    });
    this.observerCache = [];
  }
}
