import { MarkdownPostProcessorContext } from "obsidian";
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
}

export function enhancerCodeBlock (el: HTMLElement, ctx: MarkdownPostProcessorContext, plugin: CodeBlockCopyPlugin) {
  let lang = DEFAULT_LANG
  const code: HTMLElement = el.querySelector('pre > code')
  if (!code) {
    return
  }
  const pre = code.parentElement
  const div = pre.parentElement
  const temp = document.createElement('div')
  temp.innerHTML = el.innerHTML
  const tpCode = temp.querySelector('pre > code')
  // return when lang is in exclude list
  if (plugin.settings.excludeLangs.some(eLangName => tpCode.classList.contains(`language-${eLangName}`))) {
    return
  }
  tpCode.classList.forEach((value, key, parent) => {
    if (LANG_REG.test(value)) {
      lang = value.replace('language-', '')
      return
    }
  })
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
  const lineSize = code.textContent.split(LINE_SPLIT_MARK).length - 1
  const cbMeta: CodeBlockMeta = { langName: lang, lineSize, pre, code, div }
  // create copy button in right
  addCopyButton(plugin, cbMeta)
  // create lang name tip in left
  addLangName(plugin, cbMeta)
  // add line number
  addLineNumber(plugin, cbMeta)
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

function addLangName (plugin: CodeBlockCopyPlugin, cbMeta: CodeBlockMeta) {
  const { langName, pre } = cbMeta
  if (plugin.settings.showLangName) {
    const langNameTip = createEle('span', langName, 'code-block-lang-name')
    pre.appendChild(langNameTip)
  }
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
  if (plugin.settings.showLineNumber) {
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
}