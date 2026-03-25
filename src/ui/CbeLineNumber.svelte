<!-- CbeLineNumber.svelte -->
<script lang="ts">
    import { CLS, LineClickMode, LinenumHoverMode } from 'src/constant';
    import { boxSizeStore } from 'src/store';
    import { copyText, isMonoSpaceUnicode } from 'src/util';
    import { onMount } from 'svelte';
    interface Props {
        /**
         * 设置
         */
        settings: CbeSettings;
        /**
         * 代码块的基本信息
         */
        cbeInfo: CbeInfo;
        /**
         * 获取高亮行的回调函数
         */
        getHighLightLines: () => number[];
    }

    let { settings, cbeInfo, getHighLightLines }: Props = $props();

    let baseLineInfo = $state({
        minWidth: 0,
        maxWidth: 0,
        lineHeight: 0,
        codeWidth: 0,
        tabSize: 4
    });
    let defaultHighLightLines: number[] = $state.raw([]);

    let cachedBoxSize: BoxSize;
    let measureCtx: CanvasRenderingContext2D | null = document
        .createElement('canvas')
        .getContext('2d');
    const lineRefs: HTMLElement[] = [];

    /**
     * 字符宽度缓存
     * 虽然用了canvas计算本身性能也还可以，但是如果单行长度比较多的话，还是会调用很多次；
     * 所以这里缓存一下，减少`measureText`的调用。
     * 这里先简单处理一下，后续再观察一下
     */
    const charWidthCache = new Map<string, number>();

    onMount(() => {
        if (settings.showLineNumber) {
            cbeInfo.pre.classList.add(CLS.HAS_LINENUMBER);
            const code = cbeInfo.code;

            const unSubscribe = boxSizeStore.subscribe((boxSize) => {
                cachedBoxSize = boxSize;
                if (cachedBoxSize.width != cachedBoxSize.oldWidth) {
                    updateBaseLineInfo(code);
                }
            });

            const blockObs = new IntersectionObserver((entries, observer) => {
                for (const entry of entries) {
                    const target = entry.target as HTMLElement;
                    if (entry.isIntersecting) {
                        updateBaseLineInfo(target);
                        defaultHighLightLines = getHighLightLines();
                    }
                }
            });
            blockObs.observe(code);
            return () => {
                unSubscribe();
                blockObs.unobserve(code);
                blockObs.disconnect(); // 🔧 完全销毁 Observer，防止内存泄漏
            };
        }
    });
    export const updateBaseLineInfo = (target: HTMLElement) => {
        const tempSpan = createEl('span');
        target.append(tempSpan);

        tempSpan.style.display = 'inline-block';
        tempSpan.innerText = 'A';
        baseLineInfo.minWidth = tempSpan.getBoundingClientRect().width;
        tempSpan.innerText = '好';
        baseLineInfo.maxWidth = tempSpan.getBoundingClientRect().width;

        tempSpan.style.display = 'block';
        tempSpan.innerText = 'A好';
        const rect = tempSpan.getBoundingClientRect();
        baseLineInfo.lineHeight = rect.height;
        baseLineInfo.codeWidth = target.getBoundingClientRect().width;

        tempSpan.remove();
        const computedStyle = getComputedStyle(target);
        baseLineInfo.tabSize = parseInt(computedStyle.tabSize) || 4;

        // 更新 canvas context 的字体以匹配代码元素
        if (measureCtx) {
            measureCtx.font = computedStyle.font;
            // 这里考虑到切换字体之类的情况可能会导致`charWidthCache`缓存的值与实际宽度对不上
            // 因此试过比对新旧字体然后清除缓存，但是发现单纯比较`font`的字符串值没啥意义，大概率是不同一样的。
            // 大多数代码块用的字体都比较正常，基本上没有影响所以暂时不用管
        }
    };

    const computeHeight = (cbeInfo: CbeInfo, index: number) => {
        const { codeWidth, maxWidth, minWidth, lineHeight, tabSize } = baseLineInfo;

        const text = cbeInfo.lineTextList[index];
        const perLineMinSize = Math.floor(codeWidth / maxWidth);
        const length = text.length;

        let h = lineHeight;
        if (length > perLineMinSize) {
            let currentWidth = 0;
            let size = 1;
            for (let i = 0; i < length; i++) {
                const char = text.charCodeAt(i);
                let charWidth = 0;
                if (char == 9) {
                    charWidth = minWidth * tabSize;
                } else if (measureCtx) {
                    const ch = text[i];
                    const cached = charWidthCache.get(ch);
                    if (cached != null) {
                        charWidth = cached;
                    } else {
                        charWidth = measureCtx.measureText(ch).width;
                        charWidthCache.set(ch, charWidth);
                    }
                } else {
                    charWidth = isMonoSpaceUnicode(char) ? minWidth : maxWidth;
                }
                currentWidth += charWidth;
                if (currentWidth > codeWidth) {
                    size++;
                    currentWidth = charWidth;
                }
            }
            h = size * lineHeight;
        }

        return h;
    };

    /**
     * 单击行号时的行为
     * @param index 行号
     */
    const clickLine = (index: number): void => {
        lineEventModeHandler(settings.linenumClickMode, index);
    };
    /**
     * 右键行号时的行为
     * @param index 行号
     */
    const rightClickLine = (index: number): void => {
        lineEventModeHandler(settings.linenumRightClickMode, index);
    };

    const lineEventModeHandler = (mode: string, index: number) => {
        if (mode === LineClickMode.Copy) {
            copyText(cbeInfo.lineTextList[index]);
        } else if (mode === LineClickMode.Highlight) {
            const lineElement = lineRefs[index];
            if (lineElement) {
                if (lineElement.classList.contains(CLS.LN_HIGHLIGHT)) {
                    lineElement.classList.remove(CLS.LN_HIGHLIGHT);
                } else if (lineElement.classList.contains(CLS.LN_HIGHLIGHT_TEMP)) {
                    lineElement.classList.remove(CLS.LN_HIGHLIGHT_TEMP);
                } else {
                    lineElement.classList.add(CLS.LN_HIGHLIGHT_TEMP);
                }
            }
        }
    };

    /**
     * 重置高亮：清除所有临时高亮，恢复到永久高亮状态
     */
    export const resetHighlight = () => {
        // 清除所有行的高亮状态
        lineRefs.forEach((lineElement) => {
            if (lineElement) {
                lineElement.classList.remove(CLS.LN_HIGHLIGHT);
                lineElement.classList.remove(CLS.LN_HIGHLIGHT_TEMP);
            }
        });
        // 重新应用永久高亮
        defaultHighLightLines.forEach((lineNum) => {
            const index = lineNum - 1;
            if (lineRefs[index]) {
                lineRefs[index].classList.add(CLS.LN_HIGHLIGHT);
            }
        });
    };

    /**
     * 获取当前所有高亮的行号（包括永久和临时）
     */
    export const getCurrentHighlightLines = (): number[] => {
        const highlightLines: number[] = [];
        lineRefs.forEach((lineElement, index) => {
            if (
                lineElement &&
                (lineElement.classList.contains(CLS.LN_HIGHLIGHT) ||
                    lineElement.classList.contains(CLS.LN_HIGHLIGHT_TEMP))
            ) {
                highlightLines.push(index + 1);
            }
        });
        return highlightLines.sort((a, b) => a - b);
    };

    /**
     * 保存高亮：将当前高亮状态同步到永久高亮
     */
    export const saveHighlight = () => {
        defaultHighLightLines = getCurrentHighlightLines();
        // 清除所有高亮样式
        lineRefs.forEach((lineElement) => {
            if (lineElement) {
                lineElement.classList.remove(CLS.LN_HIGHLIGHT);
                lineElement.classList.remove(CLS.LN_HIGHLIGHT_TEMP);
            }
        });
        // 重新应用永久高亮
        defaultHighLightLines.forEach((lineNum) => {
            const index = lineNum - 1;
            if (lineRefs[index]) {
                lineRefs[index].classList.add(CLS.LN_HIGHLIGHT);
            }
        });
    };

    /**
     * 获取当前所有临时高亮的行号
     */
    export const getTempHighlightLines = (): number[] => {
        const highlightLines: number[] = [];
        lineRefs.forEach((lineElement, index) => {
            if (lineElement && lineElement.classList.contains(CLS.LN_HIGHLIGHT_TEMP)) {
                highlightLines.push(index + 1);
            }
        });
        return highlightLines.sort((a, b) => a - b);
    };
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
{#if settings.showLineNumber}
    <div class="cbe-linenum-wrap">
        {#each Array(cbeInfo.lineCount) as _, index}
            <div
                bind:this={lineRefs[index]}
                onclick={(e) => {
                    e.preventDefault();
                    clickLine(index);
                }}
                oncontextmenu={(e) => {
                    e.preventDefault();
                    rightClickLine(index);
                }}
                class:cbe-line={true}
                class:cbe-line-hover={settings.linenumHoverMode == LinenumHoverMode.Highlight}
                class:cbe-line-highlight={defaultHighLightLines.includes(index + 1)}
                style="height: {computeHeight(cbeInfo, index)}px;"
                data-linenum={index + 1}
            >
                <div class="cbe-linenum" data-linenum={index + 1}></div>
            </div>
        {/each}
    </div>
{/if}
