import "server-only"
import { Resend } from "resend"

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null

const FROM_EMAIL = process.env.EMAIL_FROM || "onboarding@resend.dev"

async function send(to: string, subject: string, html: string) {
  if (!resend) {
    console.warn("[Email] RESEND_API_KEY not set, skipping email:", { to, subject })
    return
  }

  try {
    await resend.emails.send({ from: FROM_EMAIL, to, subject, html })
  } catch (err) {
    console.error("[Email] Failed to send:", err)
  }
}

// 1. 고객 주문 접수 → 관리자 알림
export async function notifyAdminNewOrder(adminEmail: string, order: {
  orderNumber: string
  customerName: string
  customerEmail: string
  totalAmount: number
  itemCount: number
}) {
  await send(adminEmail, `[새 주문] ${order.orderNumber} - ${order.customerName}`,
    `<div style="font-family:sans-serif;max-width:600px">
      <h2>새 주문이 접수되었습니다</h2>
      <table style="border-collapse:collapse;width:100%">
        <tr><td style="padding:8px;color:#666">주문번호</td><td style="padding:8px;font-weight:bold">${order.orderNumber}</td></tr>
        <tr><td style="padding:8px;color:#666">주문자</td><td style="padding:8px">${order.customerName} (${order.customerEmail})</td></tr>
        <tr><td style="padding:8px;color:#666">상품</td><td style="padding:8px">${order.itemCount}개</td></tr>
        <tr><td style="padding:8px;color:#666">금액</td><td style="padding:8px;font-weight:bold">₩${order.totalAmount.toLocaleString()}</td></tr>
      </table>
      <p style="margin-top:16px;color:#666">관리자 페이지에서 인보이스를 생성해주세요.</p>
    </div>`)
}

// 2. 인보이스 생성 → 고객 알림 (결제 안내 포함)
export async function notifyCustomerInvoice(customerEmail: string, order: {
  orderNumber: string
  invoiceNumber: string
  totalAmount: number
  customerName: string
}, paymentInfo: {
  bankName?: string | null
  accountNumber?: string | null
  accountHolder?: string | null
  bankNote?: string | null
  alipayQrImage?: string | null
  wechatQrImage?: string | null
}) {
  let paymentHtml = ""

  if (paymentInfo.bankName && paymentInfo.accountNumber) {
    paymentHtml += `
      <div style="margin-top:16px;padding:16px;background:#f8f9fa;border-radius:8px">
        <h3 style="margin:0 0 8px">Bank Transfer</h3>
        <p style="margin:4px 0">Bank: ${paymentInfo.bankName}</p>
        <p style="margin:4px 0">Account: ${paymentInfo.accountNumber}</p>
        <p style="margin:4px 0">Holder: ${paymentInfo.accountHolder || "-"}</p>
        ${paymentInfo.bankNote ? `<p style="margin:8px 0 0;color:#666;font-size:14px">${paymentInfo.bankNote}</p>` : ""}
      </div>`
  }

  if (paymentInfo.alipayQrImage) {
    paymentHtml += `
      <div style="margin-top:16px;padding:16px;background:#f8f9fa;border-radius:8px">
        <h3 style="margin:0 0 8px">Alipay</h3>
        <img src="${paymentInfo.alipayQrImage}" alt="Alipay QR" style="width:200px;height:200px;object-fit:contain" />
      </div>`
  }

  if (paymentInfo.wechatQrImage) {
    paymentHtml += `
      <div style="margin-top:16px;padding:16px;background:#f8f9fa;border-radius:8px">
        <h3 style="margin:0 0 8px">WeChat Pay</h3>
        <img src="${paymentInfo.wechatQrImage}" alt="WeChat QR" style="width:200px;height:200px;object-fit:contain" />
      </div>`
  }

  await send(customerEmail, `[Invoice] ${order.invoiceNumber} - ${order.orderNumber}`,
    `<div style="font-family:sans-serif;max-width:600px">
      <h2>Invoice Ready</h2>
      <p>Dear ${order.customerName},</p>
      <p>Your invoice has been issued. Please complete payment at your earliest convenience.</p>
      <table style="border-collapse:collapse;width:100%">
        <tr><td style="padding:8px;color:#666">Order No.</td><td style="padding:8px">${order.orderNumber}</td></tr>
        <tr><td style="padding:8px;color:#666">Invoice No.</td><td style="padding:8px;font-weight:bold">${order.invoiceNumber}</td></tr>
        <tr><td style="padding:8px;color:#666">Amount</td><td style="padding:8px;font-weight:bold">₩${order.totalAmount.toLocaleString()}</td></tr>
      </table>
      ${paymentHtml}
      <p style="margin-top:16px;color:#666">After payment, please submit your payment confirmation through your order page.</p>
    </div>`)
}

// 3. 고객 결제 증빙 제출 → 관리자 알림
export async function notifyAdminPaymentSubmitted(adminEmail: string, order: {
  orderNumber: string
  customerName: string
  senderName: string
}) {
  await send(adminEmail, `[입금확인 요청] ${order.orderNumber} - ${order.senderName}`,
    `<div style="font-family:sans-serif;max-width:600px">
      <h2>입금 확인 요청이 접수되었습니다</h2>
      <table style="border-collapse:collapse;width:100%">
        <tr><td style="padding:8px;color:#666">주문번호</td><td style="padding:8px">${order.orderNumber}</td></tr>
        <tr><td style="padding:8px;color:#666">주문자</td><td style="padding:8px">${order.customerName}</td></tr>
        <tr><td style="padding:8px;color:#666">송금인</td><td style="padding:8px;font-weight:bold">${order.senderName}</td></tr>
      </table>
      <p style="margin-top:16px;color:#666">관리자 페이지에서 확인해주세요.</p>
    </div>`)
}

// 4. 관리자 결제 확인 → 고객 알림
export async function notifyCustomerPaymentConfirmed(customerEmail: string, order: {
  orderNumber: string
  customerName: string
}) {
  await send(customerEmail, `[Payment Confirmed] ${order.orderNumber}`,
    `<div style="font-family:sans-serif;max-width:600px">
      <h2>Payment Confirmed</h2>
      <p>Dear ${order.customerName},</p>
      <p>Your payment for order <strong>${order.orderNumber}</strong> has been confirmed.</p>
      <p>We will begin preparing your order shortly.</p>
    </div>`)
}

// 5. 출하 완료 → 고객 알림
export async function notifyCustomerShipped(customerEmail: string, order: {
  orderNumber: string
  customerName: string
  trackingNumber: string
  shippingCarrier: string
}) {
  await send(customerEmail, `[Shipped] ${order.orderNumber}`,
    `<div style="font-family:sans-serif;max-width:600px">
      <h2>Order Shipped</h2>
      <p>Dear ${order.customerName},</p>
      <p>Your order <strong>${order.orderNumber}</strong> has been shipped!</p>
      <table style="border-collapse:collapse;width:100%">
        <tr><td style="padding:8px;color:#666">Carrier</td><td style="padding:8px">${order.shippingCarrier || "-"}</td></tr>
        <tr><td style="padding:8px;color:#666">Tracking No.</td><td style="padding:8px;font-weight:bold">${order.trackingNumber}</td></tr>
      </table>
    </div>`)
}

/** HTML 메일에 사람이 쓴 문장을 넣기 전에 태그로 읽히지 않게 막는다 */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

// 6. 주문 취소 → 고객 알림
// 관리자가 주문을 지우면 바이어는 이유를 알 길이 없다. 사유를 그대로 전한다.
export async function notifyCustomerOrderCancelled(customerEmail: string, order: {
  orderNumber: string
  customerName: string
  reason: string
  byAdmin: boolean
}) {
  const who = order.byAdmin ? "by the seller" : "at your request"
  await send(customerEmail, `[Cancelled] ${order.orderNumber}`,
    `<div style="font-family:sans-serif;max-width:600px">
      <h2>Order Cancelled</h2>
      <p>Dear ${escapeHtml(order.customerName)},</p>
      <p>Your order <strong>${escapeHtml(order.orderNumber)}</strong> has been cancelled ${who}.</p>
      <div style="margin:16px 0;padding:12px 16px;background:#fff5f5;border-left:3px solid #e24b4a">
        <p style="margin:0 0 4px;color:#666;font-size:13px">Reason</p>
        <p style="margin:0;white-space:pre-wrap">${escapeHtml(order.reason)}</p>
      </div>
      <p>Any stock held for this order has been released. Please contact us if you have questions.</p>
    </div>`)
}
