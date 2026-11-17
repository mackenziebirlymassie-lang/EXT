(function (global) {
    'use strict';

    var PFCC = global.PFCC = global.PFCC || {};

    // NodeList.prototype.forEach (Chrome 51+)
    if (typeof global.NodeList !== 'undefined' && global.NodeList.prototype && !global.NodeList.prototype.forEach) {
        global.NodeList.prototype.forEach = Array.prototype.forEach;
    }

    // Element.prototype.matches & closest (older WebViews)
    if (typeof global.Element !== 'undefined' && global.Element.prototype) {
        if (!global.Element.prototype.matches) {
            global.Element.prototype.matches =
                global.Element.prototype.msMatchesSelector ||
                global.Element.prototype.webkitMatchesSelector;
        }
        if (!global.Element.prototype.closest) {
            global.Element.prototype.closest = function (selector) {
                var el = this;
                while (el && el.nodeType === 1) {
                    if (el.matches(selector)) return el;
                    el = el.parentElement || el.parentNode;
                }
                return null;
            };
        }
        if (!global.Element.prototype.remove) {
            global.Element.prototype.remove = function () {
                if (this.parentNode) this.parentNode.removeChild(this);
            };
        }
    }

    // String.prototype.padStart (Chrome 57+)
    if (!String.prototype.padStart) {
        String.prototype.padStart = function (targetLength, padString) {
            var len = targetLength >> 0;
            var str = String(this);
            if (str.length >= len) return str;
            var pad = String(padString === undefined ? ' ' : padString);
            if (!pad.length) return str;
            var fillLen = len - str.length;
            var repeated = '';
            while (repeated.length < fillLen) {
                repeated += pad;
            }
            return repeated.slice(0, fillLen) + str;
        };
    }

    // Object.values (Chrome 54+)
    if (!Object.values) {
        Object.values = function (obj) {
            if (obj === null || obj === undefined) {
                throw new TypeError('Cannot convert undefined or null to object');
            }
            var target = Object(obj);
            var keys = Object.keys(target);
            var out = [];
            for (var i = 0; i < keys.length; i++) {
                out.push(target[keys[i]]);
            }
            return out;
        };
    }

    // Array.prototype.flatMap (Chrome 69+)
    if (!Array.prototype.flatMap) {
        Array.prototype.flatMap = function (callback, thisArg) {
            var mapped = this.map(callback, thisArg);
            return Array.prototype.concat.apply([], mapped);
        };
    }

    function pad2(val) {
        var s = String(val);
        return s.length < 2 ? '0' + s : s;
    }

    function qsa(selector, root) {
        var scope = root || global.document;
        if (!scope || !scope.querySelectorAll) return [];
        return Array.prototype.slice.call(scope.querySelectorAll(selector));
    }

    PFCC.compat = {
        pad2: pad2,
        qsa: qsa
    };
})(window);
