import { MarkdownPostProcessorContext, Menu } from "obsidian";
import CodeBlockCopyPlugin from "./main";

const DEFAULT_LANG_ATTR = 'language-text'
const DEFAULT_LANG = ''
const LANG_REG = /^language-/
const LINE_SPLIT_MARK = '\n'

const SVG_COPY = parseToSVG('<?xml version="1.0" encoding="utf-8"?> <svg height="16" width="16" viewBox="0 0 16 16" version="1.1" data-view-component="true" class="copy" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" d="M5.75 1a.75.75 0 00-.75.75v3c0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75v-3a.75.75 0 00-.75-.75h-4.5zm.75 3V2.5h3V4h-3zm-2.874-.467a.75.75 0 00-.752-1.298A1.75 1.75 0 002 3.75v9.5c0 .966.784 1.75 1.75 1.75h8.5A1.75 1.75 0 0014 13.25v-9.5a1.75 1.75 0 00-.874-1.515.75.75 0 10-.752 1.298.25.25 0 01.126.217v9.5a.25.25 0 01-.25.25h-8.5a.25.25 0 01-.25-.25v-9.5a.25.25 0 01.126-.217z"></path></svg>')
const SVG_SUCCESS = parseToSVG('<?xml version="1.0" encoding="utf-8"?> <svg height="16" width="16" viewBox="0 0 16 16" version="1.1" data-view-component="true" class="copy-success" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"></path></svg>')

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

export function enhanceCodeBlock (el: HTMLElement, ctx: MarkdownPostProcessorContext, plugin: CodeBlockCopyPlugin) {
  const code: HTMLElement = el.querySelector('pre > code')
  // only change pre>code
  if (!code) {
    return
  }
  let lang = DEFAULT_LANG
  // return when lang is in exclude list
  if (plugin.settings.excludeLangs.some(eLangName => code.classList.contains(`language-${eLangName}`))) {
    return
  }
  code.classList.forEach((value, key, parent) => {
    if (LANG_REG.test(value)) {
      lang = value.replace('language-', '')
      return
    }
  })
  const pre = code.parentElement
  const div = pre.parentElement
  // Add default language style when lang is empty
  if (!code.classList.toString().contains('language-')) {
    pre.classList.add(DEFAULT_LANG_ATTR)
  }
  // Ignore already has copy button 
  if (pre.querySelector('div.code-block-copy-button')) {
    return;
  }
  // let div position: relative;
  div.classList.add('code-block-wrap')
  /* const { lineStart, lineEnd } = ctx.getSectionInfo(el)
  const lineSize = lineEnd - lineStart - 1 */
  const contentList: string[] = code.textContent.split(LINE_SPLIT_MARK)
  const lineSize = contentList.length - 1
  const cbMeta: CodeBlockMeta = { langName: lang, lineSize, pre, code, div, contentList }
  const { useContextMenu, showLangName, showLineNumber } = plugin.settings
  // create copy button in right
  addCopyButton(plugin, cbMeta)
  // create lang name tip in left
  if (showLangName) {
    addLangName(plugin, cbMeta)
  }
  // add line number
  if (showLineNumber) {
    addLineNumber(plugin, cbMeta)
  }
  //context menu
  if (useContextMenu) {
    enhanceContextMenu(plugin, cbMeta)
  }
}



function createElement (tagName: string, defaultClassName?: string) {
  const element = document.createElement(tagName)
  if (defaultClassName) {
    element.className = defaultClassName
  }
  return element
}

function enhanceContextMenu (plugin: CodeBlockCopyPlugin, cbMeta: CodeBlockMeta) {
  const { pre, code, lineSize } = cbMeta
  plugin.registerDomEvent(pre, 'contextmenu', (event) => {
    event.preventDefault()
    const target = <HTMLElement>event.target
    if (target.tagName !== 'BUTTON') {
      const contextMenu = new Menu(plugin.app)
      const selection = window.getSelection().toString()
      const editView = document.querySelector('.markdown-preview-view')
      const blockHeight = parseFloat(window.getComputedStyle(pre).height)
      const viewHeight = editView.clientHeight
      const { offsetY, pageY } = event
      const toBottom = blockHeight - ((viewHeight - pageY) + offsetY)
      const toTop = offsetY - pageY + 100
      const eventScrollTop = editView.scrollTop
      let eRowNum = Math.ceil((offsetY - 16) / 24)
      if (eRowNum < 1) {
        eRowNum = 1
      } else if (eRowNum > lineSize) {
        eRowNum = lineSize
      }
      if (selection) {
        contextMenu.addItem((item) => {
          item
            .setTitle('Copy')
            .setIcon('two-blank-pages', 16)
            .onClick((e) => {
              navigator.clipboard.writeText(selection)
            })
        })
      }
      contextMenu.addItem((item) => {
        item
          .setTitle('Copy Block')
          .setIcon('two-blank-pages', 16)
          .onClick(() => {
            navigator.clipboard.writeText(code.textContent)
          })
      })
      contextMenu.addItem((item) => {
        item
          .setTitle('Copy Row')
          .setIcon('two-blank-pages', 16)
          .onClick(() => {
            navigator.clipboard.writeText(cbMeta.contentList[eRowNum - 1])
          })
      })

      if (blockHeight > viewHeight) {
        if (toTop > 0) {
          contextMenu.addItem((item) => {
            item
              .setTitle('To Top')
              .onClick((e) => {
                editView.scrollTop = eventScrollTop - toTop
              })
          })
        }
        if (toBottom > 0) {
          contextMenu.addItem((item) => {
            item
              .setTitle('To Bottom')
              .onClick((e) => {
                editView.scrollTop = eventScrollTop + toBottom
              })
          })
        }
      }
      contextMenu.showAtPosition({ x: event.clientX, y: event.clientY })
    }
  })

}
function addLangName (plugin: CodeBlockCopyPlugin, cbMeta: CodeBlockMeta) {
  const { langName, pre } = cbMeta
  const langNameTip = createElement('span', 'code-block-lang-name')
  langNameTip.innerText = langName
  pre.appendChild(langNameTip)
}

function addCopyButton (plugin: CodeBlockCopyPlugin, cbMeta: CodeBlockMeta) {
  const { code, pre } = cbMeta
  const copyButton = createElement('div', 'code-block-copy-button')
  copyButton.setAttribute('aria-label', 'Copy')
  replaceFirstChild(copyButton, SVG_COPY())

  const copyHandler = () => {
    navigator.clipboard.writeText(code.textContent).then(() => {
      replaceFirstChild(copyButton, SVG_SUCCESS())
      setTimeout(() => {
        replaceFirstChild(copyButton, SVG_COPY())
      }, 1500);
    }, () => {
      copyButton.innerText = 'Error';
    });
  }
  plugin.registerDomEvent(copyButton, 'click', copyHandler)
  pre.appendChild(copyButton);
  pre.classList.add('code-block-pre__has-copy-button')
}


function addLineNumber (plugin: CodeBlockCopyPlugin, cbMeta: CodeBlockMeta) {
  const { lineSize, pre } = cbMeta
  // const { fontSize, lineHeight } = window.getComputedStyle(cbMeta.code)
  const lineNumber = createElement('span', 'code-block-linenum-wrap')
  Array.from({ length: lineSize }, (v, k) => k).forEach(i => {
    const singleLine = createElement('span', 'code-block-linenum')
    // singleLine.style.fontSize = fontSize
    // singleLine.style.lineHeight = lineHeight
    lineNumber.appendChild(singleLine)
  })
  pre.appendChild(lineNumber)
  pre.classList.add('code-block-pre__has-linenum')
}

function parseToSVG (svgString: string) {
  return function () {
    return new DOMParser().parseFromString(svgString, 'image/svg+xml').firstChild
  }
}

function replaceFirstChild (target: HTMLElement, child: ChildNode) {
  if (target.childNodes && target.childNodes.length > 0) {
    target.removeChild(target.childNodes[0])
  }
  target.appendChild(child)
}