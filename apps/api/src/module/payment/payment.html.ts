import { EcpayCheckoutForm } from '@app/external/ecpay/ecpay.dto';
import { PaymentStatus } from '@app/repository/enum/payment.enum';

import { GetPaymentResultResponse } from './payment.dto';

/**
 * 서버가 직접 그리는 최소 페이지들. 고객(대만)이 보므로 번체 중문으로 쓴다.
 * - handoff: ECPay 결제창으로 auto-submit
 * - 결과: STOREFRONT_BASE_URL 이 비어 있을 때만 프론트 결과 페이지 대신 보여준다
 */

export function renderAutoSubmitPage(form: EcpayCheckoutForm): string {
  const inputs = Object.entries(form.fields)
    .map(
      ([name, value]) =>
        `<input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(value)}">`,
    )
    .join('\n');

  return layout(
    '前往付款',
    `<p>正在前往綠界付款頁面…</p>
<form id="ecpay" method="post" action="${escapeHtml(form.action)}">
${inputs}
<button type="submit">前往付款</button>
</form>
<script>document.getElementById('ecpay').submit();</script>`,
  );
}

/**
 * handoff GET 이 주는 중간 페이지. 같은 주소로 POST 해야 결제창이 열린다.
 * - action 이 없으면 지금 주소(쿼리 포함)로 보낸다.
 * - 버튼은 noscript 에만 둔다. 자동 제출 중에 한 번 더 누르면 두 번째 POST 가 409 를 받아 결제창을 놓친다.
 * - LINE 인앱 브라우저인데 openExternalBrowser=1 이 붙어 있으면 보내지 않는다 —
 *   LINE 이 외부 브라우저로 다시 열어 주므로, 여기서 보내면 인앱에서 링크를 써 버린다.
 */
export function renderHandoffLandingPage(): string {
  return layout(
    '前往付款',
    `<p id="msg">正在前往綠界付款頁面…</p>
<form id="handoff" method="post">
<noscript><button type="submit">前往付款</button></noscript>
</form>
<script>
(function () {
  var inLine = / Line\\//.test(navigator.userAgent);
  var external = /[?&]openExternalBrowser=1/.test(location.search);
  if (inLine && external) {
    document.getElementById('msg').textContent = '正在以外部瀏覽器開啟…';
    return;
  }
  document.getElementById('handoff').submit();
})();
</script>`,
  );
}

export function renderMessagePage(title: string, message: string): string {
  return layout(
    title,
    `<h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p>`,
  );
}

export function renderResultPage(
  result: GetPaymentResultResponse | null,
): string {
  if (!result) {
    return renderMessagePage(
      '找不到付款資料',
      '請回到 LINE 或網站確認訂單狀態。',
    );
  }

  const { payment } = result;
  const lines = [`訂單編號：${result.orderNumber}`];

  if (payment.status === PaymentStatus.WAITING_DEPOSIT && payment.depositInfo) {
    const info = payment.depositInfo;

    if (info.account) {
      lines.push(
        `銀行代碼：${info.bankCode ?? ''}`,
        `繳費帳號：${info.account}`,
      );
    }

    if (info.paymentNo) {
      lines.push(`超商繳費代碼：${info.paymentNo}`);
    }

    if (payment.expireAt) {
      lines.push(`繳費期限：${formatTaipei(payment.expireAt)}`);
    }
  }

  const body = lines.map((line) => `<p>${escapeHtml(line)}</p>`).join('');

  return layout(
    RESULT_TITLE[payment.status],
    `<h1>${escapeHtml(RESULT_TITLE[payment.status])}</h1>${body}<p>請回到 LINE 或網站查看訂單。</p>`,
  );
}

const RESULT_TITLE: Record<PaymentStatus, string> = {
  [PaymentStatus.READY]: '付款處理中',
  [PaymentStatus.REQUESTED]: '付款處理中',
  [PaymentStatus.WAITING_DEPOSIT]: '請於期限內完成繳費',
  [PaymentStatus.PAID]: '付款完成',
  [PaymentStatus.FAILED]: '付款未完成',
  [PaymentStatus.CANCELED]: '付款已取消',
  [PaymentStatus.EXPIRED]: '付款已逾期',
};

function layout(title: string, body: string): string {
  return `<!doctype html>
<html lang="zh-Hant-TW">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${escapeHtml(title)} | Seoul Moment</title>
<style>
body{margin:0;padding:48px 16px;font-family:-apple-system,BlinkMacSystemFont,"Noto Sans TC",sans-serif;background:#fafafa;color:#111;text-align:center}
h1{font-size:20px;margin:0 0 16px}p{font-size:15px;line-height:1.6;margin:4px 0}
button{margin-top:24px;padding:12px 24px;font-size:15px;border:0;border-radius:8px;background:#111;color:#fff}
</style>
</head>
<body>
${body}
</body>
</html>`;
}

function formatTaipei(date: Date): string {
  return new Date(date.getTime() + 8 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 16)
    .replace('T', ' ');
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
