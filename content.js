// content.js - 内容脚本
// 在网页中运行，用于获取页面信息并与扩展通信

(function () {
    'use strict';

    /**
     * 检查扩展上下文是否有效
     * 扩展更新/卸载后，content script 仍在运行，但 runtime 上下文已失效
     */
    function isExtensionContextValid() {
        try {
            return !!chrome.runtime && !!chrome.runtime.id;
        } catch (e) {
            return false;
        }
    }

    /**
     * 安全发送消息到 background
     */
    function safeSendMessage(message) {
        if (!isExtensionContextValid()) return;
        try {
            chrome.runtime.sendMessage(message).catch(() => {
                // 静默处理 - 扩展可能已卸载/禁用
            });
        } catch (e) {
            // 静默处理
        }
    }

    // 等待 DOM 就绪后再收集页面信息
    function sendPageInfo() {
        const pageInfo = {
            title: document.title,
            url: window.location.href,
            hostname: window.location.hostname,
        };
        safeSendMessage({
            type: 'PAGE_INFO',
            payload: pageInfo,
        });
    }

    // 根据 readyState 决定立即执行还是等待
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', sendPageInfo, { once: true });
    } else {
        sendPageInfo();
    }

    // 监听来自扩展的消息
    if (isExtensionContextValid()) {
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            // 检查上下文是否仍然有效
            if (!isExtensionContextValid()) return;

            if (request.type === 'PING') {
                sendResponse({ type: 'PONG', time: Date.now() });
            }

            if (request.type === 'GET_DOM_INFO') {
                const metaTags = [...document.querySelectorAll('meta')].map(tag => ({
                    name: tag.getAttribute('name'),
                    content: tag.getAttribute('content'),
                }));

                sendResponse({
                    title: document.title,
                    url: window.location.href,
                    metaTags,
                });
            }

            // 异步响应
            return true;
        });
    }
})();