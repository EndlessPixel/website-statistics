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
  const selectAll = document.getElementById('selectAll');
  
  if (countEl) countEl.textContent = `已选择 ${count} 条`;
  if (batchBtn) batchBtn.disabled = count === 0;
  if (selectAll) {
    const checkboxes = document.querySelectorAll('input[type="checkbox"].row-checkbox');
    selectAll.checked = count > 0 && checkboxes.length === count;
  }
}

/**
 * 全选/取消全选
 */
function toggleSelectAll() {
  const checkboxes = document.querySelectorAll('input[type="checkbox"].row-checkbox');
  const selectAll = document.getElementById('selectAll');
  
  checkboxes.forEach(cb => {
    cb.checked = selectAll.checked;
    const id = parseInt(cb.dataset.id);
    if (selectAll.checked) {
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
  const content = document.getElementById('ipModalContent');
  
  if (!modal || !content) {
    console.error('IP查询模态框未找到');
    return;
  }
  
  content.innerHTML = '<p>正在查询...</p>';
  modal.style.display = 'block';
  
  fetch(`/api/query-ip?ip=${encodeURIComponent(ip)}`)
    .then(response => response.json())
    .then(data => {
      if (data.code === 0) {
        renderIpInfo(data.data);
      } else {
        content.innerHTML = `<p style="color:red">${data.msg}</p>`;
      }
    })
    .catch(error => {
      console.error('查询IP失败:', error);
      content.innerHTML = '<p style="color:red">查询失败</p>';
    });
}

/**
 * 渲染IP信息
 */
function renderIpInfo(ipInfo) {
  const content = document.getElementById('ipModalContent');
  if (!content) return;
  
  const infoHtml = `
    <div class="ip-info-grid">
      <div class="info-item"><span class="label">IP地址:</span><span class="value">${ipInfo.ip || '-'}</span></div>
      <div class="info-item"><span class="label">国家/地区:</span><span class="value">${ipInfo.country || '-'}</span></div>
      <div class="info-item"><span class="label">省份:</span><span class="value">${ipInfo.prov || '-'}</span></div>
      <div class="info-item"><span class="label">城市:</span><span class="value">${ipInfo.city || '-'}</span></div>
      <div class="info-item"><span class="label">区县:</span><span class="value">${ipInfo.area || '-'}</span></div>
      <div class="info-item"><span class="label">运营商:</span><span class="value">${ipInfo.isp || '-'}</span></div>
      <div class="info-item"><span class="label">城市简码:</span><span class="value">${ipInfo.city_short_code || '-'}</span></div>
      <div class="info-item"><span class="label">邮编:</span><span class="value">${ipInfo.post_code || '-'}</span></div>
      <div class="info-item"><span class="label">区号:</span><span class="value">${ipInfo.area_code || '-'}</span></div>
      <div class="info-item"><span class="label">经度:</span><span class="value">${ipInfo.lng || '-'}</span></div>
      <div class="info-item"><span class="label">纬度:</span><span class="value">${ipInfo.lat || '-'}</span></div>
      <div class="info-item"><span class="label">大区:</span><span class="value">${ipInfo.big_area || '-'}</span></div>
      ${ipInfo.ip_type ? `<div class="info-item"><span class="label">IP类型:</span><span class="value">${ipInfo.ip_type}</span></div>` : ''}
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
  renderIpInfo,
  closeIpModal
};
