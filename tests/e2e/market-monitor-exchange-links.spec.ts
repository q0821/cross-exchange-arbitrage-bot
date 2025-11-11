/**
 * Market Monitor - Exchange Links E2E Tests
 *
 * Feature: 008-specify-scripts-bash
 * Purpose: Test exchange quick links functionality in market monitor page
 */

import { test, expect, type Page } from '@playwright/test';

// Test helper: Navigate to market monitor page
async function navigateToMarketMonitor(page: Page) {
  await page.goto('/market-monitor');
  // Wait for the page to load and data to appear
  await page.waitForSelector('table', { timeout: 10000 });
}

// Test helper: Find exchange link icon for a specific symbol and exchange
async function findExchangeLink(
  page: Page,
  symbol: string,
  exchange: 'binance' | 'okx' | 'mexc' | 'gateio'
) {
  // Find the row containing the symbol
  const row = page.locator(`tr:has-text("${symbol}")`).first();
  await expect(row).toBeVisible({ timeout: 5000 });

  // Map exchange to column index (assuming fixed order: Binance, OKX, MEXC, Gate.io)
  const exchangeColumnIndex = {
    binance: 1, // Second column (after symbol column)
    okx: 2,
    mexc: 3,
    gateio: 4,
  };

  const columnIndex = exchangeColumnIndex[exchange];

  // Find the link in the specific exchange column
  const cell = row.locator(`td:nth-child(${columnIndex + 1})`);
  const link = cell.locator('a[target="_blank"]');

  return link;
}

test.describe('Market Monitor - Exchange Links', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToMarketMonitor(page);
  });

  test.describe('Binance Links', () => {
    test('should display Binance link for BTC/USDT', async ({ page }) => {
      const link = await findExchangeLink(page, 'BTC/USDT', 'binance');
      await expect(link).toBeVisible();
    });

    test('should open Binance contract page in new tab', async ({
      page,
      context,
    }) => {
      const link = await findExchangeLink(page, 'BTC/USDT', 'binance');

      // Listen for new page (new tab)
      const pagePromise = context.waitForEvent('page');

      await link.click();

      const newPage = await pagePromise;
      await newPage.waitForLoadState();

      // Verify URL
      expect(newPage.url()).toContain('binance.com');
      expect(newPage.url()).toContain('futures');
      expect(newPage.url()).toContain('BTCUSDT');

      await newPage.close();
    });

    test('should have correct aria-label for Binance link', async ({
      page,
    }) => {
      const link = await findExchangeLink(page, 'BTC/USDT', 'binance');
      const ariaLabel = await link.getAttribute('aria-label');

      expect(ariaLabel).toContain('Binance');
      expect(ariaLabel).toContain('BTC/USDT');
    });

    test('should have security attributes (noopener noreferrer)', async ({
      page,
    }) => {
      const link = await findExchangeLink(page, 'BTC/USDT', 'binance');

      await expect(link).toHaveAttribute('target', '_blank');
      await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });
  });

  test.describe('OKX Links', () => {
    test('should display OKX link for ETH/USDT', async ({ page }) => {
      const link = await findExchangeLink(page, 'ETH/USDT', 'okx');
      await expect(link).toBeVisible();
    });

    test('should open OKX contract page in new tab', async ({
      page,
      context,
    }) => {
      const link = await findExchangeLink(page, 'ETH/USDT', 'okx');

      const pagePromise = context.waitForEvent('page');
      await link.click();
      const newPage = await pagePromise;
      await newPage.waitForLoadState();

      expect(newPage.url()).toContain('okx.com');
      expect(newPage.url()).toContain('trade-swap');
      expect(newPage.url()).toContain('ETH-USDT-SWAP');

      await newPage.close();
    });

    test('should have correct aria-label for OKX link', async ({ page }) => {
      const link = await findExchangeLink(page, 'ETH/USDT', 'okx');
      const ariaLabel = await link.getAttribute('aria-label');

      expect(ariaLabel).toContain('OKX');
      expect(ariaLabel).toContain('ETH/USDT');
    });
  });

  test.describe('MEXC Links', () => {
    test('should display MEXC link for SOL/USDT', async ({ page }) => {
      const link = await findExchangeLink(page, 'SOL/USDT', 'mexc');
      await expect(link).toBeVisible();
    });

    test('should open MEXC contract page in new tab', async ({
      page,
      context,
    }) => {
      const link = await findExchangeLink(page, 'SOL/USDT', 'mexc');

      const pagePromise = context.waitForEvent('page');
      await link.click();
      const newPage = await pagePromise;
      await newPage.waitForLoadState();

      expect(newPage.url()).toContain('mexc.com');
      expect(newPage.url()).toContain('exchange');
      expect(newPage.url()).toContain('SOL_USDT');

      await newPage.close();
    });

    test('should have correct aria-label for MEXC link', async ({ page }) => {
      const link = await findExchangeLink(page, 'SOL/USDT', 'mexc');
      const ariaLabel = await link.getAttribute('aria-label');

      expect(ariaLabel).toContain('MEXC');
      expect(ariaLabel).toContain('SOL/USDT');
    });
  });

  test.describe('Gate.io Links', () => {
    test('should display Gate.io link for BNB/USDT', async ({ page }) => {
      const link = await findExchangeLink(page, 'BNB/USDT', 'gateio');
      await expect(link).toBeVisible();
    });

    test('should open Gate.io contract page in new tab', async ({
      page,
      context,
    }) => {
      const link = await findExchangeLink(page, 'BNB/USDT', 'gateio');

      const pagePromise = context.waitForEvent('page');
      await link.click();
      const newPage = await pagePromise;
      await newPage.waitForLoadState();

      expect(newPage.url()).toContain('gate.io');
      expect(newPage.url()).toContain('futures_trade');
      expect(newPage.url()).toContain('BNB_USDT');

      await newPage.close();
    });

    test('should have correct aria-label for Gate.io link', async ({
      page,
    }) => {
      const link = await findExchangeLink(page, 'BNB/USDT', 'gateio');
      const ariaLabel = await link.getAttribute('aria-label');

      expect(ariaLabel).toContain('Gate.io');
      expect(ariaLabel).toContain('BNB/USDT');
    });
  });

  test.describe('Tooltip Behavior', () => {
    test('should display tooltip on hover', async ({ page }) => {
      const link = await findExchangeLink(page, 'BTC/USDT', 'binance');

      // Hover over the link
      await link.hover();

      // Wait for tooltip to appear (Radix UI default is 200ms)
      await page.waitForTimeout(300);

      // Check if tooltip is visible
      const tooltip = page.locator('[role="tooltip"]');
      await expect(tooltip).toBeVisible();

      // Verify tooltip content
      const tooltipText = await tooltip.textContent();
      expect(tooltipText).toContain('Binance');
      expect(tooltipText).toContain('BTC/USDT');
    });

    test('should hide tooltip when mouse leaves', async ({ page }) => {
      const link = await findExchangeLink(page, 'BTC/USDT', 'binance');

      // Hover to show tooltip
      await link.hover();
      await page.waitForTimeout(300);

      // Move mouse away
      await page.mouse.move(0, 0);
      await page.waitForTimeout(300);

      // Tooltip should disappear
      const tooltip = page.locator('[role="tooltip"]');
      await expect(tooltip).not.toBeVisible();
    });
  });

  test.describe('Keyboard Navigation', () => {
    test('should be accessible via Tab key', async ({ page }) => {
      // Find a link
      const link = await findExchangeLink(page, 'BTC/USDT', 'binance');

      // Focus the link using keyboard
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab'); // May need multiple tabs depending on page structure

      // Check if any exchange link is focused
      const focusedElement = page.locator(':focus');
      const isFocused = await focusedElement.evaluate(
        (el) => el.tagName === 'A' && el.hasAttribute('target')
      );

      expect(isFocused).toBeTruthy();
    });

    test('should open link with Enter key', async ({ page, context }) => {
      const link = await findExchangeLink(page, 'BTC/USDT', 'binance');

      // Focus the link
      await link.focus();

      // Listen for new page
      const pagePromise = context.waitForEvent('page');

      // Press Enter
      await page.keyboard.press('Enter');

      const newPage = await pagePromise;
      await newPage.waitForLoadState();

      expect(newPage.url()).toContain('binance.com');

      await newPage.close();
    });
  });

  test.describe('Disabled State', () => {
    test('should display disabled icon for unavailable exchange', async ({
      page,
    }) => {
      // This test assumes there are some unavailable exchanges in the data
      // Look for a disabled exchange link (span instead of a tag)
      const disabledIcon = page
        .locator('span.opacity-40.cursor-not-allowed')
        .first();

      // If disabled icons exist, verify they're not clickable
      const count = await disabledIcon.count();
      if (count > 0) {
        await expect(disabledIcon).toBeVisible();
        await expect(disabledIcon).toHaveAttribute('tabIndex', '-1');
      }
    });
  });

  test.describe('Visual Regression', () => {
    test('should display exchange icons correctly', async ({ page }) => {
      // Wait for all icons to load
      await page.waitForLoadState('networkidle');

      // Check that ExternalLink icons are visible
      const icons = page.locator('svg').filter({ hasText: '' }); // Lucide icons
      const iconCount = await icons.count();

      // Should have icons for each exchange * number of symbols
      expect(iconCount).toBeGreaterThan(0);
    });

    test('should maintain layout with icons', async ({ page }) => {
      // Verify the table structure is not broken by the icons
      const table = page.locator('table');
      await expect(table).toBeVisible();

      // Check that rows are properly aligned
      const rows = table.locator('tr');
      const rowCount = await rows.count();
      expect(rowCount).toBeGreaterThan(1); // At least header + 1 data row
    });
  });
});
