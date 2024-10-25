<!-- CbeHeader.svelte -->
<script lang="ts">
    import { ChevronDown, Camera, Copy } from 'lucide-svelte';
    import { CLS } from 'src/constant';
    import { copyText, snapshot } from 'src/util';
    interface Props {
        settings: CbeSettings;
        cbeInfo: CbeInfo;
    }
    let { settings, cbeInfo }: Props = $props();
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
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="cbe-header">
    <div class="cbe-language-name">{settings.showLangName ? cbeInfo.language : ''}</div>
    <div class="cbe-toolbar">
        {#if settings.showCollapseBtn}
            <div class={iconClass} onclick={toggleCodeBlock}><ChevronDown size={iconSize} /></div>
        {/if}
        {#if settings.showCodeSnap}
            <div class={iconClass} onclick={takeCodeSnap}><Camera size={iconSize} /></div>
        {/if}
        <div class={iconClass} onclick={copyBlockText}>
            <Copy size={iconSize} />
        </div>
    </div>
</div>
