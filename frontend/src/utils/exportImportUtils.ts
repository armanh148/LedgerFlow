import { api } from '../api/client';

export type ImportType = 
  | 'all'
  | 'accounts'
  | 'vouchers'
  | 'invoices'
  | 'bills'
  | 'customers'
  | 'vendors'
  | 'banking'
  | 'bank_transactions';

/**
 * Converts array of records or headers+rows to CSV and triggers browser download.
 * Prepends UTF-8 Byte Order Mark (\uFEFF) for 100% compatibility with Microsoft Excel.
 */
export function exportToCSV(filename: string, headers: string[], rows: (string | number | boolean | null | undefined)[][]): void {
  const escapeCell = (cell: string | number | boolean | null | undefined): string => {
    if (cell === null || cell === undefined) return '""';
    const str = String(cell);
    if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return `"${str}"`;
  };

  const csvContent = [
    headers.map(escapeCell).join(','),
    ...rows.map(row => row.map(escapeCell).join(','))
  ].join('\r\n');

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Downloads a structured JavaScript object or array as a formatted .json file.
 */
export function exportToJSON(filename: string, data: any): void {
  const jsonContent = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename.endsWith('.json') ? filename : `${filename}.json`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Parses raw CSV string into array of object records using first row as keys.
 * Handles quoted fields with embedded commas and double quotes.
 */
export function parseCSV(text: string): Record<string, string>[] {
  const lines: string[] = [];
  let currentLine = '';
  let insideQuotes = false;

  // Normalize line breaks
  const cleanText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i];
    if (char === '"') {
      if (insideQuotes && cleanText[i + 1] === '"') {
        currentLine += '"';
        i++; // skip next quote
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === '\n' && !insideQuotes) {
      if (currentLine.trim()) {
        lines.push(currentLine);
      }
      currentLine = '';
    } else {
      currentLine += char;
    }
  }
  if (currentLine.trim()) {
    lines.push(currentLine);
  }

  if (lines.length < 2) return [];

  const parseRow = (line: string): string[] => {
    const cells: string[] = [];
    let cell = '';
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuote && line[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuote = !inQuote;
        }
      } else if (ch === ',' && !inQuote) {
        cells.push(cell.trim());
        cell = '';
      } else {
        cell += ch;
      }
    }
    cells.push(cell.trim());
    return cells;
  };

  const headers = parseRow(lines[0]).map(h => h.replace(/^["']|["']$/g, '').trim());
  const records: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseRow(lines[i]);
    if (values.every(v => !v)) continue; // skip empty rows
    const record: Record<string, string> = {};
    headers.forEach((header, idx) => {
      let val = values[idx] || '';
      // Strip outer quotes if still remaining
      if (val.startsWith('"') && val.endsWith('"')) {
        val = val.slice(1, -1).replace(/""/g, '"');
      }
      record[header] = val;
    });
    records.push(record);
  }

  return records;
}

/**
 * Generates and downloads ready-to-fill sample templates for each entity type.
 */
export function downloadSampleTemplate(type: ImportType): void {
  switch (type) {
    case 'accounts':
      exportToCSV(
        'chart_of_accounts_sample_template.csv',
        ['code', 'name', 'category', 'opening_balance'],
        [
          ['1010', 'Main Operating Cash Account', 'ASSET', '15000.00'],
          ['1020', 'Chase Business Checking', 'ASSET', '25000.00'],
          ['2010', 'Accounts Payable Clearing', 'LIABILITY', '0.00'],
          ['3010', 'Owner Common Equity', 'EQUITY', '40000.00'],
          ['4010', 'Software Consulting Revenue', 'REVENUE', '0.00'],
          ['5010', 'Office Rent & Facilities', 'EXPENSE', '0.00'],
        ]
      );
      break;

    case 'vouchers':
      exportToCSV(
        'journal_vouchers_sample_template.csv',
        ['Voucher Number', 'Date', 'Narration', 'Debit Account', 'Debit Amount', 'Credit Account', 'Credit Amount'],
        [
          ['JV-2026-001', '2026-03-01', 'Monthly Cloud Hosting Payment', '5010', '1200.00', '1010', '1200.00'],
          ['JV-2026-002', '2026-03-02', 'Office Supplies Expense', '5020', '450.00', '1010', '450.00'],
        ]
      );
      break;

    case 'invoices':
      exportToCSV(
        'invoices_sample_template.csv',
        ['Invoice Number', 'Customer Name', 'Issue Date', 'Due Date', 'Subtotal', 'Tax Amount', 'Grand Total', 'Notes'],
        [
          ['INV-2026-001', 'Acme Corporation', '2026-03-01', '2026-03-31', '5000.00', '500.00', '5500.00', 'Net 30 IT Architecture Services'],
          ['INV-2026-002', 'Global Tech Solutions', '2026-03-05', '2026-04-05', '8200.00', '820.00', '9020.00', 'Cloud Migration Phase 1'],
        ]
      );
      break;

    case 'bills':
      exportToCSV(
        'bills_sample_template.csv',
        ['Bill Number', 'Vendor Name', 'Issue Date', 'Due Date', 'Subtotal', 'Tax Amount', 'Grand Total', 'Notes'],
        [
          ['BILL-2026-001', 'Amazon Web Services', '2026-03-01', '2026-03-15', '1450.00', '0.00', '1450.00', 'Monthly Infrastructure Hosting'],
          ['BILL-2026-002', 'WeWork Office Space', '2026-03-01', '2026-03-15', '3500.00', '350.00', '3850.00', 'Private Office Lease'],
        ]
      );
      break;

    case 'customers':
      exportToCSV(
        'customers_sample_template.csv',
        ['Customer Name', 'Email', 'Phone', 'Address', 'Tax ID'],
        [
          ['Acme Corporation', 'billing@acme.com', '+1 (555) 123-4567', '100 Enterprise Way, Suite 400', 'US-EIN-12345678'],
          ['Global Tech Solutions', 'accounts@globaltech.io', '+1 (555) 987-6543', '250 Silicon Blvd, Floor 8', 'US-EIN-87654321'],
        ]
      );
      break;

    case 'vendors':
      exportToCSV(
        'vendors_sample_template.csv',
        ['Vendor Name', 'Email', 'Phone', 'Address', 'Tax ID'],
        [
          ['Amazon Web Services', 'aws-receivables@amazon.com', '+1 (800) 555-0199', '410 Terry Ave N, Seattle, WA', 'US-EIN-99887766'],
          ['WeWork Office Space', 'billing@wework.com', '+1 (888) 555-0144', '115 W 18th St, New York, NY', 'US-EIN-55443322'],
        ]
      );
      break;

    case 'banking':
    case 'bank_transactions':
      exportToCSV(
        'bank_statement_sample_template.csv',
        ['Date', 'Description', 'Reference', 'Amount'],
        [
          ['2026-03-01', 'Client Wire Transfer - Acme Corp', 'TXN-908123', '5500.00'],
          ['2026-03-02', 'AWS Cloud Services Debit', 'TXN-908124', '-1450.00'],
          ['2026-03-03', 'Office Supply Store', 'TXN-908125', '-230.50'],
          ['2026-03-04', 'Stripe Customer Payout', 'TXN-908126', '3400.00'],
        ]
      );
      break;

    case 'all':
      exportToJSON('ledgerflow_sample_full_backup.json', {
        version: "1.0",
        exported_at: new Date().toISOString(),
        export_type: "all",
        data: {
          accounts: [
            { code: "1010", name: "Operating Cash", category: "ASSET", opening_balance: "10000.00" },
            { code: "4010", name: "Consulting Income", category: "REVENUE", opening_balance: "0.00" },
            { code: "5010", name: "Cloud Server Hosting", category: "EXPENSE", opening_balance: "0.00" }
          ],
          customers: [
            { name: "Acme Corp", email: "contact@acme.com", phone: "555-0199", address: "100 Main St" }
          ],
          vendors: [
            { name: "Amazon Web Services", email: "billing@aws.com", phone: "555-0200", address: "Seattle, WA" }
          ]
        }
      });
      break;
  }
}

/**
 * Sends parsed data payload to backend import endpoint.
 */
export async function sendImportToBackend(type: ImportType, data: any, bankAccountId?: string) {
  const payload: any = {
    type,
    data
  };
  if (bankAccountId) {
    payload.bank_account_id = bankAccountId;
  }
  const response = await api.post('data-hub/import/', payload);
  return response.data;
}

/**
 * Fetches export dataset from backend.
 */
export async function fetchExportFromBackend(type: ImportType = 'all') {
  const response = await api.get(`data-hub/export/?type=${type}`);
  return response.data;
}
