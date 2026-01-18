/**
 * Vitest Setup File
 *
 * This file is loaded before each test file and extends the expect function
 * with additional matchers from @testing-library/jest-dom
 */

// 載入測試環境變數（.env.test），覆蓋現有環境變數
import { config } from 'dotenv';
config({ path: '.env.test', override: true });

import React from 'react';
import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';

// Make React available globally for JSX transform
globalThis.React = React;

// Extend Vitest's expect method with methods from react-testing-library
expect.extend(matchers);

// Cleanup after each test case (removes mounted components)
afterEach(() => {
  cleanup();
});
