import { i18n } from './i18n';
import CodeBlockEnhancerPlugin from './main';
import { App, SuggestModal } from 'obsidian';
export function editorExtensionProvider(plugin: CodeBlockEnhancerPlugin) {
    return [];
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
