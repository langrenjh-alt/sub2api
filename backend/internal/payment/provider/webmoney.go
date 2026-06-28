package provider

import (
	"context"
	"crypto/hmac"
	"crypto/md5"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/url"
	"regexp"
	"strconv"
	"strings"

	"github.com/Wei-Shaw/sub2api/internal/payment"
)

const (
	webMoneyDefaultPaymentURL = "https://merchant.wmtransfer.com/lmi/payment_utf.asp"
	webMoneyDefaultAllowSDP   = "31"
	webMoneyDefaultCurrency   = "USD"

	webMoneyCheckoutPath     = "/api/v1/payment/public/webmoney/checkout"
	webMoneyOutTradeNoField  = "SUB2_OUT_TRADE_NO"
	webMoneyHashFieldSHA256  = "LMI_HASH2"
	webMoneyHashFieldLegacy  = "LMI_HASH"
	webMoneyPaymentFormSign  = "LMI_PAYMENTFORM_SIGN"
	webMoneyHoldField        = "LMI_HOLD"
	webMoneyPreRequestField  = "LMI_PREREQUEST"
	webMoneyPreRequestValue  = "1"
	webMoneyProductionMode   = "0"
	webMoneyFormMethodPost   = "POST"
	webMoneyFormCharsetUTF8  = "UTF-8"
	webMoneyMaxDescription   = 255
	webMoneyMaxPaymentNo     = 15
	webMoneyLegacyOrderIDPre = "sub2_"
)

var (
	webMoneyPursePattern     = regexp.MustCompile(`^[A-Z][0-9]{12}$`)
	webMoneyPaymentNoPattern = regexp.MustCompile(`^[0-9]{1,15}$`)
	webMoneyHoldPattern      = regexp.MustCompile(`^[1-9][0-9]*$`)
)

type webMoneyCheckoutPayload struct {
	Action string            `json:"action"`
	Method string            `json:"method"`
	Fields map[string]string `json:"fields"`
}

// WebMoney implements payment.Provider for WebMoney Merchant Web Interface.
type WebMoney struct {
	instanceID string
	config     map[string]string
}

// NewWebMoney creates a WebMoney provider instance.
// Required config: payeePurse, secretKey.
// Optional config: paymentUrl, allowSdp, simMode, currency, notifyUrl, returnUrl, passCallbackUrls, secretKeyX20.
func NewWebMoney(instanceID string, config map[string]string) (*WebMoney, error) {
	cfg := cloneStringMap(config)
	cfg["payeePurse"] = strings.ToUpper(strings.TrimSpace(cfg["payeePurse"]))
	if cfg["payeePurse"] == "" {
		return nil, fmt.Errorf("webmoney config missing required key: payeePurse")
	}
	if !webMoneyPursePattern.MatchString(cfg["payeePurse"]) {
		return nil, fmt.Errorf("webmoney config payeePurse must be a purse letter followed by 12 digits")
	}
	if strings.TrimSpace(cfg["secretKey"]) == "" {
		return nil, fmt.Errorf("webmoney config missing required key: secretKey")
	}
	if strings.TrimSpace(cfg["paymentUrl"]) == "" {
		cfg["paymentUrl"] = webMoneyDefaultPaymentURL
	}
	paymentURL, err := normalizeWebMoneyPaymentURL(cfg["paymentUrl"])
	if err != nil {
		return nil, err
	}
	cfg["paymentUrl"] = paymentURL
	if strings.TrimSpace(cfg["allowSdp"]) == "" {
		cfg["allowSdp"] = webMoneyDefaultAllowSDP
	}
	if simMode := strings.TrimSpace(cfg["simMode"]); simMode != "" && simMode != "0" && simMode != "1" && simMode != "2" {
		return nil, fmt.Errorf("webmoney config simMode must be 0, 1, or 2")
	}
	if x20 := strings.TrimSpace(cfg["secretKeyX20"]); x20 != "" && len([]rune(x20)) != 50 {
		return nil, fmt.Errorf("webmoney config secretKeyX20 must be 50 characters when configured")
	}
	if hold := strings.TrimSpace(cfg["hold"]); hold != "" && !webMoneyHoldPattern.MatchString(hold) {
		return nil, fmt.Errorf("webmoney config hold must be a positive integer when configured")
	}
	currency, err := normalizeWebMoneyCurrency(cfg["currency"])
	if err != nil {
		return nil, fmt.Errorf("webmoney config currency: %w", err)
	}
	cfg["currency"] = currency
	return &WebMoney{instanceID: instanceID, config: cfg}, nil
}

func normalizeWebMoneyPaymentURL(raw string) (string, error) {
	raw = strings.TrimSpace(raw)
	parsed, err := url.Parse(raw)
	if err != nil || parsed.Scheme == "" || parsed.Host == "" {
		return "", fmt.Errorf("webmoney paymentUrl must be an absolute URL")
	}
	if parsed.Scheme != "https" {
		return "", fmt.Errorf("webmoney paymentUrl must use https")
	}
	parsed.Fragment = ""
	return parsed.String(), nil
}

func normalizeWebMoneyCurrency(raw string) (string, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		raw = webMoneyDefaultCurrency
	}
	return payment.NormalizePaymentCurrency(raw)
}

func (w *WebMoney) Name() string        { return "WebMoney" }
func (w *WebMoney) ProviderKey() string { return payment.TypeWebMoney }
func (w *WebMoney) SupportedTypes() []payment.PaymentType {
	return []payment.PaymentType{payment.TypeWebMoney}
}

func (w *WebMoney) MerchantIdentityMetadata() map[string]string {
	if w == nil {
		return nil
	}
	return map[string]string{
		"payee_purse": strings.TrimSpace(w.config["payeePurse"]),
		"currency":    w.currency(),
	}
}

func (w *WebMoney) currency() string {
	if w == nil {
		return webMoneyDefaultCurrency
	}
	currency, err := normalizeWebMoneyCurrency(w.config["currency"])
	if err != nil {
		return webMoneyDefaultCurrency
	}
	return currency
}

func (w *WebMoney) CreatePayment(_ context.Context, req payment.CreatePaymentRequest) (*payment.CreatePaymentResponse, error) {
	paymentNo := strings.TrimSpace(req.OrderID)
	if !webMoneyPaymentNoPattern.MatchString(paymentNo) {
		return nil, fmt.Errorf("webmoney LMI_PAYMENT_NO must be an unsigned integer up to %d digits", webMoneyMaxPaymentNo)
	}
	amount := strings.TrimSpace(req.Amount)
	if amount == "" {
		return nil, fmt.Errorf("webmoney payment amount is required")
	}
	amountValue, err := strconv.ParseFloat(amount, 64)
	if err != nil || amountValue <= 0 {
		return nil, fmt.Errorf("webmoney payment amount must be a positive number")
	}

	fields := map[string]string{
		"LMI_PAYEE_PURSE":       w.config["payeePurse"],
		"LMI_PAYMENT_AMOUNT":    amount,
		"LMI_PAYMENT_DESC":      truncateRunes(strings.TrimSpace(req.Subject), webMoneyMaxDescription),
		"LMI_PAYMENT_NO":        paymentNo,
		"LMI_ALLOW_SDP":         strings.TrimSpace(w.config["allowSdp"]),
		webMoneyOutTradeNoField: strings.TrimSpace(req.OutTradeNo),
	}
	if fields["LMI_PAYMENT_DESC"] == "" {
		fields["LMI_PAYMENT_DESC"] = "Sub2API payment"
	}
	if fields[webMoneyOutTradeNoField] == "" {
		delete(fields, webMoneyOutTradeNoField)
	}
	if simMode := strings.TrimSpace(w.config["simMode"]); simMode != "" {
		fields["LMI_SIM_MODE"] = simMode
	}
	if hold := strings.TrimSpace(w.config["hold"]); hold != "" {
		fields[webMoneyHoldField] = hold
	}
	if webMoneyBoolConfig(w.config["passCallbackUrls"]) {
		if notifyURL := strings.TrimSpace(webMoneyFirstNonEmpty(req.NotifyURL, w.config["notifyUrl"])); notifyURL != "" {
			fields["LMI_RESULT_URL"] = notifyURL
		}
		if returnURL := strings.TrimSpace(webMoneyFirstNonEmpty(req.ReturnURL, w.config["returnUrl"])); returnURL != "" {
			fields["LMI_SUCCESS_URL"] = returnURL
			fields["LMI_FAIL_URL"] = returnURL
		}
	}
	if sign := strings.TrimSpace(webMoneyPaymentFormSignValue(fields, w.config["secretKeyX20"])); sign != "" {
		fields[webMoneyPaymentFormSign] = sign
	}

	payURL, err := buildWebMoneyCheckoutURL(webMoneyFirstNonEmpty(req.ReturnURL, w.config["returnUrl"], w.config["checkoutBaseUrl"]), webMoneyCheckoutPayload{
		Action: w.config["paymentUrl"],
		Method: webMoneyFormMethodPost,
		Fields: fields,
	})
	if err != nil {
		return nil, err
	}
	return &payment.CreatePaymentResponse{
		PayURL:   payURL,
		Currency: w.currency(),
	}, nil
}

func buildWebMoneyCheckoutURL(baseURL string, payload webMoneyCheckoutPayload) (string, error) {
	body, err := json.Marshal(payload)
	if err != nil {
		return "", fmt.Errorf("webmoney checkout payload: %w", err)
	}
	q := url.Values{}
	q.Set("p", base64.RawURLEncoding.EncodeToString(body))
	pathWithQuery := webMoneyCheckoutPath + "?" + q.Encode()

	baseURL = strings.TrimSpace(baseURL)
	if baseURL == "" {
		return pathWithQuery, nil
	}
	parsed, err := url.Parse(baseURL)
	if err != nil || parsed.Scheme == "" || parsed.Host == "" {
		return pathWithQuery, nil
	}
	parsed.Path = webMoneyCheckoutPath
	parsed.RawPath = ""
	parsed.RawQuery = q.Encode()
	parsed.Fragment = ""
	return parsed.String(), nil
}

func (w *WebMoney) QueryOrder(_ context.Context, tradeNo string) (*payment.QueryOrderResponse, error) {
	return &payment.QueryOrderResponse{
		TradeNo:  strings.TrimSpace(tradeNo),
		Status:   payment.ProviderStatusPending,
		Metadata: w.MerchantIdentityMetadata(),
	}, nil
}

func (w *WebMoney) VerifyNotification(_ context.Context, rawBody string, _ map[string]string) (*payment.PaymentNotification, error) {
	values, err := url.ParseQuery(rawBody)
	if err != nil {
		return nil, fmt.Errorf("webmoney parse notification: %w", err)
	}
	params := webMoneyValuesToMap(values)
	if params[webMoneyPreRequestField] == webMoneyPreRequestValue {
		return nil, nil
	}
	if err := w.validateNotificationBasics(params); err != nil {
		return nil, err
	}
	if err := w.verifyNotificationHash(params); err != nil {
		return nil, err
	}

	amount, err := strconv.ParseFloat(strings.TrimSpace(params["LMI_PAYMENT_AMOUNT"]), 64)
	if err != nil || amount <= 0 {
		return nil, fmt.Errorf("webmoney invalid LMI_PAYMENT_AMOUNT")
	}
	mode := strings.TrimSpace(params["LMI_MODE"])
	status := payment.ProviderStatusFailed
	if mode == webMoneyProductionMode {
		if err := w.validateNotificationPaymentMethod(params); err != nil {
			return nil, err
		}
		status = payment.ProviderStatusSuccess
	}

	tradeNo := strings.TrimSpace(params["LMI_SYS_TRANS_NO"])
	if tradeNo == "" {
		tradeNo = strings.TrimSpace(params["LMI_SYS_INVS_NO"])
	}
	metadata := w.MerchantIdentityMetadata()
	if metadata == nil {
		metadata = map[string]string{}
	}
	metadata["lmi_mode"] = mode
	metadata["sdp_type"] = strings.TrimSpace(params["LMI_SDP_TYPE"])
	metadata["sys_invs_no"] = strings.TrimSpace(params["LMI_SYS_INVS_NO"])
	metadata["payer_wm"] = strings.TrimSpace(params["LMI_PAYER_WM"])
	metadata["payer_purse"] = strings.TrimSpace(params["LMI_PAYER_PURSE"])

	return &payment.PaymentNotification{
		TradeNo:  tradeNo,
		OrderID:  webMoneyNotificationOrderID(params),
		Amount:   amount,
		Status:   status,
		RawData:  rawBody,
		Metadata: metadata,
	}, nil
}

func webMoneyValuesToMap(values url.Values) map[string]string {
	params := make(map[string]string, len(values))
	for key := range values {
		params[key] = values.Get(key)
	}
	return params
}

func (w *WebMoney) validateNotificationBasics(params map[string]string) error {
	if strings.TrimSpace(params["LMI_PAYEE_PURSE"]) == "" {
		return fmt.Errorf("webmoney notification missing LMI_PAYEE_PURSE")
	}
	if !strings.EqualFold(strings.TrimSpace(params["LMI_PAYEE_PURSE"]), strings.TrimSpace(w.config["payeePurse"])) {
		return fmt.Errorf("webmoney payee purse mismatch")
	}
	if !webMoneyPaymentNoPattern.MatchString(strings.TrimSpace(params["LMI_PAYMENT_NO"])) {
		return fmt.Errorf("webmoney notification missing or invalid LMI_PAYMENT_NO")
	}
	if strings.TrimSpace(params["LMI_MODE"]) == "" {
		return fmt.Errorf("webmoney notification missing LMI_MODE")
	}
	return nil
}

func (w *WebMoney) validateNotificationPaymentMethod(params map[string]string) error {
	if !webMoneyRequireSDPType(w.config["requireSdpType"]) {
		return nil
	}
	expected := strings.TrimSpace(w.config["allowSdp"])
	if expected == "" {
		expected = webMoneyDefaultAllowSDP
	}
	actual := strings.TrimSpace(params["LMI_SDP_TYPE"])
	if actual == "" {
		return fmt.Errorf("webmoney notification missing LMI_SDP_TYPE")
	}
	if actual != expected {
		return fmt.Errorf("webmoney LMI_SDP_TYPE mismatch: expected %s, got %s", expected, actual)
	}
	return nil
}

func (w *WebMoney) verifyNotificationHash(params map[string]string) error {
	secret := strings.TrimSpace(w.config["secretKey"])
	if secret == "" {
		return fmt.Errorf("webmoney secretKey not configured")
	}
	receivedHold := strings.TrimSpace(params["LMI_HOLD"])
	if received := strings.TrimSpace(params[webMoneyHashFieldSHA256]); received != "" {
		expected := webMoneySHA256Hex(webMoneySignatureString(params, secret, true, receivedHold))
		if hmac.Equal([]byte(strings.ToUpper(received)), []byte(expected)) {
			return nil
		}
		return fmt.Errorf("webmoney invalid LMI_HASH2")
	}
	if received := strings.TrimSpace(params[webMoneyHashFieldLegacy]); received != "" {
		signature := webMoneySignatureString(params, secret, false, receivedHold)
		expectedSHA256 := webMoneySHA256Hex(signature)
		expectedMD5 := webMoneyMD5Hex(signature)
		received = strings.ToUpper(received)
		if hmac.Equal([]byte(received), []byte(expectedSHA256)) || hmac.Equal([]byte(received), []byte(expectedMD5)) {
			return nil
		}
		return fmt.Errorf("webmoney invalid LMI_HASH")
	}
	return fmt.Errorf("webmoney notification missing LMI_HASH2")
}

func webMoneySignatureString(params map[string]string, secret string, semicolon bool, hold string) string {
	fields := webMoneyNotificationSignatureFields(params, secret, hold)
	if semicolon {
		return strings.Join(fields, ";")
	}
	return strings.Join(fields, "")
}

func webMoneyNotificationSignatureFields(params map[string]string, secret string, hold string) []string {
	base := []string{
		params["LMI_PAYEE_PURSE"],
		params["LMI_PAYMENT_AMOUNT"],
		params["LMI_PAYMENT_NO"],
		params["LMI_MODE"],
		params["LMI_SYS_INVS_NO"],
		params["LMI_SYS_TRANS_NO"],
		params["LMI_SYS_TRANS_DATE"],
		secret,
		params["LMI_PAYER_PURSE"],
		params["LMI_PAYER_WM"],
	}
	if strings.TrimSpace(hold) == "" {
		return base
	}
	return []string{
		params["LMI_PAYEE_PURSE"],
		params["LMI_PAYMENT_AMOUNT"],
		hold,
		params["LMI_PAYMENT_NO"],
		params["LMI_MODE"],
		params["LMI_SYS_INVS_NO"],
		params["LMI_SYS_TRANS_NO"],
		params["LMI_SYS_TRANS_DATE"],
		secret,
		params["LMI_PAYER_PURSE"],
		params["LMI_PAYER_WM"],
	}
}

func webMoneyPaymentFormSignValue(fields map[string]string, secretKeyX20 string) string {
	secretKeyX20 = strings.TrimSpace(secretKeyX20)
	if secretKeyX20 == "" {
		return ""
	}
	parts := []string{
		strings.TrimSpace(fields["LMI_PAYEE_PURSE"]),
		strings.TrimSpace(fields["LMI_PAYMENT_AMOUNT"]),
	}
	if hold := strings.TrimSpace(fields[webMoneyHoldField]); hold != "" {
		parts = append(parts, hold)
	}
	parts = append(parts,
		strings.TrimSpace(fields["LMI_PAYMENT_NO"]),
		secretKeyX20,
	)
	return webMoneySHA256Hex(strings.Join(parts, ";"))
}

func webMoneySHA256Hex(s string) string {
	sum := sha256.Sum256([]byte(s))
	return strings.ToUpper(hex.EncodeToString(sum[:]))
}

func webMoneyMD5Hex(s string) string {
	sum := md5.Sum([]byte(s))
	return strings.ToUpper(hex.EncodeToString(sum[:]))
}

func webMoneyNotificationOrderID(params map[string]string) string {
	if outTradeNo := strings.TrimSpace(params[webMoneyOutTradeNoField]); outTradeNo != "" {
		return outTradeNo
	}
	return webMoneyLegacyOrderIDPre + strings.TrimSpace(params["LMI_PAYMENT_NO"])
}

func (w *WebMoney) Refund(context.Context, payment.RefundRequest) (*payment.RefundResponse, error) {
	return nil, fmt.Errorf("webmoney refund is not supported")
}

func webMoneyFirstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}

func webMoneyBoolConfig(raw string) bool {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "1", "true", "yes", "on":
		return true
	default:
		return false
	}
}

func webMoneyRequireSDPType(raw string) bool {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "0", "false", "no", "off":
		return false
	default:
		return true
	}
}

func truncateRunes(s string, max int) string {
	if max <= 0 {
		return ""
	}
	runes := []rune(s)
	if len(runes) <= max {
		return s
	}
	return string(runes[:max])
}

var (
	_ payment.Provider                 = (*WebMoney)(nil)
	_ payment.MerchantIdentityProvider = (*WebMoney)(nil)
)
