(function (global) {
    'use strict';

    const PFCC = global.PFCC = global.PFCC || {};
    let audioCtx = null;

    function getAudioContext() {
        if (!audioCtx) {
            const AudioContextClass = global.AudioContext || global.webkitAudioContext;
            if (AudioContextClass) audioCtx = new AudioContextClass();
        }
        if (audioCtx && audioCtx.state === 'suspended' && typeof audioCtx.resume === 'function') {
            try {
                const resumeResult = audioCtx.resume();
                if (resumeResult && typeof resumeResult.catch === 'function') {
                    resumeResult.catch(() => {});
                }
            } catch (err) {
                // Ignore WebKit resume errors before user gesture
            }
        }
        return audioCtx;
    }

    function playTone(freq, type, duration, startGain, endGain) {
        if (!PFCC.state.soundEnabled) return;
        const oscType = type || 'sine';
        const dur = duration || 0.05;
        const gStart = startGain === undefined ? 0.08 : startGain;
        const gEnd = endGain === undefined ? 0.001 : endGain;
        try {
            const ctx = getAudioContext();
            if (!ctx) return;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = oscType;
            osc.frequency.setValueAtTime(freq, ctx.currentTime);
            gain.gain.setValueAtTime(gStart, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(gEnd, ctx.currentTime + dur);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + dur);
        } catch (err) {
            // Audio playback unavailable
        }
    }

    function playClickSound() {
        playTone(1100, 'triangle', 0.025, 0.05, 0.001);
    }

    function playSuccessSound() {
        if (!PFCC.state.soundEnabled) return;
        try {
            const ctx = getAudioContext();
            if (!ctx) return;
            const now = ctx.currentTime;
            [523.25, 659.25, 783.99].forEach((f, idx) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(f, now + idx * 0.055);
                gain.gain.setValueAtTime(0.08, now + idx * 0.055);
                gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.055 + 0.14);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(now + idx * 0.055);
                osc.stop(now + idx * 0.055 + 0.14);
            });
        } catch (err) {
            // Ignore audio errors
        }
    }

    function playWarningSound() {
        if (!PFCC.state.soundEnabled) return;
        try {
            const ctx = getAudioContext();
            if (!ctx) return;
            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(140, now);
            osc.frequency.linearRampToValueAtTime(85, now + 0.12);
            gain.gain.setValueAtTime(0.08, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 0.12);
        } catch (err) {
            // Ignore audio errors
        }
    }

    function playSwooshSound() {
        playTone(440, 'sine', 0.07, 0.05, 0.001);
    }

    function updateSoundButton() {
        const el = PFCC.dom;
        if (el.btnToggleSound) {
            el.btnToggleSound.textContent = '';
            el.btnToggleSound.appendChild(PFCC.icons.create(PFCC.state.soundEnabled ? 'volumeOn' : 'volumeOff', 15));
            el.btnToggleSound.appendChild(PFCC.utils.createEl('span', '', PFCC.state.soundEnabled ? 'Sound' : 'Muted'));
            el.btnToggleSound.setAttribute('aria-pressed', String(PFCC.state.soundEnabled));
            el.btnToggleSound.classList.toggle('is-muted', !PFCC.state.soundEnabled);
        }
        if (el.setSoundEnabled) el.setSoundEnabled.checked = PFCC.state.soundEnabled;
    }

    function toggleSound() {
        PFCC.state.soundEnabled = !PFCC.state.soundEnabled;
        PFCC.utils.safeSaveJSON('appSoundEnabled', PFCC.state.soundEnabled);
        updateSoundButton();
        if (PFCC.state.soundEnabled) playSuccessSound();
    }

    PFCC.audio = {
        playClickSound,
        playSuccessSound,
        playWarningSound,
        playSwooshSound,
        updateSoundButton,
        toggleSound
    };
})(window);
