import * as cheerio from 'cheerio'
import PDFDocument from 'pdfkit'
import { uploadToR2 } from './r2Upload'

/**
 * Generate PDF from HTML content and upload to R2
 * @param htmlContent - The HTML content to convert to PDF
 * @param title - The title of the agreement/document
 * @param agreementType - The type of agreement (for filename)
 * @param version - The version number (for filename)
 * @returns The public URL of the uploaded PDF
 */
export const generatePDFFromHTML = async (
  htmlContent: string,
  title: string,
  agreementType: string,
  version: number,
  sellerInfo?: {
    name?: string
    email?: string
    businessName?: string
    acceptedAt?: Date
    signatureUrl?: string
    declarationText?: string
  },
): Promise<string> => {
  try {
    // Create a new PDF document
    const doc = new PDFDocument({
      size: 'A4',
      margins: {
        top: 72, // 1 inch = 72 points
        bottom: 72,
        left: 72,
        right: 72,
      },
      info: {
        Title: title,
        Author: 'Kourier Boyz Marketplace',
        Subject: `${agreementType} - Version ${version}`,
      },
    })

    // Buffer to store PDF
    const chunks: Buffer[] = []
    let pdfGenerated = false

    // Create promise to wait for PDF generation - MUST be set up BEFORE any doc operations
    const pdfPromise = new Promise<Buffer>((resolve, reject) => {
      doc.on('data', (chunk: Buffer) => {
        chunks.push(chunk)
      })

      doc.once('end', () => {
        pdfGenerated = true
        const buffer = Buffer.concat(chunks)
        console.log(`PDF buffer created, size: ${buffer.length} bytes`)
        resolve(buffer)
      })

      doc.once('error', (err) => {
        console.error('PDF document error:', err)
        reject(err)
      })
    })

    // Header section
    doc.fontSize(18).font('Helvetica-Bold').text(title, { align: 'center' })
    doc.moveDown(0.5)

    const docType = agreementType.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())

    doc
      .fontSize(10)
      .font('Helvetica')
      .fillColor('#666666')
      .text(`Version ${version} | Document Type: ${docType}`, { align: 'center' })
    doc.moveDown(1)
    doc.fillColor('#000000')

    // Add horizontal line
    doc.moveTo(72, doc.y).lineTo(522, doc.y).stroke()
    doc.moveDown(1.5)

    // Add seller information if provided (for personalized PDFs)
    if (sellerInfo) {
      doc.fontSize(12).font('Helvetica-Bold').text('Seller Information:', { underline: true })
      doc.moveDown(0.3)
      doc.fontSize(10).font('Helvetica')
      if (sellerInfo.name) doc.text(`Name: ${sellerInfo.name}`)
      if (sellerInfo.email) doc.text(`Email: ${sellerInfo.email}`)
      if (sellerInfo.businessName) doc.text(`Business Name: ${sellerInfo.businessName}`)
      if (sellerInfo.acceptedAt) {
        const dateStr = sellerInfo.acceptedAt.toLocaleString('en-US', {
          dateStyle: 'full',
          timeStyle: 'medium',
        })
        doc.text(`Accepted On: ${dateStr}`)
      }
      if (sellerInfo.declarationText) {
        doc.moveDown(0.3)
        doc.font('Helvetica-Bold').text('Declaration:', { underline: true })
        doc.font('Helvetica').text(sellerInfo.declarationText, { align: 'left' })
      }
      doc.moveDown(1)
      doc.moveTo(72, doc.y).lineTo(522, doc.y).stroke()
      doc.moveDown(1)
    }

    // Parse HTML content
    let contentToProcess: cheerio.Cheerio<any>

    try {
      // Clean and prepare HTML content
      let cleanHtml = htmlContent.trim()
      
      // If content doesn't have HTML structure, wrap it in a div
      if (!cleanHtml.includes('<') && !cleanHtml.includes('>')) {
        // Plain text - wrap in paragraph
        cleanHtml = `<p>${cleanHtml}</p>`
      } else if (!cleanHtml.includes('<body') && !cleanHtml.includes('<html')) {
        // Has HTML tags but no body/html wrapper
        cleanHtml = `<body>${cleanHtml}</body>`
      }

      // Ensure we have a proper HTML structure with body
      if (!cleanHtml.includes('<body')) {
        cleanHtml = `<body>${cleanHtml}</body>`
      }

      let $ = cheerio.load(cleanHtml, null, false)

      // Get body content
      contentToProcess = $('body')
      
      // If still no body found, create one with the root content
      if (contentToProcess.length === 0) {
        const rootHtml = $.root().html() || htmlContent
        cleanHtml = `<body>${rootHtml}</body>`
        $ = cheerio.load(cleanHtml, null, false)
        contentToProcess = $('body')
      }

      console.log(`Processing HTML content for PDF. Content length: ${htmlContent.length}`)
      console.log(`HTML preview: ${cleanHtml.substring(0, 200)}...`)
      
      // Check if we have any actual content
      const textPreview = contentToProcess.text().trim()
      console.log(`Text preview (first 200 chars): ${textPreview.substring(0, 200)}...`)
      console.log(`Total text length: ${textPreview.length}`)

      if (textPreview.length === 0) {
        throw new Error('No text content found in HTML')
      }

      // Process content elements
      processElement($, contentToProcess, doc)
    } catch (htmlError) {
      console.error('Error processing HTML content:', htmlError)
      // Fallback: extract and add plain text content
      try {
        const $fallback = cheerio.load(htmlContent)
        const textContent = $fallback.text().trim()
        if (textContent) {
          console.log('Using fallback text extraction')
          doc.fontSize(12).font('Helvetica').text(textContent)
        } else {
          console.warn('No text content found in HTML')
          doc.fontSize(12).font('Helvetica').text('No content available')
        }
      } catch (fallbackError) {
        console.error('Fallback text extraction also failed:', fallbackError)
        doc.fontSize(12).font('Helvetica').text('Error processing content')
      }
    }

    // Finalize PDF - this triggers the 'end' event
    doc.end()

    // Wait for PDF to be generated
    console.log('Waiting for PDF generation to complete...')
    const pdfBuffer = await pdfPromise
    console.log(`PDF generated successfully, buffer size: ${pdfBuffer.length} bytes`)

    // Upload PDF to R2
    const fileName = `agreements/${agreementType}/v${version}-${Date.now()}.pdf`
    console.log(`Uploading PDF to R2: ${fileName}`)
    const pdfUrl = await uploadToR2(pdfBuffer, fileName, 'application/pdf', 'agreements')
    console.log(`PDF uploaded successfully to: ${pdfUrl}`)

    return pdfUrl
  } catch (error) {
    console.error('Error generating PDF:', error)
    throw error
  }
}

/**
 * Recursively process HTML elements and convert to PDF
 */
const processElement = (
  $: cheerio.CheerioAPI,
  element: cheerio.Cheerio<any>,
  doc: InstanceType<typeof PDFDocument>,
): void => {
  element.contents().each((_, node) => {
    if (node.type === 'text') {
      // Text node
      const text = $(node).text().trim()
      if (text) {
        // Check if we're inside bold/strong tags
        const parent = $(node).parent()
        const isBold = parent.is('strong, b') || parent.closest('strong, b').length > 0
        const isItalic = parent.is('em, i') || parent.closest('em, i').length > 0

        // Set font based on formatting
        if (isItalic && isBold) {
          doc.font('Helvetica-BoldOblique')
        } else if (isBold) {
          doc.font('Helvetica-Bold')
        } else if (isItalic) {
          doc.font('Helvetica-Oblique')
        } else {
          doc.font('Helvetica')
        }

        // Add text - don't use continued for text nodes as they should flow naturally
        // The parent element (p, div, etc.) will handle spacing
        doc.text(text)

        // Reset to default font
        doc.font('Helvetica').fontSize(12)
      }
    } else if (node.type === 'tag') {
      const tagName = node.tagName.toLowerCase()
      const $node = $(node)

      switch (tagName) {
        case 'h1':
          doc.moveDown(1)
          doc.fontSize(24).font('Helvetica-Bold').text($node.text().trim())
          doc.moveDown(0.5)
          doc.fontSize(12).font('Helvetica')
          break

        case 'h2':
          doc.moveDown(1)
          doc.fontSize(20).font('Helvetica-Bold').text($node.text().trim())
          doc.moveDown(0.5)
          doc.fontSize(12).font('Helvetica')
          break

        case 'h3':
          doc.moveDown(0.8)
          doc.fontSize(16).font('Helvetica-Bold').text($node.text().trim())
          doc.moveDown(0.4)
          doc.fontSize(12).font('Helvetica')
          break

        case 'h4':
        case 'h5':
        case 'h6':
          doc.moveDown(0.6)
          doc.fontSize(14).font('Helvetica-Bold').text($node.text().trim())
          doc.moveDown(0.3)
          doc.fontSize(12).font('Helvetica')
          break

        case 'p':
        case 'div':
          doc.moveDown(0.5)
          doc.fontSize(12).font('Helvetica')
          processElement($, $node, doc)
          doc.moveDown(0.3)
          break

        case 'br':
          doc.moveDown(0.3)
          break

        case 'strong':
        case 'b':
          doc.font('Helvetica-Bold')
          processElement($, $node, doc)
          doc.font('Helvetica')
          break

        case 'em':
        case 'i':
          doc.font('Helvetica-Oblique')
          processElement($, $node, doc)
          doc.font('Helvetica')
          break

        case 'ul':
        case 'ol':
          doc.moveDown(0.3)
          $node.children('li').each((_, liNode) => {
            const $li = $(liNode)
            const text = $li.clone().children().remove().end().text().trim() || $li.text().trim()

            doc.fontSize(12)
            doc.text(`• ${text}`, {
              indent: 20,
              lineGap: 3,
            })

            // Process nested content
            if ($li.children().length > 0) {
              $li.children().each((_, child) => {
                if ($(child).is('ul, ol')) {
                  processElement($, $(child), doc)
                } else {
                  const childText = $(child).text().trim()
                  if (childText) {
                    doc.text(`  ${childText}`, {
                      indent: 40,
                      lineGap: 2,
                    })
                  }
                }
              })
            }

            doc.moveDown(0.2)
          })
          doc.moveDown(0.3)
          break

        case 'blockquote':
          doc.moveDown(0.5)
          doc.rect(72, doc.y, 450, 0).stroke('#1890ff')
          doc.moveDown(0.3)
          doc.fillColor('#666666')
          doc.font('Helvetica-Oblique')
          processElement($, $node, doc)
          doc.font('Helvetica')
          doc.fillColor('#000000')
          doc.moveDown(0.5)
          break

        case 'a':
          doc.fillColor('#1890ff')
          doc.underline(doc.x, doc.y, doc.widthOfString($node.text()), 0.5, {
            color: '#1890ff',
          })
          processElement($, $node, doc)
          doc.fillColor('#000000')
          break

        case 'table':
          doc.moveDown(0.5)
          // Simple table rendering - basic implementation
          const rows: string[][] = []
          $node.find('tr').each((_, row) => {
            const cells: string[] = []
            $(row)
              .find('td, th')
              .each((_, cell) => {
                cells.push($(cell).text().trim())
              })
            rows.push(cells)
          })

          // Render table (simplified)
          rows.forEach((row, idx) => {
            if (idx === 0) {
              // Header row
              doc.font('Helvetica-Bold').fontSize(11)
            } else {
              doc.font('Helvetica').fontSize(11)
            }

            const rowText = row.join(' | ')
            doc.text(rowText, { indent: 10 })
            doc.moveDown(0.2)
          })
          doc.fontSize(12).font('Helvetica')
          doc.moveDown(0.5)
          break

        case 'img':
          // Images are not supported in basic PDFKit, but we can note them
          const alt = $node.attr('alt') || 'Image'
          doc.font('Helvetica-Oblique')
          doc.text(`[${alt}]`)
          doc.font('Helvetica')
          break

        default:
          // Recursively process child elements
          processElement($, $node, doc)
          break
      }
    }
  })
}
