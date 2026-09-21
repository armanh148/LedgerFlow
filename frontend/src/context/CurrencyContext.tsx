import React, { createContext, useContext, useState } from 'react';

export type CurrencyCode = 'INR' | 'USD' | 'EUR' | 'GBP' | 'PKR' | 'AED' | 'SAR' | 'CAD';

export interface CurrencyConfig {
  code: CurrencyCode;
  symbol: string;
  name: string;
  locale: string;
  flag: string;
}

export const SUPPORTED_CURRENCIES: Record<CurrencyCode, CurrencyConfig> = {
  INR: {
    code: 'INR',
    symbol: '₹',
    name: 'Indian Rupee (₹ INR)',
    locale: 'en-IN',
    flag: '🇮🇳',
  },
  USD: {
    code: 'USD',
    symbol: '$',
    name: 'US Dollar ($ USD)',
    locale: 'en-US',
    flag: '🇺🇸',
  },
  EUR: {
    code: 'EUR',
    symbol: '€',
    name: 'Euro (€ EUR)',
    locale: 'de-DE',
    flag: '🇪🇺',
  },
  GBP: {
    code: 'GBP',
    symbol: '£',
    name: 'British Pound (£ GBP)',
    locale: 'en-GB',
    flag: '🇬🇧',
  },
  PKR: {
    code: 'PKR',
    symbol: '₨',
    name: 'Pakistani Rupee (₨ PKR)',
    locale: 'ur-PK',
    flag: '🇵🇰',
  },
  AED: {
    code: 'AED',
    symbol: 'AED ',
    name: 'UAE Dirham (AED)',
    locale: 'en-AE',
    flag: '🇦🇪',
  },
  SAR: {
    code: 'SAR',
    symbol: 'SAR ',
    name: 'Saudi Riyal (SAR)',
    locale: 'en-SA',
    flag: '🇸🇦',
  },
  CAD: {
    code: 'CAD',
    symbol: 'CA$',
    name: 'Canadian Dollar (CAD)',
    locale: 'en-CA',
    flag: '🇨🇦',
  },
};

interface CurrencyContextType {
  currency: CurrencyCode;
  setCurrency: (code: CurrencyCode) => void;
  currencyConfig: CurrencyConfig;
  currencySymbol: string;
  currencies: CurrencyConfig[];
  formatCurrency: (val: string | number | null | undefined, options?: Intl.NumberFormatOptions) => string;
  formatParts: (val: string | number | null | undefined) => {
    symbol: string;
    integer: string;
    decimal: string;
    fullFormatted: string;
  };
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export const CurrencyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currency, setCurrencyState] = useState<CurrencyCode>(() => {
    const saved = localStorage.getItem('ledgerflow_currency') as CurrencyCode;
    return saved && SUPPORTED_CURRENCIES[saved] ? saved : 'INR';
  });

  const currencyConfig = SUPPORTED_CURRENCIES[currency] || SUPPORTED_CURRENCIES.INR;

  const setCurrency = (code: CurrencyCode) => {
    if (SUPPORTED_CURRENCIES[code]) {
      setCurrencyState(code);
      localStorage.setItem('ledgerflow_currency', code);
    }
  };

  const formatCurrency = (val: string | number | null | undefined, options?: Intl.NumberFormatOptions): string => {
    const num = typeof val === 'number' ? val : parseFloat(String(val || '0'));
    if (isNaN(num)) {
      return `${currencyConfig.symbol}0.00`;
    }
    const formatted = new Intl.NumberFormat(currencyConfig.locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      ...options,
    }).format(num);

    return `${currencyConfig.symbol}${formatted}`;
  };

  const formatParts = (val: string | number | null | undefined) => {
    const num = typeof val === 'number' ? val : parseFloat(String(val || '0'));
    const safeNum = isNaN(num) ? 0 : num;
    const formatted = new Intl.NumberFormat(currencyConfig.locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(safeNum);
    const parts = formatted.split('.');
    return {
      symbol: currencyConfig.symbol,
      integer: parts[0],
      decimal: parts[1] || '00',
      fullFormatted: `${currencyConfig.symbol}${formatted}`,
    };
  };

  return (
    <CurrencyContext.Provider
      value={{
        currency,
        setCurrency,
        currencyConfig,
        currencySymbol: currencyConfig.symbol,
        currencies: Object.values(SUPPORTED_CURRENCIES),
        formatCurrency,
        formatParts,
      }}
    >
      {children}
    </CurrencyContext.Provider>
  );
};

export const useCurrency = () => {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return context;
};
