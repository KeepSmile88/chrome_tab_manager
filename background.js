// background.js - 后台服务脚本
// 核心功能：标签页事件监听、侧边栏通信、窗口管理、自动关闭闲置标签

class BackgroundService {
    constructor() {
        // 管理器窗口 ID（用于左侧伪窗口单例复用）
        this.managerWindowId = null;
        // 标签页最后活跃时间记录
        this.tabLastActiveTime = new Map();
        // 自动关闭检查定时器 ID
        this.autoCloseIntervalId = null;

        this.setupEventListeners();
        this.initAutoClose();
    }

    setupEventListeners() {
        // 扩展安装时的初始化
        chrome.runtime.onInstalled.addListener((details) => {
            chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });
            if (details.reason === 'install') {
                this.onInstall();
            } else if (details.reason === 'update') {
                this.onUpdate();
            }
        });

        // 标签页事件监听
        this.setupTabEventListeners();

        // 消息监听
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            this.handleMessage(request, sender, sendResponse);
            return true; // 保持消息通道打开以支持异步响应
        });

        // 右键菜单
        this.setupContextMenus();

        // 快捷键
        this.setupKeyboardShortcuts();

        // 监听窗口关闭事件（用于管理器窗口单例跟踪）
        chrome.windows.onRemoved.addListener((windowId) => {
            if (windowId === this.managerWindowId) {
                this.managerWindowId = null;
            }
        });
    }

    onInstall() {
        // 初始化默认设置
        chrome.storage.sync.set({
            categories: {
                '工作': ['work', 'office', 'email', 'calendar', 'docs', 'sheets'],
                '开发': ['github', 'stackoverflow', 'developer', 'coding', 'programming'],
                '社交': ['twitter', 'facebook', 'instagram', 'linkedin', 'social'],
                '娱乐': ['youtube', 'netflix', 'music', 'game', 'entertainment'],
                '购物': ['amazon', 'shopping', 'store', 'buy', 'cart']
            },
            settings: {
                autoCategories: true,
                showFavicons: true,
                groupByDomain: false,
                theme: 'modern',
                autoCloseEnabled: false,
                autoCloseTimeout: 60, // 默认60分钟
                autoCloseMode: 'discard' // 默认休眠模式，可选 'discard' 或 'close'
            }
        });

        // 显示欢迎页面
        chrome.tabs.create({
            url: chrome.runtime.getURL('welcome.html')
        });
    }

    onUpdate() {
        console.log('扩展已更新到 v2.0');
    }

    // ==================== 标签页事件 ====================

    setupTabEventListeners() {
        // 标签页创建
        chrome.tabs.onCreated.addListener((tab) => {
            this.tabLastActiveTime.set(tab.id, Date.now());
            this.broadcastToExtension('tabCreated', { tab });
        });

        // 标签页移除
        chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
            this.tabLastActiveTime.delete(tabId);
            this.broadcastToExtension('tabRemoved', { tabId, removeInfo });
        });

        // 标签页更新
        chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
            if (changeInfo.status === 'complete') {
                this.broadcastToExtension('tabUpdated', { tabId, changeInfo, tab });
                this.autoCategorizeTabs(tab);
            }
        });

        // 标签页激活 - 更新最后活跃时间
        chrome.tabs.onActivated.addListener((activeInfo) => {
            this.tabLastActiveTime.set(activeInfo.tabId, Date.now());
            this.broadcastToExtension('tabActivated', { activeInfo });
        });

        // 窗口焦点变化
        chrome.windows.onFocusChanged.addListener((windowId) => {
            if (windowId !== chrome.windows.WINDOW_ID_NONE) {
                // 更新当前窗口中活跃标签的最后活跃时间
                chrome.tabs.query({ active: true, windowId }, (tabs) => {
                    if (tabs[0]) {
                        this.tabLastActiveTime.set(tabs[0].id, Date.now());
                    }
                });
            }
            this.broadcastToExtension('windowFocusChanged', { windowId });
        });
    }

    // ==================== 自动分类 ====================

    async autoCategorizeTabs(tab) {
        try {
            const result = await chrome.storage.sync.get(['categories', 'settings']);
            const categories = result.categories || {};
            const settings = result.settings || {};

            if (!settings.autoCategories) return;

            const url = tab.url.toLowerCase();
            const title = tab.title.toLowerCase();
            const content = `${url} ${title}`;

            for (const [categoryName, keywords] of Object.entries(categories)) {
                if (keywords.some(keyword => content.includes(keyword.toLowerCase()))) {
                    console.log(`标签页 "${tab.title}" 自动分类为: ${categoryName}`);
                    break;
                }
            }
        } catch (error) {
            console.error('自动分类失败:', error);
        }
    }

    // ==================== 右键菜单 ====================

    setupContextMenus() {
        chrome.contextMenus.removeAll(() => {
            chrome.contextMenus.create({
                id: 'openTabManager',
                title: '📑 打开标签管理器',
                contexts: ['action']
            });

            chrome.contextMenus.create({
                id: 'groupByDomain',
                title: '📁 按域名分组当前窗口标签',
                contexts: ['action']
            });

            chrome.contextMenus.create({
                id: 'closeOtherTabs',
                title: '🗑️ 关闭当前窗口其他标签',
                contexts: ['action']
            });
        });

        chrome.contextMenus.onClicked.addListener((info, tab) => {
            this.handleContextMenuClick(info, tab);
        });
    }

    async handleContextMenuClick(info, tab) {
        switch (info.menuItemId) {
            case 'openTabManager':
                await this.openManagerWindow();
                break;
            case 'groupByDomain':
                await this.groupSimilarTabs();
                break;
            case 'closeOtherTabs':
                await this.closeOtherTabsInWindow();
                break;
        }
    }

    // ==================== 快捷键 ====================

    setupKeyboardShortcuts() {
        chrome.commands.onCommand.addListener((command) => {
            switch (command) {
                case 'toggle-sidepanel':
                    this.openManagerWindow();
                    break;
                case 'close-all-tabs':
                    this.closeAllTabs();
                    break;
                case 'group-tabs':
                    this.groupSimilarTabs();
                    break;
            }
        });
    }

    // ==================== 消息处理 ====================

    async handleMessage(request, sender, sendResponse) {
        try {
            switch (request.action) {
                case 'getTabs':
                    sendResponse(await this.getAllTabs());
                    break;
                case 'closeTab':
                    sendResponse(await this.closeTab(request.tabId));
                    break;
                case 'switchToTab':
                    sendResponse(await this.switchToTab(request.tabId));
                    break;
                case 'createCategory':
                    sendResponse(await this.createCategory(request.categoryName, request.rules));
                    break;
                case 'updateCategory':
                    sendResponse(await this.updateCategory(request.categoryName, request.rules));
                    break;
                case 'deleteCategory':
                    sendResponse(await this.deleteCategory(request.categoryName));
                    break;
                case 'OPEN_SIDEPANEL':
                    await this.openSidePanel();
                    sendResponse({ status: 'opening' });
                    break;
                case 'OPEN_MANAGER_WINDOW':
                    await this.openManagerWindow();
                    sendResponse({ status: 'opening' });
                    break;
                case 'CLOSE_WINDOW':
                    await this.closeWindow(request.windowId);
                    sendResponse({ success: true });
                    break;
                case 'BATCH_CLOSE_WINDOWS':
                    await this.batchCloseWindows(request.windowIds);
                    sendResponse({ success: true });
                    break;
                case 'GET_AUTO_CLOSE_SETTINGS':
                    sendResponse(await this.getAutoCloseSettings());
                    break;
                case 'SET_AUTO_CLOSE_SETTINGS':
                    await this.setAutoCloseSettings(request.enabled, request.timeout, request.mode);
                    sendResponse({ success: true });
                    break;
                case 'GET_TAB_IDLE_INFO':
                    sendResponse(this.getTabIdleInfo());
                    break;
                case 'PAGE_INFO':
                    // 来自 content script 的页面信息，记录即可
                    break;
                default:
                    console.warn('未识别的消息类型：', request.action);
                    sendResponse({ error: '未知的操作类型' });
            }
        } catch (error) {
            console.error('消息处理失败:', error);
            sendResponse({ error: error.message });
        }
    }

    // ==================== 扩展内部广播 ====================

    /**
     * 使用 runtime.sendMessage 向扩展内部页面（popup/sidepanel）广播事件
     * 不再遍历所有标签页发消息
     */
    broadcastToExtension(event, data) {
        try {
            chrome.runtime.sendMessage({
                action: 'tabEvent',
                event,
                data
            }).catch(() => {
                // 没有监听者时会报错，静默处理
            });
        } catch (error) {
            // 静默处理
        }
    }

    // ==================== 标签页操作 ====================

    async getAllTabs() {
        try {
            return await chrome.tabs.query({});
        } catch (error) {
            console.error('获取标签页失败:', error);
            return [];
        }
    }

    async closeTab(tabId) {
        try {
            await chrome.tabs.remove(tabId);
            return { success: true };
        } catch (error) {
            console.error('关闭标签页失败:', error);
            return { success: false, error: error.message };
        }
    }

    async switchToTab(tabId) {
        try {
            await chrome.tabs.update(tabId, { active: true });
            const tab = await chrome.tabs.get(tabId);
            await chrome.windows.update(tab.windowId, { focused: true });
            return { success: true };
        } catch (error) {
            console.error('切换标签页失败:', error);
            return { success: false, error: error.message };
        }
    }

    // ==================== 窗口操作 ====================

    /**
     * 打开右侧侧边栏
     */
    async openSidePanel() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab?.id) return;

            await chrome.sidePanel.setOptions({
                tabId: tab.id,
                path: 'sidepanel.html',
                enabled: true
            });
            await chrome.sidePanel.open({ tabId: tab.id });
        } catch (error) {
            console.error('打开侧边栏失败:', error);
        }
    }

    /**
     * 打开左侧伪窗口（单例模式）
     * 如果管理器窗口已存在则直接聚焦，否则创建新窗口
     */
    async openManagerWindow() {
        try {
            // 检查已存在的管理器窗口
            if (this.managerWindowId !== null) {
                try {
                    const existingWindow = await chrome.windows.get(this.managerWindowId);
                    if (existingWindow) {
                        // 窗口仍存在，聚焦它
                        await chrome.windows.update(this.managerWindowId, { focused: true });
                        return;
                    }
                } catch (e) {
                    // 窗口已不存在，继续创建新的
                    this.managerWindowId = null;
                }
            }

            // 获取当前窗口的高度
            let targetHeight = 800;
            try {
                const currentWin = await chrome.windows.getCurrent();
                if (currentWin && currentWin.height) {
                    targetHeight = currentWin.height;
                }
            } catch (e) {}

            // 创建新的管理器窗口
            const newWindow = await chrome.windows.create({
                url: chrome.runtime.getURL('sidepanel.html'),
                type: 'popup',
                left: 0,
                top: 0,
                width: 380,
                height: targetHeight,
                focused: true
            });

            this.managerWindowId = newWindow.id;
        } catch (error) {
            console.error('打开管理器窗口失败:', error);
        }
    }

    /**
     * 关闭指定窗口
     */
    async closeWindow(windowId) {
        try {
            await chrome.windows.remove(windowId);
        } catch (error) {
            console.error('关闭窗口失败:', error);
        }
    }

    /**
     * 批量关闭窗口
     */
    async batchCloseWindows(windowIds) {
        try {
            for (const id of windowIds) {
                try {
                    await chrome.windows.remove(id);
                } catch (e) {
                    console.error(`关闭窗口 ${id} 失败:`, e);
                }
            }
        } catch (error) {
            console.error('批量关闭窗口失败:', error);
        }
    }

    /**
     * 关闭当前窗口中非活跃且非固定的标签页
     */
    async closeOtherTabsInWindow() {
        try {
            const tabs = await chrome.tabs.query({ currentWindow: true });
            const tabIds = tabs.filter(tab => !tab.active && !tab.pinned).map(tab => tab.id);
            if (tabIds.length > 0) {
                await chrome.tabs.remove(tabIds);
            }
        } catch (error) {
            console.error('关闭其他标签页失败:', error);
        }
    }

    // ==================== 分类操作 ====================

    async createCategory(categoryName, rules) {
        try {
            const result = await chrome.storage.sync.get(['categories']);
            const categories = result.categories || {};
            categories[categoryName] = rules;
            await chrome.storage.sync.set({ categories });
            return { success: true };
        } catch (error) {
            console.error('创建分类失败:', error);
            return { success: false, error: error.message };
        }
    }

    async updateCategory(categoryName, rules) {
        try {
            const result = await chrome.storage.sync.get(['categories']);
            const categories = result.categories || {};
            if (categories[categoryName]) {
                categories[categoryName] = rules;
                await chrome.storage.sync.set({ categories });
                return { success: true };
            }
            return { success: false, error: '分类不存在' };
        } catch (error) {
            console.error('更新分类失败:', error);
            return { success: false, error: error.message };
        }
    }

    async deleteCategory(categoryName) {
        try {
            const result = await chrome.storage.sync.get(['categories']);
            const categories = result.categories || {};
            delete categories[categoryName];
            await chrome.storage.sync.set({ categories });
            return { success: true };
        } catch (error) {
            console.error('删除分类失败:', error);
            return { success: false, error: error.message };
        }
    }

    // ==================== 标签分组 ====================

    async closeAllTabs() {
        try {
            const tabs = await chrome.tabs.query({ currentWindow: true });
            const tabIds = tabs.filter(tab => !tab.pinned).map(tab => tab.id);
            if (tabIds.length > 1) {
                await chrome.tabs.remove(tabIds.slice(1));
            }
        } catch (error) {
            console.error('关闭所有标签页失败:', error);
        }
    }

    async groupSimilarTabs() {
        try {
            const tabs = await chrome.tabs.query({ currentWindow: true });
            const domainGroups = {};

            tabs.forEach(tab => {
                try {
                    const domain = new URL(tab.url).hostname;
                    if (!domainGroups[domain]) {
                        domainGroups[domain] = [];
                    }
                    domainGroups[domain].push(tab.id);
                } catch (error) {
                    // 忽略无效URL
                }
            });

            const colors = ['grey', 'blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan'];
            let colorIndex = 0;

            for (const [domain, tabIds] of Object.entries(domainGroups)) {
                if (tabIds.length > 1) {
                    try {
                        const group = await chrome.tabs.group({ tabIds });
                        await chrome.tabGroups.update(group, {
                            title: domain,
                            color: colors[colorIndex % colors.length]
                        });
                        colorIndex++;
                    } catch (error) {
                        console.error(`创建 ${domain} 组失败:`, error);
                    }
                }
            }
        } catch (error) {
            console.error('分组标签页失败:', error);
        }
    }

    // ==================== 自动关闭闲置标签 ====================

    /**
     * 初始化自动关闭功能
     */
    async initAutoClose() {
        // 初始化所有现有标签的活跃时间
        try {
            const tabs = await chrome.tabs.query({});
            const now = Date.now();
            tabs.forEach(tab => {
                if (!this.tabLastActiveTime.has(tab.id)) {
                    this.tabLastActiveTime.set(tab.id, now);
                }
            });
        } catch (e) {
            // 静默处理
        }

        // 读取设置并启动定时器
        const result = await chrome.storage.sync.get(['settings']);
        const settings = result.settings || {};
        if (settings.autoCloseEnabled) {
            this.startAutoCloseTimer(settings.autoCloseTimeout || 60, settings.autoCloseMode || 'discard');
        }
    }

    /**
     * 启动自动关闭定时器
     * @param {number} timeoutMinutes 超时分钟数
     * @param {string} mode 处理模式：'discard'(休眠) 或 'close'(关闭)
     */
    startAutoCloseTimer(timeoutMinutes, mode = 'discard') {
        // 清除旧的定时器
        if (this.autoCloseIntervalId) {
            clearInterval(this.autoCloseIntervalId);
        }

        // 每分钟检查一次
        this.autoCloseIntervalId = setInterval(() => {
            this.checkAndCloseIdleTabs(timeoutMinutes, mode);
        }, 60 * 1000);

        const modeLabel = mode === 'close' ? '关闭' : '休眠';
        console.log(`自动${modeLabel}已启动，超时：${timeoutMinutes} 分钟`);
    }

    /**
     * 停止自动关闭定时器
     */
    stopAutoCloseTimer() {
        if (this.autoCloseIntervalId) {
            clearInterval(this.autoCloseIntervalId);
            this.autoCloseIntervalId = null;
        }
        console.log('自动关闭已停止');
    }

    /**
     * 检查并处理闲置标签
     * @param {number} timeoutMinutes 超时分钟数
     * @param {string} mode 处理模式：'discard'(休眠) 或 'close'(关闭)
     */
    async checkAndCloseIdleTabs(timeoutMinutes, mode = 'discard') {
        try {
            const tabs = await chrome.tabs.query({});
            const now = Date.now();
            const timeoutMs = timeoutMinutes * 60 * 1000;
            const processedTabs = [];

            for (const tab of tabs) {
                // 跳过：活跃标签、固定标签、扩展页面、chrome 内部页面
                if (tab.active || tab.pinned) continue;
                if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) continue;
                if (tab.audible) continue; // 跳过正在播放音频的标签

                const lastActive = this.tabLastActiveTime.get(tab.id) || now;
                const idleTime = now - lastActive;

                if (idleTime > timeoutMs) {
                    try {
                        if (mode === 'close') {
                            // 关闭模式：直接关闭标签页
                            await chrome.tabs.remove(tab.id);
                        } else {
                            // 休眠模式：使用 discard 释放内存但保留标签页
                            await chrome.tabs.discard(tab.id);
                        }
                        processedTabs.push(tab.title);
                        this.tabLastActiveTime.delete(tab.id);
                    } catch (e) {
                        // 可能不支持 discard 或标签已关闭
                    }
                }
            }

            if (processedTabs.length > 0) {
                const modeLabel = mode === 'close' ? '关闭' : '休眠';
                console.log(`自动${modeLabel}了 ${processedTabs.length} 个闲置标签:`, processedTabs);
            }
        } catch (error) {
            console.error('自动关闭检查失败:', error);
        }
    }

    /**
     * 获取自动关闭设置
     */
    async getAutoCloseSettings() {
        try {
            const result = await chrome.storage.sync.get(['settings']);
            const settings = result.settings || {};
            return {
                enabled: settings.autoCloseEnabled || false,
                timeout: settings.autoCloseTimeout || 60,
                mode: settings.autoCloseMode || 'discard'
            };
        } catch (error) {
            return { enabled: false, timeout: 60, mode: 'discard' };
        }
    }

    /**
     * 设置自动关闭参数
     * @param {boolean} enabled 是否启用
     * @param {number} timeout 超时分钟数
     * @param {string} mode 处理模式：'discard'(休眠) 或 'close'(关闭)
     */
    async setAutoCloseSettings(enabled, timeout, mode = 'discard') {
        try {
            const result = await chrome.storage.sync.get(['settings']);
            const settings = result.settings || {};
            settings.autoCloseEnabled = enabled;
            settings.autoCloseTimeout = timeout;
            settings.autoCloseMode = mode;
            await chrome.storage.sync.set({ settings });

            if (enabled) {
                this.startAutoCloseTimer(timeout, mode);
            } else {
                this.stopAutoCloseTimer();
            }
        } catch (error) {
            console.error('设置自动关闭失败:', error);
        }
    }

    /**
     * 获取所有标签的闲置信息（供 sidepanel 展示）
     */
    getTabIdleInfo() {
        const idleInfo = {};
        const now = Date.now();
        for (const [tabId, lastActive] of this.tabLastActiveTime.entries()) {
            idleInfo[tabId] = {
                lastActive,
                idleMinutes: Math.floor((now - lastActive) / (60 * 1000))
            };
        }
        return idleInfo;
    }
}

// 初始化后台服务
new BackgroundService();