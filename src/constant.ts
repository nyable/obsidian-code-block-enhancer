export const LinenumHoverMode = {
    /**
     * 无行为
     */
    None: 'None',
    /**
     * 高亮
     */
    Highlight: 'Highlight'
};

export const LineClickMode = {
    /**
     * 无行为
     */
    None: 'None',
    /**
     * 复制
     */
    Copy: 'Copy',
    /**
     * 临时高亮
     */
    Highlight: 'Highlight'
};
export enum CbeCssVar {
    codeFontSize = '--cb-font-size',
    headerHeight = '--cb-top-height',
    linenumBg = '--cb-linenum-bg',
    linenumBorder = '--cb-linenum-border',
    linenumColor = '--cb-linenum-color',
    linenumHighlightColor = '--cb-linenum-highlight-color'
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
    LN_HIGHLIGHT = 'cbe-line-highlight',
    /**
     * obsidian自带的类 可点击的按钮
     */
    OB_CLICKABLE = 'clickable-icon',
    /**
     * 工具栏中的按钮
     */
    H_TOOL_BTN = 'cbe-toolbar-btn',
    /**
     * 启用替换复制按钮后在最外层加的类
     */
    HAS_COPYBTN = 'cbe-has-copy-btn',
    /**
     * 启用折叠按钮后在最外层加的类
     */
    HAS_COLLAPSED = 'cbe-collapsed',
    /**
     * 鼠标悬浮在行号时的类
     */
    LN_ON_HOVER = 'cbe-line-hover'
}
