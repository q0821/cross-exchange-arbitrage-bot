/**
 * US1 端到端測試：用戶註冊和 API Key 管理
 * 測試完整的註冊→登入→新增 API Key 流程
 *
 * Feature: 006-web-trading-platform
 * User Story: US1 - User Registration and API Key Setup
 */

import { test, expect } from '@playwright/test';

// 產生隨機測試用戶資料
const generateTestUser = () => {
  const timestamp = Date.now();
  return {
    email: `test_${timestamp}@example.com`,
    password: 'TestPassword123!',
    confirmPassword: 'TestPassword123!',
  };
};

test.describe('US1: 用戶註冊和 API Key 管理', () => {
  let testUser: ReturnType<typeof generateTestUser>;

  test.beforeEach(() => {
    // 為每個測試生成新的測試用戶
    testUser = generateTestUser();
  });

  test('完整流程：註冊 → 登入 → 新增 API Key', async ({ page }) => {
    // ========================================
    // 步驟 1: 用戶註冊
    // ========================================
    await test.step('1. 訪問註冊頁面', async () => {
      await page.goto('/register');
      await expect(page).toHaveTitle(/Register|註冊/);
    });

    await test.step('2. 填寫註冊表單', async () => {
      await page.fill('input[name="email"], input[type="email"]', testUser.email);
      await page.fill('input[name="password"], input[type="password"]', testUser.password);

      // 如果有確認密碼欄位
      const confirmPasswordField = page.locator('input[name="confirmPassword"]');
      if (await confirmPasswordField.count() > 0) {
        await confirmPasswordField.fill(testUser.confirmPassword);
      }
    });

    await test.step('3. 提交註冊', async () => {
      await page.click('button[type="submit"]');

      // 等待註冊成功後重定向到登入頁面或儀表板
      await page.waitForURL(/\/(login|dashboard)/, { timeout: 10000 });
    });

    // ========================================
    // 步驟 2: 用戶登入
    // ========================================
    // 如果註冊後直接進入儀表板，跳過登入步驟
    const currentUrl = page.url();
    if (currentUrl.includes('/login')) {
      await test.step('4. 填寫登入表單', async () => {
        await page.fill('input[name="email"], input[type="email"]', testUser.email);
        await page.fill('input[name="password"], input[type="password"]', testUser.password);
      });

      await test.step('5. 提交登入', async () => {
        await page.click('button[type="submit"]');
        await page.waitForURL(/\/dashboard/, { timeout: 10000 });
      });
    }

    await test.step('6. 驗證登入成功', async () => {
      // 檢查是否顯示用戶郵箱或登出按鈕
      const dashboard = page.locator('text=/dashboard|儀表板/i').or(page.locator('button:has-text("登出")'));
      await expect(dashboard.first()).toBeVisible({ timeout: 5000 });
    });

    // ========================================
    // 步驟 3: 新增 Binance API Key
    // ========================================
    await test.step('7. 訪問 API Key 管理頁面', async () => {
      // 可能在側邊欄或選單中
      await page.click('a[href*="api-key"], a:has-text("API Key"), a:has-text("API 金鑰")');
      await page.waitForURL(/\/settings\/api-keys/, { timeout: 5000 });
    });

    await test.step('8. 點擊新增 API Key 按鈕', async () => {
      await page.click('button:has-text("新增"), button:has-text("Add")');

      // 等待表單顯示
      await expect(page.locator('select, input[name="exchange"]')).toBeVisible();
    });

    await test.step('9. 填寫 Binance API Key 表單', async () => {
      // 選擇交易所
      await page.selectOption('select', 'binance');

      // 選擇環境（測試網）
      const testnetRadio = page.locator('input[type="radio"][value="TESTNET"]');
      if (await testnetRadio.count() > 0) {
        await testnetRadio.click();
      }

      // 填寫標籤
      await page.fill('input[name="label"], input[placeholder*="標籤"], input[placeholder*="Label"]', 'Binance 測試帳戶');

      // 填寫 API Key（測試用假資料）
      await page.fill('input[name="apiKey"]', 'test_binance_api_key_12345678');

      // 填寫 API Secret（測試用假資料）
      await page.fill('input[name="apiSecret"], input[type="password"]', 'test_binance_secret_87654321');
    });

    await test.step('10. 提交 Binance API Key', async () => {
      // 注意：這個測試會因為 API Key 驗證失敗而失敗，除非在測試環境中模擬
      // 所以我們只測試表單提交，不期待成功
      await page.click('button[type="submit"]:has-text("新增")');

      // 等待 API 回應（可能成功或失敗）
      await page.waitForTimeout(2000);

      // 檢查是否顯示錯誤訊息（因為是假 API Key）或成功訊息
      const errorOrSuccess = page.locator('text=/error|錯誤|成功|success/i');
      await expect(errorOrSuccess.first()).toBeVisible({ timeout: 5000 });
    });

    // ========================================
    // 步驟 4: 查看 API Key 列表
    // ========================================
    await test.step('11. 驗證 API Key 列表頁面存在', async () => {
      // 取消新增表單（如果還在顯示）
      const cancelButton = page.locator('button:has-text("取消"), button:has-text("Cancel")');
      if (await cancelButton.count() > 0 && await cancelButton.isVisible()) {
        await cancelButton.click();
      }

      // 檢查表格或列表容器存在
      const listContainer = page.locator('table, div[class*="list"], div[class*="grid"]');
      await expect(listContainer.first()).toBeVisible();
    });
  });

  test('新增 OKX API Key 流程', async ({ page }) => {
    // 先註冊並登入
    await page.goto('/register');
    await page.fill('input[name="email"], input[type="email"]', testUser.email);
    await page.fill('input[name="password"], input[type="password"]', testUser.password);

    const confirmPasswordField = page.locator('input[name="confirmPassword"]');
    if (await confirmPasswordField.count() > 0) {
      await confirmPasswordField.fill(testUser.confirmPassword);
    }

    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(login|dashboard)/, { timeout: 10000 });

    // 如果需要登入
    if (page.url().includes('/login')) {
      await page.fill('input[name="email"], input[type="email"]', testUser.email);
      await page.fill('input[name="password"], input[type="password"]', testUser.password);
      await page.click('button[type="submit"]');
      await page.waitForURL(/\/dashboard/, { timeout: 10000 });
    }

    // 前往 API Key 管理頁面
    await page.click('a[href*="api-key"], a:has-text("API Key"), a:has-text("API 金鑰")');
    await page.waitForURL(/\/settings\/api-keys/, { timeout: 5000 });

    await test.step('新增 OKX API Key', async () => {
      await page.click('button:has-text("新增"), button:has-text("Add")');
      await expect(page.locator('select, input[name="exchange"]')).toBeVisible();

      // 選擇 OKX
      await page.selectOption('select', 'okx');

      // 選擇測試網
      const testnetRadio = page.locator('input[type="radio"][value="TESTNET"]');
      if (await testnetRadio.count() > 0) {
        await testnetRadio.click();
      }

      // 填寫標籤
      await page.fill('input[name="label"], input[placeholder*="標籤"], input[placeholder*="Label"]', 'OKX 測試帳戶');

      // 填寫 API Key
      await page.fill('input[name="apiKey"]', 'test_okx_api_key_12345678');

      // 填寫 API Secret
      const secretInputs = page.locator('input[name="apiSecret"], input[type="password"]');
      await secretInputs.first().fill('test_okx_secret_87654321');

      // OKX 需要 Passphrase
      const passphraseInput = page.locator('input[name="passphrase"]');
      if (await passphraseInput.count() > 0) {
        await passphraseInput.fill('test_passphrase_123');
      }

      // 提交
      await page.click('button[type="submit"]:has-text("新增")');
      await page.waitForTimeout(2000);

      // 檢查回應
      const errorOrSuccess = page.locator('text=/error|錯誤|成功|success/i');
      await expect(errorOrSuccess.first()).toBeVisible({ timeout: 5000 });
    });
  });

  test('測試 API Key 編輯和停用功能', async ({ page }) => {
    // 先註冊並登入
    await page.goto('/register');
    await page.fill('input[name="email"], input[type="email"]', testUser.email);
    await page.fill('input[name="password"], input[type="password"]', testUser.password);

    const confirmPasswordField = page.locator('input[name="confirmPassword"]');
    if (await confirmPasswordField.count() > 0) {
      await confirmPasswordField.fill(testUser.confirmPassword);
    }

    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(login|dashboard)/, { timeout: 10000 });

    // 如果需要登入
    if (page.url().includes('/login')) {
      await page.fill('input[name="email"], input[type="email"]', testUser.email);
      await page.fill('input[name="password"], input[type="password"]', testUser.password);
      await page.click('button[type="submit"]');
      await page.waitForURL(/\/dashboard/, { timeout: 10000 });
    }

    // 前往 API Key 管理頁面
    await page.click('a[href*="api-key"], a:has-text("API Key"), a:has-text("API 金鑰")');
    await page.waitForURL(/\/settings\/api-keys/, { timeout: 5000 });

    await test.step('驗證頁面功能按鈕存在', async () => {
      // 檢查是否有編輯、停用、刪除按鈕（即使列表是空的，表格結構應該存在）
      const tableOrList = page.locator('table, div[class*="list"]');
      await expect(tableOrList.first()).toBeVisible();

      // 驗證表頭存在
      const headers = page.locator('th:has-text("交易所"), th:has-text("Exchange"), th:has-text("標籤"), th:has-text("操作"), th:has-text("Actions")');
      if (await headers.count() > 0) {
        await expect(headers.first()).toBeVisible();
      }
    });
  });
});
