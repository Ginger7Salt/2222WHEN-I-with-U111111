import React from "react";

/* ==================== 图标 ==================== */

const LuckinLogo = ({ className = "" }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M5 7.5h14l-1.2 10.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8L5 7.5Z" />
    <path d="M8 7.5c.2-2.8 1.5-4.5 4-4.5s3.8 1.7 4 4.5" />
    <path d="M19 10h1a3 3 0 0 1 0 6h-2" />
  </svg>
);

const PinIcon = ({ className = "" }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z" />
    <circle cx="12" cy="10" r="2.5" />
  </svg>
);

const ClockIcon = ({ className = "" }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);

const ArrowIcon = ({ className = "" }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.4"
    strokeLinecap="round"
    aria-hidden="true"
  >
    <path d="M5 12h13" />
    <path d="m13 6 6 6-6 6" />
  </svg>
);

const CheckIcon = ({ className = "" }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.3"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="m5 12 4.2 4L19 6.5" />
  </svg>
);

const ShieldIcon = ({ className = "" }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
    <path d="m9 12 2 2 4-4" />
  </svg>
);

/* ==================== 公共组件 ==================== */

function BrandHeader({ subtitle = "Professional Coffee", label = "LUCKIN COFFEE" }) {
  return (
    <header className="lk-brand-row">
      <div className="lk-brand">
        <div className="lk-brand-mark">
          <LuckinLogo />
        </div>

        <div>
          <div className="lk-brand-name">luckin coffee</div>
          <div className="lk-brand-subtitle">{subtitle}</div>
        </div>
      </div>

      <div className="lk-receipt-no">{label}</div>
    </header>
  );
}

function CardShell({ children, variant = "" }) {
  return (
    <article className={`lk-state-card ${variant}`}>
      <div className="lk-card-inner">{children}</div>
    </article>
  );
}

function BarcodePattern() {
  const widths = [
    2, 5, 2, 3, 6, 2, 4, 2, 6,
    3, 2, 5, 2, 4, 6, 2, 3, 5,
  ];

  return (
    <div className="lk-barcode" aria-label="订单条形码">
      {widths.map((width, index) => (
        <i key={index} style={{ width: `${width}px` }} />
      ))}
    </div>
  );
}

/* ==================== 门店卡片 ==================== */

function ShopCard({ card }) {
  const primaryShop = card.shops?.[0];

  if (!primaryShop) {
    return null;
  }

  return (
    <CardShell variant="lk-shop-card">
      <BrandHeader subtitle="Store Service" label="STORE INFO" />

      <div className="lk-section-title">
        <h2>附近门店</h2>
        <span>STORE / 01</span>
      </div>

      <div className="lk-shop-info">
        <div className="lk-shop-heading">
          <strong className="lk-shop-name">
            {primaryShop.deptName || "瑞幸咖啡门店"}
          </strong>

          {primaryShop.workStatus && (
            <span
              className={`lk-status-tag ${
                primaryShop.isOpen ? "is-open" : "is-closed"
              }`}
            >
              {primaryShop.workStatus}
            </span>
          )}
        </div>

        <div className="lk-shop-address">
          <PinIcon />
          <span>{primaryShop.address || "暂无门店地址"}</span>
          {primaryShop.distance && (
            <strong>{primaryShop.distance}</strong>
          )}
        </div>
      </div>

      <div className="lk-shop-footer">
        <div className="lk-muted-row">
          <ClockIcon />
          <span>
            营业时间 {primaryShop.hours || "以门店实际情况为准"}
          </span>
        </div>

        <button className="lk-primary-button" type="button">
          <span>去下单</span>
          <ArrowIcon />
        </button>
      </div>
    </CardShell>
  );
}

/* ==================== 商品卡片 ==================== */

function ProductCard({ card }) {
  const attrs = card.attrs || [];

  return (
    <CardShell variant="lk-product-card">
      <BrandHeader subtitle="Product Customization" label="PRODUCT INFO" />

      <div className="lk-section-title">
        <h2>商品信息</h2>
        <span>PRODUCT / 01</span>
      </div>

      <div className="lk-product-head">
        <div>
          <h3>{card.productName || "瑞幸咖啡"}</h3>
          <p>{card.skuCode || "HIGH-PRESSURE EXTRACT"}</p>
        </div>

        <div className="lk-product-price">
          <span>¥</span>
          <strong>{card.estimatePrice ?? "--"}</strong>

          {Number(card.initialPrice) > Number(card.estimatePrice) && (
            <del>¥{card.initialPrice}</del>
          )}
        </div>
      </div>

      {attrs.length > 0 && (
        <div className="lk-attribute-list">
          {attrs.slice(0, 3).map((attr, index) => (
            <div className="lk-attribute-row" key={index}>
              <span className="lk-attribute-name">{attr.name}</span>

              <div className="lk-option-list">
                {(attr.options || []).map((option, optionIndex) => (
                  <span
                    key={optionIndex}
                    className={`lk-option ${
                      option.selected ? "is-selected" : ""
                    }`}
                  >
                    {option.name}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </CardShell>
  );
}

/* ==================== 支付卡片 ==================== */

function PayCard({ card }) {
  const handlePay = () => {
    if (card.payUrl && typeof window !== "undefined") {
      window.open(card.payUrl, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <CardShell variant="lk-pay-card">
      <BrandHeader subtitle="Order Payment" label="ORDER SUMMARY" />

      <div className="lk-section-title">
        <h2>确认支付</h2>
        <span>PAYMENT / 03</span>
      </div>

      <div className="lk-pay-shop">
        <div>
          <span className="lk-small-label">ORDER SUMMARY</span>
          <strong>{card.shopName || "瑞幸咖啡门店"}</strong>
        </div>

        <div className="lk-coupon-tag">
          <ShieldIcon />
          <span>立减券生效</span>
        </div>
      </div>

      <div className="lk-product-list">
        {(card.products || []).map((product, index) => (
          <div className="lk-product-row" key={index}>
            <div className="lk-product-main">
              <div className="lk-cup-illustration">
                <LuckinLogo />
              </div>

              <div>
                <strong>{product.name}</strong>
                <span>数量 × {product.amount}</span>
              </div>
            </div>

            <strong className="lk-product-row-price">
              ¥{product.price}
            </strong>
          </div>
        ))}
      </div>

      <div className="lk-total-row">
        <div>
          <span className="lk-total-label">优惠后应付</span>
          <strong className="lk-total-price">
            ¥{card.discountPrice ?? "--"}
          </strong>
        </div>

        <button
          className="lk-primary-button lk-pay-button"
          type="button"
          onClick={handlePay}
        >
          <span>去支付</span>
          <ArrowIcon />
        </button>
      </div>
    </CardShell>
  );
}

/* ==================== 订单卡片 ==================== */

function OrderCard({ card }) {
  const status = Number(card.orderStatus);
  const isCanceled = status === 100;
  const isReady = status === 60;
  const isMaking = status === 20 || status === 30;

  const variant = isReady
    ? "lk-pickup-card"
    : isCanceled
      ? "lk-canceled-card"
      : "lk-making-card";

  const subtitle = isReady
    ? "Pickup Service"
    : isCanceled
      ? "Order Canceled"
      : "Kitchen Ticket";

  const headerLabel = isReady
    ? "READY"
    : isCanceled
      ? "CANCELED"
      : "IN PROGRESS";

  return (
    <CardShell variant={variant}>
      <BrandHeader subtitle={subtitle} label={headerLabel} />

      {isReady ? (
        <PickupContent card={card} />
      ) : isCanceled ? (
        <CanceledContent card={card} />
      ) : (
        <MakingContent card={card} isMaking={isMaking} />
      )}
    </CardShell>
  );
}

function MakingContent({ card, isMaking }) {
  const progress = isMaking ? 64 : 35;

  return (
    <>
      <div className="lk-making-header">
        <div>
          <h2 className="lk-making-title">
            {card.orderStatusName || "正在制作"}
          </h2>
          <div className="lk-receipt-no lk-making-subtitle">
            请稍候，咖啡马上就好
          </div>
        </div>

        <div className="lk-making-status">
          <span className="lk-status-dot" />
          <span>{card.orderStatusName || "制作中"}</span>
        </div>
      </div>

      <div className="lk-order-ticket">
        <div className="lk-ticket-label">CURRENT ORDER</div>

        {(card.products || []).map((product, index) => (
          <div className="lk-ticket-product" key={index}>
            <strong>
              {product.name || "咖啡饮品"}
            </strong>
            <span>× {product.amount || 1}</span>
          </div>
        ))}

        <div className="lk-progress-area">
          <div className="lk-progress-label">
            <span>订单进度</span>
            <strong>已完成 {progress}%</strong>
          </div>

          <div className="lk-progress-track">
            <div
              className="lk-progress-value"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      <div className="lk-making-note">
        <ClockIcon />
        <span>
          预计还需 {card.aboutTime || "几"}，请留意取餐提醒
        </span>
      </div>

      <OrderFooter card={card} />
    </>
  );
}

function PickupContent({ card }) {
  return (
    <>
      <div className="lk-pickup-main">
        <div className="lk-pickup-label">TAKE OUT CODE</div>

        <div className="lk-pickup-code">
          {card.takeMealCode || "C08"}
        </div>

        <div className="lk-pickup-shop">
          {card.shopName || "瑞幸咖啡门店"} · 请到吧台取餐
        </div>
      </div>

      <div className="lk-barcode-box">
        <BarcodePattern />

        <div className="lk-barcode-number">
          {card.takeOrderId || card.orderId || "202604010024401"}
        </div>
      </div>

      <div className="lk-pickup-bottom">
        <span>
          {card.productName || "咖啡饮品"} × {card.amount || 1}
        </span>
        <span>请核对取餐码</span>
      </div>

      <OrderFooter card={card} />
    </>
  );
}

function CanceledContent({ card }) {
  return (
    <>
      <div className="lk-canceled-main">
        <div className="lk-canceled-mark">
          <span>×</span>
        </div>

        <h2>订单已取消</h2>

        <p>
          该订单已取消，未扣减费用
          <br />
          或已按照原支付路径退回。
        </p>
      </div>

      <OrderFooter card={card} />
    </>
  );
}

function OrderFooter({ card }) {
  return (
    <div className="lk-order-footer">
      <span>
        订单号 #
        {card.orderId?.slice?.(-8) || "024401"}
      </span>
      <span>实付 ¥{card.payAmount ?? "--"}</span>
    </div>
  );
}

/* ==================== 主组件 ==================== */

export default function LuckinCoffeeCard({ card }) {
  if (!card || !card.kind) {
    return null;
  }

  return (
    <>
      <style>{styles}</style>

      <div className="lk-preview">
        <div className="lk-preview-title">
          Luckin Coffee / Order Interface
        </div>

        {card.kind === "luckin_shop" && <ShopCard card={card} />}
        {card.kind === "luckin_product" && <ProductCard card={card} />}
        {card.kind === "luckin_pay" && <PayCard card={card} />}
        {card.kind === "luckin_order" && <OrderCard card={card} />}
      </div>
    </>
  );
}

/* ==================== 样式 ==================== */

const styles = `
  .lk-preview {
    --lk-blue: #0052d9;
    --lk-dark-blue: #003da8;
    --lk-paper: #fffdf8;
    --lk-paper-deep: #f4f0e7;
    --lk-ink: #172033;
    --lk-muted: #7d8491;
    --lk-line: #dedbd2;
    --lk-green: #18875b;
    --lk-orange: #c66b22;
    --lk-red: #b64545;

    width: 100%;
    max-width: 430px;
    margin: 8px auto;
    color: var(--lk-ink);
    font-family:
      -apple-system,
      BlinkMacSystemFont,
      "PingFang SC",
      "Microsoft YaHei",
      Arial,
      sans-serif;
  }

  .lk-preview *,
  .lk-preview *::before,
  .lk-preview *::after {
    box-sizing: border-box;
  }

  .lk-preview-title {
    margin: 0 0 12px;
    color: var(--lk-blue);
    font-size: 11px;
    font-weight: 800;
    letter-spacing: .14em;
    text-transform: uppercase;
  }

  .lk-state-card {
    position: relative;
    overflow: hidden;
    width: 100%;
    background: var(--lk-paper);
    border: 1px solid #dedbd3;
    box-shadow: 0 3px 12px rgba(22, 31, 51, .08);
  }

  .lk-state-card::before,
  .lk-state-card::after {
    content: "";
    position: absolute;
    left: 0;
    right: 0;
    height: 1px;
    background: repeating-linear-gradient(
      90deg,
      transparent 0 4px,
      rgba(0, 82, 217, .24) 4px 6px
    );
    opacity: .7;
  }

  .lk-state-card::before {
    top: 7px;
  }

  .lk-state-card::after {
    bottom: 7px;
  }

  .lk-card-inner {
    position: relative;
    z-index: 1;
    padding: 21px 20px;
  }

  .lk-brand-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding-bottom: 13px;
    border-bottom: 1px solid var(--lk-line);
  }

  .lk-brand {
    display: flex;
    align-items: center;
    gap: 9px;
    min-width: 0;
  }

  .lk-brand-mark {
    display: grid;
    width: 29px;
    height: 29px;
    flex: 0 0 auto;
    place-items: center;
    color: #fff;
    background: var(--lk-blue);
  }

  .lk-brand-mark svg {
    width: 19px;
    height: 19px;
  }

  .lk-brand-name {
    color: var(--lk-blue);
    font-size: 15px;
    font-weight: 900;
    line-height: 1;
    letter-spacing: -.04em;
  }

  .lk-brand-subtitle {
    margin-top: 4px;
    color: var(--lk-muted);
    font-size: 9px;
    letter-spacing: .12em;
    text-transform: uppercase;
  }

  .lk-receipt-no {
    color: var(--lk-muted);
    font-family: "SFMono-Regular", Consolas, monospace;
    font-size: 10px;
    letter-spacing: .05em;
    white-space: nowrap;
  }

  .lk-section-title {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin: 19px 0 14px;
  }

  .lk-section-title h2 {
    margin: 0;
    font-size: 20px;
    font-weight: 900;
    letter-spacing: -.04em;
  }

  .lk-section-title span {
    color: var(--lk-blue);
    font-family: "SFMono-Regular", Consolas, monospace;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: .08em;
    white-space: nowrap;
  }

  .lk-shop-info {
    padding: 12px 13px;
    background: #f5f7fb;
    border-left: 3px solid var(--lk-blue);
  }

  .lk-shop-heading {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .lk-shop-name {
    font-size: 14px;
    font-weight: 800;
  }

  .lk-status-tag {
    padding: 3px 7px;
    border: 1px solid;
    border-radius: 999px;
    font-size: 10px;
    line-height: 1;
  }

  .lk-status-tag.is-open {
    color: var(--lk-green);
    background: #eaf7f0;
    border-color: #bfe6cf;
  }

  .lk-status-tag.is-closed {
    color: var(--lk-red);
    background: #fff0f0;
    border-color: #efcaca;
  }

  .lk-shop-address {
    display: flex;
    align-items: center;
    gap: 5px;
    margin-top: 7px;
    color: var(--lk-muted);
    font-size: 11px;
    line-height: 1.5;
  }

  .lk-shop-address svg {
    width: 13px;
    height: 13px;
    flex: 0 0 auto;
    color: var(--lk-blue);
  }

  .lk-shop-address span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .lk-shop-address strong {
    color: var(--lk-ink);
    font-weight: 700;
    white-space: nowrap;
  }

  .lk-shop-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-top: 16px;
    padding-top: 13px;
    border-top: 1px solid var(--lk-line);
  }

  .lk-muted-row {
    display: flex;
    align-items: center;
    gap: 6px;
    color: var(--lk-muted);
    font-size: 10px;
  }

  .lk-muted-row svg {
    width: 14px;
    height: 14px;
    color: var(--lk-blue);
  }

  .lk-primary-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    min-width: 104px;
    height: 36px;
    padding: 0 14px;
    border: 0;
    color: #fff;
    background: var(--lk-blue);
    font: inherit;
    font-size: 12px;
    font-weight: 800;
    cursor: pointer;
    transition:
      background 160ms ease,
      transform 160ms ease;
  }

  .lk-primary-button:hover {
    background: var(--lk-dark-blue);
  }

  .lk-primary-button:active {
    transform: scale(.97);
  }

  .lk-primary-button svg {
    width: 14px;
    height: 14px;
  }

  .lk-product-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 14px;
    padding: 12px 0 16px;
    border-bottom: 1px solid var(--lk-line);
  }

  .lk-product-head h3 {
    margin: 0;
    font-size: 17px;
    font-weight: 900;
  }

  .lk-product-head p {
    margin: 6px 0 0;
    color: var(--lk-muted);
    font-family: "SFMono-Regular", Consolas, monospace;
    font-size: 9px;
    letter-spacing: .05em;
  }

  .lk-product-price {
    color: var(--lk-blue);
    font-family: "SFMono-Regular", Consolas, monospace;
    text-align: right;
    white-space: nowrap;
  }

  .lk-product-price > span {
    font-size: 12px;
    font-weight: 800;
  }

  .lk-product-price strong {
    font-size: 25px;
    font-weight: 900;
    letter-spacing: -.06em;
  }

  .lk-product-price del {
    display: block;
    color: var(--lk-muted);
    font-size: 10px;
  }

  .lk-attribute-list {
    margin-top: 15px;
  }

  .lk-attribute-row {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    margin-bottom: 11px;
  }

  .lk-attribute-name {
    width: 42px;
    flex: 0 0 auto;
    padding-top: 5px;
    color: var(--lk-muted);
    font-size: 11px;
  }

  .lk-option-list {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .lk-option {
    padding: 6px 10px;
    color: #596273;
    background: #f0f2f5;
    border: 1px solid transparent;
    border-radius: 2px;
    font-size: 10px;
  }

  .lk-option.is-selected {
    color: #fff;
    background: var(--lk-blue);
    border-color: var(--lk-blue);
    font-weight: 700;
  }

  .lk-pay-shop {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding-bottom: 13px;
    border-bottom: 1px solid var(--lk-line);
  }

  .lk-pay-shop > div:first-child {
    min-width: 0;
  }

  .lk-small-label {
    display: block;
    margin-bottom: 4px;
    color: var(--lk-muted);
    font-family: "SFMono-Regular", Consolas, monospace;
    font-size: 9px;
    letter-spacing: .1em;
  }

  .lk-pay-shop strong {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 12px;
  }

  .lk-coupon-tag {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 5px 7px;
    color: var(--lk-blue);
    background: #eef3ff;
    border: 1px solid #cbd9f7;
    font-size: 10px;
    white-space: nowrap;
  }

  .lk-coupon-tag svg {
    width: 14px;
    height: 14px;
  }

  .lk-product-list {
    margin-top: 3px;
  }

  .lk-product-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 13px 0;
    border-bottom: 1px dashed #d9d6cc;
  }

  .lk-product-main {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
  }

  .lk-cup-illustration {
    display: grid;
    width: 38px;
    height: 43px;
    flex: 0 0 auto;
    place-items: center;
    color: var(--lk-blue);
    background: #eef3ff;
    border: 1px solid #cbd9f7;
  }

  .lk-cup-illustration svg {
    width: 24px;
    height: 24px;
  }

  .lk-product-main strong {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 13px;
  }

  .lk-product-main span {
    display: block;
    margin-top: 5px;
    color: var(--lk-muted);
    font-size: 10px;
  }

  .lk-product-row-price {
    color: var(--lk-blue);
    font-family: "SFMono-Regular", Consolas, monospace;
    font-size: 13px;
    white-space: nowrap;
  }

  .lk-total-row {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 12px;
    padding-top: 16px;
  }

  .lk-total-label {
    display: block;
    color: var(--lk-muted);
    font-size: 11px;
  }

  .lk-total-price {
    display: block;
    margin-top: 4px;
    color: var(--lk-blue);
    font-family: "SFMono-Regular", Consolas, monospace;
    font-size: 27px;
    font-weight: 900;
    letter-spacing: -.08em;
  }

  .lk-making-card {
    background: #fffefa;
  }

  .lk-making-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    margin-top: 19px;
  }

  .lk-making-title {
    margin: 0;
    color: var(--lk-blue);
    font-size: 23px;
    font-weight: 900;
    letter-spacing: -.06em;
  }

  .lk-making-subtitle {
    margin-top: 7px;
  }

  .lk-making-status {
    display: flex;
    align-items: center;
    gap: 7px;
    color: var(--lk-orange);
    font-size: 11px;
    font-weight: 800;
    white-space: nowrap;
  }

  .lk-status-dot {
    width: 8px;
    height: 8px;
    background: var(--lk-orange);
    animation: lkStatusPulse 1.4s ease-in-out infinite;
  }

  @keyframes lkStatusPulse {
    0%, 100% {
      opacity: .45;
      transform: scale(.8);
    }
    50% {
      opacity: 1;
      transform: scale(1);
    }
  }

  .lk-order-ticket {
    position: relative;
    margin-top: 20px;
    padding: 17px 15px;
    border: 1px solid #d7d2c7;
    background:
      repeating-linear-gradient(
        0deg,
        transparent 0 23px,
        rgba(0, 82, 217, .06) 24px
      ),
      #fffdf8;
  }

  .lk-ticket-label {
    color: var(--lk-muted);
    font-family: "SFMono-Regular", Consolas, monospace;
    font-size: 9px;
    letter-spacing: .12em;
  }

  .lk-ticket-product {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-top: 13px;
    padding-bottom: 13px;
    border-bottom: 1px dashed #cfcac0;
  }

  .lk-ticket-product strong {
    font-size: 13px;
  }

  .lk-ticket-product span {
    color: var(--lk-blue);
    font-family: "SFMono-Regular", Consolas, monospace;
    font-size: 13px;
    font-weight: 800;
  }

  .lk-progress-area {
    margin-top: 18px;
  }

  .lk-progress-label {
    display: flex;
    justify-content: space-between;
    color: var(--lk-muted);
    font-size: 10px;
  }

  .lk-progress-label strong {
    color: var(--lk-blue);
  }

  .lk-progress-track {
    height: 7px;
    margin-top: 9px;
    overflow: hidden;
    background: #e9e7e0;
  }

  .lk-progress-value {
    height: 100%;
    background: var(--lk-blue);
    animation: lkProgressShine 2.2s linear infinite;
  }

  @keyframes lkProgressShine {
    0%, 100% {
      opacity: .72;
    }
    50% {
      opacity: 1;
    }
  }

  .lk-making-note {
    display: flex;
    align-items: center;
    gap: 7px;
    margin-top: 15px;
    color: var(--lk-muted);
    font-size: 11px;
  }

  .lk-making-note svg {
    width: 14px;
    height: 14px;
    color: var(--lk-blue);
  }

  .lk-pickup-card {
    color: #fff;
    background: var(--lk-blue);
    border-color: var(--lk-blue);
  }

  .lk-pickup-card::before,
  .lk-pickup-card::after {
    background: repeating-linear-gradient(
      90deg,
      transparent 0 4px,
      rgba(255, 255, 255, .5) 4px 6px
    );
  }

  .lk-pickup-card .lk-brand-name,
  .lk-pickup-card .lk-receipt-no {
    color: #fff;
  }

  .lk-pickup-card .lk-brand-subtitle {
    color: rgba(255, 255, 255, .68);
  }

  .lk-pickup-card .lk-brand-mark {
    color: var(--lk-blue);
    background: #fff;
  }

  .lk-pickup-card .lk-brand-row {
    border-color: rgba(255, 255, 255, .28);
  }

  .lk-pickup-main {
    margin: 19px 0;
    text-align: center;
  }

  .lk-pickup-label {
    font-family: "SFMono-Regular", Consolas, monospace;
    font-size: 10px;
    letter-spacing: .18em;
    opacity: .72;
  }

  .lk-pickup-code {
    margin: 10px 0 7px;
    font-family: "SFMono-Regular", Consolas, monospace;
    font-size: 52px;
    font-weight: 900;
    line-height: 1;
    letter-spacing: .08em;
  }

  .lk-pickup-shop {
    font-size: 11px;
    opacity: .78;
  }

  .lk-barcode-box {
    padding: 15px 13px 11px;
    color: var(--lk-ink);
    background: #fff;
  }

  .lk-barcode {
    display: flex;
    align-items: stretch;
    justify-content: center;
    height: 42px;
    gap: 2px;
  }

  .lk-barcode i {
    display: block;
    height: 100%;
    background: #111827;
  }

  .lk-barcode-number {
    margin-top: 7px;
    color: var(--lk-ink);
    text-align: center;
    font-family: "SFMono-Regular", Consolas, monospace;
    font-size: 9px;
    letter-spacing: .18em;
  }

  .lk-pickup-bottom {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-top: 16px;
    font-size: 10px;
    opacity: .76;
  }

  .lk-order-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-top: 16px;
    padding-top: 12px;
    border-top: 1px dashed #d9d6cc;
    color: var(--lk-muted);
    font-family: "SFMono-Regular", Consolas, monospace;
    font-size: 9px;
  }

  .lk-pickup-card .lk-order-footer {
    color: rgba(255, 255, 255, .76);
    border-color: rgba(255, 255, 255, .28);
  }

  .lk-canceled-card {
    background: #f8faf8;
  }

  .lk-canceled-main {
    padding: 25px 0 10px;
  }

  .lk-canceled-mark {
    display: grid;
    width: 52px;
    height: 52px;
    place-items: center;
    color: #fff;
    background: #9098a5;
  }

  .lk-canceled-mark span {
    font-size: 35px;
    font-weight: 300;
    line-height: 1;
  }

  .lk-canceled-main h2 {
    margin: 15px 0 5px;
    font-size: 21px;
    font-weight: 900;
  }

  .lk-canceled-main p {
    margin: 0;
    color: var(--lk-muted);
    font-size: 12px;
    line-height: 1.7;
  }

  @media (max-width: 420px) {
    .lk-card-inner {
      padding-right: 16px;
      padding-left: 16px;
    }

    .lk-section-title h2 {
      font-size: 18px;
    }

    .lk-making-title {
      font-size: 21px;
    }

    .lk-pickup-code {
      font-size: 44px;
    }

    .lk-shop-footer {
      align-items: flex-end;
    }

    .lk-muted-row {
      align-items: flex-start;
    }
  }
`;
