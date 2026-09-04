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
  // 인보이스 결제 통화로 이미 포맷된 금액(예: "CNY 1,352"). 있으면 이걸 쓴다.
  amountText?: string
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
        <tr><td style="padding:8px;color:#666">Amount</td><td style="padding:8px;font-weight:bold">${order.amountText ?? `₩${order.totalAmount.toLocaleString()}`}</td></tr>
      </table>
      ${paymentHtml}
      <p style="margin-top:16px;color:#666">After payment, please submit your payment confirmation through your order page.</p>
    </div>`)
}

/**
 * 2-1. 관리자가 수량 조정안을 넘김 → 바이어 확인 요청.
 *
 * 이 메일이 없으면 바이어는 몰에 직접 들어와 봐야만 자기 차례인 것을
 * 안다. 창고 확인이 끝난 뒤 며칠씩 멈춰 있던 이유다.
 */
export async function notifyCustomerStockCheck(customerEmail: string, order: {
  orderNumber: string
  customerName: string
  orderedQuantity: number
  quantity: number
  cancelledCount: number
}) {
  const changed = order.quantity !== order.orderedQuantity
  await send(customerEmail, `[Action Required] ${order.orderNumber} - Please review quantities`,
    `<div style="font-family:sans-serif;max-width:600px">
      <h2>Please Review Your Order</h2>
      <p>Dear ${order.customerName},</p>
      <p>We have checked stock for order <strong>${order.orderNumber}</strong>${
        changed ? " and adjusted some quantities" : ""
      }. Please review and confirm.</p>
      <table style="border-collapse:collapse;width:100%">
        <tr><td style="padding:8px;color:#666">Ordered</td><td style="padding:8px">${order.orderedQuantity} pcs</td></tr>
        <tr><td style="padding:8px;color:#666">Available</td><td style="padding:8px;font-weight:bold">${order.quantity} pcs</td></tr>
        ${
          order.cancelledCount
            ? `<tr><td style="padding:8px;color:#666">Unavailable items</td><td style="padding:8px;color:#c02626">${order.cancelledCount}</td></tr>`
            : ""
        }
      </table>
      <p style="margin-top:16px;color:#666">Open your order page to adjust quantities and send it back to us. You may reduce quantities, but cannot increase beyond what you originally ordered.</p>
    </div>`)
}

/**
 * 2-2. 바이어가 확인해 되돌림 → 관리자 알림.
 *
 * 관리자 차례가 되었다는 유일한 신호다. 화면에도 메일에도 없어서
 * 회신이 온 주문이 여드레를 그대로 서 있던 적이 있다.
 */
export async function notifyAdminBuyerReviewed(adminEmail: string, order: {
  orderNumber: string
  customerName: string
  orderedQuantity: number
  quantity: number
  cancelledCount: number
}) {
  await send(adminEmail, `[바이어 확인 완료] ${order.orderNumber} - ${order.customerName}`,
    `<div style="font-family:sans-serif;max-width:600px">
      <h2>바이어가 조정안을 확인했습니다</h2>
      <table style="border-collapse:collapse;width:100%">
        <tr><td style="padding:8px;color:#666">주문번호</td><td style="padding:8px;font-weight:bold">${order.orderNumber}</td></tr>
        <tr><td style="padding:8px;color:#666">바이어</td><td style="padding:8px">${order.customerName}</td></tr>
        <tr><td style="padding:8px;color:#666">수량</td><td style="padding:8px">주문 ${order.orderedQuantity}장 → 확정 ${order.quantity}장</td></tr>
        ${
          order.cancelledCount
            ? `<tr><td style="padding:8px;color:#666">취소 항목</td><td style="padding:8px;color:#c02626;font-weight:bold">${order.cancelledCount}건</td></tr>`
            : ""
        }
      </table>
      <p style="margin-top:16px;color:#666">관리자 페이지에서 검토 후 확정해주세요.${
        order.cancelledCount ? " 취소 항목이 있으면 창고에도 알려야 합니다." : ""
      }</p>
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
  trackingNumbers: string[]
  shippingCarrier: string
}) {
  // 박스가 여럿이면 운송장 번호도 여럿. 한 줄씩 늘어놓는다.
  const numbers = order.trackingNumbers.filter((n) => n && n.trim() !== "")
  const trackingRows = numbers
    .map(
      (n, i) =>
        `<tr><td style="padding:8px;color:#666">Tracking No.${numbers.length > 1 ? ` (${i + 1})` : ""}</td><td style="padding:8px;font-weight:bold">${n}</td></tr>`,
    )
    .join("")
  await send(customerEmail, `[Shipped] ${order.orderNumber}`,
    `<div style="font-family:sans-serif;max-width:600px">
      <h2>Order Shipped</h2>
      <p>Dear ${order.customerName},</p>
      <p>Your order <strong>${order.orderNumber}</strong> has been shipped${numbers.length > 1 ? ` in ${numbers.length} boxes` : ""}!</p>
      <table style="border-collapse:collapse;width:100%">
        <tr><td style="padding:8px;color:#666">Carrier</td><td style="padding:8px">${order.shippingCarrier || "-"}</td></tr>
        ${trackingRows}
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

/**
 * 메일 설정 확인용 테스트 발송. 결과를 돌려줘 관리자가 원인을 본다.
 * (일반 send 는 실패를 조용히 삼키지만, 여기서는 이유를 보여준다.)
 */
export async function sendTestEmail(
  to: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!resend) {
    return { ok: false, error: "RESEND_API_KEY 가 설정되지 않았습니다. Vercel 환경변수를 확인하세요." }
  }
  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: "[biibws] 메일 발송 테스트",
      html: `<div style="font-family:sans-serif;max-width:600px">
        <h2>메일이 정상적으로 발송됩니다</h2>
        <p>이 메일을 받으셨다면 주문·인보이스·출하 알림이 이 주소로 나갑니다.</p>
        <p style="color:#888;font-size:13px">보낸 주소: ${FROM_EMAIL}</p>
      </div>`,
    })
    if (error) return { ok: false, error: `${error.name || "발송 실패"}: ${error.message || ""}`.trim() }
    return { ok: true }
  } catch (err: any) {
    return { ok: false, error: err?.message || "알 수 없는 오류" }
  }
}
