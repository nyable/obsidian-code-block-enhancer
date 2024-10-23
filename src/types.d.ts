interface CbeSettings {
    /**
     * 排除的语言
     */
    excludeLangs: string[];
    /**
     * 是否增强右键菜单栏
     */
    useContextMenu: boolean;
    /**
     * 是否展示行号
     */
    showLineNumber: boolean;
    /**
     * 行号的颜色
     */
    linenumFontColor: string;
    /**
     * 行号高亮的颜色
     */
    linenumHighlightColor: string;
    /**
     * 是否展示语言名称
     */
    showLangName: boolean;
    /**
     * 是否展示代码块折叠按钮
     */
    showCollapseBtn: boolean;
    /**
     * 是否展示代码块截图按钮
     */
    showCodeSnap: boolean;
    /**
     * 启用复制按钮图标
     */
    enableCbeCopyBtn: boolean;
    /**
     * 代码块字体大小 14px
     */
    codeFontSize: string;
    /**
     * 悬浮在行号时的行为
     */
    linenumHoverMode: string;
    /**
     * 单击行号时的行为
     */
    linenumClickMode: string;
}

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
    firstLine: string;
    lineNumberWrapEl: HTMLElement | null;
}

interface BaseLineInfo {
    updated: boolean;
    minWidth: number;
    maxWidth: number;
    lineHeight: number;
    codeWidth: number;
    tabSize: number;
}

declare module 'dom-to-image-more' {
    import domToImage = require('dom-to-image');
    export = domToImage;
}
