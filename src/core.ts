import { MarkdownPostProcessorContext, MarkdownView, Menu } from "obsidian";
import CodeBlockCopyPlugin from "./main";
const COPY_TEXT = 'Copy'
const COPY_OVER_TEXT = 'Done'
const DEFAULT_LANG_ATTR = 'language-text'
const DEFAULT_LANG = ''
const LANG_REG = /^language-/
const LINE_SPLIT_MARK = '\n'


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
  if (pre.querySelector('button.code-block-copy-button')) {
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



function createEle (tagName: string, text: string, defaultClassName?: string) {

  const element = document.createElement(tagName)
  if (defaultClassName) {
    element.className = defaultClassName
  }
  if (text) {
    element.innerText = text
  }
  return element
}
function enhanceContextMenu (plugin: CodeBlockCopyPlugin, cbMeta: CodeBlockMeta) {
  const { pre, code, lineSize } = cbMeta
  plugin.registerDomEvent(pre, 'contextmenu', (event) => {
    event.preventDefault()
    const target = <HTMLElement>event.target
    const activeView = plugin.app.workspace.activeLeaf.view as MarkdownView
    if (target.tagName !== 'BUTTON' && activeView.getMode() === 'preview') {
      const contextMenu = new Menu(plugin.app)
      // console.log(activeView.editor.getSelection().toString());
      const selection = window.getSelection().toString()
      const editView = document.querySelector('.markdown-preview-view')
      const blockHeight = parseFloat(window.getComputedStyle(pre).height)
      const viewHeight = editView.clientHeight
      const { offsetY, pageY } = event
      const toBottom = blockHeight - ((viewHeight - pageY) + offsetY)
      const toTop = offsetY - pageY + 100

      let eRowNum = Math.ceil((offsetY - 16) / 24)
      if (eRowNum < 1) {
        eRowNum = 1
      } else if (eRowNum > lineSize) {
        eRowNum = lineSize
      }
      // console.log(viewHeight, blockHeight, pageY, offsetY, toBottom, toTop,eRowNum);

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
                editView.scrollTop -= toTop
              })
          })
        }
        if (toBottom > 0) {
          contextMenu.addItem((item) => {
            item
              .setTitle('To Bottom')
              .onClick((e) => {
                // activeView.currentMode.applyScroll(activeView.currentMode.getScroll() + result / 24)
                editView.scrollTop += toBottom
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
  const langNameTip = createEle('span', langName, 'code-block-lang-name')
  pre.appendChild(langNameTip)
}

function addCopyButton (plugin: CodeBlockCopyPlugin, cbMeta: CodeBlockMeta) {
  const { code, pre } = cbMeta
  const copyButton = createEle('button', COPY_TEXT, 'code-block-copy-button')
  const copyHandler = () => {
    const cpBtClassList = copyButton.classList
    const doneClassName = 'code-block-copy-button__copied'
    navigator.clipboard.writeText(code.textContent).then(function () {
      copyButton.innerText = COPY_OVER_TEXT;
      cpBtClassList.add(doneClassName)
      setTimeout(function () {
        copyButton.innerText = COPY_TEXT;
        cpBtClassList.remove(doneClassName)
      }, 1000);
    }, function (error: Error) {
      copyButton.innerText = 'Error';
    });
  }
  plugin.registerDomEvent(copyButton, 'click', copyHandler)
  pre.appendChild(copyButton);

}


function addLineNumber (plugin: CodeBlockCopyPlugin, cbMeta: CodeBlockMeta) {
  const { lineSize, pre } = cbMeta
  // const { fontSize, lineHeight } = window.getComputedStyle(cbMeta.code)
  const lineNumber = createEle('span', null, 'code-block-linenum-wrap')
  Array.from({ length: lineSize }, (v, k) => k).forEach(i => {
    const singleLine = createEle('span', null, 'code-block-linenum')
    // singleLine.style.fontSize = fontSize
    // singleLine.style.lineHeight = lineHeight
    lineNumber.appendChild(singleLine)
  })
  pre.appendChild(lineNumber)
  pre.classList.add('code-block-pre__has-linenum')
}
