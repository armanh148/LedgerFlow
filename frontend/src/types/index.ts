export type UserRole = 'ADMIN' | 'ACCOUNTANT' | 'DATA_ENTRY' | 'AUDITOR';

export type AccountCategory = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';

export interface Account {
  id: string;
  code: string;
  name: string;
  category: AccountCategory;
  category_display?: string;
  parent_account?: string | null;
  is_active: boolean;
  opening_balance: string;
  current_balance: string;
}

export type JournalEntryType = 'STANDARD' | 'PAYMENT' | 'RECEIPT' | 'CONTRA' | 'INVOICE' | 'BILL' | 'REVERSAL';
export type JournalEntryStatus = 'DRAFT' | 'POSTED' | 'VOID';

export interface JournalItem {
  id?: string;
  account: string;
  account_details?: Account;
  debit: string;
  credit: string;
  description: string;
}

export interface JournalEntry {
  id: string;
  entry_number: string;
  entry_type: JournalEntryType;
  date: string;
  status: JournalEntryStatus;
  narration: string;
  created_by?: string;
  created_by_name?: string;
  posted_by?: string;
  posted_at?: string;
  created_at: string;
  reverses_entry?: string;
  items: JournalItem[];
  total_debit: string;
  total_credit: string;
  is_balanced: boolean;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  tax_id: string;
  created_at?: string;
}

export type InvoiceStatus = 'DRAFT' | 'SENT' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'CANCELLED';

export interface InvoiceItem {
  id?: string;
  description: string;
  quantity: string;
  unit_price: string;
  tax_rate: string;
  total_price: string;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  customer: string;
  customer_details?: Customer;
  issue_date: string;
  due_date: string;
  subtotal: string;
  tax_amount: string;
  grand_total: string;
  status: InvoiceStatus;
  journal_entry?: string;
  journal_entry_details?: JournalEntry;
  notes: string;
  items: InvoiceItem[];
  paid_amount: string;
  remaining_balance: string;
  created_at?: string;
}

export interface Vendor {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  tax_id: string;
  created_at?: string;
}

export type BillStatus = 'DRAFT' | 'RECEIVED' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'CANCELLED';

export interface BillItem {
  id?: string;
  description: string;
  quantity: string;
  unit_price: string;
  tax_rate: string;
  total_price: string;
}

export interface Bill {
  id: string;
  bill_number: string;
  vendor: string;
  vendor_details?: Vendor;
  issue_date: string;
  due_date: string;
  subtotal: string;
  tax_amount: string;
  grand_total: string;
  status: BillStatus;
  journal_entry?: string;
  journal_entry_details?: JournalEntry;
  notes: string;
  items: BillItem[];
  paid_amount: string;
  remaining_balance: string;
  created_at?: string;
}

export interface BankAccount {
  id: string;
  account_name: string;
  account_number: string;
  bank_name: string;
  ledger_account: string;
  ledger_account_details?: Account;
  opening_balance: string;
  current_balance: string;
}

export interface BankStatementTransaction {
  id: string;
  bank_account: string;
  transaction_date: string;
  description: string;
  reference: string;
  amount: string;
  is_reconciled: boolean;
  matched_journal_entry?: JournalEntry;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  username: string;
  user_role: string;
  action: string;
  model_name?: string;
  object_id?: string;
  ip_address?: string;
  details: Record<string, any>;
}

export interface PeriodLock {
  id: string;
  period_name: string;
  start_date: string;
  end_date: string;
  is_locked: boolean;
}

export interface TrialBalanceReport {
  as_of_date: string;
  accounts: {
    account_id: string;
    code: string;
    name: string;
    category: AccountCategory;
    debit: string;
    credit: string;
  }[];
  total_debits: string;
  total_credits: string;
  difference: string;
  is_balanced: boolean;
}

export interface ProfitAndLossReport {
  start_date?: string;
  end_date: string;
  revenues: { code: string; name: string; amount: string }[];
  total_revenue: string;
  expenses: { code: string; name: string; amount: string }[];
  total_expense: string;
  net_profit: string;
  is_profitable: boolean;
}

export interface BalanceSheetReport {
  as_of_date: string;
  assets: { code: string; name: string; amount: string }[];
  total_assets: string;
  liabilities: { code: string; name: string; amount: string }[];
  total_liabilities: string;
  equity: { code: string; name: string; amount: string }[];
  total_equity: string;
  total_liabilities_and_equity: string;
  difference: string;
  is_balanced: boolean;
}

export interface DashboardMetrics {
  net_profit: string;
  total_cash_in_hand: string;
  total_ar_outstanding: string;
  total_ap_outstanding: string;
  revenue_vs_expense_chart: { month: string; revenue: number; expense: number }[];
}
