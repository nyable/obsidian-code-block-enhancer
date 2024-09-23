import { Decoration } from '@codemirror/view';
import { i18n } from './i18n';
import CodeBlockEnhancerPlugin from './main';
import { App, Editor, MarkdownView, SuggestModal } from 'obsidian';
import { bracketMatching } from '@codemirror/language';
import { Range } from '@codemirror/state';
export function editorExtensionProvider(plugin: CodeBlockEnhancerPlugin) {
    const highlightBracketMatching = bracketMatching({
        renderMatch: (match, state) => {
            const { matched, start, end } = match;
            const decorations: Range<Decoration>[] = [];
            const className = matched ? 'cbe-bracket-matched' : 'cbe-bracket-missed';

            decorations.push(
                Decoration.mark({
                    class: className
                }).range(start.from, start.to)
            );
            if (end) {
                decorations.push(
                    Decoration.mark({
                        class: className
                    }).range(end.from, end.to)
                );

                plugin.addCommand({
                    id: 'cbe-jump-to-bracket',
                    name: 'Jump to bracket',
                    icon: 'braces',
                    editorCheckCallback: (
                        checking: boolean,
                        editor: Editor,
                        view: MarkdownView
                    ) => {
                        const offset = editor.posToOffset(editor.getCursor('from'));
                        const displayFlag =
                            (start.from <= offset && start.to >= offset) ||
                            (end.from <= offset && end.to >= offset);
                        if (displayFlag) {
                            if (!checking) {
                                editor.setCursor(editor.offsetToPos(end.to));
                            }

                            return true;
                        }

                        return false;
                    }
                });
                plugin.addCommand({
                    id: 'cbe-select-to-bracket2',
                    name: 'Select to bracket',
                    icon: 'braces',
                    editorCheckCallback: (
                        checking: boolean,
                        editor: Editor,
                        view: MarkdownView
                    ) => {
                        const offset = editor.posToOffset(editor.getCursor('from'));

                        const displayFlag =
                            (start.from <= offset && start.to >= offset) ||
                            (end.from <= offset && end.to >= offset);

                        if (displayFlag) {
                            if (!checking) {
                                const isEnd = start.to > end.to;

                                editor.setSelection(
                                    editor.offsetToPos(isEnd ? start.to : start.from),
                                    editor.offsetToPos(isEnd ? end.from : end.to)
                                );
                            }
                            return true;
                        }

                        return false;
                    }
                });
            }
            return decorations;
        }
    });
    return [highlightBracketMatching];
}

export function editorModeEnhancer(plugin: CodeBlockEnhancerPlugin) {
    const { enableLinkPasteModal } = plugin.settings;
    if (enableLinkPasteModal) {
        linkPasteEnhancer(plugin);
    }
}

interface LinkAction {
    label: string;
    value: string;
    callback: () => void;
}

class LinkActionModal extends SuggestModal<LinkAction> {
    constructor(app: App) {
        super(app);
    }
    getSuggestions(query: string): LinkAction[] {
        return [];
    }

    renderSuggestion(action: LinkAction, el: HTMLElement) {
        el.createEl('div', { text: action.label });
        el.createEl('small', { text: action.value });
    }

    onChooseSuggestion(action: LinkAction, evt: MouseEvent | KeyboardEvent) {}
}

function linkPasteEnhancer(plugin: CodeBlockEnhancerPlugin) {
    plugin.registerEvent(
        plugin.app.workspace.on('editor-paste', (evt, editor) => {
            const dataType = 'text/plain';
            const clipData = evt.clipboardData;

            if (clipData) {
                if (clipData.types.includes(dataType)) {
                    const originText = clipData.getData(dataType);
                    const trimText = originText.trim();
                    if (!trimText.includes('\n') && /^https?:\/\/\S+/.test(trimText)) {
                        evt.preventDefault();
                        evt.stopPropagation();
                        const url = new URL(trimText);
                        const lastPath = decodeURI(url.pathname.split('/').pop() || '');
                        const markdownLink = `[${lastPath}](${url.toString()})`;
                        const model = new LinkActionModal(plugin.app);
                        model.getSuggestions = (q: string) => {
                            return [
                                {
                                    label: i18n.t('suggestion.linkAction.link.label'),
                                    value: markdownLink,
                                    callback: () => {
                                        editor.replaceSelection(markdownLink);
                                        const { ch, line } = editor.getCursor();
                                        const cursorCh =
                                            ch - markdownLink.length + lastPath.length + 1;
                                        editor.setCursor(line, cursorCh);
                                        editor.setSelection(
                                            {
                                                line: line,
                                                ch: ch - markdownLink.length + 1
                                            },
                                            {
                                                line: line,
                                                ch: cursorCh
                                            }
                                        );
                                    }
                                },
                                {
                                    label: i18n.t('suggestion.linkAction.text.label'),
                                    value: originText,
                                    callback: () => {
                                        editor.replaceSelection(originText);
                                    }
                                }
                            ]
                                .map((s, index) => {
                                    s.label = `${index + 1}. ${s.label}`;
                                    return s;
                                })
                                .filter((s) => s.label.includes(q));
                        };
                        model.onChooseSuggestion = (
                            suggestion: LinkAction,
                            evt: MouseEvent | KeyboardEvent
                        ) => {
                            suggestion.callback();
                        };
                        model.open();
                    }
                }
            }
        })
    );
}
