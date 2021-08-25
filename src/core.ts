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
  pre: Element;
  /**
   * Code block 'code' HTMLElement
   */
  code: Element;
}

export function enhancerCodeBlock (el: HTMLElement, ctx: MarkdownPostProcessorContext, plugin: CodeBlockCopyPlugin) {
  let lang = DEFAULT_LANG
  const code = el.querySelector('pre > code')
  const pre = code.parentElement
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
  // let pre be position: relative;
  pre.classList.add('code-block-wrap')
  const lineSize = code.textContent.split(LINE_SPLIT_MARK).length - 1
  const cbMeta: CodeBlockMeta = { langName: lang, lineSize, pre, code }
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
  copyButton.addEventListener('click', function () {
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
  });
  pre.appendChild(copyButton);

}


function addLineNumber (plugin: CodeBlockCopyPlugin, cbMeta: CodeBlockMeta) {
  const { lineSize, pre } = cbMeta
  if (plugin.settings.showLineNumber) {
    const lineNumber = createEle('span', null, 'code-block-linenum-wrap')
    Array.from({ length: lineSize }, (v, k) => k).forEach(i => {
      lineNumber.appendChild(createEle('span', null, 'code-block-linenum'))
    })
    pre.appendChild(lineNumber)
    pre.classList.add('code-block-wrap__has-linenum')
  }
}