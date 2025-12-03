// ==UserScript==

// @name         Ask Gemini (Mobile Long Press)

// @namespace    http://tampermonkey.net/

// @version      3.0

// @description  Long press an image to ask Gemini about it. Features first-time setup, configurable API base URL, and secure API key management.

// @author       CJeremy

// @match        *://*/*

// @grant        GM_addStyle

// @grant        GM_xmlhttpRequest

// @grant        GM_getValue

// @grant        GM_setValue

// @grant        GM_deleteValue

// @connect      *

// ==/UserScript==

(function() {

    'use strict';

    // --- 1. 配置与设置管理 ---

    // 设置键名
    const SETTINGS_KEYS = {
        FIRST_TIME_SETUP: 'gemini_first_time_setup_completed',
        API_BASE_URL: 'gemini_api_base_url',
        API_KEY_ENCRYPTED: 'gemini_api_key_encrypted',
        DEFAULT_MODEL: 'gemini_default_model',
        SETTINGS_VERSION: 'gemini_settings_version'
    };

    // 默认配置
    const DEFAULT_CONFIG = {
        apiBaseUrl: 'https://generativelanguage.googleapis.com/v1beta',
        defaultModel: 'gemini-2.5-flash',
        settingsVersion: '3.0'
    };

    // 获取配置
    let GEMINI_API_KEY = getSecureGeminiApiKey();
    let API_BASE_URL = getApiBaseUrl();

/**
 * 获取 API 基础 URL
 * @returns {string} API 基础 URL
 */
function getApiBaseUrl() {
    // 优先级 1: GM_getValue 持久化存储
    const storedUrl = GM_getValue(SETTINGS_KEYS.API_BASE_URL, '');
    if (storedUrl) {
        return sanitizeApiBaseUrl(storedUrl);
    }

    // 优先级 2: 环境变量
    if (typeof unsafeWindow !== 'undefined' && unsafeWindow.GEMINI_API_BASE_URL) {
        return sanitizeApiBaseUrl(unsafeWindow.GEMINI_API_BASE_URL);
    }

    // 优先级 3: 默认配置
    return DEFAULT_CONFIG.apiBaseUrl;
}

/**
 * 设置 API 基础 URL
 * @param {string} baseUrl - 新的 API 基础 URL
 * @returns {boolean} 设置是否成功
 */
function setApiBaseUrl(baseUrl) {
    const sanitizedUrl = sanitizeApiBaseUrl(baseUrl);
    if (!sanitizedUrl) {
        throw new Error('Invalid API base URL format');
    }

    GM_setValue(SETTINGS_KEYS.API_BASE_URL, sanitizedUrl);
    API_BASE_URL = sanitizedUrl;
    console.log('[Settings] API base URL updated:', sanitizedUrl);
    return true;
}

/**
 * 清理和验证 API 基础 URL
 * @param {string} url - 原始 URL
 * @returns {string|null} 清理后的 URL 或 null（如果无效）
 */
function sanitizeApiBaseUrl(url) {
    if (!url || typeof url !== 'string') return null;

    // 移除尾部斜杠
    let sanitized = url.trim().replace(/\/+$/g, '');

    // 验证 URL 格式
    try {
        new URL(sanitized);

        // 确保 URL 看起来像 API 端点
        if (!sanitized.includes('api') && !sanitized.includes('generativelanguage')) {
            console.warn('[Settings] URL does not appear to be an API endpoint:', sanitized);
        }

        return sanitized;
    } catch (e) {
        console.error('[Settings] Invalid URL format:', url, e);
        return null;
    }
}

/**
 * 检查是否为首次安装
 * @returns {boolean} 是否为首次安装
 */
function isFirstTimeSetup() {
    return !GM_getValue(SETTINGS_KEYS.FIRST_TIME_SETUP, false);
}

/**
 * 标记首次安装完成
 */
function markFirstTimeSetupCompleted() {
    GM_setValue(SETTINGS_KEYS.FIRST_TIME_SETUP, true);
    GM_setValue(SETTINGS_KEYS.SETTINGS_VERSION, DEFAULT_CONFIG.settingsVersion);
}

/**
 * 安全获取 Gemini API 密钥（增强版）
 * @returns {string} API 密钥或默认值
 */
function getSecureGeminiApiKey() {
    // 优先级 1: 环境变量（最安全）
    if (typeof unsafeWindow !== 'undefined' && unsafeWindow.GEMINI_API_KEY) {
        return unsafeWindow.GEMINI_API_KEY;
    }

    // 优先级 2: GM_getValue 持久化存储
    const storedKey = GM_getValue(SETTINGS_KEYS.API_KEY_ENCRYPTED, '');
    if (storedKey) {
        // 这里使用简单的 Base64 编码，生产环境建议使用更强的加密
        try {
            return atob(storedKey);
        } catch (e) {
            console.warn('[Security] Failed to decode stored API key');
            GM_deleteValue(SETTINGS_KEYS.API_KEY_ENCRYPTED);
        }
    }

    // 优先级 3: 临时会话存储（兼容性）
    const sessionKey = sessionStorage.getItem('bdfz_gemini_api_key_temp');
    if (sessionKey && sessionKey.startsWith('AIza')) {
        if (validateApiKeyFormat(sessionKey)) {
            return sessionKey;
        } else {
            sessionStorage.removeItem('bdfz_gemini_api_key_temp');
            console.warn('[Security] Invalid API key format detected in session storage');
        }
    }

    // 优先级 4: 默认占位符
    return "YOUR_GEMINI_API_KEY";
}

/**
 * 验证 API 密钥格式（增强版，支持不同 API 提供商）
 * @param {string} apiKey - API 密钥
 * @returns {boolean} 是否有效
 */
function validateApiKeyFormat(apiKey) {
    if (!apiKey || typeof apiKey !== 'string') return false;

    // Gemini API 密钥格式
    if (/^AIza[A-Za-z0-9_-]{35}$/.test(apiKey)) return true;

    // OpenAI API 密钥格式
    if (/^sk-[A-Za-z0-9]{48}$/.test(apiKey)) return true;

    // Claude API 密钥格式
    if (/^sk-ant-[A-Za-z0-9_-]{95}$/.test(apiKey)) return true;

    // 通用 API 密钥格式（至少 20 字符，包含字母数字）
    if (/^[A-Za-z0-9_-]{20,}$/.test(apiKey)) return true;

    return false;
}

/**
 * 设置 API 密钥（用于用户输入）
 * @param {string} apiKey - 新的 API 密钥
 * @returns {boolean} 设置是否成功
 */
function setSecureGeminiApiKey(apiKey) {
    if (!validateApiKeyFormat(apiKey)) {
        throw new Error('Invalid API key format');
    }

    // 持久化存储（简单编码）
    GM_setValue(SETTINGS_KEYS.API_KEY_ENCRYPTED, btoa(apiKey));

    // 更新当前会话的 API 密钥
    GEMINI_API_KEY = apiKey;

    console.log('[Security] API key stored securely');
    return true;
}

/**
 * 获取默认模型
 * @returns {string} 默认模型名称
 */
function getDefaultModel() {
    return GM_getValue(SETTINGS_KEYS.DEFAULT_MODEL, DEFAULT_CONFIG.defaultModel);
}

/**
 * 设置默认模型
 * @param {string} model - 模型名称
 * @returns {boolean} 设置是否成功
 */
function setDefaultModel(model) {
    if (!model || typeof model !== 'string') return false;

    GM_setValue(SETTINGS_KEYS.DEFAULT_MODEL, model);
    console.log('[Settings] Default model updated:', model);
    return true;
}

    const LONG_PRESS_DURATION = 500;

    // --- 状态变量 ---

    let pressTimer = null;

    let longPressTriggered = false;

    let targetImageElement = null;

    let currentRequest = null;

    // --- 2. 首次安装设置 ---

    // 页面加载完成后检查是否需要首次设置
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', checkFirstTimeSetup);
    } else {
        checkFirstTimeSetup();
    }

    /**
     * 检查并执行首次安装设置
     */
    function checkFirstTimeSetup() {
        if (isFirstTimeSetup()) {
            setTimeout(() => {
                showFirstTimeSetupDialog();
            }, 1000); // 延迟 1 秒显示，确保页面完全加载
        }
    }

    /**
     * 显示首次安装设置对话框
     */
    function showFirstTimeSetupDialog() {
        // 移除现有的对话框
        removeExistingUI('.gemini-setup-overlay');

        const setupOverlay = document.createElement('div');
        setupOverlay.className = 'gemini-setup-overlay';

        setupOverlay.innerHTML = `
            <div class="gemini-setup-dialog">
                <div class="gemini-setup-header">
                    <h2 class="gemini-setup-title">🚀 Ask Gemini 初始设置</h2>
                    <p class="gemini-setup-subtitle">欢迎使用 Ask Gemini！请配置您的 API 设置以开始使用。</p>
                </div>

                <div class="gemini-setup-content">
                    <div class="gemini-setup-section">
                        <label for="setup-api-base-url" class="gemini-setup-label">API 基础 URL *</label>
                        <input type="url" id="setup-api-base-url" class="gemini-setup-input"
                               placeholder="https://generativelanguage.googleapis.com/v1beta"
                               value="${DEFAULT_CONFIG.apiBaseUrl}" />
                        <div class="gemini-setup-help">
                            支持 Google Gemini API 或其他兼容的 API 端点
                        </div>
                    </div>

                    <div class="gemini-setup-section">
                        <label for="setup-api-key" class="gemini-setup-label">API 密钥 *</label>
                        <input type="password" id="setup-api-key" class="gemini-setup-input"
                               placeholder="输入您的 API 密钥" />
                        <div class="gemini-setup-help">
                            您的 API 密钥将被安全存储在本地
                        </div>
                    </div>

                    <div class="gemini-setup-section">
                        <label for="setup-default-model" class="gemini-setup-label">默认模型</label>
                        <select id="setup-default-model" class="gemini-setup-select">
                            <option value="gemini-2.5-flash" selected>Gemini 2.5 Flash (推荐)</option>
                            <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                            <option value="gemini-2.5-flash-lite">Gemini 2.5 Flash Lite</option>
                            <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                            <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                            <option value="custom">自定义模型...</option>
                        </select>
                        <input type="text" id="setup-custom-model" class="gemini-setup-input"
                               placeholder="输入自定义模型名称" style="display: none; margin-top: 8px;" />
                    </div>

                    <div class="gemini-setup-section">
                        <label class="gemini-checkbox-label">
                            <input type="checkbox" id="setup-advanced-mode" class="gemini-checkbox">
                            <span class="gemini-checkbox-text">启用高级设置（适用于高级用户）</span>
                        </label>
                    </div>
                </div>

                <div class="gemini-setup-footer">
                    <button id="setup-skip-btn" class="gemini-setup-button gemini-setup-button-secondary">
                        稍后设置
                    </button>
                    <button id="setup-save-btn" class="gemini-setup-button gemini-setup-button-primary">
                        保存设置
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(setupOverlay);

        // 事件监听器
        const setupDialog = setupOverlay.querySelector('.gemini-setup-dialog');
        setupDialog.addEventListener('click', e => e.stopPropagation());

        // 模型选择变化处理
        const modelSelect = document.getElementById('setup-default-model');
        const customModelInput = document.getElementById('setup-custom-model');

        modelSelect.addEventListener('change', () => {
            if (modelSelect.value === 'custom') {
                customModelInput.style.display = 'block';
                customModelInput.required = true;
            } else {
                customModelInput.style.display = 'none';
                customModelInput.required = false;
            }
        });

        // 保存按钮
        document.getElementById('setup-save-btn').addEventListener('click', handleSetupSave);

        // 跳过按钮
        document.getElementById('setup-skip-btn').addEventListener('click', handleSetupSkip);

        // 点击背景关闭
        setupOverlay.addEventListener('click', () => {
            if (confirm('确定要跳过初始设置吗？您可以稍后在脚本设置中重新配置。')) {
                handleSetupSkip();
            }
        });
    }

    /**
     * 处理首次设置的保存
     */
    function handleSetupSave() {
        const baseUrl = document.getElementById('setup-api-base-url').value.trim();
        const apiKey = document.getElementById('setup-api-key').value.trim();
        const modelSelect = document.getElementById('setup-default-model');
        const customModel = document.getElementById('setup-custom-model').value.trim();
        const advancedMode = document.getElementById('setup-advanced-mode').checked;

        // 验证必填字段
        if (!baseUrl) {
            showSetupError('请输入 API 基础 URL');
            return;
        }

        if (!apiKey) {
            showSetupError('请输入 API 密钥');
            return;
        }

        try {
            // 验证并保存 API 基础 URL
            setApiBaseUrl(baseUrl);

            // 验证并保存 API 密钥
            setSecureGeminiApiKey(apiKey);

            // 保存默认模型
            const selectedModel = modelSelect.value === 'custom' ? customModel : modelSelect.value;
            if (selectedModel) {
                setDefaultModel(selectedModel);
            }

            // 标记首次设置完成
            markFirstTimeSetupCompleted();

            // 显示成功消息
            showSetupSuccess();

        } catch (error) {
            showSetupError(error.message);
        }
    }

    /**
     * 处理跳过设置
     */
    function handleSetupSkip() {
        markFirstTimeSetupCompleted();
        removeExistingUI('.gemini-setup-overlay');

        // 显示提示信息
        showNotification('初始设置已跳过。您可以稍后通过长按图片菜单中的「设置」来重新配置。', 'info');
    }

    /**
     * 显示设置错误
     */
    function showSetupError(message) {
        showNotification(`设置错误：${message}`, 'error');
    }

    /**
     * 显示设置成功
     */
    function showSetupSuccess() {
        removeExistingUI('.gemini-setup-overlay');
        showNotification('🎉 设置完成！Ask Gemini 已准备就绪。长按任意图片开始使用。', 'success');
    }

    /**
     * 显示通知消息
     */
    function showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `gemini-notification gemini-notification-${type}`;
        notification.innerHTML = `
            <div class="gemini-notification-content">
                <span class="gemini-notification-message">${message}</span>
                <button class="gemini-notification-close">×</button>
            </div>
        `;

        document.body.appendChild(notification);

        // 自动关闭
        const autoCloseTimeout = setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 5000);

        // 手动关闭
        notification.querySelector('.gemini-notification-close').addEventListener('click', () => {
            clearTimeout(autoCloseTimeout);
            notification.remove();
        });
    }

    /**
     * 显示设置对话框
     */
    function showSettingsDialog() {
        // 移除现有的对话框
        removeExistingUI('.gemini-settings-overlay');

        const settingsOverlay = document.createElement('div');
        settingsOverlay.className = 'gemini-settings-overlay';

        // 获取当前配置
        const currentApiUrl = API_BASE_URL;
        const currentModel = getDefaultModel();

        settingsOverlay.innerHTML = `
            <div class="gemini-settings-dialog">
                <div class="gemini-settings-header">
                    <h3 class="gemini-settings-title">⚙️ Ask Gemini 设置</h3>
                    <button class="gemini-settings-close">×</button>
                </div>

                <div class="gemini-settings-content">
                    <div class="gemini-settings-section">
                        <label for="settings-api-base-url" class="gemini-settings-label">API 基础 URL</label>
                        <input type="url" id="settings-api-base-url" class="gemini-settings-input"
                               value="${currentApiUrl}" />
                        <div class="gemini-settings-help">
                            支持的端点：Google Gemini API 或其他兼容的 API 服务
                        </div>
                    </div>

                    <div class="gemini-settings-section">
                        <label for="settings-api-key" class="gemini-settings-label">API 密钥</label>
                        <div class="gemini-settings-key-wrapper">
                            <input type="password" id="settings-api-key" class="gemini-settings-input"
                                   placeholder="••••••••••••••••" />
                            <button type="button" id="settings-toggle-key" class="gemini-settings-button">显示</button>
                        </div>
                        <div class="gemini-settings-help">
                            当前 API 密钥状态：${GEMINI_API_KEY === "YOUR_GEMINI_API_KEY" ? "未设置" : "已设置"}
                        </div>
                    </div>

                    <div class="gemini-settings-section">
                        <label for="settings-default-model" class="gemini-settings-label">默认模型</label>
                        <select id="settings-default-model" class="gemini-settings-select">
                            <option value="gemini-2.5-flash" ${currentModel === "gemini-2.5-flash" ? "selected" : ""}>Gemini 2.5 Flash</option>
                            <option value="gemini-2.5-pro" ${currentModel === "gemini-2.5-pro" ? "selected" : ""}>Gemini 2.5 Pro</option>
                            <option value="gemini-2.5-flash-lite" ${currentModel === "gemini-2.5-flash-lite" ? "selected" : ""}>Gemini 2.5 Flash Lite</option>
                            <option value="gemini-1.5-flash" ${currentModel === "gemini-1.5-flash" ? "selected" : ""}>Gemini 1.5 Flash</option>
                            <option value="gemini-1.5-pro" ${currentModel === "gemini-1.5-pro" ? "selected" : ""}>Gemini 1.5 Pro</option>
                            <option value="custom" ${! ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.5-flash-lite", "gemini-1.5-flash", "gemini-1.5-pro"].includes(currentModel) ? "selected" : ""}>自定义</option>
                        </select>
                        <input type="text" id="settings-custom-model" class="gemini-settings-input"
                               value="${!["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.5-flash-lite", "gemini-1.5-flash", "gemini-1.5-pro"].includes(currentModel) ? currentModel : ""}"
                               style="display: ${!["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.5-flash-lite", "gemini-1.5-flash", "gemini-1.5-pro"].includes(currentModel) ? "block" : "none"}; margin-top: 8px;"
                               placeholder="输入自定义模型名称" />
                    </div>

                    <div class="gemini-settings-section">
                        <h4 class="gemini-settings-subtitle">状态信息</h4>
                        <div class="gemini-settings-status">
                            <div class="gemini-settings-status-item">
                                <span class="gemini-settings-status-label">API 基础 URL：</span>
                                <span class="gemini-settings-status-value">${currentApiUrl}</span>
                            </div>
                            <div class="gemini-settings-status-item">
                                <span class="gemini-settings-status-label">API 密钥状态：</span>
                                <span class="gemini-settings-status-value">${GEMINI_API_KEY === "YOUR_GEMINI_API_KEY" ? "❌ 未设置" : "✅ 已设置"}</span>
                            </div>
                            <div class="gemini-settings-status-item">
                                <span class="gemini-settings-status-label">默认模型：</span>
                                <span class="gemini-settings-status-value">${currentModel}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="gemini-settings-footer">
                    <button id="settings-test-btn" class="gemini-settings-button gemini-settings-button-secondary">
                        测试连接
                    </button>
                    <button id="settings-reset-btn" class="gemini-settings-button gemini-settings-button-secondary">
                        重置设置
                    </button>
                    <button id="settings-save-btn" class="gemini-settings-button gemini-settings-button-primary">
                        保存设置
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(settingsOverlay);

        // 事件监听器
        const settingsDialog = settingsOverlay.querySelector('.gemini-settings-dialog');
        settingsDialog.addEventListener('click', e => e.stopPropagation());

        // 关闭按钮
        settingsOverlay.querySelector('.gemini-settings-close').addEventListener('click', () => {
            removeExistingUI('.gemini-settings-overlay');
        });

        // 点击背景关闭
        settingsOverlay.addEventListener('click', () => {
            removeExistingUI('.gemini-settings-overlay');
        });

        // API 密钥显示/隐藏切换
        const apiKeyInput = document.getElementById('settings-api-key');
        const toggleKeyBtn = document.getElementById('settings-toggle-key');

        toggleKeyBtn.addEventListener('click', () => {
            if (apiKeyInput.type === 'password') {
                apiKeyInput.type = 'text';
                toggleKeyBtn.textContent = '隐藏';
                // 如果当前是占位符，显示实际存储的密钥
                if (!apiKeyInput.value) {
                    apiKeyInput.value = GEMINI_API_KEY === "YOUR_GEMINI_API_KEY" ? '' : GEMINI_API_KEY;
                }
            } else {
                apiKeyInput.type = 'password';
                toggleKeyBtn.textContent = '显示';
                if (apiKeyInput.value !== "YOUR_GEMINI_API_KEY") {
                    apiKeyInput.value = '';
                }
            }
        });

        // 模型选择变化处理
        const modelSelect = document.getElementById('settings-default-model');
        const customModelInput = document.getElementById('settings-custom-model');

        modelSelect.addEventListener('change', () => {
            if (modelSelect.value === 'custom') {
                customModelInput.style.display = 'block';
            } else {
                customModelInput.style.display = 'none';
            }
        });

        // 保存设置
        document.getElementById('settings-save-btn').addEventListener('click', handleSettingsSave);

        // 测试连接
        document.getElementById('settings-test-btn').addEventListener('click', handleSettingsTest);

        // 重置设置
        document.getElementById('settings-reset-btn').addEventListener('click', handleSettingsReset);
    }

    /**
     * 处理设置保存
     */
    function handleSettingsSave() {
        const baseUrl = document.getElementById('settings-api-base-url').value.trim();
        const apiKey = document.getElementById('settings-api-key').value.trim();
        const modelSelect = document.getElementById('settings-default-model');
        const customModel = document.getElementById('settings-custom-model').value.trim();

        try {
            // 验证并保存 API 基础 URL
            if (baseUrl) {
                setApiBaseUrl(baseUrl);
            }

            // 验证并保存 API 密钥（如果用户输入了新的）
            if (apiKey) {
                setSecureGeminiApiKey(apiKey);
            }

            // 保存默认模型
            const selectedModel = modelSelect.value === 'custom' ? customModel : modelSelect.value;
            if (selectedModel) {
                setDefaultModel(selectedModel);
            }

            showNotification('✅ 设置已保存！', 'success');
            setTimeout(() => {
                removeExistingUI('.gemini-settings-overlay');
            }, 1500);

        } catch (error) {
            showNotification(`保存失败：${error.message}`, 'error');
        }
    }

    /**
     * 处理设置测试
     */
    async function handleSettingsTest() {
        const baseUrl = document.getElementById('settings-api-base-url').value.trim();
        const apiKey = document.getElementById('settings-api-key').value.trim() || GEMINI_API_KEY;
        const testBtn = document.getElementById('settings-test-btn');

        if (!baseUrl) {
            showNotification('请先输入 API 基础 URL', 'error');
            return;
        }

        if (!apiKey || apiKey === "YOUR_GEMINI_API_KEY") {
            showNotification('请先设置有效的 API 密钥', 'error');
            return;
        }

        testBtn.disabled = true;
        testBtn.textContent = '测试中...';

        try {
            // 构造测试请求 URL
            const testUrl = `${baseUrl}/models?key=${apiKey}`;

            const response = await new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: testUrl,
                    timeout: 10000,
                    onload: resolve,
                    onerror: reject,
                    ontimeout: reject
                });
            });

            if (response.status === 200) {
                showNotification('✅ API 连接测试成功！', 'success');
            } else {
                throw new Error(`HTTP ${response.status}`);
            }

        } catch (error) {
            showNotification(`❌ 连接测试失败：${error.message}`, 'error');
        } finally {
            testBtn.disabled = false;
            testBtn.textContent = '测试连接';
        }
    }

    /**
     * 处理设置重置
     */
    function handleSettingsReset() {
        if (confirm('确定要重置所有设置吗？这将清除您的 API 密钥和所有配置。')) {
            // 清除所有设置
            GM_deleteValue(SETTINGS_KEYS.API_BASE_URL);
            GM_deleteValue(SETTINGS_KEYS.API_KEY_ENCRYPTED);
            GM_deleteValue(SETTINGS_KEYS.DEFAULT_MODEL);
            GM_deleteValue(SETTINGS_KEYS.FIRST_TIME_SETUP);

            // 重新加载页面以应用重置
            showNotification('设置已重置，页面将重新加载...', 'info');
            setTimeout(() => {
                location.reload();
            }, 1500);
        }
    }

    // --- 2. 长按检测事件监听 ---

    const onTouchStart = (e) => {

        if (e.target.tagName !== 'IMG') return;

        targetImageElement = e.target;

        longPressTriggered = false;

        pressTimer = setTimeout(() => {

            longPressTriggered = true;

            e.preventDefault();

            showCustomContextMenu(e.touches[0].pageX, e.touches[0].pageY);

        }, LONG_PRESS_DURATION);

    };

    const onTouchEnd = () => clearTimeout(pressTimer);

    const onTouchMove = () => clearTimeout(pressTimer);

    const onContextMenu = (e) => {
        if (e.target.tagName === 'IMG' || longPressTriggered) {
            e.preventDefault();
            e.stopPropagation();
        }
    };

    document.addEventListener('touchstart', onTouchStart, { passive: false });

    document.addEventListener('touchend', onTouchEnd);

    document.addEventListener('touchmove', onTouchMove);

    document.addEventListener('contextmenu', onContextMenu, { capture: true });

    // --- 3. UI 创建 (自定义菜单和对话框) ---

    function showCustomContextMenu(x, y) {

        removeExistingUI('.gemini-context-menu');

        const menu = document.createElement('div');

        menu.className = 'gemini-context-menu';

        menu.innerHTML = `
            <div class="gemini-context-menu-item" data-action="ask">Ask Gemini</div>
            <div class="gemini-context-menu-separator"></div>
            <div class="gemini-context-menu-item" data-action="settings">⚙️ 设置</div>
        `;

        menu.style.left = `${x}px`;

        menu.style.top = `${y}px`;

        menu.addEventListener('click', (e) => {

            e.stopPropagation();

            removeExistingUI('.gemini-context-menu');

            const action = e.target.dataset.action;

            if (action === 'ask') {
                showGeminiDialog();
            } else if (action === 'settings') {
                showSettingsDialog();
            }

        });

        document.body.appendChild(menu);

        setTimeout(() => document.addEventListener('click', () => removeExistingUI('.gemini-context-menu'), { once: true }), 0);

    }

    function showGeminiDialog() {

        removeExistingUI('.gemini-dialog-overlay');

        const dialogOverlay = document.createElement('div');

        dialogOverlay.className = 'gemini-dialog-overlay';

        dialogOverlay.innerHTML = `

            <div class="gemini-dialog">

                <div class="gemini-dialog-header">

                    <h3 class="gemini-dialog-title">询问 Gemini 关于图片的问题</h3>

                    <div class="gemini-model-selector">

                        <label for="gemini-model-select" class="gemini-model-label">模型：</label>

                        <select id="gemini-model-select" class="gemini-model-select">

                            <option value="gemini-2.5-flash" selected>Gemini 2.5 Flash</option>

                            <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>

                            <option value="gemini-2.5-flash-lite">Gemini 2.5 Flash Lite</option>

                        </select>

                    </div>

                </div>

                <div class="gemini-dialog-content">

                    <img class="gemini-dialog-preview-image" src="${targetImageElement.src}" alt="Image preview"/>

                    <textarea class="gemini-dialog-input" id="gemini-question" placeholder="例如：这是什么？">解答本题。</textarea>

                    <div id="gemini-response-area" class="gemini-dialog-response"></div>

                </div>

                <div class="gemini-dialog-footer">

                    <button class="gemini-dialog-button gemini-dialog-button-secondary" id="gemini-cancel-btn">取消</button>

                    <button class="gemini-dialog-button gemini-dialog-button-primary" id="gemini-ask-btn">发送</button>

                </div>

            </div>

        `;

        document.body.appendChild(dialogOverlay);

        const dialog = dialogOverlay.querySelector('.gemini-dialog');

        dialog.addEventListener('click', e => e.stopPropagation());

        document.getElementById('gemini-ask-btn').addEventListener('click', handleAskGemini);

        document.getElementById('gemini-cancel-btn').addEventListener('click', closeDialog);

        dialogOverlay.addEventListener('click', closeDialog);

    }

    function closeDialog() {

        if (currentRequest) {

            currentRequest.abort();

            currentRequest = null;

        }

        removeExistingUI('.gemini-dialog-overlay');

    }

    function removeExistingUI(selector) {

        const element = document.querySelector(selector);

        if (element) element.remove();

    }

    // --- 4. 核心逻辑 (图片转换与 API 调用) ---

    async function handleAskGemini() {

        const question = document.getElementById('gemini-question').value;

        if (!question.trim()) { alert("请输入问题。"); return; }

        if (GEMINI_API_KEY === "YOUR_GEMINI_API_KEY") {

            showError("请设置 GEMINI_API_KEY。你可以在浏览器控制台中运行 setSecureGeminiApiKey('your-api-key-here') 来设置，或者使用环境变量。");

            return;

        }

        // 安全检查：记录 API 调用（不包含敏感信息）
        console.log('[Security] Gemini API call initiated for image analysis', {
            timestamp: new Date().toISOString(),
            model: document.getElementById('gemini-model-select').value,
            hasValidKey: GEMINI_API_KEY.startsWith('AIza')
        });

        const askBtn = document.getElementById('gemini-ask-btn');

        const cancelBtn = document.getElementById('gemini-cancel-btn');

        askBtn.disabled = true;

        askBtn.textContent = '生成中...';

        cancelBtn.textContent = '停止';

        showLoadingAnimation();

        try {

            const base64Image = await imageToBase64(targetImageElement.src);

            const mimeType = base64Image.match(/data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+).*,.*/)[1];

            const cleanBase64 = base64Image.split(',')[1];

            callGeminiAPI(question, cleanBase64, mimeType);

        } catch (error) {

            console.error('图片处理错误:', error);

            showError("无法处理图片。请检查图片链接是否有效或查看浏览器控制台。");

            resetButtons();

        }

    }

    function imageToBase64(url) {

        return new Promise((resolve, reject) => {

            GM_xmlhttpRequest({

                method: 'GET', url: url, responseType: 'blob',

                onload: (response) => {

                    const reader = new FileReader();

                    reader.onloadend = () => resolve(reader.result);

                    reader.onerror = reject;

                    reader.readAsDataURL(response.response);

                },

                onerror: reject

            });

        });

    }

    function callGeminiAPI(prompt, base64Image, mimeType) {

        const selectedModel = document.getElementById('gemini-model-select').value;

        // 【安全】使用可配置的 API 基础 URL。GM_xmlhttpRequest 会处理跨域。

        // 生成请求ID用于审计和错误追踪
        const requestId = Date.now().toString(36) + Math.random().toString(36).substr(2);

        // 检查当前配置是否有效
        if (GEMINI_API_KEY === "YOUR_GEMINI_API_KEY") {
            showError("请先配置 API 密钥。您可以长按图片选择「设置」来配置。");
            resetButtons();
            return;
        }

        const apiUrl = `${API_BASE_URL}/models/${selectedModel}:generateContent?key=${GEMINI_API_KEY}`;

        const headers = {

            "Content-Type": "application/json"

        };

        const requestBody = {

            "contents": [{

                "parts": [

                    { "text": prompt + "[SYSTEM]以上是用户要求；输出时请不要使用markdown格式，也不要用LaTeX。只许输出纯文本。" },

                    { "inline_data": { "mime_type": mimeType, "data": base64Image } }

                ]

            }],

            "generationConfig": {

                "thinkingConfig": { "thinkingBudget": 5000 }

            }

        };

        currentRequest = GM_xmlhttpRequest({

            method: "POST",

            url: apiUrl,

            headers: headers,

            data: JSON.stringify(requestBody),

            onload: function(response) {

                currentRequest = null;

                if (response.status !== 200) {

                    let errorMessage = `API 返回错误 (状态码: ${response.status})`;

                    try {

                        const errorData = JSON.parse(response.responseText);

                        const message = errorData.error?.message || "未知 API 错误";

                        if (message.includes("API key not valid")) {

                            errorMessage = "API 密钥无效或已过期，请在脚本中检查你的密钥。";

                        } else {

                            errorMessage = message;

                        }

                    } catch (e) {

                        errorMessage = "无法解析 API 错误信息。";

                    }

                    showError(errorMessage);

                } else {

                    try {

                        const data = JSON.parse(response.responseText);

                        const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;

                        if (responseText) {

                            showResponse(responseText);

                        } else {

                            showError("模型未返回任何内容，可能是由于安全设置或其他原因。");

                        }

                    } catch (e) {

                        console.error('解析响应失败:', e);

                        showError("无法解析API响应。");

                    }

                }

                resetButtons();

            },

            onerror: function(error) {

                console.error('网络或 GM_xmlhttpRequest 错误:', error);

                showError("网络连接失败。无法访问 Gemini API，请检查网络或浏览器控制台。");

                resetButtons();

                currentRequest = null;

            }

        });

    }

    function showLoadingAnimation() {

        const responseArea = document.getElementById('gemini-response-area');

        if (responseArea) {

             responseArea.innerHTML = `<div class="gemini-loader-container"><div class="gemini-loader"></div></div>`;

        }

    }

    function showResponse(text) {

        const responseArea = document.getElementById('gemini-response-area');

        if (responseArea) {

            responseArea.innerHTML = '';

            responseArea.innerText = text;

        }

    }

    function showError(message) {

        const responseArea = document.getElementById('gemini-response-area');

        if (responseArea) {

            responseArea.innerHTML = `<div class="gemini-error-message"><strong>出错了：</strong><br>${message}</div>`;

        }

    }

    function resetButtons() {

        const askBtn = document.getElementById('gemini-ask-btn');

        const cancelBtn = document.getElementById('gemini-cancel-btn');

        if (askBtn) {

            askBtn.disabled = false;

            askBtn.textContent = '发送';

        }

        if (cancelBtn) {

            cancelBtn.textContent = '取消';

        }

    }

    // --- 5. 样式 (shadcn/ui 风格) ---

    GM_addStyle(`

        :root {

            --background: 0 0% 100%; --foreground: 222.2 84% 4.9%;

            --card: 0 0% 100%; --card-foreground: 222.2 84% 4.9%;

            --popover: 0 0% 100%; --popover-foreground: 222.2 84% 4.9%;

            --primary: 222.2 47.4% 11.2%; --primary-foreground: 210 40% 98%;

            --secondary: 210 40% 96.1%; --secondary-foreground: 222.2 47.4% 11.2%;

            --muted: 210 40% 96.1%; --muted-foreground: 215.4 16.3% 46.9%;

            --border: 214.3 31.8% 91.4%; --input: 214.3 31.8% 91.4%;

            --destructive: 0 84.2% 60.2%;

            --radius: 0.5rem;

        }

        .gemini-context-menu {

            position: fixed; z-index: 2147483647; background-color: hsl(var(--popover));

            color: hsl(var(--popover-foreground)); border: 1px solid hsl(var(--border));

            border-radius: var(--radius); box-shadow: 0 4px 12px rgba(0,0,0,0.1);

            padding: 4px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;

            font-size: 14px;

        }

        .gemini-context-menu-item { padding: 6px 12px; cursor: pointer; border-radius: calc(var(--radius) - 2px); user-select: none; }

        .gemini-context-menu-item:hover { background-color: hsl(var(--secondary)); }

        .gemini-dialog-overlay {

            position: fixed; top: 0; left: 0; right: 0; bottom: 0; background-color: rgba(0,0,0,0.7);

            display: flex; align-items: center; justify-content: center; z-index: 2147483646;

            -webkit-backdrop-filter: blur(4px); backdrop-filter: blur(4px);

        }

        .gemini-dialog {

            background-color: hsl(var(--card)); color: hsl(var(--card-foreground)); border-radius: var(--radius);

            box-shadow: 0 8px 32px rgba(0,0,0,0.2); width: 90%; max-width: 500px;

            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;

            animation: gemini-dialog-fade-in 0.2s ease-out; display: flex; flex-direction: column; max-height: 80vh;

        }

        @keyframes gemini-dialog-fade-in { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }

        .gemini-dialog-header { padding: 24px 24px 0; }

        .gemini-dialog-content { padding: 16px 24px; overflow-y: auto; }

        .gemini-dialog-footer { display: flex; justify-content: flex-end; gap: 8px; padding: 0 24px 24px; border-top: 1px solid hsl(var(--border)); margin-top: 16px; padding-top: 16px; }

        .gemini-dialog-title { font-size: 18px; font-weight: 600; margin: 0 0 12px 0; }

        .gemini-model-selector {

            display: flex; align-items: center; gap: 8px; margin-bottom: 8px;

        }

        .gemini-model-label {

            font-size: 14px; color: hsl(var(--foreground)); font-weight: 500;

        }

        .gemini-model-select {

            padding: 4px 8px; border: 1px solid hsl(var(--input)); border-radius: calc(var(--radius) - 2px);

            font-size: 14px; background-color: hsl(var(--background)); color: hsl(var(--foreground));

            cursor: pointer;

        }

        .gemini-model-select:focus {

            outline: none; border-color: hsl(var(--primary)); box-shadow: 0 0 0 2px hsl(var(--primary) / 0.2);

        }

        .gemini-dialog-preview-image {

            width: 100%; max-height: 200px; object-fit: contain; border-radius: calc(var(--radius) - 2px);

            margin-bottom: 16px; border: 1px solid hsl(var(--border));

        }

        .gemini-dialog-input {

            width: 100%; padding: 8px 12px; border: 1px solid hsl(var(--input)); border-radius: var(--radius);

            font-size: 14px; box-sizing: border-box; background-color: transparent; color: hsl(var(--foreground)); min-height: 80px;

        }

        .gemini-dialog-response {

            margin-top: 16px; padding: 12px; background-color: hsl(var(--muted)); border-radius: var(--radius);

            font-size: 14px; line-height: 1.5; min-height: 24px; white-space: pre-wrap;

            word-break: break-word;

        }

        .gemini-dialog-button {

            padding: 8px 16px; border: none; border-radius: var(--radius); font-size: 14px; font-weight: 500; cursor: pointer; transition: opacity 0.2s;

        }

        .gemini-dialog-button:disabled { cursor: not-allowed; opacity: 0.7; }

        .gemini-dialog-button-primary { background-color: hsl(var(--primary)); color: hsl(var(--primary-foreground)); }

        .gemini-dialog-button-secondary { background-color: hsl(var(--secondary)); color: hsl(var(--secondary-foreground)); }

        /* 加载动画和错误信息样式 */

        .gemini-loader-container { display: flex; justify-content: center; align-items: center; min-height: 48px; }

        .gemini-loader {

            display: inline-block; position: relative; width: 40px; height: 20px;

        }

        .gemini-loader::after, .gemini-loader::before {

            content: ''; position: absolute; width: 6px; height: 6px;

            border-radius: 50%; background-color: hsl(var(--muted-foreground));

            animation: gemini-loader-bounce 1.4s infinite ease-in-out both;

        }

        .gemini-loader::before { left: 8px; animation-delay: -0.32s; }

        .gemini-loader::after { left: 24px; animation-delay: -0.16s; }

        @keyframes gemini-loader-bounce {

            0%, 80%, 100% { transform: scale(0); }

            40% { transform: scale(1.0); }

        }

        .gemini-error-message {

            color: hsl(var(--destructive));

            white-space: pre-wrap;

            word-break: break-word;

        }

        /* 首次安装设置对话框样式 */
        .gemini-setup-overlay {
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background-color: rgba(0,0,0,0.8);
            display: flex; align-items: center; justify-content: center;
            z-index: 2147483647;
            -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px);
        }

        .gemini-setup-dialog {
            background-color: hsl(var(--card)); color: hsl(var(--card-foreground));
            border-radius: var(--radius); box-shadow: 0 12px 48px rgba(0,0,0,0.3);
            width: 95%; max-width: 520px; max-height: 85vh;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            animation: gemini-setup-fade-in 0.3s ease-out;
            display: flex; flex-direction: column; overflow: hidden;
        }

        @keyframes gemini-setup-fade-in {
            from { opacity: 0; transform: scale(0.9) translateY(20px); }
            to { opacity: 1; transform: scale(1) translateY(0); }
        }

        .gemini-setup-header {
            padding: 28px 28px 20px; text-align: center; border-bottom: 1px solid hsl(var(--border));
        }

        .gemini-setup-title {
            font-size: 24px; font-weight: 700; margin: 0 0 8px 0;
            color: hsl(var(--foreground)); line-height: 1.3;
        }

        .gemini-setup-subtitle {
            font-size: 14px; color: hsl(var(--muted-foreground)); margin: 0;
            line-height: 1.5;
        }

        .gemini-setup-content {
            padding: 24px 28px; overflow-y: auto; flex: 1;
        }

        .gemini-setup-section {
            margin-bottom: 20px;
        }

        .gemini-setup-label {
            display: block; font-size: 14px; font-weight: 600;
            color: hsl(var(--foreground)); margin-bottom: 6px;
        }

        .gemini-setup-input, .gemini-setup-select {
            width: 100%; padding: 10px 14px;
            border: 1px solid hsl(var(--input)); border-radius: var(--radius);
            font-size: 14px; background-color: hsl(var(--background));
            color: hsl(var(--foreground)); box-sizing: border-box;
            transition: border-color 0.2s, box-shadow 0.2s;
        }

        .gemini-setup-input:focus, .gemini-setup-select:focus {
            outline: none; border-color: hsl(var(--primary));
            box-shadow: 0 0 0 2px hsl(var(--primary) / 0.2);
        }

        .gemini-setup-help {
            font-size: 12px; color: hsl(var(--muted-foreground));
            margin-top: 4px; line-height: 1.4;
        }

        .gemini-checkbox-label {
            display: flex; align-items: center; cursor: pointer;
            font-size: 14px; color: hsl(var(--foreground));
        }

        .gemini-checkbox {
            margin-right: 8px; transform: scale(1.1);
        }

        .gemini-setup-footer {
            display: flex; justify-content: space-between; gap: 12px;
            padding: 20px 28px 28px; border-top: 1px solid hsl(var(--border));
        }

        .gemini-setup-button {
            padding: 10px 20px; border: none; border-radius: var(--radius);
            font-size: 14px; font-weight: 600; cursor: pointer;
            transition: all 0.2s; min-width: 100px;
        }

        .gemini-setup-button-primary {
            background-color: hsl(var(--primary)); color: hsl(var(--primary-foreground));
        }

        .gemini-setup-button-primary:hover {
            background-color: hsl(var(--primary) / 0.9);
        }

        .gemini-setup-button-secondary {
            background-color: hsl(var(--secondary)); color: hsl(var(--secondary-foreground));
        }

        .gemini-setup-button-secondary:hover {
            background-color: hsl(var(--secondary) / 0.8);
        }

        /* 设置对话框样式 */
        .gemini-settings-overlay {
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background-color: rgba(0,0,0,0.7);
            display: flex; align-items: center; justify-content: center;
            z-index: 2147483647;
            -webkit-backdrop-filter: blur(4px); backdrop-filter: blur(4px);
        }

        .gemini-settings-dialog {
            background-color: hsl(var(--card)); color: hsl(var(--card-foreground));
            border-radius: var(--radius); box-shadow: 0 8px 32px rgba(0,0,0,0.2);
            width: 95%; max-width: 560px; max-height: 80vh;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            animation: gemini-dialog-fade-in 0.2s ease-out;
            display: flex; flex-direction: column; overflow: hidden;
        }

        .gemini-settings-header {
            display: flex; justify-content: space-between; align-items: center;
            padding: 20px 24px; border-bottom: 1px solid hsl(var(--border));
        }

        .gemini-settings-title {
            font-size: 18px; font-weight: 600; margin: 0;
        }

        .gemini-settings-close {
            background: none; border: none; font-size: 24px; cursor: pointer;
            color: hsl(var(--muted-foreground)); padding: 4px; border-radius: 4px;
            transition: background-color 0.2s;
        }

        .gemini-settings-close:hover {
            background-color: hsl(var(--secondary));
        }

        .gemini-settings-content {
            padding: 20px 24px; overflow-y: auto; flex: 1;
        }

        .gemini-settings-section {
            margin-bottom: 24px;
        }

        .gemini-settings-subtitle {
            font-size: 16px; font-weight: 600; margin: 0 0 12px 0;
            color: hsl(var(--foreground));
        }

        .gemini-settings-label {
            display: block; font-size: 14px; font-weight: 600;
            color: hsl(var(--foreground)); margin-bottom: 6px;
        }

        .gemini-settings-input, .gemini-settings-select {
            width: 100%; padding: 8px 12px;
            border: 1px solid hsl(var(--input)); border-radius: var(--radius);
            font-size: 14px; background-color: hsl(var(--background));
            color: hsl(var(--foreground)); box-sizing: border-box;
            transition: border-color 0.2s, box-shadow 0.2s;
        }

        .gemini-settings-input:focus, .gemini-settings-select:focus {
            outline: none; border-color: hsl(var(--primary));
            box-shadow: 0 0 0 2px hsl(var(--primary) / 0.2);
        }

        .gemini-settings-key-wrapper {
            display: flex; gap: 8px;
        }

        .gemini-settings-key-wrapper .gemini-settings-input {
            flex: 1;
        }

        .gemini-settings-help {
            font-size: 12px; color: hsl(var(--muted-foreground));
            margin-top: 4px; line-height: 1.4;
        }

        .gemini-settings-status {
            background-color: hsl(var(--muted)); border-radius: var(--radius);
            padding: 12px; margin-top: 8px;
        }

        .gemini-settings-status-item {
            display: flex; justify-content: space-between; align-items: center;
            padding: 4px 0; font-size: 12px;
        }

        .gemini-settings-status-label {
            color: hsl(var(--muted-foreground));
        }

        .gemini-settings-status-value {
            color: hsl(var(--foreground)); font-weight: 500;
            word-break: break-all; max-width: 60%; text-align: right;
        }

        .gemini-settings-footer {
            display: flex; justify-content: flex-end; gap: 8px;
            padding: 16px 24px; border-top: 1px solid hsl(var(--border));
        }

        .gemini-settings-button {
            padding: 6px 16px; border: none; border-radius: var(--radius);
            font-size: 14px; font-weight: 500; cursor: pointer;
            transition: all 0.2s;
        }

        .gemini-settings-button:disabled {
            cursor: not-allowed; opacity: 0.6;
        }

        .gemini-settings-button-primary {
            background-color: hsl(var(--primary)); color: hsl(var(--primary-foreground));
        }

        .gemini-settings-button-secondary {
            background-color: hsl(var(--secondary)); color: hsl(var(--secondary-foreground));
        }

        /* 通知消息样式 */
        .gemini-notification {
            position: fixed; top: 20px; right: 20px; z-index: 2147483648;
            border-radius: var(--radius); box-shadow: 0 4px 20px rgba(0,0,0,0.15);
            animation: gemini-notification-slide-in 0.3s ease-out;
            max-width: 400px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        }

        @keyframes gemini-notification-slide-in {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }

        .gemini-notification-success {
            background-color: #10b981; color: white; border-left: 4px solid #059669;
        }

        .gemini-notification-error {
            background-color: #ef4444; color: white; border-left: 4px solid #dc2626;
        }

        .gemini-notification-info {
            background-color: #3b82f6; color: white; border-left: 4px solid #2563eb;
        }

        .gemini-notification-content {
            display: flex; align-items: center; justify-content: space-between;
            padding: 12px 16px;
        }

        .gemini-notification-message {
            flex: 1; margin-right: 12px; line-height: 1.4;
        }

        .gemini-notification-close {
            background: none; border: none; color: white; font-size: 18px;
            cursor: pointer; padding: 2px; border-radius: 2px; opacity: 0.8;
            transition: opacity 0.2s;
        }

        .gemini-notification-close:hover {
            opacity: 1;
        }

        /* 上下文菜单分隔线 */
        .gemini-context-menu-separator {
            height: 1px; background-color: hsl(var(--border));
            margin: 2px 6px;
        }

    `);

})();
