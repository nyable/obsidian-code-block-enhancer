import { Notice } from 'obsidian';
import { i18n } from './i18n';
import { CLS } from './constant';
import domToImage from 'dom-to-image-more';
/**
 * 判断字符的宽度是否是英文字母宽度的
 * @param code charCode
 * @returns boolean
 */
export function isMonoSpaceUnicode(code: number) {
    // 用来判断字符的宽度,目前就分成两个宽度,一个是英文/数字/英文符号等，另一个像中文日文之类更宽的
    // 有少部分特殊的字符宽度会更大,但是一般用不到,先把常用的算出来就好
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
 * 获取可视窗口中指定类的元素
 * @param selector 选择器
 * @returns 可视元素
 */
export function queryVisibleElement(selector: string) {
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

/**
 * 将 {1,3,7-9}格式的字符串解析成一个数组[1,3,7,8,9]
 * @param input string
 * @returns number[]
 */
export function parseLineRange(input: string) {
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

export function snapshot(pre: HTMLElement) {
    domToImage
        //@ts-ignore
        .toCanvas(pre, {
            style: {
                margin: '0px'
            },
            // @ts-ignore
            adjustClonedNode: (node: HTMLElement, clone: HTMLElement, after: any) => {
                if (!after) {
                    const classList = clone.classList;
                    if (classList) {
                        if (classList.contains(CLS.H_TOOLBAR)) {
                            clone.style.display = 'none';
                        }
                        if (classList.contains(CLS.HEADER)) {
                            clone.style.borderRadius = '4px';
                            const size = '1em';
                            const btnGroup = createDiv();
                            btnGroup.style.display = 'flex';
                            btnGroup.style.width = '6em';
                            btnGroup.style.alignSelf = 'center';
                            btnGroup.style.padding = '0 1em';
                            btnGroup.style.gap = '8px';
                            const bgColors = ['#ff5f57', '#ffbd2e', '#28c940'];
                            bgColors.forEach((color) => {
                                const btn = document.createElement('div');
                                btn.style.width = size;
                                btn.style.height = size;
                                btn.style.borderRadius = '50%';
                                btn.style.backgroundColor = color;
                                btnGroup.append(btn);
                            });
                            clone.append(btnGroup);
                        }
                        if (classList.contains(CLS.H_LANG_NAME)) {
                            clone.style.flex = '1';
                            clone.style.textAlign = 'right';
                            clone.style.paddingRight = '1em';
                            clone.style.fontSize = '1em';
                            clone.style.fontWeight = 'bold';
                        }
                    }
                }
                return clone;
            }
        })
        .then((b: HTMLCanvasElement) => {
            const nCanvas = document.createElement('canvas');
            const nCtx = nCanvas.getContext('2d');
            const mw = 32;
            const mh = 32;

            nCanvas.width = b.width + mw;
            nCanvas.height = b.height + mh;
            if (nCtx) {
                const gradient = nCtx.createLinearGradient(0, 0, nCanvas.width, nCanvas.height);
                ['#ffafbd', '#ffc3a0', '#ffccbc', '#d1c4e9', '#c5e1a5'].forEach(
                    (color, index, arr) => {
                        gradient.addColorStop(index / (arr.length - 1), color);
                    }
                );
                nCtx.fillStyle = gradient;
                nCtx.fillRect(0, 0, nCanvas.width, nCanvas.height);
                // 设置阴影属性
                nCtx.shadowColor = 'rgba(0, 0, 0, 0.2)';
                nCtx.shadowBlur = 10;
                nCtx.shadowOffsetX = -5;
                nCtx.shadowOffsetY = 5;

                nCtx.drawImage(b, mw / 2, mh / 2, b.width, b.height);
                nCanvas.toBlob((nblob) => {
                    if (nblob) {
                        navigator.clipboard
                            .write([new ClipboardItem({ 'image/png': nblob })])
                            .then(() => {
                                new Notice(i18n.t('common.notice.copySuccess'));
                            });
                    }
                });
            }
        });
}

export function copyText(text: string | null) {
    if (text != null) {
        navigator.clipboard.writeText(text).then(() => {
            new Notice(i18n.t('common.notice.copySuccess'));
        });
    }
}
