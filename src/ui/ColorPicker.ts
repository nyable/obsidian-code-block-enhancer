import { setIcon } from 'obsidian';

/**
 * 颜色选择器配置选项
 */
export interface ColorPickerOptions {
    /** 初始颜色值 */
    initialValue: string;
    /** 默认颜色值(用于重置) */
    defaultValue?: string;
    /** 颜色变化回调 */
    onChange?: (color: string) => void | Promise<void>;
    /** 是否显示重置按钮 */
    showReset?: boolean;
    /** 颜色选择器和预览框的宽度，默认 '30px' */
    width?: string;
    /** 颜色选择器和预览框的高度，默认 '30px' */
    height?: string;
    /** 是否允许编辑输入框，默认 true */
    allowEdit?: boolean;
}

/**
 * 解析颜色值并返回 hex 和 alpha
 * 支持所有 CSS 颜色格式：CSS变量、颜色名称、RGBA、RGB、HEX等
 */
export function parseColor(color: string): { hex: string; alpha: number } {
    let actualColor = color.trim();

    // 创建一个临时元素来获取计算后的颜色值
    // 这个方法可以处理所有 CSS 颜色格式：var(), 颜色名称, rgba(), rgb(), hex 等
    const tempEl = document.createElement('div');
    tempEl.style.color = actualColor;
    document.body.appendChild(tempEl);
    const computedColor = getComputedStyle(tempEl).color;
    document.body.removeChild(tempEl);

    // 如果无法计算颜色(无效的颜色值),返回默认值
    if (!computedColor || computedColor === 'rgba(0, 0, 0, 0)') {
        return { hex: '#8a5cf5', alpha: 0.15 };
    }

    // 解析计算后的颜色 (浏览器总是返回 rgb() 或 rgba() 格式)
    const rgbaMatch = computedColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    if (rgbaMatch) {
        const r = parseInt(rgbaMatch[1]);
        const g = parseInt(rgbaMatch[2]);
        const b = parseInt(rgbaMatch[3]);
        const a = rgbaMatch[4] ? parseFloat(rgbaMatch[4]) : 1;
        const hex = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
        return { hex, alpha: a };
    }

    // 备用：如果还是无法解析,返回默认值
    return { hex: '#8a5cf5', alpha: 0.15 };
}

/**
 * 创建一个可复用的颜色选择器组件
 * 包含颜色选择器、预览框、透明度滑块和输入框
 */
export class ColorPicker {
    private container: HTMLElement;
    private options: ColorPickerOptions;
    private currentValue: string;

    // UI 元素
    private colorInput!: HTMLInputElement;
    private previewBox!: HTMLDivElement;
    private resetBtn?: HTMLElement;
    private alphaSlider!: HTMLInputElement;
    private alphaValue!: HTMLSpanElement;
    private colorInput2!: HTMLInputElement;

    constructor(container: HTMLElement, options: ColorPickerOptions) {
        this.container = container;
        this.options = {
            showReset: true,
            width: '30px',
            height: '30px',
            allowEdit: true,
            ...options
        };
        this.currentValue = options.initialValue;

        this.render();
    }

    /**
     * 渲染颜色选择器
     */
    private render() {
        const width = this.options.width!;
        const height = this.options.height!;
        const { hex, alpha } = parseColor(this.currentValue);

        const wrapper = this.container.createDiv({ cls: 'color-picker-wrapper' });
        wrapper.style.display = 'flex';
        wrapper.style.flexDirection = 'column';
        wrapper.style.gap = '8px';

        // 第一行:颜色选择器 + 预览 + 重置按钮
        const colorRow = wrapper.createDiv({ cls: 'color-picker-row' });
        colorRow.style.display = 'flex';
        colorRow.style.alignItems = 'center';
        colorRow.style.gap = '8px';

        // 颜色选择器
        this.colorInput = colorRow.createEl('input', {
            type: 'color',
            value: hex
        });
        this.colorInput.style.width = width;
        this.colorInput.style.height = height;
        this.colorInput.style.cursor = 'pointer';

        // 颜色预览框
        this.previewBox = colorRow.createDiv({ cls: 'color-preview-box' });
        this.previewBox.style.width = width;
        this.previewBox.style.height = height;
        this.previewBox.style.border = '1px solid var(--background-modifier-border)';
        this.previewBox.style.borderRadius = '4px';
        this.previewBox.style.backgroundColor = this.currentValue;

        // 重置按钮
        if (this.options.showReset && this.options.defaultValue) {
            this.resetBtn = colorRow.createEl('div');
            this.resetBtn.addClass('clickable-icon', 'extra-setting-button');
            this.resetBtn.title = 'Reset';
            // 使用 Obsidian 的图标 API
            setIcon(this.resetBtn, 'rotate-ccw');
            this.resetBtn.addEventListener('click', () => this.reset());
        }

        // 第二行:透明度滑块
        const alphaRow = wrapper.createDiv({ cls: 'alpha-slider-row' });
        alphaRow.style.display = 'flex';
        alphaRow.style.alignItems = 'center';
        alphaRow.style.gap = '8px';

        const alphaLabel = alphaRow.createSpan({ text: 'Opacity:' });
        alphaLabel.style.fontSize = '12px';
        alphaLabel.style.minWidth = '60px';

        this.alphaSlider = alphaRow.createEl('input', {
            type: 'range',
            value: (alpha * 100).toString()
        });
        this.alphaSlider.min = '0';
        this.alphaSlider.max = '100';
        this.alphaSlider.step = '1';
        this.alphaSlider.style.flex = '1';

        this.alphaValue = alphaRow.createSpan({ text: `${Math.round(alpha * 100)}%` });
        this.alphaValue.style.fontSize = '12px';
        this.alphaValue.style.minWidth = '40px';
        this.alphaValue.style.textAlign = 'right';

        // 第三行:颜色代码输入框(可编辑)
        const colorTextRow = wrapper.createDiv({ cls: 'color-text-row' });
        colorTextRow.style.display = 'flex';
        colorTextRow.style.alignItems = 'center';
        colorTextRow.style.gap = '8px';

        this.colorInput2 = colorTextRow.createEl('input', {
            type: 'text',
            value: this.currentValue
        });
        this.colorInput2.style.fontSize = '12px';
        this.colorInput2.style.fontFamily = 'var(--font-monospace)';
        this.colorInput2.style.flex = '1';
        this.colorInput2.style.padding = '4px 8px';
        this.colorInput2.placeholder = 'e.g. rgba(255,0,0,0.5) or var(--code-normal)';

        // 根据配置设置是否可编辑
        if (!this.options.allowEdit) {
            this.colorInput2.readOnly = true;
            this.colorInput2.style.cursor = 'default';
            this.colorInput2.style.backgroundColor = 'var(--background-secondary)';
        }

        // 绑定事件
        this.bindEvents();
    }

    /**
     * 绑定事件监听器
     */
    private bindEvents() {
        // 监听颜色选择器变化
        this.colorInput.addEventListener('input', () => this.updateFromPicker());

        // 监听透明度滑块变化
        this.alphaSlider.addEventListener('input', () => this.updateFromPicker());

        // 只在允许编辑时绑定输入框事件
        if (this.options.allowEdit) {
            // 监听输入框变化(失焦时触发)
            this.colorInput2.addEventListener('blur', () => this.updateFromInput());

            // 监听输入框回车键
            this.colorInput2.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    this.updateFromInput();
                }
            });
        }
    }

    /**
     * 从颜色选择器和滑块更新
     */
    private async updateFromPicker() {
        const hex = this.colorInput.value;
        const alpha = parseInt(this.alphaSlider.value) / 100;

        // 将hex转换为rgb
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);

        const rgbaColor = `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(2)})`;

        // 更新预览和输入框
        this.previewBox.style.backgroundColor = rgbaColor;
        this.colorInput2.value = rgbaColor;
        this.alphaValue.textContent = `${Math.round(alpha * 100)}%`;

        this.currentValue = rgbaColor;

        // 触发回调
        if (this.options.onChange) {
            await this.options.onChange(rgbaColor);
        }
    }

    /**
     * 从输入框更新
     */
    private async updateFromInput() {
        const inputValue = this.colorInput2.value.trim();
        if (!inputValue) return;

        // 解析输入的颜色
        const parsed = parseColor(inputValue);

        // 更新颜色选择器和滑块
        this.colorInput.value = parsed.hex;
        this.alphaSlider.value = (parsed.alpha * 100).toString();
        this.alphaValue.textContent = `${Math.round(parsed.alpha * 100)}%`;

        // 更新预览
        this.previewBox.style.backgroundColor = inputValue;

        this.currentValue = inputValue;

        // 触发回调
        if (this.options.onChange) {
            await this.options.onChange(inputValue);
        }
    }

    /**
     * 重置到默认值
     */
    private async reset() {
        if (!this.options.defaultValue) return;

        const defaultValue = this.options.defaultValue;
        const { hex: defaultHex, alpha: defaultAlpha } = parseColor(defaultValue);

        // 更新UI
        this.colorInput.value = defaultHex;
        this.alphaSlider.value = (defaultAlpha * 100).toString();
        this.colorInput2.value = defaultValue;

        // 更新预览
        this.previewBox.style.backgroundColor = defaultValue;
        this.alphaValue.textContent = `${Math.round(defaultAlpha * 100)}%`;

        this.currentValue = defaultValue;

        // 触发回调
        if (this.options.onChange) {
            await this.options.onChange(defaultValue);
        }
    }

    /**
     * 获取当前颜色值
     */
    getValue(): string {
        return this.currentValue;
    }

    /**
     * 设置颜色值
     */
    setValue(color: string) {
        this.currentValue = color;
        const { hex, alpha } = parseColor(color);

        this.colorInput.value = hex;
        this.alphaSlider.value = (alpha * 100).toString();
        this.colorInput2.value = color;
        this.previewBox.style.backgroundColor = color;
        this.alphaValue.textContent = `${Math.round(alpha * 100)}%`;
    }

    /**
     * 销毁组件
     */
    destroy() {
        this.container.empty();
    }
}
