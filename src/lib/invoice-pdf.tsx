import React from "react"
import fs from "fs"
import path from "path"
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
  renderToBuffer,
} from "@react-pdf/renderer"
import { SELLER_INFO, HK_BANK_INFO, WISE_INFO, INVOICE_FOOTER } from "./invoice-config"

function registerFont() {
  const base = path.join(process.cwd(), "public/fonts")
  Font.register({
    family: "NotoSansKR",
    fonts: [
      { src: path.join(base, "NotoSansKR-Latin.woff2") },
      { src: path.join(base, "NotoSansKR-Regular.woff2") },
    ],
  })
}

registerFont()

export interface InvoiceItem {
  productName: string
  colorName: string
  sizeName: string
  quantity: number
  unitPrice: number
  subtotal: number
}

export interface InvoiceData {
  invoiceNumber: string
  issueDate: string
  buyer: {
    name: string
    businessName?: string | null
    address?: string | null
    phone?: string | null
    email: string
  }
  items: InvoiceItem[]
  currency: string
  exchangeRate: number
  subtotalKRW: number
  gradeDiscount: number
  discountAmountKRW: number
  totalAmountKRW: number
  formatAmount: (amountKRW: number) => string
}

const styles = StyleSheet.create({
  page: {
    fontFamily: "NotoSansKR",
    fontSize: 9,
    padding: 40,
    color: "#1a1a1a",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 30,
    borderBottomWidth: 2,
    borderBottomColor: "#333",
    paddingBottom: 15,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
    letterSpacing: 2,
  },
  headerRight: {
    textAlign: "right",
  },
  invoiceNumber: {
    fontSize: 10,
    marginBottom: 4,
  },
  twoColumn: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 25,
  },
  columnHalf: {
    width: "48%",
  },
  sectionLabel: {
    fontSize: 8,
    color: "#888",
    textTransform: "uppercase",
    marginBottom: 6,
    letterSpacing: 1,
  },
  companyName: {
    fontSize: 11,
    fontWeight: "bold",
    marginBottom: 3,
  },
  infoLine: {
    fontSize: 9,
    marginBottom: 2,
    color: "#444",
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f0f0f0",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#ccc",
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#e0e0e0",
    paddingVertical: 5,
    paddingHorizontal: 4,
  },
  colNo: { width: "6%" },
  colProduct: { width: "30%" },
  colSpec: { width: "22%" },
  colQty: { width: "10%", textAlign: "right" },
  colPrice: { width: "16%", textAlign: "right" },
  colSubtotal: { width: "16%", textAlign: "right" },
  thText: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#555",
  },
  totalsSection: {
    marginTop: 15,
    alignItems: "flex-end",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 4,
    width: 220,
  },
  totalLabel: {
    width: 120,
    textAlign: "right",
    paddingRight: 10,
    color: "#555",
  },
  totalValue: {
    width: 100,
    textAlign: "right",
  },
  totalFinal: {
    flexDirection: "row",
    justifyContent: "flex-end",
    width: 220,
    borderTopWidth: 1.5,
    borderTopColor: "#333",
    paddingTop: 6,
    marginTop: 4,
  },
  totalFinalLabel: {
    width: 120,
    textAlign: "right",
    paddingRight: 10,
    fontWeight: "bold",
    fontSize: 11,
  },
  totalFinalValue: {
    width: 100,
    textAlign: "right",
    fontWeight: "bold",
    fontSize: 11,
  },
  paymentSection: {
    marginTop: 30,
    borderTopWidth: 1,
    borderTopColor: "#ccc",
    paddingTop: 15,
  },
  paymentTitle: {
    fontSize: 10,
    fontWeight: "bold",
    marginBottom: 10,
    color: "#333",
  },
  paymentColumn: {
    width: "48%",
    backgroundColor: "#fafafa",
    padding: 10,
    borderRadius: 4,
  },
  paymentLabel: {
    fontSize: 9,
    fontWeight: "bold",
    marginBottom: 6,
    color: "#333",
  },
  paymentLine: {
    fontSize: 8,
    marginBottom: 2,
    color: "#555",
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: "center",
  },
  footerText: {
    fontSize: 8,
    color: "#999",
    marginBottom: 2,
  },
})

function InvoiceDocument({ data }: { data: InvoiceData }) {
  const { formatAmount } = data

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>INVOICE</Text>
          <View style={styles.headerRight}>
            <Text style={styles.invoiceNumber}>{data.invoiceNumber}</Text>
            <Text style={styles.infoLine}>Date: {data.issueDate}</Text>
          </View>
        </View>

        {/* From / To */}
        <View style={styles.twoColumn}>
          <View style={styles.columnHalf}>
            <Text style={styles.sectionLabel}>From</Text>
            <Text style={styles.companyName}>{SELLER_INFO.companyName}</Text>
            <Text style={styles.infoLine}>{SELLER_INFO.address}</Text>
            <Text style={styles.infoLine}>{SELLER_INFO.phone}</Text>
            <Text style={styles.infoLine}>{SELLER_INFO.email}</Text>
          </View>
          <View style={styles.columnHalf}>
            <Text style={styles.sectionLabel}>To</Text>
            <Text style={styles.companyName}>
              {data.buyer.businessName || data.buyer.name}
            </Text>
            {data.buyer.address && (
              <Text style={styles.infoLine}>{data.buyer.address}</Text>
            )}
            {data.buyer.phone && (
              <Text style={styles.infoLine}>{data.buyer.phone}</Text>
            )}
            <Text style={styles.infoLine}>{data.buyer.email}</Text>
          </View>
        </View>

        {/* Items Table Header */}
        <View style={styles.tableHeader}>
          <Text style={[styles.colNo, styles.thText]}>#</Text>
          <Text style={[styles.colProduct, styles.thText]}>Product</Text>
          <Text style={[styles.colSpec, styles.thText]}>Color / Size</Text>
          <Text style={[styles.colQty, styles.thText]}>Qty</Text>
          <Text style={[styles.colPrice, styles.thText]}>Unit Price</Text>
          <Text style={[styles.colSubtotal, styles.thText]}>Subtotal</Text>
        </View>

        {/* Items Rows */}
        {data.items.map((item, i) => (
          <View key={i} style={styles.tableRow}>
            <Text style={styles.colNo}>{i + 1}</Text>
            <Text style={styles.colProduct}>{item.productName}</Text>
            <Text style={styles.colSpec}>
              {item.colorName} / {item.sizeName}
            </Text>
            <Text style={styles.colQty}>{item.quantity}</Text>
            <Text style={styles.colPrice}>{formatAmount(item.unitPrice)}</Text>
            <Text style={styles.colSubtotal}>{formatAmount(item.subtotal)}</Text>
          </View>
        ))}

        {/* Totals */}
        <View style={styles.totalsSection}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal</Text>
            <Text style={styles.totalValue}>{formatAmount(data.subtotalKRW)}</Text>
          </View>
          {data.gradeDiscount > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>
                Discount ({Math.round(data.gradeDiscount * 100)}%)
              </Text>
              <Text style={styles.totalValue}>
                -{formatAmount(data.discountAmountKRW)}
              </Text>
            </View>
          )}
          <View style={styles.totalFinal}>
            <Text style={styles.totalFinalLabel}>Total ({data.currency})</Text>
            <Text style={styles.totalFinalValue}>
              {formatAmount(data.totalAmountKRW)}
            </Text>
          </View>
        </View>

        {/* Payment Info */}
        <View style={styles.paymentSection}>
          <Text style={styles.paymentTitle}>Payment Information</Text>
          <View style={styles.twoColumn}>
            <View style={styles.paymentColumn}>
              <Text style={styles.paymentLabel}>HK Bank Transfer</Text>
              <Text style={styles.paymentLine}>Bank: {HK_BANK_INFO.bankName}</Text>
              <Text style={styles.paymentLine}>
                Account: {HK_BANK_INFO.accountName}
              </Text>
              <Text style={styles.paymentLine}>
                No: {HK_BANK_INFO.accountNumber}
              </Text>
              <Text style={styles.paymentLine}>
                SWIFT: {HK_BANK_INFO.swiftCode}
              </Text>
            </View>
            <View style={styles.paymentColumn}>
              <Text style={styles.paymentLabel}>Wise Transfer</Text>
              <Text style={styles.paymentLine}>
                Account: {WISE_INFO.accountName}
              </Text>
              <Text style={styles.paymentLine}>IBAN: {WISE_INFO.iban}</Text>
              <Text style={styles.paymentLine}>
                SWIFT/BIC: {WISE_INFO.swiftBic}
              </Text>
              <Text style={styles.paymentLine}>Bank: {WISE_INFO.bankName}</Text>
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>{INVOICE_FOOTER.message}</Text>
          <Text style={styles.footerText}>{INVOICE_FOOTER.terms}</Text>
        </View>
      </Page>
    </Document>
  )
}

export async function buildInvoicePdf(data: InvoiceData): Promise<Buffer> {
  const buffer = await renderToBuffer(<InvoiceDocument data={data} />)
  return Buffer.from(buffer)
}
