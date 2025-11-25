# Quickstart Guide: 修正複製套利訊息顯示

**Feature**: 023-fix-copy-message-display
**Branch**: `023-fix-copy-message-display`
**Created**: 2025-11-25

## Overview

本指南幫助開發者快速上手此功能的開發、測試和驗證工作。

## Prerequisites

### System Requirements
- Node.js 20.x LTS
- pnpm (package manager)
- TypeScript 5.6+
- Git

### Knowledge Requirements
- TypeScript/JavaScript
- React 18
- Next.js 14 App Router
- Vitest testing framework

### Repository Setup
```bash
# Clone repository (if not already)
git clone <repository-url>
cd cross-exchange-arbitrage-bot

# Install dependencies
pnpm install

# Checkout feature branch
git checkout 023-fix-copy-message-display
```

---

## Development Workflow

### Step 1: Understand Current Code

**Read existing implementation**:
```bash
# Main file to modify
cat app/(dashboard)/market-monitor/utils/formatArbitrageMessage.ts

# Component that uses it
cat app/(dashboard)/market-monitor/components/RateRow.tsx

# Type definitions
cat app/(dashboard)/market-monitor/types.ts
```

**Key files**:
- `formatArbitrageMessage.ts` - 主要修改目標
- `RateRow.tsx` - 需要傳遞 timeBasis 參數
- `types.ts` - 參考型別定義

### Step 2: Make Changes

#### 2.1 修改 formatArbitrageMessage.ts

**Location**: `app/(dashboard)/market-monitor/utils/formatArbitrageMessage.ts`

**Changes**:
1. 移除 `formatPercentageRange()` 函數
2. 新增 `formatAnnualizedReturn()` 函數
3. 新增 `formatSingleFundingReturn()` 函數
4. 新增 `formatPriceDiffWithExplanation()` 函數
5. 修改 `formatArbitrageMessage()` 函數簽名和實作

**Quick Reference**:
```typescript
// New function signatures
function formatAnnualizedReturn(annualizedReturn: number): string;
function formatSingleFundingReturn(spreadPercent: number, timeBasis: TimeBasis): string;
function formatPriceDiffWithExplanation(priceDiffPercent: number | null): string;

// Modified function
export function formatArbitrageMessage(rate: MarketRate, timeBasis: TimeBasis = 8): string;
```

#### 2.2 修改 RateRow.tsx

**Location**: `app/(dashboard)/market-monitor/components/RateRow.tsx`

**Changes**:
1. 獲取當前時間基準（從 context 或 props）
2. 在 `handleCopy()` 中傳遞 timeBasis 參數

**Quick Reference**:
```typescript
const handleCopy = async (e: React.MouseEvent) => {
  e.stopPropagation();

  if (!rate.bestPair) return;

  try {
    const message = formatArbitrageMessage(rate, currentTimeBasis); // Add timeBasis
    await navigator.clipboard.writeText(message);
    setCopyStatus('success');
  } catch (err) {
    console.error('Failed to copy to clipboard:', err);
    setCopyStatus('error');
  }
};
```

### Step 3: Run Development Server

```bash
# Start Next.js dev server
pnpm dev

# Open in browser
open http://localhost:3000
```

**Manual Testing**:
1. Navigate to Market Monitor page (`/market-monitor`)
2. Wait for data to load via WebSocket
3. Find an opportunity row (status = "opportunity" or "approaching")
4. Click the copy button
5. Paste into a text editor to verify format

---

## Testing

### Unit Tests

#### Create test file

**Location**: `tests/unit/frontend/formatArbitrageMessage.test.ts`

```bash
# Create if doesn't exist
touch tests/unit/frontend/formatArbitrageMessage.test.ts
```

#### Run unit tests

```bash
# Run all frontend tests
pnpm test tests/unit/frontend/

# Run specific test file
pnpm test formatArbitrageMessage.test.ts

# Run in watch mode (for development)
pnpm test formatArbitrageMessage.test.ts --watch

# Run with coverage
pnpm test formatArbitrageMessage.test.ts --coverage
```

#### Test Coverage Targets

- `formatAnnualizedReturn`: 100% coverage
- `formatSingleFundingReturn`: 100% coverage
- `formatPriceDiffWithExplanation`: 100% coverage
- `formatArbitrageMessage`: > 90% coverage

### Example Test Cases

```typescript
import { describe, it, expect } from 'vitest';
import { formatArbitrageMessage } from '../../../app/(dashboard)/market-monitor/utils/formatArbitrageMessage';

describe('formatAnnualizedReturn', () => {
  it('should format normal value with ±10% range', () => {
    const result = formatAnnualizedReturn(800);
    expect(result).toBe('約 720-880%');
  });

  it('should handle zero', () => {
    const result = formatAnnualizedReturn(0);
    expect(result).toBe('約 0%');
  });
});

describe('formatPriceDiffWithExplanation', () => {
  it('should show positive diff as favorable', () => {
    const result = formatPriceDiffWithExplanation(0.15);
    expect(result).toContain('+0.15%');
    expect(result).toContain('✓');
    expect(result).toContain('有利平倉');
  });

  it('should show negative diff as unfavorable', () => {
    const result = formatPriceDiffWithExplanation(-0.10);
    expect(result).toContain('-0.10%');
    expect(result).toContain('✗');
    expect(result).toContain('不利平倉');
  });

  it('should handle null', () => {
    const result = formatPriceDiffWithExplanation(null);
    expect(result).toBe('N/A（無價格數據）');
  });
});
```

### Integration Testing

```bash
# Run all tests (unit + integration)
pnpm test --run

# Run with type checking
pnpm test && pnpm tsc --noEmit
```

---

## Verification Checklist

### Code Quality

- [ ] TypeScript compilation passes (`pnpm tsc --noEmit`)
- [ ] All tests pass (`pnpm test --run`)
- [ ] No ESLint errors (`pnpm lint`)
- [ ] Code formatted (`pnpm format` if available)
- [ ] No console.log statements left in production code

### Functionality

- [ ] 年化收益顯示正確（範圍約 ±10%）
- [ ] 單次費率收益顯示正確（2 位小數）
- [ ] 時間基準說明正確（每 X 小時）
- [ ] 價格偏差顯示正負號
- [ ] 價格偏差有有利/不利說明
- [ ] Null 價格數據顯示 "N/A（無價格數據）"
- [ ] 訊息格式完整（包含所有章節）
- [ ] Emoji 正確顯示
- [ ] 繁體中文正確顯示

### Edge Cases

- [ ] 年化收益 = 0 時顯示 "約 0%"
- [ ] 價格偏差 = 0 時視為有利
- [ ] 不同時間基準 (1h, 4h, 8h, 24h) 都正確
- [ ] bestPair 為 null 時拋出錯誤
- [ ] 極大數值（> 1000%）正確格式化
- [ ] 極小數值（< 0.01%）正確格式化

### User Experience

- [ ] 訊息容易理解
- [ ] 術語有註解說明
- [ ] 風險提示清晰
- [ ] 複製按鈕狀態正確更新
- [ ] 錯誤處理友善

---

## Debugging

### Common Issues

#### Issue 1: TypeScript 錯誤

```bash
# Check TypeScript errors
pnpm tsc --noEmit

# Common fixes:
# - Check import paths
# - Check type definitions match
# - Verify TimeBasis type is imported
```

#### Issue 2: 測試失敗

```bash
# Run tests in verbose mode
pnpm test --reporter=verbose

# Check:
# - Mock data matches expected structure
# - Regex patterns are correct
# - Number formatting matches (decimal places)
```

#### Issue 3: 複製功能不工作

**Check**:
1. 瀏覽器支援 clipboard API
2. HTTPS 或 localhost（clipboard API 需要安全環境）
3. 權限已授予

**Debug**:
```typescript
// Add console.log in handleCopy
try {
  const message = formatArbitrageMessage(rate, currentTimeBasis);
  console.log('Message to copy:', message);
  await navigator.clipboard.writeText(message);
} catch (err) {
  console.error('Copy failed:', err);
}
```

### Logging

```typescript
// Enable debug logging
const message = formatArbitrageMessage(rate, timeBasis);
console.debug('[formatArbitrageMessage] Generated message:', {
  symbol: rate.symbol,
  annualizedReturn: rate.bestPair?.annualizedReturn,
  spreadPercent: rate.bestPair?.spreadPercent,
  priceDiffPercent: rate.bestPair?.priceDiffPercent,
  timeBasis,
  messageLength: message.length
});
```

---

## Performance Validation

### Benchmark Tests

```typescript
import { performance } from 'perf_hooks';

describe('Performance', () => {
  it('should format message in < 10ms', () => {
    const mockRate = { /* ... */ };
    const start = performance.now();
    formatArbitrageMessage(mockRate, 8);
    const end = performance.now();
    expect(end - start).toBeLessThan(10);
  });
});
```

### Production Checks

```bash
# Build for production
pnpm build

# Check bundle size
pnpm analyze (if available)

# Verify no warnings
# Expected: ✓ Compiled successfully
```

---

## Code Review Checklist

### Before Submitting PR

- [ ] Feature完全實作（所有 User Stories P1-P3）
- [ ] 所有測試通過
- [ ] TypeScript 無錯誤
- [ ] ESLint 無錯誤
- [ ] 手動測試通過
- [ ] 文檔已更新（如果需要）
- [ ] Commit message 清晰
- [ ] No debug code (console.log, debugger)
- [ ] No commented-out code
- [ ] Constitution compliance verified (✅ already checked in plan.md)

### PR Description Template

```markdown
## Feature: 修正複製套利訊息顯示

### Changes
- 修正 formatPercentageRange 錯誤計算邏輯
- 新增年化收益範圍顯示
- 新增單次費率收益和時間基準說明
- 新增價格偏差正負值說明和風險提示
- 改善術語使用更口語化表達

### Testing
- [ ] Unit tests: XX/XX passing
- [ ] Manual testing: Verified on local dev server
- [ ] Edge cases: Tested null, zero, negative values
- [ ] Different time bases: Tested 1h, 4h, 8h, 24h

### Screenshots
[Include screenshot of copied message]

### Related Issues
Fixes #XXX (if applicable)
```

---

## Quick Commands Reference

```bash
# Development
pnpm dev                      # Start dev server
pnpm build                    # Production build
pnpm lint                     # Run ESLint
pnpm tsc --noEmit            # Type check

# Testing
pnpm test                     # Run all tests
pnpm test --watch            # Watch mode
pnpm test --coverage         # With coverage
pnpm test formatArbitrageMessage  # Specific file

# Git
git status                    # Check changes
git add <files>              # Stage changes
git commit -m "feat: ..."    # Commit
git push origin 023-fix-copy-message-display  # Push to remote
```

---

## Troubleshooting

### Q: 如何獲取 currentTimeBasis？

**A**: Check page context or props:
```typescript
// Option 1: From context (if available)
const { timeBasis } = useMarketMonitor();

// Option 2: From props
const RateRow = ({ rate, timeBasis }: RateRowProps) => { /* ... */ };

// Option 3: From state
const [currentTimeBasis, setCurrentTimeBasis] = useState<TimeBasis>(8);
```

### Q: 測試時如何 mock clipboard API？

**A**:
```typescript
import { vi } from 'vitest';

const mockClipboard = {
  writeText: vi.fn().mockResolvedValue(undefined)
};

Object.assign(navigator, { clipboard: mockClipboard });
```

### Q: 如何驗證訊息格式正確？

**A**: Use regex validation:
```typescript
const message = formatArbitrageMessage(rate, 8);

// Check structure
expect(message).toMatch(/^=======\n【套套摳訊】/);
expect(message).toMatch(/📈 收益評估：/);
expect(message).toMatch(/預估年化收益：約 \d+-\d+%/);
```

---

## Next Steps

After completing this feature:

1. ✅ Merge to main branch
2. ✅ Deploy to staging environment
3. ✅ Test in staging
4. ✅ Deploy to production
5. ✅ Monitor for errors
6. ✅ Gather user feedback

---

## Resources

### Documentation
- [spec.md](spec.md) - Feature specification
- [plan.md](plan.md) - Implementation plan
- [research.md](research.md) - Technical decisions
- [data-model.md](data-model.md) - Type definitions
- [contracts/](contracts/) - Function signatures and message format

### External References
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/)
- [Vitest Documentation](https://vitest.dev/)
- [Next.js App Router](https://nextjs.org/docs/app)
- [Clipboard API](https://developer.mozilla.org/en-US/docs/Web/API/Clipboard_API)

---

## Support

### Internal
- Check `#development` channel (if applicable)
- Review constitution: `.specify/memory/constitution.md`
- Check existing tests: `tests/unit/frontend/`

### External
- TypeScript issues: https://github.com/microsoft/TypeScript/issues
- Next.js issues: https://github.com/vercel/next.js/issues
- Vitest issues: https://github.com/vitest-dev/vitest/issues

---

**Ready to code!** 🚀

Follow the workflow above and refer back to this guide as needed.
