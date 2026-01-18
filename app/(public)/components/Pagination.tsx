'use client';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

/**
 * 分頁元件
 *
 * 支援頁碼顯示、上下頁切換、省略號邏輯
 */
export function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  // 生成頁碼陣列
  const generatePageNumbers = (): (number | string)[] => {
    if (totalPages <= 7) {
      // 總頁數 <= 7，顯示所有頁碼
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    // 總頁數 > 7，使用省略號
    const pages: (number | string)[] = [];

    if (currentPage <= 4) {
      // 當前頁在前 4 頁：1 2 3 4 5 ... 20
      pages.push(1, 2, 3, 4, 5, '...', totalPages);
    } else if (currentPage >= totalPages - 3) {
      // 當前頁在後 4 頁：1 ... 16 17 18 19 20
      pages.push(1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
    } else {
      // 當前頁在中間：1 ... 8 9 10 ... 20
      pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages);
    }

    return pages;
  };

  const pageNumbers = generatePageNumbers();

  const handlePrevious = () => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  };

  const handleNext = () => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1);
    }
  };

  const handlePageClick = (page: number) => {
    if (page !== currentPage) {
      onPageChange(page);
    }
  };

  return (
    <nav className="flex items-center justify-center space-x-2" aria-label="分頁導航">
      {/* 上一頁按鈕 */}
      <button
        onClick={handlePrevious}
        disabled={currentPage === 1}
        aria-label="上一頁 (Previous)"
        className="px-3 py-2 text-sm font-medium rounded-md border border-border bg-background text-foreground disabled:opacity-50 disabled:cursor-not-allowed hover:bg-accent hover:text-accent-foreground transition-colors"
      >
        上一頁
      </button>

      {/* 頁碼按鈕 */}
      <div className="flex items-center space-x-1">
        {pageNumbers.map((page, index) => {
          if (page === '...') {
            return (
              <span key={`ellipsis-${index}`} className="px-2 text-muted-foreground">
                ...
              </span>
            );
          }

          const pageNum = page as number;
          const isCurrent = pageNum === currentPage;

          return (
            <button
              key={pageNum}
              onClick={() => handlePageClick(pageNum)}
              aria-label={`第 ${pageNum} 頁`}
              aria-current={isCurrent ? 'page' : undefined}
              className={`min-w-[2.5rem] px-3 py-2 text-sm font-medium rounded-md border transition-colors ${
                isCurrent
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-foreground border-border hover:bg-accent hover:text-accent-foreground'
              }`}
            >
              {pageNum}
            </button>
          );
        })}
      </div>

      {/* 下一頁按鈕 */}
      <button
        onClick={handleNext}
        disabled={currentPage === totalPages}
        aria-label="下一頁 (Next)"
        className="px-3 py-2 text-sm font-medium rounded-md border border-border bg-background text-foreground disabled:opacity-50 disabled:cursor-not-allowed hover:bg-accent hover:text-accent-foreground transition-colors"
      >
        下一頁
      </button>

      {/* 頁碼資訊 */}
      <div className="ml-4 text-sm text-muted-foreground">
        第 {currentPage} / {totalPages} 頁
      </div>
    </nav>
  );
}
