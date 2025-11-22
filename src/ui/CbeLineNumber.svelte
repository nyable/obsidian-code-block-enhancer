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
    const lineRefs: HTMLElement[] = [];
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
        baseLineInfo.tabSize = parseInt(getComputedStyle(target).tabSize) || 4;
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

    const clickLine = (index: number): void => {
        if (settings.linenumClickMode === LineClickMode.Copy) {
            copyText(cbeInfo.lineTextList[index]);
        } else if (settings.linenumClickMode === LineClickMode.Highlight) {
            const lineElement = lineRefs[index];
            if (lineElement) {
                lineElement.classList.toggle(CLS.LN_HIGHLIGHT);
            }
        }
    };
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
{#if settings.showLineNumber}
    <div class="cbe-linenum-wrap">
        {#each Array(cbeInfo.lineCount) as _, index}
            <div
                bind:this={lineRefs[index]}
                onclick={() => clickLine(index)}
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
