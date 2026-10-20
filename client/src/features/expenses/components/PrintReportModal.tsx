// src/features/expenses/components/PrintReportModal.tsx
import React, { useRef, useState } from "react";
import { Modal, Button } from "../../../components/ui";
import { type AnalyticsReport } from "../../../store/api/expenseApi";
import { useCurrency } from "../../../hooks/useCurrency";
import { format } from "date-fns";
import { Printer, Download, FileDown, X, Building, Calendar, DollarSign, PackageCheck } from "lucide-react";
import toast from "react-hot-toast";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

interface PrintReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: AnalyticsReport | null;
  academyName?: string;
  franchiseName?: string;
}

export const PrintReportModal: React.FC<PrintReportModalProps> = ({
  isOpen,
  onClose,
  report,
  academyName = "Noxphere Football Academy",
  franchiseName = "All Branches",
}) => {
  const { format: formatMoney, currencySymbol } = useCurrency();
  const printAreaRef = useRef<HTMLDivElement>(null);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  if (!report) return null;

  const { summary, categoryBreakdown, expenses, feeInflows, otherInflows, stockSummary, period } = report;

  const handlePrint = () => {
    if (!printAreaRef.current) {
      window.print();
      return;
    }

    try {
      // Remove any previously orphaned print frames
      const existingFrame = document.getElementById("noxphere-print-frame");
      if (existingFrame) existingFrame.remove();

      // Create an isolated hidden iframe dedicated to printing
      const iframe = document.createElement("iframe");
      iframe.id = "noxphere-print-frame";
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "0";
      iframe.setAttribute("aria-hidden", "true");
      iframe.title = "Print Statement Frame";
      document.body.appendChild(iframe);

      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!doc) {
        window.print();
        return;
      }

      // Title for the browser's "Save as PDF" filename suggestion
      const reportTitle = `Noxphere_Financial_Report_${period.timeframe.toUpperCase()}_${format(new Date(period.startDate), "yyyyMMdd")}_to_${format(new Date(period.endDate), "yyyyMMdd")}`;
      doc.title = reportTitle;

      // Extract stylesheets from main page
      const styles = Array.from(document.querySelectorAll("link[rel='stylesheet'], style"))
        .map((node) => node.outerHTML)
        .join("\n");

      const printStyles = `
        <style>
          @page {
            size: A4 portrait;
            margin: 10mm 12mm;
          }
          html, body {
            background-color: #ffffff !important;
            color: #0f172a !important;
            margin: 0 !important;
            padding: 0 !important;
            font-family: 'Plus Jakarta Sans', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            width: 100% !important;
            min-height: 100% !important;
          }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            box-sizing: border-box !important;
          }
          #print-root {
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 auto !important;
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
          }
          table {
            width: 100% !important;
            border-collapse: collapse !important;
            page-break-inside: auto;
          }
          tr {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          thead {
            display: table-header-group !important;
          }
          tfoot {
            display: table-footer-group !important;
          }
          .report-section {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .print\\:hidden {
            display: none !important;
          }
        </style>
      `;

      // Clone content cleanly
      const clonedReport = printAreaRef.current.cloneNode(true) as HTMLElement;
      // Remove any internal style tags that had old @media print rules
      clonedReport.querySelectorAll("style").forEach((s) => s.remove());
      clonedReport.id = "print-root";
      clonedReport.style.border = "none";
      clonedReport.style.boxShadow = "none";
      clonedReport.style.padding = "0";

      doc.open();
      doc.write(`
        <!DOCTYPE html>
        <html lang="en">
          <head>
            <meta charset="utf-8" />
            <title>${reportTitle}</title>
            ${styles}
            ${printStyles}
          </head>
          <body class="bg-white text-slate-900 p-0 m-0">
            ${clonedReport.outerHTML}
          </body>
        </html>
      `);
      doc.close();

      toast("Opening print preview. Choose 'Save as PDF' to save your statement.", {
        icon: "🖨️",
        duration: 4000,
      });

      // Allow fonts and layout to settle in the iframe
      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch (e) {
          console.error("Iframe print error, falling back to window.print():", e);
          window.print();
        } finally {
          setTimeout(() => {
            if (document.body.contains(iframe)) {
              document.body.removeChild(iframe);
            }
          }, 3500);
        }
      }, 400);
    } catch (err) {
      console.error("Print statement error:", err);
      window.print();
    }
  };

  const handleDownloadPdf = async () => {
    if (!printAreaRef.current) return;
    setIsExportingPdf(true);
    const toastId = toast.loading("Generating High-Resolution PDF statement...");

    try {
      const element = printAreaRef.current;
      const originalBg = element.style.backgroundColor;
      element.style.backgroundColor = "#ffffff";

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
        windowWidth: 1200,
      });

      element.style.backgroundColor = originalBg;

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const contentWidth = pdfWidth - margin * 2;
      const contentHeight = (canvas.height * contentWidth) / canvas.width;

      let heightLeft = contentHeight;
      let position = margin;

      // First Page
      pdf.addImage(imgData, "PNG", margin, position, contentWidth, contentHeight, undefined, "FAST");
      heightLeft -= (pdfHeight - margin * 2);

      // Subsequent pages if statement spans across multiple pages
      while (heightLeft > 0) {
        position = position - (pdfHeight - margin * 2);
        pdf.addPage();
        pdf.addImage(imgData, "PNG", margin, position, contentWidth, contentHeight, undefined, "FAST");
        heightLeft -= (pdfHeight - margin * 2);
      }

      const fileName = `Noxphere_Financial_Report_${period.timeframe.toUpperCase()}_${format(new Date(), "yyyyMMdd_HHmm")}.pdf`;
      pdf.save(fileName);
      toast.success("PDF statement downloaded successfully!", { id: toastId });
    } catch (err) {
      console.error("PDF export failed:", err);
      toast.error("Failed to generate PDF. Use 'Print Statement' to save as PDF.", { id: toastId });
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleDownloadCsv = () => {
    try {
      const rows: string[][] = [];

      // Header
      rows.push(["NOXPHERE FINANCIAL & EXPENSE AUDIT REPORT"]);
      rows.push(["Academy:", academyName]);
      rows.push(["Branch:", franchiseName]);
      rows.push(["Timeframe:", period.timeframe.toUpperCase()]);
      rows.push(["Period Range:", `${format(new Date(period.startDate), "dd MMM yyyy")} to ${format(new Date(period.endDate), "dd MMM yyyy")}`]);
      rows.push(["Generated At:", format(new Date(), "dd MMM yyyy, hh:mm a")]);
      rows.push([]);

      // Financial Summary
      rows.push(["EXECUTIVE FINANCIAL SUMMARY"]);
      rows.push(["Metric", "Amount (INR)"]);
      rows.push(["Total Inflow (Revenue)", summary.totalInflow.toString()]);
      rows.push(["- Student Fees Collected", summary.feesInflow.toString()]);
      rows.push(["- Other Incomes", summary.otherInflow.toString()]);
      rows.push(["Total Outflow (Expenses)", summary.totalOutflow.toString()]);
      rows.push(["- Verified Purchases (Stocks In)", summary.purchasesOutflow.toString()]);
      rows.push(["- Miscellaneous Expenses", summary.miscOutflow.toString()]);
      rows.push(["- Staff Salaries Paid", summary.salariesOutflow.toString()]);
      rows.push(["Net Balance (Surplus / Deficit)", summary.netBalance.toString()]);
      rows.push(["Operating Profit Margin", `${summary.profitMargin}%`]);
      rows.push(["Total Inventory Valuation", summary.totalInventoryValue.toString()]);
      rows.push(["Low Stock Items Count", summary.lowStockCount.toString()]);
      rows.push(["Out of Stock Items Count", summary.outOfStockCount.toString()]);
      rows.push([]);

      // Category Breakdown
      rows.push(["EXPENSE CATEGORY BREAKDOWN"]);
      rows.push(["Category", "Amount (INR)", "Count", "Percentage"]);
      categoryBreakdown.forEach((c) => {
        rows.push([c.category, c.amount.toString(), c.count.toString(), `${c.percentage}%`]);
      });
      rows.push([]);

      // Itemized Expenses
      rows.push(["ITEMIZED EXPENSES (PURCHASES & MISCELLANEOUS)"]);
      rows.push(["Date", "Type", "Item / Title", "Category", "Quantity", "Unit", "Unit Price", "Total Amount (INR)", "Invoice / Payee", "Payment Method", "Invoice No", "Status"]);
      expenses.forEach((e) => {
        rows.push([
          format(new Date(e.date), "yyyy-MM-dd"),
          e.type.toUpperCase(),
          e.type === "purchase" ? (e.itemName || "") : (e.title || ""),
          e.category,
          (e.quantity || "").toString(),
          e.unit || "",
          (e.unitPrice || "").toString(),
          e.amount.toString(),
          (e.type === "purchase" ? e.invoiceNumber : e.vendor) || "",
          e.paymentMethod,
          e.invoiceNumber || "",
          e.type === "purchase" ? (e.verificationStatus || "pending") : "paid",
        ]);
      });
      rows.push([]);

      // Itemized Inflows
      rows.push(["ITEMIZED INFLOWS (STUDENT FEES & OTHER REVENUES)"]);
      rows.push(["Date", "Type", "Source / Student", "Branch", "Amount (INR)", "Payment Method", "Ref / Txn ID"]);
      feeInflows.forEach((f) => {
        rows.push([
          format(new Date(f.paidAt), "yyyy-MM-dd"),
          `Student Fee (#${f.installmentNumber})`,
          f.studentName,
          f.franchiseName || franchiseName,
          f.amount.toString(),
          f.paymentMethod || "",
          f.transactionId || "",
        ]);
      });
      otherInflows.forEach((inc) => {
        rows.push([
          format(new Date(inc.date), "yyyy-MM-dd"),
          inc.category,
          inc.source,
          (inc.franchiseId as any)?.name || franchiseName,
          inc.amount.toString(),
          inc.paymentMethod,
          inc.referenceNumber || "",
        ]);
      });
      rows.push([]);

      // Stock Inventory Snapshot
      rows.push(["CURRENT INVENTORY SNAPSHOT"]);
      rows.push(["Item Name", "SKU", "Category", "Current Stock", "Unit", "Unit Cost (INR)", "Total Valuation (INR)", "Status"]);
      stockSummary.forEach((s) => {
        rows.push([
          s.name,
          s.sku || "",
          s.category,
          s.quantity.toString(),
          s.unit,
          s.unitPrice.toString(),
          s.totalValue.toString(),
          s.status.toUpperCase(),
        ]);
      });

      const csvContent = "data:text/csv;charset=utf-8," + rows.map((e) => e.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `Noxphere_Financial_Report_${period.timeframe}_${format(new Date(), "yyyyMMdd_HHmm")}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("CSV financial report downloaded successfully!");
    } catch (err) {
      toast.error("Failed to generate CSV download");
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Advanced Financial & Expense Report" size="xl">
      <div className="space-y-4">
        {/* Action Header (Hidden during print) */}
        <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-100 dark:bg-pitch-900 border border-slate-200 dark:border-white/10 rounded-lg print:hidden">
          <div className="text-xs text-slate-600 dark:text-slate-400">
            Previewing complete audit statement for <span className="font-semibold text-slate-900 dark:text-white">{period.timeframe.toUpperCase()}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              onClick={handleDownloadCsv}
              className="text-xs py-1.5 px-3 flex items-center gap-1.5"
              title="Download CSV spreadsheet"
            >
              <Download size={14} /> Download CSV
            </Button>
            <Button
              variant="secondary"
              onClick={handleDownloadPdf}
              loading={isExportingPdf}
              className="text-xs py-1.5 px-3 flex items-center gap-1.5"
              title="Download PDF statement file directly"
            >
              <FileDown size={14} /> Download PDF
            </Button>
            <Button
              variant="primary"
              onClick={handlePrint}
              className="text-xs py-1.5 px-3 flex items-center gap-1.5 shadow-sm"
              title="Print statement or export as PDF via print preview"
            >
              <Printer size={14} /> Print Statement
            </Button>
          </div>
        </div>

        {/* Printable Area */}
        <div
          ref={printAreaRef}
          id="printable-report"
          className="bg-white text-slate-900 p-6 sm:p-8 rounded-lg shadow-sm border border-slate-200 font-sans text-xs space-y-6"
        >
          {/* Print Stylesheet (supports direct window.print fallback) */}
          <style>{`
            @media print {
              @page {
                size: A4 portrait;
                margin: 10mm 12mm;
              }
              html, body {
                background: #ffffff !important;
                color: #0f172a !important;
                overflow: visible !important;
                height: auto !important;
                min-height: auto !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              /* Prevent clipping from modal scroll ancestors */
              div:has(> #printable-report),
              .custom-scrollbar,
              .overflow-y-auto,
              .card,
              .shadow-panel {
                max-height: none !important;
                height: auto !important;
                overflow: visible !important;
              }
              #printable-report {
                position: static !important;
                width: 100% !important;
                border: none !important;
                box-shadow: none !important;
                padding: 0 !important;
              }
              .print\\:hidden {
                display: none !important;
              }
              .report-section {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
              }
              tr {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
              }
              thead {
                display: table-header-group !important;
              }
            }
          `}</style>

          {/* Letterhead */}
          <div className="flex items-start justify-between border-b-2 border-slate-900 pb-4">
            <div>
              <span className="text-2xl font-black tracking-tight text-slate-900 uppercase font-display">
                NOXPHERE
              </span>
              <p className="text-sm font-bold text-slate-800">{academyName}</p>
              <p className="text-xs text-slate-500">Branch: {franchiseName}</p>
            </div>
            <div className="text-right">
              <span className="inline-block bg-slate-900 text-white font-bold px-2.5 py-1 rounded text-[11px] uppercase tracking-wider">
                Financial Audit Report
              </span>
              <p className="text-xs text-slate-600 mt-1">
                Period: <span className="font-semibold text-slate-900 capitalize">{period.timeframe}</span>
              </p>
              <p className="text-[11px] text-slate-500">
                {format(new Date(period.startDate), "dd MMM yyyy")} – {format(new Date(period.endDate), "dd MMM yyyy")}
              </p>
            </div>
          </div>

          {/* Executive Summary Cards */}
          <div className="report-section">
            <h4 className="font-bold text-slate-900 uppercase tracking-wider mb-2 text-[11px]">
              1. Executive Cash Flow Summary
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded border border-slate-200 bg-slate-50">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Inflow (Revenue)</span>
                <span className="text-base font-extrabold text-emerald-700 tabular-nums">
                  {formatMoney(summary.totalInflow)}
                </span>
                <span className="block text-[10px] text-slate-500 mt-0.5">
                  Fees: {formatMoney(summary.feesInflow)}
                </span>
              </div>

              <div className="p-3 rounded border border-slate-200 bg-slate-50">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Outflow (Expenses)</span>
                <span className="text-base font-extrabold text-rose-700 tabular-nums">
                  {formatMoney(summary.totalOutflow)}
                </span>
                <span className="block text-[10px] text-slate-500 mt-0.5">
                  Purchases: {formatMoney(summary.purchasesOutflow)}
                </span>
              </div>

              <div className="p-3 rounded border border-slate-200 bg-slate-50">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Net Balance (Surplus / Deficit)</span>
                <span className={`text-base font-extrabold tabular-nums ${summary.netBalance >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                  {(summary.netBalance >= 0 ? "+" : "") + formatMoney(summary.netBalance)}
                </span>
                <span className="block text-[10px] text-slate-500 mt-0.5">
                  Margin: {summary.profitMargin}%
                </span>
              </div>

              <div className="p-3 rounded border border-slate-200 bg-slate-50">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Inventory Valuation</span>
                <span className="text-base font-extrabold text-sky-700 tabular-nums">
                  {formatMoney(summary.totalInventoryValue)}
                </span>
                <span className="block text-[10px] text-slate-500 mt-0.5">
                  Stockouts: {summary.outOfStockCount} | Low: {summary.lowStockCount}
                </span>
              </div>
            </div>
          </div>

          {/* Category Breakdown Table */}
          {categoryBreakdown.length > 0 && (
            <div className="report-section">
              <h4 className="font-bold text-slate-900 uppercase tracking-wider mb-2 text-[11px]">
                2. Expense Distribution by Category
              </h4>
              <table className="w-full border-collapse border border-slate-200 text-left">
                <thead>
                  <tr className="bg-slate-100 text-[11px] font-bold text-slate-700">
                    <th className="border border-slate-200 px-3 py-1.5">Category</th>
                    <th className="border border-slate-200 px-3 py-1.5 text-right">Transactions</th>
                    <th className="border border-slate-200 px-3 py-1.5 text-right">Total Amount ({currencySymbol})</th>
                    <th className="border border-slate-200 px-3 py-1.5 text-right">% of Total Expenses</th>
                  </tr>
                </thead>
                <tbody>
                  {categoryBreakdown.map((cat, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 text-[11px]">
                      <td className="border border-slate-200 px-3 py-1 font-medium">{cat.category}</td>
                      <td className="border border-slate-200 px-3 py-1 text-right tabular-nums">{cat.count}</td>
                      <td className="border border-slate-200 px-3 py-1 text-right font-semibold tabular-nums">
                        {formatMoney(cat.amount)}
                      </td>
                      <td className="border border-slate-200 px-3 py-1 text-right tabular-nums">{cat.percentage}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Itemized Expenses Table */}
          <div className="report-section">
            <h4 className="font-bold text-slate-900 uppercase tracking-wider mb-2 text-[11px]">
              3. Itemized Expenses ({expenses.length} Records)
            </h4>
            {expenses.length === 0 ? (
              <p className="text-slate-500 italic">No expense records found in this timeframe.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-slate-200 text-left text-[11px]">
                  <thead>
                    <tr className="bg-slate-100 font-bold text-slate-700">
                      <th className="border border-slate-200 px-2.5 py-1.5">Date</th>
                      <th className="border border-slate-200 px-2.5 py-1.5">Type</th>
                      <th className="border border-slate-200 px-2.5 py-1.5">Item / Title</th>
                      <th className="border border-slate-200 px-2.5 py-1.5">Category</th>
                      <th className="border border-slate-200 px-2.5 py-1.5 text-right">Qty / Unit</th>
                      <th className="border border-slate-200 px-2.5 py-1.5">Invoice / Payee</th>
                      <th className="border border-slate-200 px-2.5 py-1.5 text-right">Amount ({currencySymbol})</th>
                      <th className="border border-slate-200 px-2.5 py-1.5">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.map((e, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="border border-slate-200 px-2.5 py-1 tabular-nums">
                          {format(new Date(e.date), "dd/MM/yyyy")}
                        </td>
                        <td className="border border-slate-200 px-2.5 py-1 uppercase font-semibold text-[10px]">
                          {e.type === "purchase" ? (
                            <span className="text-sky-700">Purchase</span>
                          ) : (
                            <span className="text-slate-600">Misc</span>
                          )}
                        </td>
                        <td className="border border-slate-200 px-2.5 py-1 font-medium">
                          {e.type === "purchase" ? e.itemName : e.title}
                        </td>
                        <td className="border border-slate-200 px-2.5 py-1 text-slate-600">{e.category}</td>
                        <td className="border border-slate-200 px-2.5 py-1 text-right tabular-nums">
                          {e.quantity ? `${e.quantity} ${e.unit || ""}` : "—"}
                        </td>
                        <td className="border border-slate-200 px-2.5 py-1 text-slate-600">{e.type === "purchase" ? (e.invoiceNumber || "—") : (e.vendor || "—")}</td>
                        <td className="border border-slate-200 px-2.5 py-1 text-right font-bold tabular-nums">
                          {formatMoney(e.amount)}
                        </td>
                        <td className="border border-slate-200 px-2.5 py-1 text-[10px] capitalize">
                          {e.type === "purchase" ? (
                            <span
                              className={
                                e.verificationStatus === "verified"
                                  ? "text-emerald-700 font-bold"
                                  : e.verificationStatus === "rejected"
                                  ? "text-rose-700 font-bold"
                                  : "text-amber-700"
                              }
                            >
                              {e.verificationStatus}
                            </span>
                          ) : (
                            <span className="text-emerald-700 font-bold">Paid</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Itemized Inflow (Revenues) Table */}
          <div className="report-section">
            <h4 className="font-bold text-slate-900 uppercase tracking-wider mb-2 text-[11px]">
              4. Itemized Inflow Collections (Fees & Income)
            </h4>
            {feeInflows.length === 0 && otherInflows.length === 0 ? (
              <p className="text-slate-500 italic">No incoming funds recorded in this timeframe.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-slate-200 text-left text-[11px]">
                  <thead>
                    <tr className="bg-slate-100 font-bold text-slate-700">
                      <th className="border border-slate-200 px-2.5 py-1.5">Date</th>
                      <th className="border border-slate-200 px-2.5 py-1.5">Type</th>
                      <th className="border border-slate-200 px-2.5 py-1.5">Source / Student Name</th>
                      <th className="border border-slate-200 px-2.5 py-1.5">Payment Mode</th>
                      <th className="border border-slate-200 px-2.5 py-1.5">Ref / Txn ID</th>
                      <th className="border border-slate-200 px-2.5 py-1.5 text-right">Amount ({currencySymbol})</th>
                    </tr>
                  </thead>
                  <tbody>
                    {feeInflows.map((f, idx) => (
                      <tr key={`fee-${idx}`} className="hover:bg-slate-50">
                        <td className="border border-slate-200 px-2.5 py-1 tabular-nums">
                          {format(new Date(f.paidAt), "dd/MM/yyyy")}
                        </td>
                        <td className="border border-slate-200 px-2.5 py-1 text-emerald-700 font-semibold text-[10px]">
                          Student Fee Inst #{f.installmentNumber}
                        </td>
                        <td className="border border-slate-200 px-2.5 py-1 font-medium">{f.studentName}</td>
                        <td className="border border-slate-200 px-2.5 py-1 capitalize text-slate-600">
                          {f.paymentMethod}
                        </td>
                        <td className="border border-slate-200 px-2.5 py-1 font-mono text-[10px] text-slate-500">
                          {f.transactionId || "—"}
                        </td>
                        <td className="border border-slate-200 px-2.5 py-1 text-right font-bold text-emerald-700 tabular-nums">
                          {formatMoney(f.amount)}
                        </td>
                      </tr>
                    ))}
                    {otherInflows.map((inc, idx) => (
                      <tr key={`inc-${idx}`} className="hover:bg-slate-50">
                        <td className="border border-slate-200 px-2.5 py-1 tabular-nums">
                          {format(new Date(inc.date), "dd/MM/yyyy")}
                        </td>
                        <td className="border border-slate-200 px-2.5 py-1 text-sky-700 font-semibold text-[10px]">
                          {inc.category}
                        </td>
                        <td className="border border-slate-200 px-2.5 py-1 font-medium">{inc.source}</td>
                        <td className="border border-slate-200 px-2.5 py-1 capitalize text-slate-600">
                          {inc.paymentMethod}
                        </td>
                        <td className="border border-slate-200 px-2.5 py-1 font-mono text-[10px] text-slate-500">
                          {inc.referenceNumber || "—"}
                        </td>
                        <td className="border border-slate-200 px-2.5 py-1 text-right font-bold text-sky-700 tabular-nums">
                          {formatMoney(inc.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Current Inventory Snapshot */}
          {stockSummary.length > 0 && (
            <div className="report-section">
              <h4 className="font-bold text-slate-900 uppercase tracking-wider mb-2 text-[11px]">
                5. Current Stock Valuation Snapshot
              </h4>
              <table className="w-full border-collapse border border-slate-200 text-left text-[11px]">
                <thead>
                  <tr className="bg-slate-100 font-bold text-slate-700">
                    <th className="border border-slate-200 px-2.5 py-1.5">Stock Item Name</th>
                    <th className="border border-slate-200 px-2.5 py-1.5">Category</th>
                    <th className="border border-slate-200 px-2.5 py-1.5 text-right">Qty Available</th>
                    <th className="border border-slate-200 px-2.5 py-1.5 text-right">Unit Cost ({currencySymbol})</th>
                    <th className="border border-slate-200 px-2.5 py-1.5 text-right">Total Value ({currencySymbol})</th>
                    <th className="border border-slate-200 px-2.5 py-1.5">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {stockSummary.slice(0, 15).map((stk, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="border border-slate-200 px-2.5 py-1 font-medium">{stk.name}</td>
                      <td className="border border-slate-200 px-2.5 py-1 text-slate-600">{stk.category}</td>
                      <td className="border border-slate-200 px-2.5 py-1 text-right font-bold tabular-nums">
                        {stk.quantity} {stk.unit}
                      </td>
                      <td className="border border-slate-200 px-2.5 py-1 text-right tabular-nums">
                        {formatMoney(stk.unitPrice)}
                      </td>
                      <td className="border border-slate-200 px-2.5 py-1 text-right font-bold text-sky-700 tabular-nums">
                        {formatMoney(stk.totalValue)}
                      </td>
                      <td className="border border-slate-200 px-2.5 py-1 text-[10px] uppercase font-bold">
                        <span
                          className={
                            stk.status === "in_stock"
                              ? "text-emerald-700"
                              : stk.status === "low_stock"
                              ? "text-amber-700"
                              : "text-rose-700"
                          }
                        >
                          {stk.status.replace("_", " ")}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Authorization & Signatures */}
          <div className="report-section pt-8 border-t border-slate-300 grid grid-cols-2 gap-8 text-center text-[11px] text-slate-600">
            <div>
              <div className="border-b border-slate-400 w-48 mx-auto mb-1"></div>
              <p className="font-semibold text-slate-800">Prepared By: Finance / Inventory Officer</p>
              <p className="text-[10px] text-slate-500">Date: {format(new Date(), "dd MMM yyyy")}</p>
            </div>
            <div>
              <div className="border-b border-slate-400 w-48 mx-auto mb-1"></div>
              <p className="font-semibold text-slate-800">Authorized Signatory: Academy Director</p>
              <p className="text-[10px] text-slate-500">Stamp & Seal</p>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-white/5 print:hidden">
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
};
