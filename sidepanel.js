// sidepanel.js - 侧边栏/管理器窗口逻辑
// 功能：标签页管理、多视图、搜索、批量操作、窗口管理、自动关闭设置

class TabManager {
    constructor() {
        this.tabs = [];
        this.categories = new Map();
        this.currentView = 'all'; // all, window, domain, category
        this.searchQuery = '';
        this.collapsedGroups = new Set();
        this.batchMode = false;
        this.selectedTabs = new Set();
        this.selectedWindows = new Set();
        this.debounceTimer = null;
        // Shift 连选：记录上次点击的标签 ID
        this.lastClickedTabId = null;

        this.initializeElements();
        this.bindEvents();
        this.loadCategories();
        this.loadAutoCloseSettings();
        this.loadTheme();
        this.refreshTabs();
        this.setupTabListeners();
        this.enableWindowDrag();
        this.setupKeyboardNavigation();
    }

    // ==================== 初始化 ====================

    initializeElements() {
        // 统计
        this.totalCount = document.getElementById('totalCount');
        this.windowCount = document.getElementById('windowCount');
        this.domainCount = document.getElementById('domainCount');

        // 搜索
        this.searchInput = document.getElementById('searchInput');
        this.searchClear = document.getElementById('searchClear');

        // 控制按钮
        this.viewAllBtn = document.getElementById('viewAll');
        this.viewByWindowBtn = document.getElementById('viewByWindow');
        this.viewByDomainBtn = document.getElementById('viewByDomain');
        this.viewByCategoryBtn = document.getElementById('viewByCategory');
        this.newCategoryBtn = document.getElementById('newCategoryBtn');
        this.refreshBtn = document.getElementById('refreshBtn');
        this.batchModeBtn = document.getElementById('batchModeBtn');
        this.windowsBtn = document.getElementById('windowsBtn');
        this.settingsBtn = document.getElementById('settingsBtn');
        this.themeBtn = document.getElementById('themeBtn');

        // 批量打开
        this.pipBatchOpenBtn = document.getElementById('pipBatchOpenBtn');
        this.batchOpenBtn = document.getElementById('batchOpenBtn');
        this.batchOpenModal = document.getElementById('batchOpenModal');
        this.closeBatchModalBtn = document.getElementById('closeBatchModal');
        this.batchUrlsInput = document.getElementById('batchUrlsInput');
        this.readClipboardBtn = document.getElementById('readClipboardBtn');
        this.confirmBatchOpenBtn = document.getElementById('confirmBatchOpenBtn');

        // 内容区域
        this.tabContent = document.getElementById('tabContent');

        // 批量操作
        this.batchToolbar = document.getElementById('batchToolbar');
        this.batchInfo = document.getElementById('batchInfo');
        this.batchSelectAllBtn = document.getElementById('batchSelectAll');
        this.batchCloseBtn = document.getElementById('batchClose');
        this.batchGroupBtn = document.getElementById('batchGroup');
        this.batchCancelBtn = document.getElementById('batchCancel');

        // 分类表单
        this.newCategoryForm = document.getElementById('newCategoryForm');
        this.categoryNameInput = document.getElementById('categoryNameInput');
        this.categoryKeywordsInput = document.getElementById('categoryKeywordsInput');
        this.saveCategoryBtn = document.getElementById('saveCategoryBtn');
        this.cancelCategoryBtn = document.getElementById('cancelCategoryBtn');

        // 窗口管理
        this.windowsPanel = document.getElementById('windowsPanel');
        this.windowsList = document.getElementById('windowsList');
        this.batchCloseWindowsBtn = document.getElementById('batchCloseWindows');

        // 设置
        this.settingsPanel = document.getElementById('settingsPanel');
        this.autoCloseToggle = document.getElementById('autoCloseToggle');
        this.autoCloseTimeout = document.getElementById('autoCloseTimeout');
        this.autoCloseMode = document.getElementById('autoCloseMode');
        this.exportDataBtn = document.getElementById('exportDataBtn');
        this.importDataBtn = document.getElementById('importDataBtn');
        this.importDataInput = document.getElementById('importDataInput');
        this.saveSessionBtn = document.getElementById('saveSessionBtn');
        this.restoreSessionBtn = document.getElementById('restoreSessionBtn');

        // 状态栏
        this.statusText = document.getElementById('statusText');
    }

    bindEvents() {
        // 搜索
        this.searchInput.addEventListener('input', (e) => {
            this.searchQuery = e.target.value;
            this.searchClear.classList.toggle('visible', this.searchQuery.length > 0);
            this.debounceRender();
        });
        this.searchClear.addEventListener('click', () => {
            this.searchInput.value = '';
            this.searchQuery = '';
            this.searchClear.classList.remove('visible');
            this.renderTabs();
        });

        // 视图切换
        this.viewAllBtn.addEventListener('click', () => this.setView('all'));
        this.viewByWindowBtn.addEventListener('click', () => this.setView('window'));
        this.viewByDomainBtn.addEventListener('click', () => this.setView('domain'));
        this.viewByCategoryBtn.addEventListener('click', () => this.setView('category'));

        // 功能按钮
        this.refreshBtn.addEventListener('click', () => this.refreshTabs());
        this.batchModeBtn.addEventListener('click', () => this.toggleBatchMode());
        this.newCategoryBtn.addEventListener('click', () => this.showNewCategoryForm());

        // 窗口管理按钮
        this.windowsBtn.addEventListener('click', () => this.toggleWindowsPanel());

        // 设置按钮
        this.settingsBtn.addEventListener('click', () => this.toggleSettingsPanel());

        // 批量打开
        if (this.pipBatchOpenBtn) {
            this.pipBatchOpenBtn.addEventListener('click', () => this.openPipBatchOpen());
        }
        this.batchOpenBtn.addEventListener('click', () => this.showBatchModal());
        this.closeBatchModalBtn.addEventListener('click', () => this.hideBatchModal());
        this.readClipboardBtn.addEventListener('click', () => this.readFromClipboard());
        this.confirmBatchOpenBtn.addEventListener('click', () => this.batchOpenUrls());

        // 批量操作
        this.batchSelectAllBtn.addEventListener('click', () => this.toggleSelectAll());
        this.batchCloseBtn.addEventListener('click', () => this.batchCloseTabs());
        this.batchGroupBtn.addEventListener('click', () => this.batchGroupTabs());
        this.batchCancelBtn.addEventListener('click', () => this.toggleBatchMode());

        // 分类表单
        this.saveCategoryBtn.addEventListener('click', () => this.saveCategory());
        this.cancelCategoryBtn.addEventListener('click', () => this.hideNewCategoryForm());
        this.categoryNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.categoryKeywordsInput.focus();
        });
        this.categoryKeywordsInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.saveCategory();
        });

        // 自动关闭设置
        this.autoCloseToggle.addEventListener('click', () => this.toggleAutoClose());
        this.autoCloseTimeout.addEventListener('change', () => this.saveAutoCloseSettings());
        this.autoCloseMode.addEventListener('change', () => this.saveAutoCloseSettings());

        // 批量关闭窗口
        this.batchCloseWindowsBtn.addEventListener('click', () => this.batchCloseWindows());

        // 主题与数据管理
        this.themeBtn.addEventListener('click', () => this.toggleTheme());
        this.exportDataBtn.addEventListener('click', () => this.exportData());
        this.importDataBtn.addEventListener('click', () => this.importDataInput.click());
        this.importDataInput.addEventListener('change', (e) => this.importData(e));
        this.saveSessionBtn.addEventListener('click', () => this.saveSession());
        this.restoreSessionBtn.addEventListener('click', () => this.restoreSession());

        // 监听来自 background 的消息
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            if (request.action === 'tabEvent') {
                this.debounceRefresh();
            } else if (request.action === 'windowFocusChanged') {
                if (this.currentView === 'window') this.refreshTabs();
            }
        });

        this.setupContextMenu();
    }

    setupContextMenu() {
        this.ctxMenu = document.getElementById('tabContextMenu');
        this.ctxTargetTabId = null;

        // 点击空白处或其他地方时关闭菜单
        document.addEventListener('click', () => {
            if (this.ctxMenu) {
                this.ctxMenu.classList.remove('visible');
                this.ctxMenu.style.display = 'none'; // 暴力隐藏
            }
        });

        // 在空白处右击也关闭菜单
        document.addEventListener('contextmenu', (e) => {
            if (this.ctxMenu && !e.target.closest('.tab-item')) {
                this.ctxMenu.classList.remove('visible');
                this.ctxMenu.style.display = 'none'; // 暴力隐藏
            }
        });

        document.getElementById('ctxCopyUrl').addEventListener('click', () => {
            if (this.ctxTargetTabId) {
                const tab = this.tabs.find(t => t.id === this.ctxTargetTabId);
                if (tab) {
                    navigator.clipboard.writeText(tab.url);
                    this.showNotification('已复制链接', 'success');
                }
            }
        });
        document.getElementById('ctxCopyTitle').addEventListener('click', () => {
            if (this.ctxTargetTabId) {
                const tab = this.tabs.find(t => t.id === this.ctxTargetTabId);
                if (tab) {
                    navigator.clipboard.writeText(tab.title);
                    this.showNotification('已复制标题', 'success');
                }
            }
        });
        document.getElementById('ctxMuteToggle').addEventListener('click', async () => {
            if (this.ctxTargetTabId) {
                const tab = this.tabs.find(t => t.id === this.ctxTargetTabId);
                if (tab) await chrome.tabs.update(tab.id, { muted: !tab.mutedInfo?.muted });
                this.refreshTabs();
            }
        });
        document.getElementById('ctxNewWindow').addEventListener('click', async () => {
            if (this.ctxTargetTabId) {
                const tab = this.tabs.find(t => t.id === this.ctxTargetTabId);
                if (tab) {
                    await chrome.windows.create({ tabId: tab.id });
                    this.refreshTabs();
                }
            }
        });
        document.getElementById('ctxClose').addEventListener('click', () => {
            if (this.ctxTargetTabId) {
                this.closeTab(this.ctxTargetTabId);
            }
        });
    }

    // ==================== 标签页监听 ====================

    setupTabListeners() {
        chrome.tabs.onCreated.addListener(() => this.debounceRefresh());
        chrome.tabs.onRemoved.addListener(() => this.debounceRefresh());
        chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
            if (changeInfo.status === 'complete' || changeInfo.title) {
                this.debounceRefresh();
            }
        });
        chrome.tabs.onActivated.addListener(() => this.debounceRefresh());
    }

    /**
     * 防抖刷新 - 避免频繁更新
     */
    debounceRefresh() {
        if (this.debounceTimer) clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(() => this.refreshTabs(), 200);
    }

    /**
     * 防抖渲染
     */
    debounceRender() {
        if (this.renderTimer) clearTimeout(this.renderTimer);
        this.renderTimer = setTimeout(() => this.renderTabs(), 150);
    }

    // ==================== 主题与数据管理 ====================

    loadTheme() {
        chrome.storage.local.get(['darkMode'], (result) => {
            const isDark = result.darkMode || false;
            if (isDark) {
                document.body.classList.add('dark-theme');
            }
        });
    }

    toggleTheme() {
        const isDark = document.body.classList.toggle('dark-theme');
        chrome.storage.local.set({ darkMode: isDark });
        this.showNotification(isDark ? '已切换至暗黑模式' : '已切换至亮色模式');
    }

    exportData() {
        chrome.storage.sync.get(null, (syncData) => {
            chrome.storage.local.get(null, (localData) => {
                const exportObj = {
                    sync: syncData,
                    local: localData,
                    exportDate: new Date().toISOString()
                };
                const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportObj, null, 2));
                const downloadAnchorNode = document.createElement('a');
                downloadAnchorNode.setAttribute("href", dataStr);
                downloadAnchorNode.setAttribute("download", "tab_manager_backup_" + new Date().getTime() + ".json");
                document.body.appendChild(downloadAnchorNode);
                downloadAnchorNode.click();
                downloadAnchorNode.remove();
                this.showNotification('🎉 配置已成功导出！');
            });
        });
    }

    importData(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const importedObj = JSON.parse(event.target.result);
                if (importedObj.sync) {
                    chrome.storage.sync.set(importedObj.sync);
                }
                if (importedObj.local) {
                    chrome.storage.local.set(importedObj.local);
                }
                this.showNotification('✅ 配置导入成功！重新加载中...', 'success');
                setTimeout(() => window.location.reload(), 1500);
            } catch (err) {
                this.showNotification('❌ 导入失败，无效的配置文件', 'error');
            }
        };
        reader.readAsText(file);
        e.target.value = ''; // reset input
    }

    async saveSession() {
        if (!this.tabs || this.tabs.length === 0) {
            this.showNotification('当前没有可以保存的标签页', 'error');
            return;
        }

        const urls = this.tabs.map(t => t.url).filter(url => !url.startsWith('chrome://') && !url.startsWith('chrome-extension://'));

        if (urls.length === 0) {
            this.showNotification('没有有效的网页可以保存', 'error');
            return;
        }

        const sessionData = {
            date: new Date().toLocaleString(),
            count: urls.length,
            urls: urls
        };

        try {
            await chrome.storage.local.set({ savedSession: sessionData });
            this.showNotification(`💾 已成功保存 ${urls.length} 个标签页为会话！`, 'success');
        } catch (e) {
            this.showNotification('保存会话失败', 'error');
        }
    }

    async restoreSession() {
        try {
            const data = await chrome.storage.local.get('savedSession');
            if (!data.savedSession || !data.savedSession.urls || data.savedSession.urls.length === 0) {
                this.showNotification('没有找到已保存的会话快照', 'error');
                return;
            }

            const urls = data.savedSession.urls;

            // 在新窗口打开保存的所有 URL
            await chrome.windows.create({
                url: urls,
                focused: true
            });
            this.showNotification(`🚀 成功恢复 ${urls.length} 个标签页！`, 'success');
        } catch (e) {
            this.showNotification('恢复会话失败', 'error');
        }
    }

    // ==================== 窗口拖拽 ====================

    async enableWindowDrag() {
        try {
            const currentWin = await chrome.windows.getCurrent();
            // 只有独立的 popup 窗口才允许拖拽整个窗口，避免在侧边栏模式拖动整个浏览器
            if (currentWin && currentWin.type === 'popup') {
                this.setupDragForWindow(window, currentWin.id);
            }
        } catch (e) {
            console.error('获取窗口状态失败:', e);
        }
    }

    setupDragForWindow(win, winId = null) {
        if (!winId) return; // PiP 窗口由浏览器系统接管拖拽，无法通过 JS 移动，直接返回

        let isDragging = false;
        let startScreenX = 0;
        let startScreenY = 0;
        let initialLeft = 0;
        let initialTop = 0;
        let lastUpdate = 0;

        win.document.addEventListener('mousedown', async (e) => {
            if (e.button !== 0) return; // 仅左键

            // 排除可交互元素
            const ignoreTags = ['BUTTON', 'INPUT', 'TEXTAREA', 'SELECT', 'A'];
            if (ignoreTags.includes(e.target.tagName)) return;

            const interactiveSelectors = '.tab-item, .group-header, .window-item, .modal-content, .settings-panel, .new-category-form, .search-box';
            if (e.target.closest(interactiveSelectors)) return;

            // 排除滚动条点击
            if (e.offsetX > e.target.clientWidth || e.offsetY > e.target.clientHeight) return;

            try {
                const w = await chrome.windows.get(winId);
                initialLeft = w.left;
                initialTop = w.top;

                isDragging = true;
                startScreenX = e.screenX;
                startScreenY = e.screenY;
            } catch (err) { }
        });

        win.addEventListener('mousemove', (e) => {
            if (!isDragging) return;

            const dx = e.screenX - startScreenX;
            const dy = e.screenY - startScreenY;

            if (dx === 0 && dy === 0) return;

            // 简单的节流，防止更新太频繁导致卡顿
            const now = Date.now();
            if (now - lastUpdate < 16) return;
            lastUpdate = now;

            chrome.windows.update(winId, {
                left: initialLeft + dx,
                top: initialTop + dy
            }).catch(() => {
                isDragging = false;
            });
        });

        win.addEventListener('mouseup', () => {
            isDragging = false;
        });
    }

    // ==================== 数据加载 ====================

    async loadCategories() {
        try {
            const result = await chrome.storage.sync.get(['categories']);
            if (result.categories) {
                this.categories = new Map(Object.entries(result.categories));
            }
        } catch (error) {
            console.error('加载分类失败:', error);
        }
    }

    async saveCategories() {
        try {
            const categoriesObj = Object.fromEntries(this.categories);
            await chrome.storage.sync.set({ categories: categoriesObj });
        } catch (error) {
            console.error('保存分类失败:', error);
        }
    }

    async refreshTabs() {
        try {
            this.tabs = await chrome.tabs.query({});

            // 获取标签组
            this.tabGroupsMap = new Map();
            if (chrome.tabGroups) {
                try {
                    const groups = await chrome.tabGroups.query({});
                    groups.forEach(g => this.tabGroupsMap.set(g.id, g));
                } catch (e) { }
            }

            this.updateStats();
            this.renderTabs();
            this.updateStatus('已刷新');
        } catch (error) {
            console.error('获取标签页失败:', error);
            this.showEmptyState('无法获取标签页信息');
        }
    }

    updateStats() {
        const domains = new Set();
        const windowIds = new Set();
        const domainCountMap = {};

        this.tabs.forEach(tab => {
            windowIds.add(tab.windowId);
            try {
                const host = new URL(tab.url).hostname;
                domains.add(host);
                domainCountMap[host] = (domainCountMap[host] || 0) + 1;
            } catch (e) { }
        });
        this.totalCount.textContent = this.tabs.length;
        this.windowCount.textContent = windowIds.size;
        this.domainCount.textContent = domains.size;

        // 内存与 Dashboard 统计
        const estimatedMemMB = this.tabs.length * 45;
        const memEstimateEl = document.getElementById('memEstimate');
        if (memEstimateEl) {
            memEstimateEl.textContent = `~${estimatedMemMB} MB`;
            const memPercent = Math.min(100, (estimatedMemMB / 4000) * 100);
            const memBar = document.getElementById('memBar');
            memBar.style.width = `${memPercent}%`;
            memBar.style.backgroundColor = memPercent > 80 ? '#ff6b6b' : (memPercent > 50 ? '#feca57' : '#48c78e');

            const sortedDomains = Object.entries(domainCountMap).sort((a, b) => b[1] - a[1]).slice(0, 5);
            const listHTML = sortedDomains.map(([domain, count]) => `
                <div class="domain-stat-item">
                    <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width: 150px;" title="${domain}">${domain}</span>
                    <span style="color: rgba(255,255,255,0.7);">${count} 个标签</span>
                </div>
            `).join('');
            document.getElementById('domainStatsList').innerHTML = listHTML;
        }
    }

    // ==================== 视图切换 ====================

    setView(view) {
        this.currentView = view;
        document.querySelectorAll('.controls .ctrl-btn').forEach(btn => btn.classList.remove('active'));
        const btnMap = { all: this.viewAllBtn, window: this.viewByWindowBtn, domain: this.viewByDomainBtn, category: this.viewByCategoryBtn };
        btnMap[view]?.classList.add('active');
        this.renderTabs();
    }

    // ==================== 渲染 ====================

    renderTabs() {
        const filtered = this.getFilteredTabs();
        if (filtered.length === 0) {
            this.showEmptyState(this.searchQuery ? '没有找到匹配的标签页' : '没有标签页');
            return;
        }

        this.tabContent.innerHTML = '';

        switch (this.currentView) {
            case 'window':
                this.renderByWindow(filtered);
                break;
            case 'domain':
                this.renderByDomain(filtered);
                break;
            case 'category':
                this.renderByCategory(filtered);
                break;
            default:
                this.renderAll(filtered);
        }
    }

    fuzzyMatch(pattern, str) {
        if (!pattern) return true;
        let pIdx = 0;
        for (let i = 0; i < str.length; i++) {
            if (str[i] === pattern[pIdx]) {
                pIdx++;
                if (pIdx === pattern.length) return true;
            }
        }
        return false;
    }

    getFilteredTabs() {
        if (!this.searchQuery) return this.tabs;

        let regex;
        try {
            regex = new RegExp(this.searchQuery, 'i');
        } catch (e) {
            regex = null;
        }

        const queryLower = this.searchQuery.toLowerCase();

        return this.tabs.filter(tab => {
            const title = tab.title || '';
            const url = tab.url || '';

            // 拼音搜索支持
            let pinyinStr = '';
            if (typeof pinyinPro !== 'undefined') {
                try {
                    pinyinStr = pinyinPro.pinyin(title, { pattern: 'first', toneType: 'none', type: 'array' }).join('').toLowerCase();
                } catch (e) { }
            }

            if (regex) {
                if (regex.test(title) || regex.test(url)) return true;
            } else {
                if (title.toLowerCase().includes(queryLower) ||
                    url.toLowerCase().includes(queryLower) ||
                    this.fuzzyMatch(queryLower, title.toLowerCase()) ||
                    this.fuzzyMatch(queryLower, url.toLowerCase()) ||
                    (pinyinStr && this.fuzzyMatch(queryLower, pinyinStr)) ||
                    (pinyinStr && pinyinStr.includes(queryLower))
                ) return true;
            }
            return false;
        });
    }

    // 全部视图
    renderAll(tabs) {
        const section = this.createGroupSection('全部标签', tabs, 'all');
        this.tabContent.appendChild(section);
    }

    // 按窗口分组视图
    renderByWindow(tabs) {
        const groups = {};
        tabs.forEach(tab => {
            const key = `window-${tab.windowId}`;
            if (!groups[key]) groups[key] = { windowId: tab.windowId, tabs: [] };
            groups[key].tabs.push(tab);
        });

        Object.values(groups).forEach((group, index) => {
            const section = this.createGroupSection(
                `🪟 窗口 ${index + 1}`,
                group.tabs,
                `win-${group.windowId}`,
                group.windowId
            );
            this.tabContent.appendChild(section);
        });
    }

    // 按域名分组视图
    renderByDomain(tabs) {
        const groups = {};
        tabs.forEach(tab => {
            let domain = '其他';
            try { domain = new URL(tab.url).hostname || '其他'; } catch (e) { }
            if (!groups[domain]) groups[domain] = [];
            groups[domain].push(tab);
        });

        // 按标签数量排序
        const sorted = Object.entries(groups).sort((a, b) => b[1].length - a[1].length);
        sorted.forEach(([domain, domainTabs]) => {
            const section = this.createGroupSection(`🌐 ${domain}`, domainTabs, `domain-${domain}`);
            this.tabContent.appendChild(section);
        });
    }

    // 按分类视图
    renderByCategory(tabs) {
        const categorized = this.categorizeTabs(tabs);

        // 渲染已分类
        for (const [name, catTabs] of Object.entries(categorized.categories)) {
            if (catTabs.length > 0) {
                const section = this.createGroupSection(`📁 ${name}`, catTabs, `cat-${name}`);
                this.tabContent.appendChild(section);
            }
        }

        // 渲染未分类
        if (categorized.uncategorized.length > 0) {
            const section = this.createGroupSection('📋 未分类', categorized.uncategorized, 'uncategorized');
            this.tabContent.appendChild(section);
        }
    }

    categorizeTabs(tabs) {
        const result = { uncategorized: [], categories: {} };
        for (const name of this.categories.keys()) result.categories[name] = [];

        for (const tab of tabs) {
            let matched = false;
            for (const [name, rules] of this.categories.entries()) {
                if (this.matchesCategory(tab, rules)) {
                    result.categories[name].push(tab);
                    matched = true;
                    break;
                }
            }
            if (!matched) result.uncategorized.push(tab);
        }
        return result;
    }

    matchesCategory(tab, rules) {
        if (!rules || rules.length === 0) return false;
        const text = `${tab.title} ${tab.url}`.toLowerCase();
        return rules.some(rule => text.includes(rule.toLowerCase()));
    }

    // ==================== 组件创建 ====================

    createGroupSection(title, tabs, groupId, windowId = null) {
        const isCollapsed = this.collapsedGroups.has(groupId);

        const section = document.createElement('div');
        section.className = 'group-section fade-in';

        // 组头
        const header = document.createElement('div');
        header.className = 'group-header';
        header.innerHTML = `
            <span class="group-toggle ${isCollapsed ? 'collapsed' : ''}">▼</span>
            <span class="group-title">${this.escapeHtml(title)}</span>
            <span class="group-count">${tabs.length}</span>
        `;

        // 添加关闭分组内所有标签的按钮（所有视图维度均支持）
        const closeBtn = document.createElement('button');
        closeBtn.className = 'group-close-btn';
        closeBtn.textContent = '✕';
        closeBtn.title = '关闭此分组所有标签';
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (windowId !== null) {
                // 窗口视图：关闭整个窗口
                this.closeWindowById(windowId);
            } else {
                // 其他视图（全部/域名/分类）：批量关闭组内标签
                this.closeGroupTabs(tabs, title);
            }
        });
        header.appendChild(closeBtn);

        header.addEventListener('click', () => {
            this.toggleGroup(groupId);
        });

        // 标签列表
        const tabList = document.createElement('div');
        tabList.className = `group-tabs ${isCollapsed ? 'collapsed' : ''}`;
        if (!isCollapsed) {
            tabList.style.maxHeight = `${tabs.length * 52}px`;
        }

        tabs.forEach(tab => {
            tabList.appendChild(this.createTabElement(tab));
        });

        section.appendChild(header);
        section.appendChild(tabList);
        return section;
    }

    createTabElement(tab) {
        const item = document.createElement('div');
        item.className = `tab-item ${tab.active ? 'active-tab' : ''} ${this.selectedTabs.has(tab.id) ? 'selected' : ''}`;
        item.dataset.tabId = tab.id;
        item.draggable = true; // 开启拖拽

        // 图标回退
        const fallbackIcon = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#aaa" d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/></svg>')}`;
        const favicon = tab.favIconUrl || fallbackIcon;

        // 徽章与标签组
        let badges = '';
        if (tab.pinned) badges += '<span class="tab-badge badge-pinned">📌 固定</span>';
        if (tab.audible) badges += '<span class="tab-badge badge-audible">🔊 播放中</span>';

        // 原生标签组支持 (Tab Groups)
        if (tab.groupId && tab.groupId > -1 && this.tabGroupsMap && this.tabGroupsMap.has(tab.groupId)) {
            const g = this.tabGroupsMap.get(tab.groupId);
            const colorMap = {
                grey: '#bdc3c7', blue: '#3498db', red: '#e74c3c', yellow: '#f1c40f',
                green: '#2ecc71', pink: '#ff9ff3', purple: '#9b59b6', cyan: '#00cec9', orange: '#e67e22'
            };
            const hexColor = colorMap[g.color] || '#bdc3c7';
            badges += `<span class="tab-badge" style="background-color: ${hexColor}; color: #fff;">${this.escapeHtml(g.title || '组')}</span>`;
        }

        item.innerHTML = `
            <input type="checkbox" class="tab-checkbox" ${this.selectedTabs.has(tab.id) ? 'checked' : ''}>
            <img class="tab-favicon" src="${favicon}" alt="" loading="lazy" onerror="this.src='${fallbackIcon}'">
            <div class="tab-info">
                <div class="tab-title">${this.escapeHtml(tab.title || '无标题')}</div>
                <div class="tab-meta">
                    <span class="tab-url">${this.escapeHtml(this.formatUrl(tab.url))}</span>
                    ${badges}
                </div>
            </div>
            <div class="tab-actions">
                <button class="tab-act-btn pin" title="${tab.pinned ? '取消置顶' : '置顶'}">${tab.pinned ? '📌' : '📍'}</button>
                <button class="tab-act-btn" title="切换到此标签">👁</button>
                <button class="tab-act-btn close" title="关闭">✕</button>
            </div>
        `;

        // 事件绑定
        const checkbox = item.querySelector('.tab-checkbox');
        checkbox.addEventListener('click', (e) => {
            e.stopPropagation();
            // Shift 连选支持
            if (e.shiftKey && this.lastClickedTabId !== null) {
                this.shiftSelectRange(this.lastClickedTabId, tab.id);
                return;
            }
            this.toggleTabSelection(tab.id, checkbox.checked);
            this.lastClickedTabId = tab.id;
        });

        item.addEventListener('click', (e) => {
            if (e.target.classList.contains('tab-act-btn') || e.target.classList.contains('tab-checkbox')) return;
            if (this.batchMode) {
                // Shift 连选：选中从上次到当前的范围
                if (e.shiftKey && this.lastClickedTabId !== null) {
                    this.shiftSelectRange(this.lastClickedTabId, tab.id);
                    return;
                }
                // Ctrl/Cmd 多选：切换单个选中
                if (e.ctrlKey || e.metaKey) {
                    const newState = !this.selectedTabs.has(tab.id);
                    checkbox.checked = newState;
                    this.toggleTabSelection(tab.id, newState);
                    this.lastClickedTabId = tab.id;
                    return;
                }
                // 普通点击：切换当前标签选中
                checkbox.checked = !checkbox.checked;
                this.toggleTabSelection(tab.id, checkbox.checked);
                this.lastClickedTabId = tab.id;
            } else {
                this.switchToTab(tab.id);
            }
        });

        // 绑定右键菜单
        item.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.ctxTargetTabId = tab.id;
            this.ctxMenu.style.left = `${e.clientX}px`;
            this.ctxMenu.style.top = `${e.clientY}px`;

            // 暴力显示，绕过任何类的限制
            this.ctxMenu.style.display = 'flex'; 
            this.ctxMenu.classList.add('visible');

            const rect = this.ctxMenu.getBoundingClientRect();
            // 防止菜单超出屏幕底部
            if (rect.bottom > window.innerHeight) {
                this.ctxMenu.style.top = `${e.clientY - rect.height}px`;
            }
        });

        const switchBtn = item.querySelector('.tab-act-btn:not(.close):not(.pin)');
        const closeBtn = item.querySelector('.tab-act-btn.close');
        const pinBtn = item.querySelector('.tab-act-btn.pin');

        switchBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.switchToTab(tab.id);
        });

        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.closeTab(tab.id);
        });

        pinBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.togglePinTab(tab);
        });

        // ================= 拖拽排序逻辑 =================
        item.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', tab.id.toString());
            e.dataTransfer.effectAllowed = 'move';
            item.classList.add('dragging');
            setTimeout(() => item.style.opacity = '0.5', 0);
        });

        item.addEventListener('dragend', (e) => {
            item.classList.remove('dragging');
            item.style.opacity = '1';
            document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
        });

        item.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
        });

        item.addEventListener('dragenter', (e) => {
            e.preventDefault();
            if (!item.classList.contains('dragging')) {
                item.classList.add('drag-over');
            }
        });

        item.addEventListener('dragleave', (e) => {
            item.classList.remove('drag-over');
        });

        item.addEventListener('drop', async (e) => {
            e.preventDefault();
            item.classList.remove('drag-over');
            const draggedTabId = parseInt(e.dataTransfer.getData('text/plain'), 10);
            const targetTabId = tab.id;

            if (draggedTabId && draggedTabId !== targetTabId) {
                try {
                    const targetTab = await chrome.tabs.get(targetTabId);
                    const rect = item.getBoundingClientRect();
                    const insertAfter = e.clientY > rect.top + rect.height / 2;
                    let newIndex = insertAfter ? targetTab.index + 1 : targetTab.index;

                    await chrome.tabs.move(draggedTabId, {
                        windowId: targetTab.windowId,
                        index: newIndex
                    });
                } catch (err) {
                    console.error('拖拽移动失败:', err);
                }
            }
        });

        return item;
    }

    // ==================== 标签页操作 ====================

    async switchToTab(tabId) {
        try {
            await chrome.tabs.update(tabId, { active: true });
            const tab = await chrome.tabs.get(tabId);
            await chrome.windows.update(tab.windowId, { focused: true });
        } catch (error) {
            console.error('切换标签页失败:', error);
        }
    }

    async closeTab(tabId) {
        try {
            await chrome.tabs.remove(tabId);
            this.selectedTabs.delete(tabId);
        } catch (error) {
            console.error('关闭标签页失败:', error);
        }
    }

    async closeWindowById(windowId) {
        const confirmed = await this.showConfirm('确定要关闭此窗口中的所有标签吗？');
        if (!confirmed) return;
        try {
            await chrome.runtime.sendMessage({ action: 'CLOSE_WINDOW', windowId });
            this.showNotification('窗口已关闭', 'success');
        } catch (error) {
            console.error('关闭窗口失败:', error);
        }
    }

    /**
     * 关闭分组内所有标签（适用于全部/域名/分类等视图维度）
     */
    async closeGroupTabs(tabs, groupTitle) {
        if (!tabs || tabs.length === 0) return;
        const confirmed = await this.showConfirm(`确定要关闭「${groupTitle}」中的 ${tabs.length} 个标签吗？`);
        if (!confirmed) return;

        try {
            const tabIds = tabs.map(t => t.id);
            await chrome.tabs.remove(tabIds);
            // 从选中集合中移除
            tabIds.forEach(id => this.selectedTabs.delete(id));
            this.showNotification(`已关闭「${groupTitle}」的 ${tabs.length} 个标签`, 'success');
        } catch (error) {
            console.error('批量关闭分组标签失败:', error);
            this.showNotification('关闭失败', 'error');
        }
    }

    // ==================== 组折叠 ====================

    toggleGroup(groupId) {
        if (this.collapsedGroups.has(groupId)) {
            this.collapsedGroups.delete(groupId);
        } else {
            this.collapsedGroups.add(groupId);
        }
        this.renderTabs();
    }

    // ==================== 批量操作 ====================

    toggleBatchMode() {
        this.batchMode = !this.batchMode;
        this.selectedTabs.clear();
        this.lastClickedTabId = null;
        this.batchModeBtn.classList.toggle('active', this.batchMode);
        this.batchToolbar.classList.toggle('visible', this.batchMode);
        this.tabContent.classList.toggle('batch-mode', this.batchMode);
        this.updateBatchInfo();
        this.renderTabs();
    }

    /**
     * 全选/取消全选切换
     */
    toggleSelectAll() {
        const filtered = this.getFilteredTabs();
        const allSelected = filtered.length > 0 && filtered.every(t => this.selectedTabs.has(t.id));

        if (allSelected) {
            // 取消全选
            this.selectedTabs.clear();
            this.batchSelectAllBtn.textContent = '☑ 全选';
            this.showNotification('已取消全选', 'info');
        } else {
            // 全选当前可见标签
            filtered.forEach(t => this.selectedTabs.add(t.id));
            this.batchSelectAllBtn.textContent = '☐ 取消全选';
            this.showNotification(`已全选 ${filtered.length} 个标签`, 'success');
        }

        this.updateBatchInfo();
        this.renderTabs();
    }

    /**
     * Shift 范围选择：从 fromTabId 到 toTabId 之间的所有标签
     */
    shiftSelectRange(fromTabId, toTabId) {
        const allItems = Array.from(document.querySelectorAll('.tab-item'));
        const fromIndex = allItems.findIndex(el => parseInt(el.dataset.tabId) === fromTabId);
        const toIndex = allItems.findIndex(el => parseInt(el.dataset.tabId) === toTabId);

        if (fromIndex === -1 || toIndex === -1) return;

        const start = Math.min(fromIndex, toIndex);
        const end = Math.max(fromIndex, toIndex);

        // 选中范围内所有标签
        for (let i = start; i <= end; i++) {
            const tabId = parseInt(allItems[i].dataset.tabId);
            this.selectedTabs.add(tabId);
            allItems[i].classList.add('selected');
            const cb = allItems[i].querySelector('.tab-checkbox');
            if (cb) cb.checked = true;
        }

        this.lastClickedTabId = toTabId;
        this.updateBatchInfo();
        this.showNotification(`已选择 ${end - start + 1} 个标签`, 'success');
    }

    toggleTabSelection(tabId, selected) {
        if (selected) {
            this.selectedTabs.add(tabId);
        } else {
            this.selectedTabs.delete(tabId);
        }
        this.updateBatchInfo();
        // 更新选中样式
        const item = document.querySelector(`.tab-item[data-tab-id="${tabId}"]`);
        if (item) item.classList.toggle('selected', selected);
    }

    updateBatchInfo() {
        this.batchInfo.textContent = `已选择 ${this.selectedTabs.size} 个标签`;
        // 同步全选按钮文本
        const filtered = this.getFilteredTabs();
        const allSelected = filtered.length > 0 && filtered.every(t => this.selectedTabs.has(t.id));
        if (this.batchSelectAllBtn) {
            this.batchSelectAllBtn.textContent = allSelected ? '☐ 取消全选' : '☑ 全选';
        }
    }

    async batchCloseTabs() {
        if (this.selectedTabs.size === 0) {
            this.showNotification('请先选择标签页', 'info');
            return;
        }

        const confirmed = await this.showConfirm(`确定要关闭选中的 ${this.selectedTabs.size} 个标签页吗？`);
        if (!confirmed) return;

        try {
            await chrome.tabs.remove([...this.selectedTabs]);
            this.showNotification(`已关闭 ${this.selectedTabs.size} 个标签`, 'success');
            this.selectedTabs.clear();
            this.updateBatchInfo();
        } catch (error) {
            console.error('批量关闭失败:', error);
            this.showNotification('批量关闭失败', 'error');
        }
    }

    async batchGroupTabs() {
        if (this.selectedTabs.size < 2) {
            this.showNotification('至少选择 2 个标签才能分组', 'info');
            return;
        }

        const groupName = prompt('请输入组名：');
        if (!groupName) return;

        try {
            const tabIds = [...this.selectedTabs];
            const group = await chrome.tabs.group({ tabIds });
            const colors = ['blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan'];
            await chrome.tabGroups.update(group, {
                title: groupName,
                color: colors[Math.floor(Math.random() * colors.length)]
            });
            this.showNotification(`已创建 "${groupName}" 分组`, 'success');
            this.selectedTabs.clear();
            this.updateBatchInfo();
        } catch (error) {
            console.error('批量分组失败:', error);
            this.showNotification('批量分组失败', 'error');
        }
    }

    // ==================== 窗口管理 ====================

    toggleWindowsPanel() {
        const isVisible = this.windowsPanel.classList.toggle('visible');
        this.windowsBtn.classList.toggle('active', isVisible);
        // 关闭其他面板
        if (isVisible) {
            this.settingsPanel.classList.remove('visible');
            this.settingsBtn.classList.remove('active');
            this.loadWindowsList();
        }
    }

    async loadWindowsList() {
        try {
            const windows = await chrome.windows.getAll({ populate: true });
            this.selectedWindows.clear();
            this.windowsList.innerHTML = '';

            windows.forEach((win, index) => {
                const tabCount = win.tabs ? win.tabs.length : 0;
                const firstTab = win.tabs && win.tabs[0] ? win.tabs[0].title : '空窗口';

                const item = document.createElement('div');
                item.className = 'window-item';
                item.dataset.windowId = win.id;
                item.innerHTML = `
                    <input type="checkbox" class="win-checkbox">
                    <div class="win-info">
                        <div class="win-name">窗口 ${index + 1} ${win.focused ? '(当前)' : ''}</div>
                        <div class="win-detail">${tabCount} 个标签 · ${this.escapeHtml(firstTab.substring(0, 30))}</div>
                    </div>
                    <button class="win-focus-btn">聚焦</button>
                `;

                const checkbox = item.querySelector('.win-checkbox');
                // 当前聚焦的窗口不允许选中关闭
                if (win.focused) {
                    checkbox.disabled = true;
                    checkbox.title = '不能关闭当前窗口';
                }

                checkbox.addEventListener('change', () => {
                    if (checkbox.checked) {
                        this.selectedWindows.add(win.id);
                    } else {
                        this.selectedWindows.delete(win.id);
                    }
                    item.classList.toggle('selected', checkbox.checked);
                    this.batchCloseWindowsBtn.disabled = this.selectedWindows.size === 0;
                });

                const focusBtn = item.querySelector('.win-focus-btn');
                focusBtn.addEventListener('click', async () => {
                    try {
                        await chrome.windows.update(win.id, { focused: true });
                    } catch (e) {
                        console.error('聚焦窗口失败:', e);
                    }
                });

                this.windowsList.appendChild(item);
            });

            this.batchCloseWindowsBtn.disabled = true;
        } catch (error) {
            console.error('加载窗口列表失败:', error);
        }
    }

    async batchCloseWindows() {
        if (this.selectedWindows.size === 0) return;

        const confirmed = await this.showConfirm(`确定要关闭选中的 ${this.selectedWindows.size} 个窗口吗？\n这将关闭这些窗口中的所有标签页。`);
        if (!confirmed) return;

        try {
            await chrome.runtime.sendMessage({
                action: 'BATCH_CLOSE_WINDOWS',
                windowIds: [...this.selectedWindows]
            });
            this.showNotification(`已关闭 ${this.selectedWindows.size} 个窗口`, 'success');
            this.selectedWindows.clear();
            // 重新加载窗口列表
            setTimeout(() => this.loadWindowsList(), 300);
        } catch (error) {
            console.error('批量关闭窗口失败:', error);
            this.showNotification('关闭窗口失败', 'error');
        }
    }

    // ==================== 分类管理 ====================

    showNewCategoryForm() {
        this.newCategoryForm.classList.add('visible');
        this.categoryNameInput.focus();
    }

    hideNewCategoryForm() {
        this.newCategoryForm.classList.remove('visible');
        this.categoryNameInput.value = '';
        this.categoryKeywordsInput.value = '';
    }

    async saveCategory() {
        const name = this.categoryNameInput.value.trim();
        const keywordsStr = this.categoryKeywordsInput.value.trim();

        if (!name) {
            this.showNotification('请输入分类名称', 'info');
            return;
        }

        if (this.categories.has(name)) {
            this.showNotification('分类已存在', 'error');
            return;
        }

        // 解析关键词
        const keywords = keywordsStr
            ? keywordsStr.split(/[,，]/).map(k => k.trim()).filter(k => k)
            : [];

        this.categories.set(name, keywords);
        await this.saveCategories();
        this.hideNewCategoryForm();
        this.renderTabs();
        this.showNotification(`分类 "${name}" 创建成功`, 'success');
    }

    // ==================== 自动关闭设置 ====================

    async loadAutoCloseSettings() {
        try {
            const result = await chrome.runtime.sendMessage({ action: 'GET_AUTO_CLOSE_SETTINGS' });
            if (result) {
                this.autoCloseToggle.classList.toggle('on', result.enabled);
                this.autoCloseTimeout.value = result.timeout.toString();
                // 加载休眠模式设置
                if (result.mode && this.autoCloseMode) {
                    this.autoCloseMode.value = result.mode;
                }
            }
        } catch (error) {
            console.error('加载自动关闭设置失败:', error);
        }
    }

    toggleAutoClose() {
        const isOn = this.autoCloseToggle.classList.toggle('on');
        this.saveAutoCloseSettings();
    }

    async saveAutoCloseSettings() {
        const enabled = this.autoCloseToggle.classList.contains('on');
        const timeout = parseInt(this.autoCloseTimeout.value);
        const mode = this.autoCloseMode ? this.autoCloseMode.value : 'discard';
        const modeLabel = mode === 'close' ? '关闭' : '休眠';

        try {
            await chrome.runtime.sendMessage({
                action: 'SET_AUTO_CLOSE_SETTINGS',
                enabled,
                timeout,
                mode
            });
            this.showNotification(
                enabled ? `自动${modeLabel}已开启（${timeout}分钟）` : '自动休眠已关闭',
                'success'
            );
        } catch (error) {
            console.error('保存自动关闭设置失败:', error);
        }
    }

    toggleSettingsPanel() {
        const isVisible = this.settingsPanel.classList.toggle('visible');
        this.settingsBtn.classList.toggle('active', isVisible);
        // 关闭其他面板
        if (isVisible) {
            this.windowsPanel.classList.remove('visible');
            this.windowsBtn.classList.remove('active');
        }
    }

    // ==================== 置顶操作 ====================

    async togglePinTab(tab) {
        try {
            await chrome.tabs.update(tab.id, { pinned: !tab.pinned });
            this.updateStatus(tab.pinned ? '已取消置顶' : '已置顶');
            this.debounceRefresh();
        } catch (error) {
            console.error('切换置顶状态失败:', error);
            this.showNotification('操作失败', 'error');
        }
    }

    // ==================== 批量打开标签页 ====================

    showBatchModal() {
        this.batchOpenModal.classList.add('visible');
        this.batchUrlsInput.focus();
    }

    hideBatchModal() {
        this.batchOpenModal.classList.remove('visible');
        this.batchUrlsInput.value = '';
    }

    async readFromClipboard() {
        try {
            const text = await new Promise(resolve => {
                const textarea = document.createElement('textarea');
                textarea.style.opacity = '0';
                textarea.style.position = 'absolute';
                textarea.style.width = '1px';
                textarea.style.height = '1px';
                textarea.style.left = '-1px';
                textarea.style.top = '0';
                let resolved = false;
                const read = () => {
                    if (resolved) return;
                    resolved = true;
                    textarea.remove();
                    resolve(textarea.value);
                };
                textarea.addEventListener("paste", () => setTimeout(read, 0), { once: true });
                textarea.addEventListener("input", () => read(), { once: true });
                textarea.addEventListener("focus", () => document.execCommand('paste'), { once: true });
                document.body.appendChild(textarea);
                textarea.focus();
            });

            if (text) {
                this.batchUrlsInput.value = text;
                this.showNotification('已读取剪贴板内容', 'success');
            } else {
                this.showNotification('剪贴板为空', 'info');
            }
        } catch (error) {
            console.error('读取剪贴板失败:', error);
            this.showNotification('无法读取剪贴板，请尝试手动粘贴', 'error');
        }
    }

    async batchOpenUrls() {
        const text = this.batchUrlsInput.value.trim();
        if (!text) {
            this.showNotification('请输入要打开的链接', 'info');
            return;
        }

        const v = text.match(/(https|http|ttps|ttp)\:\/\/[-_.!~*'()a-zA-Z0-9;/?:@&=+$,%#]+/ig);

        if (!v || !v.length) {
            this.showNotification('未找到有效的链接', 'error');
            return;
        }

        // 获取所有已打开的标签页进行比对
        const existingTabs = await chrome.tabs.query({});
        const formatUrlForCompare = (url) => {
            try {
                const u = new URL(url);
                return u.origin + u.pathname.replace(/\/$/, '') + u.search;
            } catch {
                return url.replace(/\/$/, '');
            }
        };
        const existingUrls = new Set(existingTabs.map(t => formatUrlForCompare(t.url)));

        let openCount = 0;
        let skipCount = 0;

        for (let i = 0; i < v.length; ++i) {
            let url = v[i];
            if (url.substring(0, 3).toLowerCase() === 'ttp') {
                url = 'h' + url;
            }

            const normalizedUrl = formatUrlForCompare(url);
            if (existingUrls.has(normalizedUrl)) {
                skipCount++;
                continue; // 已经存在，跳过
            }

            try {
                await chrome.tabs.create({ url: url, active: false });
                existingUrls.add(normalizedUrl);
                openCount++;
            } catch (e) {
                console.error('打开链接失败:', url, e);
            }
        }

        if (openCount > 0 || skipCount > 0) {
            this.showNotification(`成功打开 ${openCount} 个，跳过重复 ${skipCount} 个`, 'success');
            this.hideBatchModal();
            this.debounceRefresh();
        }
    }

    // ==================== 画中画 (PiP) 悬浮打开 ====================

    async openPipBatchOpen() {
        if (!('documentPictureInPicture' in window)) {
            this.showNotification('当前浏览器不支持 Document PiP (悬浮窗) API', 'error');
            return;
        }

        try {
            // 请求 PiP 窗口
            const pipWindow = await window.documentPictureInPicture.requestWindow({
                width: 320,
                height: 240
            });

            // 注入样式
            const style = pipWindow.document.createElement('style');
            style.textContent = `
                body {
                    margin: 0;
                    padding: 15px;
                    background: linear-gradient(135deg, #764ba2 0%, #667eea 100%);
                    color: white;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    display: flex;
                    flex-direction: column;
                    height: 100vh;
                    box-sizing: border-box;
                    gap: 12px;
                }
                .header { font-size: 15px; font-weight: 600; text-align: center; }
                textarea {
                    flex: 1;
                    width: 100%;
                    background: rgba(255, 255, 255, 0.1);
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    border-radius: 8px;
                    color: white;
                    padding: 10px;
                    font-family: monospace;
                    font-size: 12px;
                    resize: none;
                    outline: none;
                    box-sizing: border-box;
                }
                textarea::placeholder { color: rgba(255, 255, 255, 0.5); }
                .actions { display: flex; gap: 10px; }
                button {
                    flex: 1;
                    padding: 8px;
                    border-radius: 8px;
                    border: none;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .btn-sec { background: rgba(255,255,255,0.15); color: white; border: 1px solid rgba(255,255,255,0.2); }
                .btn-sec:hover { background: rgba(255,255,255,0.25); }
                .btn-pri { background: rgba(255,255,255,0.9); color: #667eea; }
                .btn-pri:hover { background: #fff; }
                .status { font-size: 11px; text-align: center; opacity: 0.8; height: 14px; }
            `;
            pipWindow.document.head.appendChild(style);

            // 构建 DOM
            pipWindow.document.body.innerHTML = `
                <div class="header">📺 悬浮批量打开 (全局置顶)</div>
                <textarea id="pipInput" placeholder="请输入链接，一行一个..."></textarea>
                <div class="actions">
                    <button id="pipReadBtn" class="btn-sec">剪贴板读取</button>
                    <button id="pipOpenBtn" class="btn-pri">打开链接</button>
                </div>
                <div id="pipStatus" class="status"></div>
            `;

            const pipInput = pipWindow.document.getElementById('pipInput');
            const pipReadBtn = pipWindow.document.getElementById('pipReadBtn');
            const pipOpenBtn = pipWindow.document.getElementById('pipOpenBtn');
            const pipStatus = pipWindow.document.getElementById('pipStatus');

            const setStatus = (msg) => {
                pipStatus.textContent = msg;
                setTimeout(() => { if (pipStatus.textContent === msg) pipStatus.textContent = ''; }, 3000);
            };

            pipReadBtn.addEventListener('click', async () => {
                try {
                    const text = await new Promise(resolve => {
                        const tempTa = pipWindow.document.createElement('textarea');
                        tempTa.style.opacity = '0';
                        tempTa.style.position = 'absolute';
                        tempTa.style.width = '1px';
                        tempTa.style.height = '1px';
                        let resolved = false;
                        const read = () => {
                            if (resolved) return;
                            resolved = true;
                            tempTa.remove();
                            resolve(tempTa.value);
                        };
                        tempTa.addEventListener("paste", () => setTimeout(read, 0), { once: true });
                        tempTa.addEventListener("input", () => read(), { once: true });
                        tempTa.addEventListener("focus", () => pipWindow.document.execCommand('paste'), { once: true });
                        pipWindow.document.body.appendChild(tempTa);
                        tempTa.focus();
                    });
                    if (text) {
                        pipInput.value = text;
                        setStatus('✅ 已读取剪贴板内容');
                    } else {
                        setStatus('剪贴板为空');
                    }
                } catch (error) {
                    setStatus('❌ 读取失败，请手动粘贴');
                }
            });

            pipOpenBtn.addEventListener('click', async () => {
                const text = pipInput.value.trim();
                if (!text) {
                    setStatus('请输入链接');
                    return;
                }

                const v = text.match(/(https|http|ttps|ttp)\:\/\/[-_.!~*'()a-zA-Z0-9;/?:@&=+$,%#]+/ig);
                if (!v || !v.length) {
                    setStatus('❌ 未找到有效链接');
                    return;
                }

                const existingTabs = await chrome.tabs.query({});
                const formatUrlForCompare = (url) => {
                    try {
                        const u = new URL(url);
                        return u.origin + u.pathname.replace(/\/$/, '') + u.search;
                    } catch {
                        return url.replace(/\/$/, '');
                    }
                };
                const existingUrls = new Set(existingTabs.map(t => formatUrlForCompare(t.url)));

                let openCount = 0;
                let skipCount = 0;

                for (let i = 0; i < v.length; ++i) {
                    let url = v[i];
                    if (url.substring(0, 3).toLowerCase() === 'ttp') url = 'h' + url;

                    const normalizedUrl = formatUrlForCompare(url);
                    if (existingUrls.has(normalizedUrl)) {
                        skipCount++;
                        continue;
                    }

                    try {
                        await chrome.tabs.create({ url: url, active: false });
                        existingUrls.add(normalizedUrl);
                        openCount++;
                    } catch (e) { }
                }

                if (openCount > 0 || skipCount > 0) {
                    setStatus(`✅ 打开 ${openCount} 个，跳过重复 ${skipCount} 个`);
                    pipInput.value = '';
                    this.debounceRefresh();
                }
            });

        } catch (error) {
            console.error('打开 PiP 失败:', error);
            this.showNotification('开启悬浮窗失败，可能需更新 Chrome 版本', 'error');
        }
    }

    // ==================== 辅助方法 ====================

    showEmptyState(message) {
        this.tabContent.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🔍</div>
                <p class="empty-text">${message}</p>
            </div>
        `;
    }

    showNotification(message, type = 'info') {
        document.querySelectorAll('.notification').forEach(n => n.remove());
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);
        setTimeout(() => {
            notification.classList.add('fade-out');
            setTimeout(() => notification.remove(), 300);
        }, 2500);
    }

    /**
     * 自定义确认弹窗（替代原生 confirm）
     * @param {string} message 确认提示文本
     * @returns {Promise<boolean>} 用户确认返回 true，取消返回 false
     */
    showConfirm(message) {
        return new Promise((resolve) => {
            const overlay = document.getElementById('confirmOverlay');
            const msgEl = document.getElementById('confirmMessage');
            const okBtn = document.getElementById('confirmOkBtn');
            const cancelBtn = document.getElementById('confirmCancelBtn');

            // 支持换行显示
            msgEl.innerHTML = message.replace(/\n/g, '<br>');
            overlay.classList.add('visible');

            // 清理旧的事件监听器
            const newOkBtn = okBtn.cloneNode(true);
            const newCancelBtn = cancelBtn.cloneNode(true);
            okBtn.parentNode.replaceChild(newOkBtn, okBtn);
            cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

            const close = (result) => {
                overlay.classList.remove('visible');
                resolve(result);
            };

            newOkBtn.addEventListener('click', () => close(true), { once: true });
            newCancelBtn.addEventListener('click', () => close(false), { once: true });

            // 点击遮罩层关闭
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) close(false);
            }, { once: true });

            // Esc 键关闭
            const escHandler = (e) => {
                if (e.key === 'Escape') {
                    close(false);
                    document.removeEventListener('keydown', escHandler);
                }
            };
            document.addEventListener('keydown', escHandler);
        });
    }

    updateStatus(text) {
        this.statusText.textContent = text;
        setTimeout(() => {
            this.statusText.textContent = '就绪';
        }, 2000);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text || '';
        return div.innerHTML;
    }

    formatUrl(url) {
        try {
            const u = new URL(url);
            return u.hostname + (u.pathname !== '/' ? u.pathname : '');
        } catch {
            return url || '';
        }
    }

    // ==================== 键盘导航 ====================

    setupKeyboardNavigation() {
        this.keyboardFocusedIndex = -1;

        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + F 全局快速聚焦搜索框
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
                e.preventDefault();
                if (this.searchInput) {
                    this.searchInput.focus();
                }
                return;
            }

            const isInput = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA';

            if (isInput) {
                if (e.key === 'Escape') {
                    e.target.blur(); // 按 Esc 退出输入框焦点，以便继续使用上下键
                }
                return; // 输入状态下不拦截上下键
            }

            const items = Array.from(document.querySelectorAll('.tab-item'));
            if (items.length === 0) return;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                this.keyboardFocusedIndex = (this.keyboardFocusedIndex + 1) % items.length;
                this.updateKeyboardFocus(items);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                this.keyboardFocusedIndex = this.keyboardFocusedIndex <= 0 ? items.length - 1 : this.keyboardFocusedIndex - 1;
                this.updateKeyboardFocus(items);
            } else if (e.key === 'Enter') {
                if (this.keyboardFocusedIndex >= 0 && this.keyboardFocusedIndex < items.length) {
                    e.preventDefault();
                    const tabId = parseInt(items[this.keyboardFocusedIndex].dataset.tabId, 10);
                    this.switchToTab(tabId);
                }
            } else if (e.key === 'Delete' || e.key === 'Backspace') {
                if (this.keyboardFocusedIndex >= 0 && this.keyboardFocusedIndex < items.length) {
                    e.preventDefault();
                    const tabId = parseInt(items[this.keyboardFocusedIndex].dataset.tabId, 10);
                    this.closeTab(tabId);

                    // 等待 DOM 更新后调整焦点
                    setTimeout(() => {
                        const newItems = Array.from(document.querySelectorAll('.tab-item'));
                        if (newItems.length > 0) {
                            this.keyboardFocusedIndex = Math.min(this.keyboardFocusedIndex, newItems.length - 1);
                            this.updateKeyboardFocus(newItems);
                        } else {
                            this.keyboardFocusedIndex = -1;
                        }
                    }, 100);
                }
            }
        });
    }

    updateKeyboardFocus(items) {
        items.forEach((item, index) => {
            if (index === this.keyboardFocusedIndex) {
                item.classList.add('keyboard-focused');
                item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            } else {
                item.classList.remove('keyboard-focused');
            }
        });
    }
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    new TabManager();
});