import { debounce, MarkdownPostProcessorContext, Menu } from 'obsidian';
import CodeBlockEnhancer from './main';
import { v4 as uuidv4 } from 'uuid';

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
const FILE_OBSERVER_CACHE: IntersectionObserver[] = [];

const META_CACHE = new Map<String, CodeBlockMeta>();

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

export function enhanceCodeBlock(
  el: HTMLElement,
  ctx: MarkdownPostProcessorContext,
  plugin: CodeBlockEnhancer
) {
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
    addLangName(plugin, ctx, cbMeta);
  }
  // add line number
  if (showLineNumber) {
    addLineNumber(plugin, ctx, cbMeta);
  }
  //add context menu
  if (useContextMenu) {
    addContextMenu(plugin, ctx, cbMeta);
  }
}

function addContextMenu(
  plugin: CodeBlockEnhancer,
  ctx: MarkdownPostProcessorContext,
  cbMeta: CodeBlockMeta
) {
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
function addLangName(
  plugin: CodeBlockEnhancer,
  ctx: MarkdownPostProcessorContext,
  cbMeta: CodeBlockMeta
) {
  const { langName, pre } = cbMeta;
  pre.append(createEl('div', { cls: CLS.LANGUAGE_NAME, text: langName }));
}

/**
 *
 * 重新设置行元素的样式,这里主要设置高度
 * @param line 对应的行元素
 * @param cbMeta 代码块数据
 * @param i 行元素索引
 */
function resetLineNumberStyle(line: HTMLElement, cbMeta: CodeBlockMeta, i: number) {
  const { codeWidth, maxWidth, minWidth, lineHeight } = BASE_LINE_INFO;

  const text = cbMeta.contentList[i];
  const oneSize = Math.floor(codeWidth / maxWidth);
  const length = text.length;

  let h = lineHeight;

  if (length > oneSize) {
    let width = 0;
    let size = 1;
    for (let i = 0; i < length; i++) {
      const char = text.charCodeAt(i);
      width += isMonoSpaceUnicode(char) ? minWidth : maxWidth;
      if (width >= codeWidth) {
        size++;
        width = 0;
      }
    }
    h = size * lineHeight;
    /*     // 有误差 不适合
    for (let i = 0; i < length; i++) {
      const char = text.charCodeAt(i);
      width += isMonoSpaceUnicode(char) ? minWidth : maxWidth;
    }
    let size = Math.ceil(width / codeWidth);
    h = size * lineHeight; */
    /*     // 行数很多有性能问题 千行以上
         if (/^\s+/.test(text) && length > 4 * oneSize) {
      const tempSpan = document.createElement('span');
      tempSpan.style.display = 'block';
      tempSpan.innerText = text || 'A';
      cbMeta.code.append(tempSpan);
      const rect = tempSpan.getBoundingClientRect();
      h = rect.height;
      tempSpan.remove();
    }   */
  }
  line.style.height = h + 'px';
}

/**
 * 为代码块添加行号
 * @param plugin 插件
 * @param cbMeta 代码块数据
 */
function addLineNumber(
  plugin: CodeBlockEnhancer,
  ctx: MarkdownPostProcessorContext,
  cbMeta: CodeBlockMeta
) {
  const { pre, code, lineSize } = cbMeta;
  const wrap = createEl('span', { cls: CLS.LN_WRAP });
  pre.appendChild(wrap);
  pre.classList.add(CLS.HAS_LINENUMBER);
  const uuid = uuidv4();

  META_CACHE.set(uuid, cbMeta);
  pre.setAttribute(ATTR.CBE_ID, uuid);
  code.setAttribute(ATTR.CBE_ID, uuid);

  const mutationOb = new MutationObserver(
    debounce((mutations) => {
      Array.from({ length: cbMeta.lineSize }, (v, k) => k).forEach((i) => {
        const line = createEl('span', { cls: CLS.LN_LINE });
        wrap.appendChild(line);
        resetLineNumberStyle(line, cbMeta, i);
      });

      const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const code = entry.target;
            if (BASE_LINE_INFO.updated == false) {
              updateBaseLineInfo(code);
            }
            const wrap = code.parentElement.querySelector(`.${CLS.LN_WRAP}`);
            Array.from(wrap.children).forEach((line, index) => {
              resetLineNumberStyle(line as HTMLElement, cbMeta, index);
            });
          }
        });
      });
      observer.observe(cbMeta.code);
      FILE_OBSERVER_CACHE.push(observer);
      mutationOb.disconnect();
    }, 1000)
  );
  mutationOb.observe(pre, { attributes: false, childList: true });
}

export function clearObserverCache() {
  FILE_OBSERVER_CACHE.length = 0;
}

export function disconnectObserver() {
  FILE_OBSERVER_CACHE.forEach((ob) => ob && ob.disconnect());
}

function isMonoSpaceUnicode(code: number) {
  // 判断是否在拉丁字母、法语、德语、西里尔字母、数字和常见符号范围内
  return (
    (code >= 0x0041 && code <= 0x005a) || // A-Z
    (code >= 0x0061 && code <= 0x007a) || // a-z
    (code >= 0x00c0 && code <= 0x00ff) || // 法语字符
    (code >= 0x0030 && code <= 0x0039) || // 0-9
    (code >= 0x0020 && code <= 0x007e) || // 常见符号
    (code >= 0x0100 && code <= 0x017f) || // 拉丁扩展 A
    (code >= 0x0180 && code <= 0x024f) || // 拉丁扩展 B
    (code >= 0x0400 && code <= 0x042f) || // 西里尔大写字母
    (code >= 0x0430 && code <= 0x044f) // 西里尔小写字母
  );
}

/**
 * 更新缓存的文字信息;
 * 感觉可以改成每个代码块第一行时计算,然后缓存给这个代码块后续使用,到最后一行时移除缓存
 */
export function updateLineInfo() {
  BASE_LINE_INFO.updated = false;
  const codeBlocks = getVisibleElement('pre>code');
  codeBlocks.forEach((code: HTMLElement, index: number) => {
    if (index == 0) {
      updateBaseLineInfo(code);
    }
    const uuid = code.getAttribute(ATTR.CBE_ID);
    const cbMeta = META_CACHE.get(uuid);
    if (cbMeta) {
      code.parentElement
        .querySelectorAll(`.${CLS.LN_LINE}`)
        .forEach((line: HTMLElement, i: number) => {
          resetLineNumberStyle(line, cbMeta, i);
        });
    }
  });
}

function updateBaseLineInfo(target: Element) {
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

/**
 * 获取可视窗口中指定类的元素
 * @param selector 选择器
 * @returns 可视元素
 */
function getVisibleElement(selector: string) {
  // 获取所有指定的元素列表
  // 过滤出可视窗口中部分可见的元素
  const elements = Array.from(document.querySelectorAll(selector)).filter((element) => {
    const rect = element.getBoundingClientRect();
    return (
      rect.bottom > 0 &&
      rect.right > 0 &&
      rect.top < (window.innerHeight || document.documentElement.clientHeight) &&
      rect.left < (window.innerWidth || document.documentElement.clientWidth)
    );
  }) as HTMLElement[];
  return elements;
}
