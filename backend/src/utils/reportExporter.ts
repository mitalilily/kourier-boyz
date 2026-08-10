import ExcelJS from 'exceljs'
import PDFDocument from 'pdfkit'
import { uploadToR2 } from './r2Upload'

/**
 * Export settlement report to Excel
 */
export const exportSettlementReportToExcel = async (
  reportData: any[],
  summary: any,
  seller: any,
  filename: string = 'settlement-report',
): Promise<Buffer> => {
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet('Settlement Report')

  // Add seller info header
  if (seller) {
    worksheet.addRow(['Seller Information'])
    worksheet.addRow(['Business Name:', seller.businessName || seller.name || 'N/A'])
    worksheet.addRow(['GSTIN:', seller.gstNumber || 'N/A'])
    worksheet.addRow(['PAN:', seller.panNumber || 'N/A'])
    worksheet.addRow([])
  }

  // Add headers
  const headers = [
    'Order ID',
    'Order Number',
    'Invoice No',
    'Invoice Date',
    'Sales Amount',
    'GST Amount',
    'Total (Sales + GST)',
    'Commission',
    'Marketing Fees',
    'Courier Charges (Forward)',
    'Courier Charges (Return)',
    'COD Fees (Forward)',
    'COD Fees (Reverse)',
    'Other Charges',
    'TDS Amount',
    'TCS Amount',
    'Net Settlement Payable',
  ]

  worksheet.addRow(headers)

  // Style header row
  const headerRow = worksheet.getRow(worksheet.rowCount)
  headerRow.font = { bold: true }
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' },
  }

  // Add data rows
  reportData.forEach((row) => {
    worksheet.addRow([
      row.orderId || '',
      row.orderNumber || '',
      row.invoiceNumber || '',
      row.invoiceDate ? new Date(row.invoiceDate).toLocaleDateString('en-IN') : '',
      row.salesAmount || 0,
      row.gstAmount || 0,
      row.total || 0,
      row.commission || 0,
      row.marketingFees || 0,
      row.courierChargesForward || 0,
      row.courierChargesReturn || 0,
      row.codFeesForward || 0,
      row.codFeesReverse || 0,
      row.otherCharges || 0,
      row.tdsAmount || 0,
      row.tcsAmount || 0,
      row.netSettlementPayable || 0,
    ])
  })

  // Add summary row
  worksheet.addRow([])
  worksheet.addRow(['Summary'])
  worksheet.addRow(['Total Orders:', summary.totalOrders || 0])
  worksheet.addRow(['Total Returns:', summary.totalReturns || 0])
  worksheet.addRow(['Total Sales Amount:', summary.totalSalesAmount || 0])
  worksheet.addRow(['Total GST Amount:', summary.totalGstAmount || 0])
  worksheet.addRow(['Total Amount:', summary.totalAmount || 0])
  worksheet.addRow(['Total Commission:', summary.totalCommission || 0])
  worksheet.addRow(['Total TDS Amount:', summary.totalTdsAmount || 0])
  worksheet.addRow(['Total TCS Amount:', summary.totalTcsAmount || 0])
  worksheet.addRow(['Total Net Settlement:', summary.totalNetSettlementPayable || 0])

  // Auto-fit columns
  worksheet.columns.forEach((column) => {
    if (column.header) {
      column.width = 20
    }
  })

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}

/**
 * Export TDS report to Excel
 */
export const exportTdsReportToExcel = async (
  reportData: any[],
  summary: any,
  seller: any,
  filename: string = 'tds-report',
): Promise<Buffer> => {
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet('TDS Report (Section 194O)')

  // Add seller info header
  if (seller) {
    worksheet.addRow(['Seller Information'])
    worksheet.addRow(['Business Name:', seller.businessName || seller.name || 'N/A'])
    worksheet.addRow(['GSTIN:', seller.gstNumber || 'N/A'])
    worksheet.addRow(['PAN:', seller.panNumber || 'N/A'])
    worksheet.addRow([])
  }

  // Add headers
  const headers = [
    'Settlement Batch ID',
    'From Date',
    'To Date',
    'Payout Date',
    'Seller Trade Name',
    'Seller GSTIN',
    'Seller PAN',
    'Total Sales (including GST)',
    'TDS Amount',
    'TDS Rate (%)',
    'Exempted',
    'Exemption Reason',
  ]

  worksheet.addRow(headers)

  // Style header row
  const headerRow = worksheet.getRow(worksheet.rowCount)
  headerRow.font = { bold: true }
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' },
  }

  // Add data rows
  reportData.forEach((row) => {
    worksheet.addRow([
      row.settlementBatchId || '',
      row.fromDate ? new Date(row.fromDate).toLocaleDateString('en-IN') : '',
      row.toDate ? new Date(row.toDate).toLocaleDateString('en-IN') : '',
      row.payoutDate ? new Date(row.payoutDate).toLocaleDateString('en-IN') : '',
      row.sellerTradeName || '',
      row.sellerGstin || '',
      row.sellerPan || '',
      row.totalSalesInclGst || 0,
      row.tdsAmount || 0,
      row.tdsRate || 0,
      row.tdsExempted ? 'Yes' : 'No',
      row.tdsExemptionReason || '',
    ])
  })

  // Add summary row
  worksheet.addRow([])
  worksheet.addRow(['Summary'])
  worksheet.addRow(['Total Batches:', summary.totalBatches || 0])
  worksheet.addRow(['Total Sales (including GST):', summary.totalSalesInclGst || 0])
  worksheet.addRow(['Total TDS Amount:', summary.totalTdsAmount || 0])
  worksheet.addRow(['Exempted Batches:', summary.exemptedBatches || 0])
  worksheet.addRow(['Pending Reversals:', summary.pendingReversals || 0])

  // Auto-fit columns
  worksheet.columns.forEach((column) => {
    if (column.header) {
      column.width = 20
    }
  })

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}

/**
 * Export TCS report to Excel
 */
export const exportTcsReportToExcel = async (
  reportData: any[],
  summary: any,
  seller: any,
  filename: string = 'tcs-report',
): Promise<Buffer> => {
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet('TCS Report (GST)')

  // Add seller info header
  if (seller) {
    worksheet.addRow(['Seller Information'])
    worksheet.addRow(['Business Name:', seller.businessName || seller.name || 'N/A'])
    worksheet.addRow(['GSTIN:', seller.gstNumber || 'N/A'])
    worksheet.addRow(['State:', seller.state || 'N/A'])
    worksheet.addRow([])
  }

  // Add headers
  const headers = [
    'Settlement Batch ID',
    'From Date',
    'To Date',
    'Payout Date',
    'Seller State',
    'Seller GSTIN',
    'Customer Type',
    'Sales Amount (excluding GST)',
    'IGST TCS',
    'CGST TCS',
    'SGST TCS',
    'Total TCS Amount',
  ]

  worksheet.addRow(headers)

  // Style header row
  const headerRow = worksheet.getRow(worksheet.rowCount)
  headerRow.font = { bold: true }
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' },
  }

  // Add data rows - expand breakdown by customer type
  reportData.forEach((row) => {
    // Registered customers row
    if (row.breakdown?.registeredCustomers?.salesAmount > 0) {
      worksheet.addRow([
        row.settlementBatchId || '',
        row.fromDate ? new Date(row.fromDate).toLocaleDateString('en-IN') : '',
        row.toDate ? new Date(row.toDate).toLocaleDateString('en-IN') : '',
        row.payoutDate ? new Date(row.payoutDate).toLocaleDateString('en-IN') : '',
        row.sellerState || '',
        row.sellerGstin || '',
        'Registered',
        row.breakdown.registeredCustomers.salesAmount || 0,
        row.tcsIgstAmount || 0,
        row.tcsCgstAmount || 0,
        row.tcsSgstAmount || 0,
        row.breakdown.registeredCustomers.tcsAmount || 0,
      ])
    }

    // Unregistered customers row
    if (row.breakdown?.unregisteredCustomers?.salesAmount > 0) {
      worksheet.addRow([
        row.settlementBatchId || '',
        row.fromDate ? new Date(row.fromDate).toLocaleDateString('en-IN') : '',
        row.toDate ? new Date(row.toDate).toLocaleDateString('en-IN') : '',
        row.payoutDate ? new Date(row.payoutDate).toLocaleDateString('en-IN') : '',
        row.sellerState || '',
        row.sellerGstin || '',
        'Unregistered',
        row.breakdown.unregisteredCustomers.salesAmount || 0,
        row.tcsIgstAmount || 0,
        row.tcsCgstAmount || 0,
        row.tcsSgstAmount || 0,
        row.breakdown.unregisteredCustomers.tcsAmount || 0,
      ])
    }

    // If no breakdown, show total
    if (
      (!row.breakdown?.registeredCustomers?.salesAmount ||
        row.breakdown.registeredCustomers.salesAmount === 0) &&
      (!row.breakdown?.unregisteredCustomers?.salesAmount ||
        row.breakdown.unregisteredCustomers.salesAmount === 0)
    ) {
      worksheet.addRow([
        row.settlementBatchId || '',
        row.fromDate ? new Date(row.fromDate).toLocaleDateString('en-IN') : '',
        row.toDate ? new Date(row.toDate).toLocaleDateString('en-IN') : '',
        row.payoutDate ? new Date(row.payoutDate).toLocaleDateString('en-IN') : '',
        row.sellerState || '',
        row.sellerGstin || '',
        'All',
        row.salesAmountExclGst || 0,
        row.tcsIgstAmount || 0,
        row.tcsCgstAmount || 0,
        row.tcsSgstAmount || 0,
        row.totalTcsAmount || 0,
      ])
    }
  })

  // Add summary row
  worksheet.addRow([])
  worksheet.addRow(['Summary'])
  worksheet.addRow(['Total Batches:', summary.totalBatches || 0])
  worksheet.addRow(['Total Sales (excluding GST):', summary.totalSalesExclGst || 0])
  worksheet.addRow(['Total TCS Amount:', summary.totalTcsAmount || 0])
  worksheet.addRow(['Total IGST TCS:', summary.totalTcsIgst || 0])
  worksheet.addRow(['Total CGST TCS:', summary.totalTcsCgst || 0])
  worksheet.addRow(['Total SGST TCS:', summary.totalTcsSgst || 0])
  worksheet.addRow(['Inter-state Sales:', summary.interStateSales || 0])
  worksheet.addRow(['Intra-state Sales:', summary.intraStateSales || 0])
  worksheet.addRow(['Registered Customer Sales:', summary.registeredCustomerSales || 0])
  worksheet.addRow(['Unregistered Customer Sales:', summary.unregisteredCustomerSales || 0])

  // Auto-fit columns
  worksheet.columns.forEach((column) => {
    if (column.header) {
      column.width = 20
    }
  })

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}

/**
 * Export report to PDF (formatted version)
 */
export const exportReportToPDF = async (
  reportData: any[],
  summary: any,
  seller: any,
  reportType: 'settlement' | 'tds' | 'tcs',
  filename: string = 'report',
): Promise<Buffer> => {
  const doc = new PDFDocument({
    size: 'A4',
    margins: {
      top: 72,
      bottom: 72,
      left: 72,
      right: 72,
    },
  })

  const chunks: Buffer[] = []
  const pdfPromise = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    doc.once('end', () => {
      const buffer = Buffer.concat(chunks)
      resolve(buffer)
    })
    doc.once('error', reject)
  })

  const formatCurrency = (value: number | null | undefined): string => {
    if (value === null || value === undefined) return '₹0.00'
    return `₹${Number(value).toFixed(2)}`
  }

  const formatDate = (date: string | Date | null | undefined): string => {
    if (!date) return 'N/A'
    return new Date(date).toLocaleDateString('en-IN')
  }

  // Header
  doc.fontSize(20).font('Helvetica-Bold').text(`${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Report`, { align: 'center' })
  doc.fontSize(10).font('Helvetica').text(`Generated: ${new Date().toLocaleDateString('en-IN')}`, { align: 'center' })
  doc.moveDown(2)

  // Seller info
  if (seller) {
    doc.fontSize(12).font('Helvetica-Bold').text('Seller Information:')
    doc.fontSize(10).font('Helvetica')
    doc.text(`Business Name: ${seller.businessName || seller.name || 'N/A'}`)
    doc.text(`GSTIN: ${seller.gstNumber || 'N/A'}`)
    if (seller.panNumber) doc.text(`PAN: ${seller.panNumber}`)
    if (seller.state) doc.text(`State: ${seller.state}`)
    doc.moveDown(1.5)
  }

  // Summary
  doc.fontSize(12).font('Helvetica-Bold').text('Summary:')
  doc.fontSize(10).font('Helvetica')
  
  if (reportType === 'settlement') {
    doc.text(`Total Orders: ${summary.totalOrders || 0}`)
    doc.text(`Total Returns: ${summary.totalReturns || 0}`)
    doc.text(`Total Sales Amount: ${formatCurrency(summary.totalSalesAmount)}`)
    doc.text(`Total GST Amount: ${formatCurrency(summary.totalGstAmount)}`)
    doc.text(`Total Amount: ${formatCurrency(summary.totalAmount)}`)
    doc.text(`Total Commission: ${formatCurrency(summary.totalCommission)}`)
    doc.text(`Total TDS Amount: ${formatCurrency(summary.totalTdsAmount)}`)
    doc.text(`Total TCS Amount: ${formatCurrency(summary.totalTcsAmount)}`)
    doc.text(`Total Net Settlement Payable: ${formatCurrency(summary.totalNetSettlementPayable)}`)
  } else if (reportType === 'tds') {
    doc.text(`Total Batches: ${summary.totalBatches || 0}`)
    doc.text(`Total Sales (including GST): ${formatCurrency(summary.totalSalesInclGst)}`)
    doc.text(`Total TDS Amount: ${formatCurrency(summary.totalTdsAmount)}`)
    doc.text(`Exempted Batches: ${summary.exemptedBatches || 0}`)
    if (summary.pendingReversals) {
      doc.text(`Pending Reversals: ${summary.pendingReversals}`)
    }
  } else if (reportType === 'tcs') {
    doc.text(`Total Batches: ${summary.totalBatches || 0}`)
    doc.text(`Total Sales (excluding GST): ${formatCurrency(summary.totalSalesExclGst)}`)
    doc.text(`Total TCS Amount: ${formatCurrency(summary.totalTcsAmount)}`)
    doc.text(`Total IGST TCS: ${formatCurrency(summary.totalTcsIgst)}`)
    doc.text(`Total CGST TCS: ${formatCurrency(summary.totalTcsCgst)}`)
    doc.text(`Total SGST TCS: ${formatCurrency(summary.totalTcsSgst)}`)
  }
  
  doc.moveDown(1.5)

  // Report data table
  if (reportData.length > 0) {
    doc.fontSize(12).font('Helvetica-Bold').text('Report Data:')
    doc.moveDown(0.5)
    doc.fontSize(8).font('Helvetica')
    
    const startY = doc.y
    const pageWidth = doc.page.width - 144 // margins
    const colWidth = pageWidth / 6
    let currentY = startY
    const rowHeight = 15
    const maxRowsPerPage = 35
    let rowIndex = 0

    // Table headers
    if (reportType === 'settlement') {
      const headers = ['Order #', 'Invoice', 'Date', 'Sales', 'Commission', 'Net Payable']
      let x = 72
      doc.fontSize(8).font('Helvetica-Bold')
      headers.forEach((header, i) => {
        doc.text(header, x, currentY, { width: colWidth, align: 'left' })
        x += colWidth
      })
      currentY += rowHeight
      doc.fontSize(7).font('Helvetica')
      
      reportData.slice(0, 100).forEach((row, index) => {
        if (index > 0 && index % maxRowsPerPage === 0) {
          doc.addPage()
          currentY = 72
        }
        
        x = 72
        const orderNum = (row.orderNumber || '').substring(0, 12)
        const invoice = (row.invoiceNumber || '-').substring(0, 10)
        const date = formatDate(row.invoiceDate).substring(0, 10)
        const sales = formatCurrency(row.salesAmount)
        const commission = formatCurrency(row.commission)
        const net = formatCurrency(row.netSettlementPayable)
        
        doc.text(orderNum, x, currentY, { width: colWidth })
        x += colWidth
        doc.text(invoice, x, currentY, { width: colWidth })
        x += colWidth
        doc.text(date, x, currentY, { width: colWidth })
        x += colWidth
        doc.text(sales, x, currentY, { width: colWidth, align: 'right' })
        x += colWidth
        doc.text(commission, x, currentY, { width: colWidth, align: 'right' })
        x += colWidth
        doc.text(net, x, currentY, { width: colWidth, align: 'right' })
        
        currentY += rowHeight
      })
    } else if (reportType === 'tds') {
      const headers = ['Batch ID', 'From Date', 'To Date', 'Sales', 'TDS Amount']
      let x = 72
      doc.fontSize(8).font('Helvetica-Bold')
      headers.forEach((header) => {
        doc.text(header, x, currentY, { width: colWidth, align: 'left' })
        x += colWidth
      })
      currentY += rowHeight
      doc.fontSize(7).font('Helvetica')
      
      reportData.slice(0, 100).forEach((row, index) => {
        if (index > 0 && index % maxRowsPerPage === 0) {
          doc.addPage()
          currentY = 72
        }
        
        x = 72
        const batchId = row.settlementBatchId ? String(row.settlementBatchId).slice(-8) : '-'
        const fromDate = formatDate(row.fromDate)
        const toDate = formatDate(row.toDate)
        const sales = formatCurrency(row.totalSalesInclGst)
        const tds = formatCurrency(row.tdsAmount)
        
        doc.text(batchId, x, currentY, { width: colWidth })
        x += colWidth
        doc.text(fromDate, x, currentY, { width: colWidth })
        x += colWidth
        doc.text(toDate, x, currentY, { width: colWidth })
        x += colWidth
        doc.text(sales, x, currentY, { width: colWidth, align: 'right' })
        x += colWidth
        doc.text(tds, x, currentY, { width: colWidth, align: 'right' })
        
        currentY += rowHeight
      })
    } else if (reportType === 'tcs') {
      const headers = ['Batch ID', 'From Date', 'To Date', 'Customer Type', 'Sales', 'TCS']
      let x = 72
      doc.fontSize(8).font('Helvetica-Bold')
      headers.forEach((header) => {
        doc.text(header, x, currentY, { width: colWidth, align: 'left' })
        x += colWidth
      })
      currentY += rowHeight
      doc.fontSize(7).font('Helvetica')
      
      reportData.slice(0, 100).forEach((row, index) => {
        if (index > 0 && index % maxRowsPerPage === 0) {
          doc.addPage()
          currentY = 72
        }
        
        x = 72
        const batchId = row.settlementBatchId ? String(row.settlementBatchId).slice(-8) : '-'
        const fromDate = formatDate(row.fromDate)
        const toDate = formatDate(row.toDate)
        const customerType = row.customerType || 'All'
        const sales = formatCurrency(row.salesAmountExclGst)
        const tcs = formatCurrency(row.totalTcsAmount)
        
        doc.text(batchId, x, currentY, { width: colWidth })
        x += colWidth
        doc.text(fromDate, x, currentY, { width: colWidth })
        x += colWidth
        doc.text(toDate, x, currentY, { width: colWidth })
        x += colWidth
        doc.text(customerType, x, currentY, { width: colWidth })
        x += colWidth
        doc.text(sales, x, currentY, { width: colWidth, align: 'right' })
        x += colWidth
        doc.text(tcs, x, currentY, { width: colWidth, align: 'right' })
        
        currentY += rowHeight
      })
    }

    if (reportData.length > 100) {
      doc.moveDown(1)
      doc.fontSize(9).font('Helvetica').text(`... and ${reportData.length - 100} more rows (see Excel export for complete data)`)
    }
  } else {
    doc.fontSize(10).font('Helvetica').text('No data available for the selected filters.')
  }

  doc.end()

  return pdfPromise
}

/**
 * Export Settlement Due Report to Excel (Admin Only)
 */
export const exportSettlementDueReportToExcel = async (
  reportData: any[],
  summary: any,
  filename: string = 'settlement-due-report',
): Promise<Buffer> => {
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet('Settlement Due Report')

  // Add title
  worksheet.addRow(['Settlement Due Report (Pending Settlements)'])
  worksheet.addRow(['Generated:', new Date().toLocaleDateString('en-IN')])
  worksheet.addRow([])

  // Add headers
  const headers = [
    'Seller Name',
    'Seller GSTIN',
    'Seller PAN',
    'Seller State',
    'Total Batches',
    'Total Net Payout',
    'Total Sale Amount',
    'Total Commission',
    'Total TDS',
    'Total TCS',
    'Total Other Charges',
    'Earliest Due Date',
  ]

  worksheet.addRow(headers)

  // Style header row
  const headerRow = worksheet.getRow(worksheet.rowCount)
  headerRow.font = { bold: true }
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' },
  }

  // Add data rows
  reportData.forEach((row) => {
    worksheet.addRow([
      row.sellerName || '',
      row.sellerGstin || '',
      row.sellerPan || '',
      row.sellerState || '',
      row.totalBatches || 0,
      row.totalNetPayout || 0,
      row.totalSaleAmount || 0,
      row.totalCommissionAmount || 0,
      row.totalTdsAmount || 0,
      row.totalTcsAmount || 0,
      row.totalOtherCharges || 0,
      row.earliestDueDate ? new Date(row.earliestDueDate).toLocaleDateString('en-IN') : 'N/A',
    ])
  })

  // Add summary row
  worksheet.addRow([])
  worksheet.addRow(['Summary'])
  worksheet.addRow(['Total Sellers:', summary.totalSellers || 0])
  worksheet.addRow(['Total Batches:', summary.totalBatches || 0])
  worksheet.addRow(['Total Net Payout:', summary.totalNetPayout || 0])
  worksheet.addRow(['Total Sale Amount:', summary.totalSaleAmount || 0])
  worksheet.addRow(['Total Commission:', summary.totalCommissionAmount || 0])
  worksheet.addRow(['Total TDS:', summary.totalTdsAmount || 0])
  worksheet.addRow(['Total TCS:', summary.totalTcsAmount || 0])

  // Auto-fit columns
  worksheet.columns.forEach((column) => {
    if (column.header) {
      column.width = 20
    }
  })

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}

/**
 * Export Settlement Due Report to PDF (Admin Only)
 */
export const exportSettlementDueReportToPDF = async (
  reportData: any[],
  summary: any,
  filename: string = 'settlement-due-report',
): Promise<Buffer> => {
  const doc = new PDFDocument({
    size: 'A4',
    margins: {
      top: 72,
      bottom: 72,
      left: 72,
      right: 72,
    },
  })

  const chunks: Buffer[] = []
  const pdfPromise = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    doc.once('end', () => {
      const buffer = Buffer.concat(chunks)
      resolve(buffer)
    })
    doc.once('error', reject)
  })

  // Header
  doc.fontSize(18).font('Helvetica-Bold').text('Settlement Due Report', { align: 'center' })
  doc.fontSize(10).font('Helvetica').text(`Generated: ${new Date().toLocaleDateString('en-IN')}`, {
    align: 'center',
  })
  doc.moveDown(2)

  // Summary
  doc.fontSize(12).font('Helvetica-Bold').text('Summary:')
  doc.fontSize(10).font('Helvetica')
  doc.text(`Total Sellers: ${summary.totalSellers || 0}`)
  doc.text(`Total Batches: ${summary.totalBatches || 0}`)
  doc.text(`Total Net Payout: ₹${(summary.totalNetPayout || 0).toFixed(2)}`)
  doc.text(`Total Sale Amount: ₹${(summary.totalSaleAmount || 0).toFixed(2)}`)
  doc.text(`Total Commission: ₹${(summary.totalCommissionAmount || 0).toFixed(2)}`)
  doc.text(`Total TDS: ₹${(summary.totalTdsAmount || 0).toFixed(2)}`)
  doc.text(`Total TCS: ₹${(summary.totalTcsAmount || 0).toFixed(2)}`)
  doc.moveDown(2)

  // Report data
  doc.fontSize(12).font('Helvetica-Bold').text('Sellers with Pending Settlements:')
  doc.fontSize(9).font('Helvetica')

  const maxRows = 30
  const rowsToShow = reportData.slice(0, maxRows)

  rowsToShow.forEach((row, index) => {
    if (index > 0 && index % 15 === 0) {
      doc.addPage()
    }
    const dueDate = row.earliestDueDate
      ? new Date(row.earliestDueDate).toLocaleDateString('en-IN')
      : 'N/A'
    doc.text(
      `${index + 1}. ${row.sellerName || 'N/A'} - ${row.totalBatches || 0} batch(es) - ₹${(row.totalNetPayout || 0).toFixed(2)} - Due: ${dueDate}`,
    )
  })

  if (reportData.length > maxRows) {
    doc.moveDown(1)
    doc.text(`... and ${reportData.length - maxRows} more sellers (see Excel export for full data)`)
  }

  doc.end()

  return pdfPromise
}

