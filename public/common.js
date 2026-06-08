/**
 * 共享工具函数库
 * Website Statistics Service
 */

// ======================== 主题切换 ========================

/**
 * 初始化主题设置
 */
function initTheme() {
  const savedTheme = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = savedTheme === 'dark' || (!savedTheme && prefersDark);
  
  if (isDark) {
    document.documentElement.classList.add('dark');
  }
  updateThemeUI(isDark);
}

/**
 * 切换主题
 */
function toggleTheme() {
  const isDark = document.documentElement.classList.toggle('dark');
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
  updateThemeUI(isDark);
}

/**
 * 更新主题UI（图标）
 */
function updateThemeUI(isDark) {
  const icon = document.getElementById('themeIcon');
  if (!icon) return;
  
  if (isDark) {
    icon.innerHTML = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>';
  } else {
    icon.innerHTML = '<circle cx="12" cy="12" r="5"></circle><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"></path>';
  }
}

// ======================== 导航栏 ========================

/**
 * 渲染导航栏 - 根据当前页面高亮导航项
 */
function renderNavigation() {
  const currentPath = window.location.pathname;

  document.querySelectorAll('.nav-item').forEach(btn => {
    const href = btn.getAttribute('href');
    if (href === currentPath || (href === '/overview' && (currentPath === '/' || currentPath === ''))) {
      btn.classList.add('nav-active');
    } else {
      btn.classList.remove('nav-active');
    }
  });
}

// ======================== 导航栏组件 ========================

const NAV_ITEMS = [
  { path: '/overview', label: '数据概览' },
  { path: '/charts', label: '图表分析' },
  { path: '/records', label: '访问记录' },
  { path: '/logs', label: '操作日志' },
  { path: '/api-docs', label: 'API文档' },
  { path: '/repo', label: '仓库信息' },
  { path: '/version', label: '版本管理' },
  { path: '/settings', label: '高级设置' }
];

/**
 * 渲染顶部导航栏
 */
function renderNavigationBar() {
  if (document.querySelector('nav.site-nav')) return;
  
  const currentPath = window.location.pathname;
  
  const nav = document.createElement('nav');
  nav.className = 'site-nav bg-white dark:bg-neutral-900 border-b border-gray-200 dark:border-neutral-800 sticky top-0 z-40';
  nav.innerHTML = `
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex items-center justify-between h-16">
        <div class="flex items-center gap-8">
          <h1 class="text-lg font-semibold text-gray-800 dark:text-gray-100">WebsiteStatistics</h1>
          <div class="hidden md:flex items-center gap-1">
            ${NAV_ITEMS.map(item => `
              <a href="${item.path}" class="nav-item px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                currentPath === item.path ? 'nav-active' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-800'
              }">${item.label}</a>
            `).join('')}
          </div>
        </div>
        <div class="flex items-center gap-3">
          <button id="mobileMenuBtn" class="md:hidden p-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-800">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path>
            </svg>
          </button>
          <button onclick="AppUtils.toggleTheme()" class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors">
            <svg class="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="5"></circle>
              <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"></path>
            </svg>
          </button>
          <a href="/logout" class="text-sm text-red-600 dark:text-red-400 hover:text-red-700">退出</a>
        </div>
      </div>
    </div>
    <div id="mobileMenu" class="hidden md:hidden border-t border-gray-200 dark:border-neutral-800 px-4 py-3 space-y-1">
      ${NAV_ITEMS.map(item => `
        <a href="${item.path}" class="nav-item block px-4 py-2 rounded-lg text-sm font-medium ${
          currentPath === item.path ? '' : 'text-gray-600 dark:text-gray-400'
        }">${item.label}</a>
      `).join('')}
    </div>
  `;
  
  document.body.insertBefore(nav, document.body.firstChild);
  
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const mobileMenu = document.getElementById('mobileMenu');
  if (mobileMenuBtn && mobileMenu) {
    mobileMenuBtn.addEventListener('click', function() {
      mobileMenu.classList.toggle('hidden');
    });
  }
}

// ======================== Footer ========================

/**
 * 渲染 Footer - 包含版权信息、GitHub链接和许可证
 */
function renderFooter() {
  // 检查是否已存在 footer
  if (document.querySelector('footer')) return;
  
  const footer = document.createElement('footer');
  footer.className = 'site-footer bg-white dark:bg-neutral-900 py-4 px-6 mt-auto';
  footer.innerHTML = `
    <div class="flex flex-wrap items-center justify-center gap-4 text-sm text-gray-500 dark:text-gray-400">
      <span>© 2026 EndlessPixel Studio</span>
      <span class="hidden sm:inline">|</span>
      <a href="https://github.com/EndlessPixel/website-statistics" target="_blank" class="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">GitHub</a>
      <span class="hidden sm:inline">|</span>
      <a href="/LICENSE" target="_blank" class="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">MIT License</a>
    </div>
  `;
  document.body.appendChild(footer);
}

// ======================== 自动刷新 ========================

let refreshTimer = null;

/**
 * 设置自动刷新
 * @param {Function} callback - 刷新时调用的回调函数
 */
function setupAutoRefresh(callback) {
  const autoRefresh = document.getElementById('autoRefresh');
  const interval = document.getElementById('refreshInterval');
  
  if (!autoRefresh || !interval) return;
  
  function doRefresh() {
    if (autoRefresh.checked) {
      const intervalValue = parseInt(interval.value) * 1000;
      if (refreshTimer) {
        clearInterval(refreshTimer);
      }
      refreshTimer = setInterval(callback, intervalValue);
    }
  }
  
  // 初始设置
  doRefresh();
  
  // 监听变化
  autoRefresh.addEventListener('change', doRefresh);
  interval.addEventListener('change', doRefresh);
}

/**
 * 清除自动刷新
 */
function clearAutoRefresh() {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
}

// ======================== 时间格式化 ========================

/**
 * 统一时间格式化函数
 */
function formatTime(timeStr) {
  if (!timeStr) return '-';
  try {
    // 支持时间戳（秒或毫秒）
    let date;
    if (/^\d+$/.test(timeStr)) {
      const timestamp = parseInt(timeStr);
      // 判断是秒还是毫秒（秒级时间戳通常小于100亿）
      date = new Date(timestamp < 10000000000 ? timestamp * 1000 : timestamp);
    } else {
      date = new Date(timeStr);
    }
    
    if (isNaN(date.getTime())) return timeStr;
    
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  } catch (e) {
    return timeStr;
  }
}

// ======================== 分页控制 ========================

let paginationState = {
  currentPage: 1,
  currentPageSize: 25,
  totalPages: 0,
  selectedIds: new Set()
};

/**
 * 上一页
 */
function prevPage(callback) {
  if (paginationState.currentPage > 1) {
    paginationState.currentPage--;
    paginationState.selectedIds.clear();
    updateSelectedCount();
    callback();
  }
}

/**
 * 下一页
 */
function nextPage(callback) {
  if (paginationState.currentPage < paginationState.totalPages) {
    paginationState.currentPage++;
    paginationState.selectedIds.clear();
    updateSelectedCount();
    callback();
  }
}

/**
 * 应用每页数量
 */
function applyPageSize(newSize, callback) {
  if (newSize >= 1 && newSize <= 100) {
    paginationState.currentPageSize = newSize;
    paginationState.currentPage = 1;
    paginationState.selectedIds.clear();
    updateSelectedCount();
    callback();
  } else {
    alert('每页数量必须在1-100之间');
  }
}

/**
 * 更新分页信息
 */
function updatePagination(pagination, countEl, pageInfoEl, prevBtnEl, nextBtnEl) {
  paginationState.totalPages = pagination.totalPages;
  
  if (countEl) countEl.textContent = '总记录数: ' + pagination.total;
  if (pageInfoEl) pageInfoEl.textContent = `第 ${pagination.page} 页 / 共 ${pagination.totalPages} 页`;
  if (prevBtnEl) prevBtnEl.disabled = pagination.page <= 1;
  if (nextBtnEl) nextBtnEl.disabled = pagination.page >= pagination.totalPages;
}

/**
 * 更新已选择数量
 */
function updateSelectedCount() {
  const count = paginationState.selectedIds.size;
  const countEl = document.getElementById('selectedCount');
  const batchBtn = document.getElementById('batchDeleteBtn');
  const forceBatchBtn = document.getElementById('forceBatchDeleteBtn');
  const selectAll = document.getElementById('selectAll');
  
  if (countEl) countEl.textContent = `已选择 ${count} 条`;
  if (batchBtn) batchBtn.disabled = count === 0;
  if (forceBatchBtn) forceBatchBtn.disabled = count === 0;
  if (selectAll) {
    const checkboxes = document.querySelectorAll('input[type="checkbox"].row-checkbox');
    selectAll.checked = count > 0 && checkboxes.length === count;
  }
}

/**
 * 全选/取消全选
 */
function toggleSelectAll(checked) {
  const selectAll = document.getElementById('selectAll');
  const actualChecked = checked !== undefined ? checked : selectAll.checked;

  const checkboxes = document.querySelectorAll('input[type="checkbox"].row-checkbox');
  checkboxes.forEach(cb => {
    cb.checked = actualChecked;
    const id = parseInt(cb.dataset.id);
    if (actualChecked) {
      paginationState.selectedIds.add(id);
    } else {
      paginationState.selectedIds.delete(id);
    }
  });

  updateSelectedCount();
}

/**
 * 切换行选中状态
 */
function toggleRowSelect(id) {
  const checkbox = document.querySelector(`input[type="checkbox"][data-id="${id}"]`);
  if (checkbox.checked) {
    paginationState.selectedIds.add(id);
  } else {
    paginationState.selectedIds.delete(id);
  }
  updateSelectedCount();
}

/**
 * 获取当前分页状态
 */
function getPaginationState() {
  return {
    page: paginationState.currentPage,
    pageSize: paginationState.currentPageSize
  };
}

/**
 * 重置分页状态
 */
function resetPaginationState() {
  paginationState = {
    currentPage: 1,
    currentPageSize: 25,
    totalPages: 0,
    selectedIds: new Set()
  };
}

// ======================== 删除操作 ========================

/**
 * 处理删除（单条）
 */
function handleDelete(id, event, callback) {
  const isShiftPressed = event.shiftKey;
  
  if (isShiftPressed) {
    deleteRecord(id, true, callback);
  } else {
    if (confirm('确定要删除这条记录吗？')) {
      deleteRecord(id, false, callback);
    }
  }
}

/**
 * 删除记录
 */
function deleteRecord(id, force = false, callback) {
  const url = force ? `/api/statistics/${id}?force=1` : `/api/statistics/${id}`;
  fetch(url, { method: 'DELETE' })
    .then(response => response.json())
    .then(data => {
      if (data.code === 0) {
        paginationState.selectedIds.delete(id);
        updateSelectedCount();
        if (callback) callback();
      } else {
        alert(data.msg);
      }
    })
    .catch(error => {
      console.error('删除失败:', error);
      alert('删除失败');
    });
}

/**
 * 处理批量删除
 */
function handleBatchDelete(force = false, callback) {
  if (paginationState.selectedIds.size === 0) {
    alert('请先选择要删除的记录');
    return;
  }
  
  if (force || confirm(`确定要删除选中的 ${paginationState.selectedIds.size} 条记录吗？`)) {
    batchDelete(force, callback);
  }
}

/**
 * 批量删除
 */
function batchDelete(force = false, callback) {
  const ids = Array.from(paginationState.selectedIds);
  
  fetch('/api/statistics/batch-delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids, force })
  })
  .then(response => response.json())
  .then(data => {
    if (data.code === 0) {
      paginationState.selectedIds.clear();
      updateSelectedCount();
      if (callback) callback();
    } else {
      alert(data.msg);
    }
  })
  .catch(error => {
    console.error('批量删除失败:', error);
    alert('批量删除失败');
  });
}

// ======================== IP查询 ========================

/**
 * 查询IP信息
 */
function queryIp(ip) {
  const modal = document.getElementById('ipModal');
  const content = document.getElementById('ipInfoContent');
  
  if (!modal || !content) {
    console.error('IP查询模态框未找到');
    return;
  }
  
  // 显示API选择弹窗
  content.innerHTML = `
    <div class="text-center">
      <p class="text-gray-700 dark:text-gray-300 mb-4">请选择查询方式</p>
      <div class="grid grid-cols-2 gap-3">
        <button onclick="AppUtils.executeIpQuery('${ip}', 'ip9')" class="px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex flex-col items-center">
          <span class="font-medium">IP9</span>
          <span class="text-xs opacity-80">主通道</span>
        </button>
        <button onclick="AppUtils.executeIpQuery('${ip}', 'uapis')" class="px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors flex flex-col items-center">
          <span class="font-medium">uapis</span>
          <span class="text-xs opacity-80">备用通道</span>
        </button>
      </div>
      <p class="text-xs text-gray-500 dark:text-gray-400 mt-4">免费用户默认使用IP9通道，查询失败后可尝试uapis通道</p>
    </div>
  `;
  modal.style.display = 'block';
}

/**
 * 执行IP查询
 */
function executeIpQuery(ip, api) {
  const content = document.getElementById('ipInfoContent');
  content.innerHTML = `
    <div class="text-center py-4">
      <div class="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent"></div>
      <p class="text-gray-500 dark:text-gray-400 mt-2">正在通过 ${api === 'ip9' ? 'IP9' : 'uapis'} 查询...</p>
    </div>
  `;
  
  fetch(`/api/query-ip?ip=${encodeURIComponent(ip)}&api=${api}`)
    .then(response => response.json())
    .then(data => {
      if (data.code === 0) {
        renderIpInfo(data.data);
      } else {
        content.innerHTML = `
          <div class="text-center">
            <p style="color:red">${data.msg}</p>
            ${api === 'ip9' ? `
              <p class="text-sm text-gray-500 dark:text-gray-400 mt-2">IP9查询失败，尝试uapis？</p>
              <button onclick="AppUtils.executeIpQuery('${ip}', 'uapis')" class="mt-3 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm">使用uapis查询</button>
            ` : `
              <p class="text-sm text-gray-500 dark:text-gray-400 mt-2">所有通道均查询失败</p>
            `}
          </div>
        `;
      }
    })
    .catch(error => {
      console.error('查询IP失败:', error);
      content.innerHTML = `
        <div class="text-center">
          <p style="color:red">查询失败，请重试</p>
          ${api === 'ip9' ? `
            <button onclick="AppUtils.executeIpQuery('${ip}', 'uapis')" class="mt-3 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm">使用uapis查询</button>
          ` : ''}
        </div>
      `;
    });
}

/**
 * 渲染IP信息
 */
function renderIpInfo(ipInfo) {
  const content = document.getElementById('ipInfoContent');
  if (!content) return;
  
  const sourceLabel = ipInfo.source === 'uapis' ? 'uapis' : 'IP9';
  const sourceClass = ipInfo.source === 'uapis' ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300' : 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300';
  
  const infoHtml = `
    <div class="mb-3 flex items-center justify-between">
      <span class="text-xs px-2 py-1 rounded ${sourceClass}">来源: ${sourceLabel}</span>
      <button onclick="AppUtils.executeIpQuery('${ipInfo.ip}', '${ipInfo.source === 'uapis' ? 'ip9' : 'uapis'}')" class="text-xs text-blue-600 dark:text-blue-400 hover:underline">切换通道</button>
    </div>
    <div class="ip-info-grid">
      <div class="info-item"><span class="label">IP地址:</span><span class="value">${ipInfo.ip || '-'}</span></div>
      <div class="info-item"><span class="label">国家/地区:</span><span class="value">${ipInfo.country || '-'}</span></div>
      <div class="info-item"><span class="label">省份:</span><span class="value">${ipInfo.province || ipInfo.prov || '-'}</span></div>
      <div class="info-item"><span class="label">城市:</span><span class="value">${ipInfo.city || '-'}</span></div>
      <div class="info-item"><span class="label">运营商:</span><span class="value">${ipInfo.isp || '-'}</span></div>
      ${ipInfo.lng ? `<div class="info-item"><span class="label">经度:</span><span class="value">${ipInfo.lng}</span></div>` : ''}
      ${ipInfo.lat ? `<div class="info-item"><span class="label">纬度:</span><span class="value">${ipInfo.lat}</span></div>` : ''}
      ${ipInfo.info ? `<div class="info-item col-span-2"><span class="label">完整信息:</span><span class="value">${ipInfo.info}</span></div>` : ''}
    </div>
  `;
  
  content.innerHTML = infoHtml;
}

/**
 * 关闭IP信息模态框
 */
function closeIpModal() {
  const modal = document.getElementById('ipModal');
  if (modal) modal.style.display = 'none';
}

// ======================== 导出公共API ========================

window.AppUtils = {
  // 主题
  initTheme,
  toggleTheme,
  updateThemeUI,
  
  // 导航
  renderNavigation,
  renderNavigationBar,
  
  // Footer
  renderFooter,
  
  // 自动刷新
  setupAutoRefresh,
  clearAutoRefresh,
  
  // 时间格式化
  formatTime,
  
  // 分页
  getPaginationState,
  resetPaginationState,
  prevPage,
  nextPage,
  applyPageSize,
  updatePagination,
  updateSelectedCount,
  toggleSelectAll,
  toggleRowSelect,
  
  // 删除
  handleDelete,
  deleteRecord,
  handleBatchDelete,
  batchDelete,
  
  // IP查询
  queryIp,
  executeIpQuery,
  renderIpInfo,
  closeIpModal
};
