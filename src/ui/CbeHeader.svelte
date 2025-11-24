<script lang="ts">
    import { ChevronDown, Camera, Copy, MoreVertical } from 'lucide-svelte';
    import { CLS } from 'src/constant';
    import { i18n } from 'src/i18n';
    import { copyText, snapshot, formatLineRange } from 'src/util';
    import { Menu, Notice, MarkdownView, TFile, type MarkdownPostProcessorContext } from 'obsidian';
    import type CbeLineNumber from './CbeLineNumber.svelte';

    interface Props {
        settings: CbeSettings;
        cbeInfo: CbeInfo;
        lineNumberComponent?: any;
        ctx?: MarkdownPostProcessorContext;
    }
    let { settings, cbeInfo, lineNumberComponent, ctx }: Props = $props();
    const iconClass = 'clickable-icon cbe-toolbar-btn';
    const iconSize = 18;
    const toggleCodeBlock = () => {
        cbeInfo.pre.classList.toggle(CLS.HAS_COLLAPSED);
    };
    const takeCodeSnap = () => {
        snapshot(cbeInfo.pre);
    };

    const copyBlockText = () => {
        copyText(cbeInfo.code.textContent);
    };

    // 菜单按钮点击处理
    const handleMenuClick = (event: MouseEvent) => {
        const menu = new Menu();

        // 选项 1: 重置高亮
        menu.addItem((item) => {
            item.setTitle('重置高亮')
                .setIcon('rotate-ccw')
                .onClick(() => {
                    if (lineNumberComponent && 'resetHighlight' in lineNumberComponent) {
                        (lineNumberComponent as any).resetHighlight();
                        new Notice('已重置高亮状态');
                    }
                });
        });

        // 选项 2: 保存高亮
        menu.addItem((item) => {
            item.setTitle('保存高亮')
                .setIcon('save')
                .onClick(async () => {
                    if (
                        lineNumberComponent &&
                        'getCurrentHighlightLines' in lineNumberComponent &&
                        ctx
                    ) {
                        const highlightLines = (
                            lineNumberComponent as any
                        ).getCurrentHighlightLines();
                        const highlightStr = formatLineRange(highlightLines);

                        const app = (window as any).app;
                        const file = app.vault.getAbstractFileByPath(ctx.sourcePath);

                        if (file instanceof TFile) {
                            try {
                                await app.vault.process(file, (data: string) => {
                                    const sectionInfo = ctx!.getSectionInfo(cbeInfo.el);
                                    if (!sectionInfo) {
                                        console.error('无法获取代码块位置信息');
                                        return data;
                                    }

                                    const lines = data.split('\n');
                                    const lineStart = sectionInfo.lineStart;

                                    if (lineStart >= lines.length) {
                                        console.error('行号超出范围');
                                        return data;
                                    }

                                    const firstLine = lines[lineStart];
                                    // 匹配代码块开头，支持 ```ts{1,2,3} 或 ```ts {1,2,3} 格式
                                    const langMatch = firstLine.match(/^```(\w*)\s*(?:\{[^}]*\})?/);

                                    if (langMatch) {
                                        const lang = langMatch[1] || '';
                                        // 构建新的第一行（保持空格提高可读性）
                                        const newFirstLine = highlightStr
                                            ? `\`\`\`${lang} ${highlightStr}`
                                            : `\`\`\`${lang}`;

                                        lines[lineStart] = newFirstLine;
                                        return lines.join('\n');
                                    }
                                    return data;
                                });

                                new Notice('已保存高亮状态');
                                // 保存到组件状态
                                if ('saveHighlight' in lineNumberComponent) {
                                    (lineNumberComponent as any).saveHighlight();
                                }
                            } catch (error) {
                                console.error('保存高亮失败:', error);
                                new Notice('保存失败: ' + error);
                            }
                        } else {
                            new Notice('无法找到源文件，保存失败');
                        }
                    } else {
                        new Notice('组件未就绪，无法保存');
                    }
                });
        });

        menu.addSeparator();

        // 选项 3: 复制高亮行
        menu.addItem((item) => {
            item.setTitle('复制高亮行')
                .setIcon('copy')
                .onClick(() => {
                    if (lineNumberComponent && 'getCurrentHighlightLines' in lineNumberComponent) {
                        const highlightLines = (
                            lineNumberComponent as any
                        ).getCurrentHighlightLines();
                        if (highlightLines.length > 0) {
                            const lines = highlightLines.map(
                                (lineNum: number) => cbeInfo.lineTextList[lineNum - 1]
                            );
                            copyText(lines.join('\n'));
                            new Notice(`已复制 ${highlightLines.length} 行高亮代码`);
                        } else {
                            new Notice('当前没有高亮行');
                        }
                    }
                });
        });

        // 选项 4: 复制临时高亮行
        menu.addItem((item) => {
            item.setTitle('复制临时高亮行')
                .setIcon('copy')
                .onClick(() => {
                    if (lineNumberComponent && 'getTempHighlightLines' in lineNumberComponent) {
                        const highlightLines = (lineNumberComponent as any).getTempHighlightLines();
                        if (highlightLines.length > 0) {
                            const lines = highlightLines.map(
                                (lineNum: number) => cbeInfo.lineTextList[lineNum - 1]
                            );
                            copyText(lines.join('\n'));
                            new Notice(`已复制 ${highlightLines.length} 行临时高亮代码`);
                        } else {
                            new Notice('当前没有临时高亮行');
                        }
                    }
                });
        });

        menu.showAtMouseEvent(event);
    };
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="cbe-header">
    <div class="cbe-language-name">{settings.showLangName ? cbeInfo.language : ''}</div>
    <div class="cbe-toolbar">
        {#if settings.showCollapseBtn}
            <div aria-label={i18n.t('btn.collapse')} class={iconClass} onclick={toggleCodeBlock}>
                <ChevronDown size={iconSize} />
            </div>
        {/if}
        {#if settings.showCodeSnap}
            <div aria-label={i18n.t('btn.codeSnap')} class={iconClass} onclick={takeCodeSnap}>
                <Camera size={iconSize} />
            </div>
        {/if}
        <div aria-label={i18n.t('btn.copy')} class={iconClass} onclick={copyBlockText}>
            <Copy size={iconSize} />
        </div>
        <!-- 菜单按钮 -->
        <div aria-label="更多选项" class={iconClass} onclick={handleMenuClick}>
            <MoreVertical size={iconSize} />
        </div>
    </div>
</div>
