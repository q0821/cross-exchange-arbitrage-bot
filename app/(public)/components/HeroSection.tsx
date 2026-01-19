import Link from 'next/link';

/**
 * Hero Section 元件
 *
 * 首頁品牌區塊，包含：
 * - 系統名稱標題
 * - 產品簡介
 * - 主要 CTA（註冊）
 * - 次要 CTA（登入）
 */
export function HeroSection() {
  return (
    <section className="text-center py-12 px-4">
      <div className="max-w-3xl mx-auto">
        {/* 系統名稱標題 */}
        <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
          跨交易所套利機會監測
        </h1>

        {/* 產品簡介 */}
        <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
          即時監測多交易所資金費率套利機會，自動計算年化報酬率，幫助您發現最佳套利時機
        </p>

        {/* CTA 按鈕組 */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          {/* 主要 CTA - 註冊 */}
          <Link
            href="/register"
            className="inline-flex items-center justify-center px-6 py-3 text-base font-medium rounded-md text-primary-foreground bg-primary hover:bg-primary/90 transition-colors shadow-sm"
          >
            免費註冊開始使用
          </Link>

          {/* 次要 CTA - 登入 */}
          <Link
            href="/login"
            className="inline-flex items-center justify-center px-6 py-3 text-base font-medium rounded-md text-foreground bg-background border border-border hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            已有帳號？立即登入
          </Link>
        </div>

        {/* 產品特色（可選，視覺平衡用） */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 text-sm text-muted-foreground">
          <div>
            <div className="font-semibold text-foreground mb-1">📊 即時監控</div>
            <div>24/7 不間斷監測多交易所費率變化</div>
          </div>
          <div>
            <div className="font-semibold text-foreground mb-1">💰 精準計算</div>
            <div>自動計算年化報酬率與最佳開倉時機</div>
          </div>
          <div>
            <div className="font-semibold text-foreground mb-1">🔔 即時通知</div>
            <div>套利機會出現時立即推送提醒</div>
          </div>
        </div>
      </div>
    </section>
  );
}
