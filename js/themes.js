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
            colorGreen: '#15803D',
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

    PFCC.themes = {
        OS_THEMES,
        resolveThemeKey,
        normalizeRadius,
        normalizeFont
    };
})(window);
