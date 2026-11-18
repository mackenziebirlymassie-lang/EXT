(function (global) {
    'use strict';

    const PFCC = global.PFCC = global.PFCC || {};

    // Palettes derived from the user's reference swatches, verified for WCAG AA contrast.
    // Core neutral: Obsidian Chrome (#0A0A0A Onyx, #536878 Blue Slate, #E5E4E2 Alabaster Grey).
    const OS_THEMES = {
        obsidian: {
            label: 'Obsidian Chrome (Default)',
            mode: 'dark',
            bgMain: '#0A0A0A',
            bgSurface: '#121417',
            bgHover: '#1A1E24',
            border: '#2D3640',
            textMain: '#E5E4E2',
            textSec: '#9AA5B1',
            accentFill: '#536878',
            accentText: '#8DA3B5',
            accentContrast: '#FFFFFF',
            colorGreen: '#34D399',
            colorRed: '#F87171',
            colorWarn: '#D2B48C',
            font: "'JetBrains Mono', monospace",
            radius: '6px',
            chartPalette: ['#8DA3B5', '#34D399', '#D2B48C', '#60A5FA', '#F87171', '#A3B1C2', '#536878']
        },
        crimson: {
            label: 'Classic Crimson (Carbon & Tan)',
            mode: 'dark',
            bgMain: '#1C1C1C',
            bgSurface: '#242424',
            bgHover: '#2E2E2E',
            border: '#3D3732',
            textMain: '#E5E4E2',
            textSec: '#D2B48C',
            accentFill: '#DB123C',
            accentText: '#FF5C77',
            accentContrast: '#FFFFFF',
            colorGreen: '#34D399',
            colorRed: '#FF5C77',
            colorWarn: '#D2B48C',
            font: "'JetBrains Mono', monospace",
            radius: '4px',
            chartPalette: ['#FF5C77', '#D2B48C', '#34D399', '#E5E4E2', '#DB123C', '#9AA5B1', '#B89B72']
        },
        tundra: {
            label: 'Electric Tundra (Prussian & Cyan)',
            mode: 'dark',
            bgMain: '#050A30',
            bgSurface: '#0B1242',
            bgHover: '#121B57',
            border: '#1E2D70',
            textMain: '#E5E4E2',
            textSec: '#9CC5E8',
            accentFill: '#1D4ED8',
            accentText: '#00E5FF',
            accentContrast: '#FFFFFF',
            colorGreen: '#34D399',
            colorRed: '#FB7185',
            colorWarn: '#FBBF24',
            font: "'JetBrains Mono', monospace",
            radius: '6px',
            chartPalette: ['#00E5FF', '#60A5FA', '#34D399', '#E5E4E2', '#FBBF24', '#FB7185', '#1D4ED8']
        },
        neonpetal: {
            label: 'Neon Petal (Carbon & Chartreuse)',
            mode: 'dark',
            bgMain: '#111114',
            bgSurface: '#18181D',
            bgHover: '#222229',
            border: '#343440',
            textMain: '#E5E4E2',
            textSec: '#B4B4C2',
            accentFill: '#EC2B7A',
            accentText: '#CEFF32',
            accentContrast: '#0A0A0A',
            colorGreen: '#CEFF32',
            colorRed: '#FF66A3',
            colorWarn: '#FE7BBF',
            font: "'JetBrains Mono', monospace",
            radius: '4px',
            chartPalette: ['#CEFF32', '#FF66A3', '#FE7BBF', '#E5E4E2', '#EC2B7A', '#9AA5B1', '#34D399']
        },
        alabaster: {
            label: 'Alabaster Daylight (Light)',
            mode: 'light',
            bgMain: '#E5E4E2',
            bgSurface: '#FFFFFF',
            bgHover: '#F3F2F0',
            border: '#C5C7C4',
            textMain: '#0A0A0A',
            textSec: '#4A5568',
            accentFill: '#536878',
            accentText: '#3E4E5C',
            accentContrast: '#FFFFFF',
            colorGreen: '#166534',
            colorRed: '#B91C1C',
            colorWarn: '#92400E',
            font: "'JetBrains Mono', monospace",
            radius: '6px',
            chartPalette: ['#3E4E5C', '#15803D', '#92400E', '#1D4ED8', '#B91C1C', '#536878', '#64748B']
        }
    };

    const LEGACY_THEME_MAP = {
        tokyonight: 'obsidian',
        cyberpunk: 'neonpetal',
        catppuccin: 'obsidian',
        synthwave: 'neonpetal',
        rosepine: 'crimson',
        gruvbox: 'crimson',
        dracula: 'obsidian',
        nord: 'tundra',
        emerald: 'obsidian',
        light: 'alabaster'
    };

    function resolveThemeKey(preset) {
        if (OS_THEMES[preset]) return preset;
        if (LEGACY_THEME_MAP[preset]) return LEGACY_THEME_MAP[preset];
        return 'obsidian';
    }

    function normalizeRadius(radius) {
        const allowed = ['0px', '4px', '6px', '8px'];
        if (allowed.includes(radius)) return radius;
        if (radius === '12px' || radius === '20px') return '6px';
        return '6px';
    }

    function normalizeFont(font) {
        const allowed = [
            "'JetBrains Mono', monospace",
            "'Fira Code', monospace",
            "ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace"
        ];
        if (allowed.includes(font)) return font;
        return "'JetBrains Mono', monospace";
    }

    function hexToRgbTuple(hex) {
        if (!hex || typeof hex !== 'string' || hex.charAt(0) !== '#') return [83, 104, 120];
        let clean = hex.slice(1);
        if (clean.length === 3) clean = clean.split('').map(c => c + c).join('');
        const num = parseInt(clean, 16);
        if (Number.isNaN(num)) return [83, 104, 120];
        return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
    }

    function rgbaTuple(rgb, alpha) {
        return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
    }

    function blendRgb(baseRgb, tintRgb, weight) {
        const w = Math.max(0, Math.min(1, weight));
        return [
            Math.round(baseRgb[0] * (1 - w) + tintRgb[0] * w),
            Math.round(baseRgb[1] * (1 - w) + tintRgb[1] * w),
            Math.round(baseRgb[2] * (1 - w) + tintRgb[2] * w)
        ];
    }

    function computeLiquidGlassTokens(theme) {
        const activeTheme = theme || OS_THEMES.obsidian;
        const isLight = activeTheme.mode === 'light';
        const mainRgb = hexToRgbTuple(activeTheme.bgMain);
        const surfRgb = hexToRgbTuple(activeTheme.bgSurface);
        const accentFillRgb = hexToRgbTuple(activeTheme.accentFill);
        const accentTextRgb = hexToRgbTuple(activeTheme.accentText);

        const tintedSurface = blendRgb(surfRgb, accentFillRgb, isLight ? 0.03 : 0.06);
        const tintedElevated = blendRgb(surfRgb, accentFillRgb, isLight ? 0.05 : 0.10);

        return {
            bgSurface: rgbaTuple(tintedSurface, isLight ? 0.86 : 0.78),
            bgElevated: rgbaTuple(tintedElevated, isLight ? 0.94 : 0.88),
            bgHeader: rgbaTuple(mainRgb, isLight ? 0.74 : 0.68),
            bgControl: rgbaTuple(mainRgb, isLight ? 0.78 : 0.62),
            borderSubtle: isLight ? 'rgba(15, 23, 42, 0.11)' : 'rgba(255, 255, 255, 0.09)',
            borderAccent: rgbaTuple(accentTextRgb, isLight ? 0.36 : 0.32),
            specular: isLight ? 'rgba(255, 255, 255, 0.88)' : 'rgba(255, 255, 255, 0.12)',
            sheen: rgbaTuple(accentFillRgb, isLight ? 0.09 : 0.17),
            sheenSoft: rgbaTuple(accentTextRgb, isLight ? 0.06 : 0.09),
            pillBg: rgbaTuple(accentFillRgb, isLight ? 0.92 : 0.82),
            pillEdge: rgbaTuple(accentTextRgb, isLight ? 0.48 : 0.45),
            shadowCard: isLight
                ? '0 4px 16px rgba(15, 23, 42, 0.06), 0 1px 3px rgba(15, 23, 42, 0.04)'
                : '0 8px 24px rgba(0, 0, 0, 0.34), 0 1px 3px rgba(0, 0, 0, 0.22)',
            shadowFloat: isLight
                ? '0 16px 42px rgba(15, 23, 42, 0.14), 0 4px 12px rgba(15, 23, 42, 0.08)'
                : '0 18px 48px rgba(0, 0, 0, 0.56), 0 4px 14px rgba(0, 0, 0, 0.32)'
        };
    }

    PFCC.themes = {
        OS_THEMES,
        resolveThemeKey,
        normalizeRadius,
        normalizeFont,
        computeLiquidGlassTokens
    };
})(window);
