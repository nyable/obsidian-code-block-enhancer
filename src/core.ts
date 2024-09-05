import { MarkdownPostProcessorContext, MarkdownView, Menu } from 'obsidian';
import CodeBlockEnhancer from './main';

const DEFAULT_LANG_ATTR = 'language-text';
const DEFAULT_LANG = '';
const LANG_REG = /^language-/;
const LINE_SPLIT_MARK = '\n';
const FILE_OBSERVER_CACHE: IntersectionObserver[] = [];

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
   * Code block 'pre' HTMLElement
   */
  pre: HTMLElement;
  /**
   * Code block 'code' HTMLElement
   */
  code: HTMLElement;
  /**
   * Code block wrap div
   */
  div: HTMLElement;
  contentList: string[];
}

export function enhanceCodeBlock(
  el: HTMLElement,
  ctx: MarkdownPostProcessorContext,
  plugin: CodeBlockEnhancer
) {
  const view = plugin.app.workspace.getActiveViewOfType(MarkdownView);
  const code: HTMLElement = el.querySelector('pre > code');
  // only change pre>code
  if (!code) {
    return;
  }
  let lang = DEFAULT_LANG;
  // return when lang is in exclude list
  if (
    plugin.settings.excludeLangs.some((eLangName) =>
      code.classList.contains(`language-${eLangName}`)
    )
  ) {
    return;
  }
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
  // Ignore already has copy button
  if (pre.querySelector('div.code-block-copy-button')) {
    return;
  }
  // let div position: relative;
  div.classList.add('code-block-wrap');
  /* const { lineStart, lineEnd } = ctx.getSectionInfo(el)
  const lineSize = lineEnd - lineStart - 1 */
  const contentList: string[] = code.textContent.split(LINE_SPLIT_MARK);
  const lineSize = contentList.length - 1;
  const cbMeta: CodeBlockMeta = {
    langName: lang,
    lineSize,
    pre,
    code,
    div,
    contentList
  };
  const { useContextMenu, showLangName, showLineNumber } = plugin.settings;
  // create lang name tip in left
  if (showLangName) {
    addLangName(plugin, cbMeta);
  }
  // add line number
  if (showLineNumber) {
    addLineNumber(plugin, cbMeta);
  }
  //context menu
  if (useContextMenu) {
    enhanceContextMenu(plugin, cbMeta);
  }
}

function createElement(tagName: string, defaultClassName?: string) {
  const element = document.createElement(tagName);
  if (defaultClassName) {
    element.className = defaultClassName;
  }
  return element;
}

function enhanceContextMenu(plugin: CodeBlockEnhancer, cbMeta: CodeBlockMeta) {
  const { pre, code, lineSize } = cbMeta;
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
function addLangName(plugin: CodeBlockEnhancer, cbMeta: CodeBlockMeta) {
  const { langName, pre } = cbMeta;
  const langNameTip = createElement('span', 'code-block-lang-name');
  langNameTip.innerText = langName;
  pre.appendChild(langNameTip);
}

/**
 *
 * 重新设置行元素的样式,这里主要设置高度
 * @param singleLine 对应的行元素
 * @param cbMeta 代码块数据
 * @param i 行元素索引
 */
function resetLineNumberStyle(singleLine: HTMLElement, cbMeta: CodeBlockMeta, i: number) {
  const tempSpan = document.createElement('span');
  tempSpan.style.display = 'block';
  tempSpan.innerText = cbMeta.contentList[i] || 'A';
  cbMeta.code.appendChild(tempSpan);
  const h = tempSpan.getBoundingClientRect().height;
  if (h > 0) {
    singleLine.style.height = h + 'px';
  }
  tempSpan && tempSpan.remove();
}

/**
 * 为代码块添加行号
 * @param plugin 插件
 * @param cbMeta 代码块数据
 */
function addLineNumber(plugin: CodeBlockEnhancer, cbMeta: CodeBlockMeta) {
  const { pre } = cbMeta;
  const lineNumber = createElement('span', 'code-block-linenum-wrap');
  pre.appendChild(lineNumber);
  pre.classList.add('code-block-pre__has-linenum');
  setTimeout(() => {
    Array.from({ length: cbMeta.lineSize }, (v, k) => k).forEach((i) => {
      const singleLine = createElement('span', 'code-block-linenum');
      lineNumber.appendChild(singleLine);
      resetLineNumberStyle(singleLine, cbMeta, i);
    });
  }, 350);

  const observer = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const linenumWrap = entry.target.parentElement.querySelector('.code-block-linenum-wrap');
        const renderFlag =
          linenumWrap.getBoundingClientRect().height < cbMeta.code.getBoundingClientRect().height;
        if (linenumWrap && renderFlag) {
          linenumWrap.querySelectorAll('span.code-block-linenum').forEach((line, index) => {
            resetLineNumberStyle(line as HTMLElement, cbMeta, index);
          });
        }
      }
    });
  });
  observer.observe(cbMeta.code);
  FILE_OBSERVER_CACHE.push(observer);
}

export function clearObserverCache() {
  FILE_OBSERVER_CACHE.length = 0;
}

export function disconnectObserver() {
  FILE_OBSERVER_CACHE.forEach((ob) => ob && ob.disconnect());
}
