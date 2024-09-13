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
