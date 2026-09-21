import React, { useState, useRef } from 'react';
import { 
  X, UploadCloud, FileSpreadsheet, FileCode, CheckCircle2, 
  AlertCircle, Download, Loader2, Sparkles
} from 'lucide-react';
import type { ImportType } from '../utils/exportImportUtils';
import { 
  parseCSV, downloadSampleTemplate, sendImportToBackend 
} from '../utils/exportImportUtils';
import { useAuth } from '../context/AuthContext';
import type { BankAccount } from '../types';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  type: ImportType;
  title?: string;
  bankAccounts?: BankAccount[];
}

export const ImportModal: React.FC<ImportModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  type,
  title,
  bankAccounts = []
}) => {
  const { showToast, activeRole } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileFormat, setFileFormat] = useState<'csv' | 'json' | null>(null);
  const [parsedData, setParsedData] = useState<any[] | Record<string, any> | null>(null);
  const [selectedBankId, setSelectedBankId] = useState<string>(bankAccounts.length > 0 ? bankAccounts[0].id : '');
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<{
    created: number;
    updated: number;
    skipped: number;
    errors: string[];
  } | null>(null);

  if (!isOpen) return null;

  const getEntityDisplayName = (t: ImportType) => {
    switch (t) {
      case 'accounts': return 'Chart of Accounts';
      case 'vouchers': return 'Journal Vouchers';
      case 'invoices': return 'Sales Invoices';
      case 'bills': return 'Purchase Bills';
      case 'customers': return 'Customers & Clients';
      case 'vendors': return 'Vendors & Suppliers';
      case 'banking':
      case 'bank_transactions': return 'Bank Statement Transactions';
      case 'all': return 'Full System Backup & Restore';
      default: return 'Financial Data';
    }
  };

  const handleFileProcess = async (file: File) => {
    setParseError(null);
    setImportResult(null);
    setSelectedFile(file);

    const fileName = file.name.toLowerCase();
    try {
      const text = await file.text();

      if (fileName.endsWith('.json')) {
        setFileFormat('json');
        try {
          const parsed = JSON.parse(text);
          if (type === 'all' && parsed.data) {
            setParsedData(parsed.data);
          } else if (Array.isArray(parsed)) {
            setParsedData(parsed);
          } else if (typeof parsed === 'object') {
            setParsedData(parsed);
          } else {
            throw new Error('Invalid JSON format for import.');
          }
        } catch (err: any) {
          setParseError(`JSON Syntax Error: ${err.message}`);
          setParsedData(null);
        }
      } else if (fileName.endsWith('.csv') || fileName.endsWith('.txt')) {
        setFileFormat('csv');
        const records = parseCSV(text);
        if (records.length === 0) {
          setParseError('The uploaded CSV file is empty or does not have recognizable rows/headers.');
          setParsedData(null);
        } else {
          setParsedData(records);
        }
      } else {
        setParseError('Unsupported file format. Please upload a valid .CSV or .JSON file.');
        setSelectedFile(null);
        setParsedData(null);
      }
    } catch (err: any) {
      setParseError(`Failed to read file: ${err.message}`);
      setParsedData(null);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileProcess(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleExecuteImport = async () => {
    if (activeRole === 'AUDITOR') {
      showToast('Permission Denied: Auditors cannot import or modify data.', 'error');
      return;
    }

    if (!parsedData) {
      showToast('Please upload and preview a valid file first.', 'warning');
      return;
    }

    if ((type === 'banking' || type === 'bank_transactions') && !selectedBankId && bankAccounts.length > 0) {
      showToast('Please select a target Bank Account for this statement import.', 'warning');
      return;
    }

    try {
      setIsProcessing(true);
      const res = await sendImportToBackend(type, parsedData, selectedBankId);
      
      const results = res.results || {
        created: 0,
        updated: 0,
        skipped: 0,
        errors: []
      };

      setImportResult(results);
      showToast(
        `Import complete! ${results.created} created, ${results.updated} updated${results.errors.length ? `, ${results.errors.length} warnings` : ''}.`,
        results.errors.length > 0 && results.created === 0 ? 'warning' : 'success'
      );
      onSuccess();
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || err.message || 'Import failed';
      setParseError(errorMsg);
      showToast(errorMsg, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const resetState = () => {
    setSelectedFile(null);
    setParsedData(null);
    setParseError(null);
    setImportResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const getPreviewRows = (): { headers: string[]; rows: any[] } => {
    if (!parsedData) return { headers: [], rows: [] };

    if (Array.isArray(parsedData)) {
      if (parsedData.length === 0) return { headers: [], rows: [] };
      const sample = parsedData[0];
      const headers = Object.keys(sample).slice(0, 6);
      return {
        headers,
        rows: parsedData.slice(0, 5)
      };
    } else if (typeof parsedData === 'object') {
      const keys = Object.keys(parsedData);
      return {
        headers: ['Dataset / Entity', 'Record Count', 'Status'],
        rows: keys.map(k => ({
          'Dataset / Entity': k.replace(/_/g, ' ').toUpperCase(),
          'Record Count': Array.isArray(parsedData[k]) ? `${parsedData[k].length} items` : 'Structured Data',
          'Status': 'Ready to restore'
        }))
      };
    }
    return { headers: [], rows: [] };
  };

  const { headers: previewHeaders, rows: previewRows } = getPreviewRows();
  const totalCount = Array.isArray(parsedData) 
    ? parsedData.length 
    : (parsedData ? Object.keys(parsedData).reduce((sum, k) => sum + (Array.isArray(parsedData[k]) ? parsedData[k].length : 1), 0) : 0);

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1050 }}>
      <div 
        className="modal-content glass-panel" 
        onClick={(e) => e.stopPropagation()} 
        style={{ 
          maxWidth: '750px', 
          width: '95%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          border: '1px solid rgba(249,115,22,0.25)',
          boxShadow: '0 20px 40px rgba(0,0,0,0.6)'
        }}
      >
        {/* Header */}
        <div className="modal-header" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ 
              width: '38px', height: '38px', 
              borderRadius: '10px', 
              background: 'linear-gradient(135deg, rgba(249,115,22,0.2), rgba(234,88,12,0.4))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '1px solid rgba(249,115,22,0.3)'
            }}>
              <UploadCloud size={20} color="#F97316" />
            </div>
            <div>
              <h3 className="modal-title" style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>
                {title || `Import ${getEntityDisplayName(type)}`}
              </h3>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Upload CSV or JSON file to batch import and update records seamlessly
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            style={{ 
              background: 'rgba(255,255,255,0.05)', 
              border: 'none', 
              color: '#9CA3AF', 
              cursor: 'pointer',
              borderRadius: '8px',
              padding: '6px',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ overflowY: 'auto', padding: '16px 0', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Quick Info & Sample Template Download Bar */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            background: 'rgba(255,255,255,0.03)', 
            border: '1px solid rgba(255,255,255,0.06)',
            padding: '10px 16px',
            borderRadius: '10px',
            flexWrap: 'wrap',
            gap: '8px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: '#D1D5DB' }}>
              <Sparkles size={16} color="#F97316" />
              <span>Need the required format structure? Download our ready template:</span>
            </div>
            <button 
              type="button"
              className="btn btn-outline"
              style={{ fontSize: '0.8rem', padding: '5px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
              onClick={() => downloadSampleTemplate(type)}
            >
              <Download size={14} /> Download Sample Template (.CSV)
            </button>
          </div>

          {/* Target Bank Account Selector if banking import */}
          {(type === 'banking' || type === 'bank_transactions') && bankAccounts.length > 0 && (
            <div style={{ background: '#1e293b', padding: '12px 16px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
              <label className="form-label" style={{ marginBottom: '6px', display: 'block', fontSize: '0.85rem' }}>
                Select Target Bank Account:
              </label>
              <select 
                className="form-select"
                value={selectedBankId}
                onChange={(e) => setSelectedBankId(e.target.value)}
                style={{ width: '100%', background: '#0f172a', borderColor: 'var(--border-color)' }}
              >
                {bankAccounts.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.bank_name} - {b.account_name} ({b.account_number})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Dropzone File Upload Area */}
          {!parsedData && (
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: isDragging ? '2px dashed #F97316' : '2px dashed rgba(255,255,255,0.15)',
                background: isDragging ? 'rgba(249,115,22,0.08)' : 'rgba(15,23,42,0.6)',
                borderRadius: '14px',
                padding: '36px 20px',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px'
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv, .json, .txt"
                style={{ display: 'none' }}
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    handleFileProcess(e.target.files[0]);
                  }
                }}
              />
              <div style={{
                width: '56px', height: '56px',
                borderRadius: '50%',
                background: 'rgba(249,115,22,0.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#F97316'
              }}>
                <UploadCloud size={28} />
              </div>

              <div>
                <div style={{ fontSize: '1rem', fontWeight: 600, color: '#F3F4F6' }}>
                  Click to browse or drag & drop file here
                </div>
                <div style={{ fontSize: '0.8rem', color: '#9CA3AF', marginTop: '4px' }}>
                  Supports <span style={{ color: '#F97316', fontWeight: 600 }}>.CSV</span> (Excel-compatible) and <span style={{ color: '#60A5FA', fontWeight: 600 }}>.JSON</span> files
                </div>
              </div>
            </div>
          )}

          {/* Parse / File Error Display */}
          {parseError && (
            <div style={{ 
              display: 'flex', 
              alignItems: 'flex-start', 
              gap: '10px', 
              background: 'rgba(239,68,68,0.12)', 
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: '10px',
              padding: '12px 16px',
              color: '#FCA5A5',
              fontSize: '0.875rem'
            }}>
              <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong>Import Error:</strong> {parseError}
              </div>
            </div>
          )}

          {/* Parsed Data Preview Grid */}
          {parsedData && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* File details bar */}
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                padding: '10px 14px',
                borderRadius: '10px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {fileFormat === 'csv' ? (
                    <FileSpreadsheet size={20} color="#34d399" />
                  ) : (
                    <FileCode size={20} color="#60a5fa" />
                  )}
                  <div>
                    <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#fff' }}>
                      {selectedFile?.name || 'Uploaded File'}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#9CA3AF' }}>
                      {((selectedFile?.size || 0) / 1024).toFixed(1)} KB · Format: {fileFormat?.toUpperCase()}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="badge badge-emerald" style={{ padding: '4px 10px', fontSize: '0.8rem' }}>
                    <CheckCircle2 size={13} /> {totalCount} Records Parsed
                  </span>
                  <button 
                    type="button" 
                    className="btn btn-outline" 
                    style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                    onClick={resetState}
                  >
                    Change File
                  </button>
                </div>
              </div>

              {/* Data Table Preview */}
              <div style={{ 
                border: '1px solid rgba(255,255,255,0.08)', 
                borderRadius: '10px', 
                overflow: 'hidden',
                background: '#0f172a'
              }}>
                <div style={{ 
                  padding: '8px 12px', 
                  background: 'rgba(255,255,255,0.03)', 
                  borderBottom: '1px solid rgba(255,255,255,0.08)',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  color: 'var(--text-muted)'
                }}>
                  PREVIEW (First {previewRows.length} rows shown):
                </div>
                <div className="table-container" style={{ maxHeight: '180px', overflowY: 'auto' }}>
                  <table className="data-table" style={{ fontSize: '0.8rem' }}>
                    <thead>
                      <tr>
                        {previewHeaders.map((h, i) => (
                          <th key={i} style={{ padding: '8px 12px' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((r, rowIdx) => (
                        <tr key={rowIdx}>
                          {previewHeaders.map((h, colIdx) => (
                            <td key={colIdx} style={{ padding: '8px 12px' }}>
                              {typeof r[h] === 'object' ? JSON.stringify(r[h]) : String(r[h] ?? '')}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Import Result Notification */}
          {importResult && (
            <div style={{
              background: importResult.created > 0 || importResult.updated > 0 ? 'rgba(52,211,153,0.12)' : 'rgba(251,191,36,0.12)',
              border: importResult.created > 0 || importResult.updated > 0 ? '1px solid rgba(52,211,153,0.3)' : '1px solid rgba(251,191,36,0.3)',
              borderRadius: '10px',
              padding: '14px 18px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, color: '#fff', fontSize: '0.95rem' }}>
                <CheckCircle2 size={18} color="#34d399" />
                <span>Import Summary</span>
              </div>
              <div style={{ fontSize: '0.85rem', color: '#D1D5DB' }}>
                • <strong>{importResult.created}</strong> records created<br />
                • <strong>{importResult.updated}</strong> records updated<br />
                • <strong>{importResult.skipped}</strong> records skipped
              </div>
              {importResult.errors.length > 0 && (
                <div style={{ marginTop: '6px', fontSize: '0.8rem', color: '#F87171' }}>
                  <strong>Warnings/Errors ({importResult.errors.length}):</strong>
                  <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                    {importResult.errors.slice(0, 3).map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div style={{ 
          borderTop: '1px solid rgba(255,255,255,0.08)', 
          paddingTop: '16px', 
          display: 'flex', 
          justifyContent: 'flex-end', 
          gap: '12px' 
        }}>
          <button 
            type="button" 
            className="btn btn-outline" 
            onClick={onClose}
            disabled={isProcessing}
          >
            {importResult ? 'Close' : 'Cancel'}
          </button>

          {parsedData && !importResult && (
            <button 
              type="button" 
              className="btn btn-primary" 
              onClick={handleExecuteImport}
              disabled={isProcessing}
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              {isProcessing ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Processing Import...
                </>
              ) : (
                <>
                  <UploadCloud size={16} /> Start Import ({totalCount} records)
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
