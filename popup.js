// popup.js - 弹窗逻辑
// 功能：统计展示、快速操作、导入导出、管理器窗口/侧边栏入口

class PopupManager {
    constructor() {
        this.tabs = [];
        this.initializeElements();
        this.bindEvents();
        this.loadStats();
    }

    initializeElements() {
        this.statsContainer = document.getElementById('stats');
        this.openManagerBtn = document.getElementById('openManager');
        this.openSidepanelBtn = document.getElementById('openSidepanel');
        this.groupTabsBtn = document.getElementById('groupTabs');
        this.closeOthersBtn = document.getElementById('closeOthers');
        this.refreshAllBtn = document.getElementById('refreshAll');
        this.bookmarkAllBtn = document.getElementById('bookmarkAll');
        this.exportTabsBtn = document.getElementById('exportTabs');
        this.importTabsBtn = document.getElementById('importTabs');
        this.importFileInput = document.getElementById('importFileInput');
        
        // 批量打开
        this.batchOpenBtn = document.getElementById('batchOpenBtn');
        this.batchOpenModal = document.getElementById('batchOpenModal');
        this.closeBatchModalBtn = document.getElementById('closeBatchModal');
        this.batchUrlsInput = document.getElementById('batchUrlsInput');
        this.readClipboardBtn = document.getElementById('readClipboardBtn');
        this.confirmBatchOpenBtn = document.getElementById('confirmBatchOpenBtn');
    }

    bindEvents() {
        this.openManagerBtn.addEventListener('click', () => this.openManagerWindow());
        this.openSidepanelBtn.addEventListener('click', () => this.openSidepanel());
        this.groupTabsBtn.addEventListener('click', () => this.groupTabs());
        this.closeOthersBtn.addEventListener('click', () => this.closeOtherTabs());
        this.refreshAllBtn.addEventListener('click', () => this.refreshAllTabs());
        this.bookmarkAllBtn.addEventListener('click', () => this.bookmarkAllTabs());
        this.exportTabsBtn.addEventListener('click', () => this.exportTabs());
        this.importTabsBtn.addEventListener('click', () => this.importFileInput.click());
        this.importFileInput.addEventListener('change', (e) => this.importTabs(e));

        // 批量打开
        this.batchOpenBtn.addEventListener('click', () => this.showBatchModal());
        this.closeBatchModalBtn.addEventListener('click', () => this.hideBatchModal());
        this.readClipboardBtn.addEventListener('click', () => this.readFromClipboard());
        this.confirmBatchOpenBtn.addEventListener('click', () => this.batchOpenUrls());
    }

    // ==================== 统计信息 ====================

    async loadStats() {
        try {
            // 获取所有标签页
            this.tabs = await chrome.tabs.query({});
            // 获取当前窗口标签页
            const currentWindowTabs = await chrome.tabs.query({ currentWindow: true });
            // 获取所有窗口
            const windows = await chrome.windows.getAll();

            // 计算统计
            const totalTabs = this.tabs.length;
            const windowCount = windows.length;
            const domains = new Set();
            this.tabs.forEach(tab => {
                try {
                    domains.add(new URL(tab.url).hostname);
                } catch (e) { /* 忽略无效 URL */ }
            });

            this.renderStats({
                totalTabs,
                currentWindowTabs: currentWindowTabs.length,
                windows: windowCount,
                domains: domains.size
            });

        } catch (error) {
            console.error('加载统计信息失败:', error);
            this.showError('无法加载统计信息');
        }
    }

    renderStats(stats) {
        this.statsContainer.innerHTML = `
            <div class="stat-item">
                <div class="stat-number">${stats.totalTabs}</div>
                <div class="stat-label">总标签数</div>
            </div>
            <div class="stat-item">
                <div class="stat-number">${stats.currentWindowTabs}</div>
                <div class="stat-label">当前窗口</div>
            </div>
            <div class="stat-item">
                <div class="stat-number">${stats.domains}</div>
                <div class="stat-label">不同域名</div>
            </div>
        `;
    }

    // ==================== 打开管理器（左侧伪窗口，单例复用） ====================

    async openManagerWindow() {
        try {
            await chrome.runtime.sendMessage({ action: 'OPEN_MANAGER_WINDOW' });
            window.close();
        } catch (error) {
            console.error('打开管理器失败:', error);
            this.showNotification('打开管理器失败', 'error');
        }
    }

    // ==================== 打开右侧侧边栏 ====================

    async openSidepanel() {
        try {
            const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (activeTab) {
                await chrome.sidePanel.setOptions({
                    tabId: activeTab.id,
                    path: 'sidepanel.html',
                    enabled: true
                });
                await chrome.sidePanel.open({ tabId: activeTab.id });
                window.close();
            }
        } catch (error) {
            console.error('打开侧边栏失败:', error);
            this.showNotification('打开侧边栏失败', 'error');
        }
    }

    // ==================== 按域名分组 ====================

    async groupTabs() {
        try {
            const tabs = await chrome.tabs.query({ currentWindow: true });
            const domainGroups = {};

            tabs.forEach(tab => {
                try {
                    const domain = new URL(tab.url).hostname;
                    if (!domainGroups[domain]) domainGroups[domain] = [];
                    domainGroups[domain].push(tab.id);
                } catch (error) { /* 忽略无效 URL */ }
            });

            let groupsCreated = 0;
            const colors = ['grey', 'blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan'];

            for (const [domain, tabIds] of Object.entries(domainGroups)) {
                if (tabIds.length > 1) {
                    try {
                        const group = await chrome.tabs.group({ tabIds });
                        await chrome.tabGroups.update(group, {
                            title: domain,
                            color: colors[groupsCreated % colors.length]
                        });
                        groupsCreated++;
                    } catch (error) {
                        console.error(`创建 ${domain} 组失败:`, error);
                    }
                }
            }

            this.showNotification(`成功创建 ${groupsCreated} 个标签组`, 'success');
            setTimeout(() => window.close(), 1200);
        } catch (error) {
            console.error('分组标签页失败:', error);
            this.showNotification('分组失败', 'error');
        }
    }

    // ==================== 关闭其他标签 ====================

    async closeOtherTabs() {
        try {
            const tabs = await chrome.tabs.query({ currentWindow: true });
            const otherTabs = tabs.filter(tab => !tab.active && !tab.pinned);

            if (otherTabs.length === 0) {
                this.showNotification('没有其他标签页可关闭', 'info');
                return;
            }

            const confirmed = confirm(`确定要关闭其他 ${otherTabs.length} 个标签页吗？\n（固定标签不会被关闭）`);
            if (!confirmed) return;

            const tabIds = otherTabs.map(tab => tab.id);
            await chrome.tabs.remove(tabIds);

            this.showNotification(`已关闭 ${tabIds.length} 个标签页`, 'success');
            setTimeout(() => window.close(), 1200);
        } catch (error) {
            console.error('关闭其他标签页失败:', error);
            this.showNotification('关闭失败', 'error');
        }
    }

    // ==================== 刷新所有标签 ====================

    async refreshAllTabs() {
        try {
            const tabs = await chrome.tabs.query({ currentWindow: true });
            let refreshCount = 0;

            for (const tab of tabs) {
                try {
                    if (!tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
                        await chrome.tabs.reload(tab.id);
                        refreshCount++;
                    }
                } catch (error) {
                    console.error(`刷新标签页 ${tab.id} 失败:`, error);
                }
            }

            this.showNotification(`已刷新 ${refreshCount} 个标签页`, 'success');
            setTimeout(() => window.close(), 1200);
        } catch (error) {
            console.error('刷新所有标签页失败:', error);
            this.showNotification('刷新失败', 'error');
        }
    }

    // ==================== 全部收藏 ====================

    async bookmarkAllTabs() {
        try {
            const tabs = await chrome.tabs.query({ currentWindow: true });
            const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
            const folderTitle = `标签页备份 - ${timestamp}`;

            const folder = await chrome.bookmarks.create({
                title: folderTitle,
                parentId: '1'
            });

            let bookmarkCount = 0;
            for (const tab of tabs) {
                try {
                    if (!tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
                        await chrome.bookmarks.create({
                            title: tab.title,
                            url: tab.url,
                            parentId: folder.id
                        });
                        bookmarkCount++;
                    }
                } catch (error) {
                    console.error('添加书签失败:', error);
                }
            }

            this.showNotification(`已添加 ${bookmarkCount} 个书签`, 'success');
        } catch (error) {
            console.error('收藏所有标签页失败:', error);
            this.showNotification('收藏失败', 'error');
        }
    }

    // ==================== 导出标签 ====================

    async exportTabs() {
        try {
            const tabs = await chrome.tabs.query({});
            const windows = await chrome.windows.getAll({ populate: true });
            const timestamp = new Date().toISOString().slice(0, 19).replace('T', '_');

            const exportData = {
                exportVersion: '2.0',
                timestamp: new Date().toISOString(),
                totalTabs: tabs.length,
                totalWindows: windows.length,
                windows: windows.map(win => ({
                    id: win.id,
                    focused: win.focused,
                    type: win.type,
                    tabs: (win.tabs || []).map(tab => ({
                        title: tab.title,
                        url: tab.url,
                        active: tab.active,
                        pinned: tab.pinned,
                        index: tab.index
                    }))
                }))
            };

            const jsonData = JSON.stringify(exportData, null, 2);
            const blob = new Blob([jsonData], { type: 'application/json' });
            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = `tabs_export_${timestamp}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            this.showNotification(`已导出 ${tabs.length} 个标签页`, 'success');
        } catch (error) {
            console.error('导出标签页失败:', error);
            this.showNotification('导出失败', 'error');
        }
    }

    // ==================== 导入标签 ====================

    async importTabs(event) {
        const file = event.target.files[0];
        if (!file) return;

        try {
            const text = await file.text();
            const data = JSON.parse(text);

            let tabCount = 0;

            // 支持 v2.0 格式（按窗口分组）
            if (data.windows && Array.isArray(data.windows)) {
                for (const win of data.windows) {
                    if (win.tabs && win.tabs.length > 0) {
                        // 为每个导入窗口创建新窗口
                        const urls = win.tabs.map(t => t.url).filter(u =>
                            u && !u.startsWith('chrome://') && !u.startsWith('chrome-extension://')
                        );
                        if (urls.length > 0) {
                            await chrome.windows.create({ url: urls });
                            tabCount += urls.length;
                        }
                    }
                }
            }
            // 支持 v1.0 格式（平铺列表）
            else if (data.tabs && Array.isArray(data.tabs)) {
                const urls = data.tabs.map(t => t.url).filter(u =>
                    u && !u.startsWith('chrome://') && !u.startsWith('chrome-extension://')
                );
                if (urls.length > 0) {
                    await chrome.windows.create({ url: urls });
                    tabCount = urls.length;
                }
            } else {
                this.showNotification('无效的导入文件格式', 'error');
                return;
            }

            this.showNotification(`成功导入 ${tabCount} 个标签页`, 'success');
            // 重置文件输入
            event.target.value = '';
            // 刷新统计
            setTimeout(() => this.loadStats(), 500);

        } catch (error) {
            console.error('导入标签页失败:', error);
            this.showNotification('导入失败：文件格式错误', 'error');
            event.target.value = '';
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
            setTimeout(() => this.loadStats(), 500);
        }
    }

    // ==================== 通知 ====================

    showNotification(message, type = 'info') {
        // 移除已有通知
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

    showError(message) {
        this.statsContainer.innerHTML = `
            <div class="stat-card" style="flex: 1;">
                <span class="stat-icon">⚠️</span>
                <div class="stat-number" style="font-size: 14px;">${message}</div>
                <div class="stat-label">请重试</div>
            </div>
        `;
    }
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    new PopupManager();
});