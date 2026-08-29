package provider

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/md5"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/Wei-Shaw/sub2api/internal/payment"
)

const (
	bepusdtHTTPTimeout     = 15 * time.Second
	bepusdtMaxResponseSize = 1 << 20
)

// BEpusdt implements the BEpusdt cryptocurrency cashier API.
// Config keys: apiBase, token, notifyUrl, returnUrl. Optional keys are
// tradeType, networks, fiat, currencies, address, timeout and rate.
type BEpusdt struct {
	instanceID string
	config     map[string]string
	httpClient *http.Client
}

func NewBEpusdt(instanceID string, config map[string]string) (*BEpusdt, error) {
	for _, key := range []string{"apiBase", "token", "notifyUrl", "returnUrl"} {
		if strings.TrimSpace(config[key]) == "" {
			return nil, fmt.Errorf("bepusdt config missing required key: %s", key)
		}
	}
	base, err := normalizeBEpusdtAPIBase(config["apiBase"])
	if err != nil {
		return nil, err
	}
	cfg := cloneStringMap(config)
	cfg["apiBase"] = base
	if strings.TrimSpace(cfg["fiat"]) == "" {
		cfg["fiat"] = payment.DefaultPaymentCurrency
	}
	return &BEpusdt{instanceID: instanceID, config: cfg, httpClient: &http.Client{Timeout: bepusdtHTTPTimeout}}, nil
}

func normalizeBEpusdtAPIBase(raw string) (string, error) {
	base := strings.TrimSpace(raw)
	parsed, err := url.Parse(base)
	if err != nil || parsed.Scheme == "" || parsed.Host == "" || (parsed.Scheme != "http" && parsed.Scheme != "https") {
		return "", fmt.Errorf("bepusdt apiBase must be an absolute http or https URL")
	}
	parsed.RawQuery, parsed.Fragment, parsed.RawPath = "", "", ""
	parsed.Path = strings.TrimRight(parsed.Path, "/")
	if !strings.HasSuffix(strings.ToLower(parsed.Path), "/api/v1") {
		parsed.Path += "/api/v1"
	}
	return strings.TrimRight(parsed.String(), "/"), nil
}

func (b *BEpusdt) Name() string        { return "BEpusdt" }
func (b *BEpusdt) ProviderKey() string { return payment.TypeBEpusdt }
func (b *BEpusdt) SupportedTypes() []payment.PaymentType {
	return []payment.PaymentType{payment.TypeBEpusdt}
}

func (b *BEpusdt) CreatePayment(ctx context.Context, req payment.CreatePaymentRequest) (*payment.CreatePaymentResponse, error) {
	payload := map[string]any{
		"order_id":     req.OrderID,
		"notify_url":   b.config["notifyUrl"],
		"redirect_url": firstNonEmptyBEpusdt(req.ReturnURL, b.config["returnUrl"]),
		"amount":       json.Number(req.Amount),
		"name":         req.Subject,
	}
	for key, configKey := range map[string]string{
		"trade_type": "tradeType", "fiat": "fiat", "address": "address",
		"timeout": "timeout", "rate": "rate", "currencies": "currencies",
	} {
		if value := strings.TrimSpace(b.config[configKey]); value != "" {
			if key == "timeout" {
				if n, err := strconv.Atoi(value); err == nil && n > 0 {
					payload[key] = n
					continue
				}
			} else {
				payload[key] = value
				continue
			}
		}
	}
	if tradeType := strings.TrimSpace(req.TradeType); tradeType != "" {
		payload["trade_type"] = tradeType
	}
	payload["signature"] = bepusdtSign(payload, b.config["token"])
	var response bepusdtEnvelope
	if err := b.postJSON(ctx, "/order/create-transaction", payload, &response); err != nil {
		return nil, fmt.Errorf("bepusdt create payment: %w", err)
	}
	if response.StatusCode != 200 {
		return nil, fmt.Errorf("bepusdt create payment failed: %s", response.Message)
	}
	var data bepusdtTransactionData
	if err := json.Unmarshal(response.Data, &data); err != nil {
		return nil, fmt.Errorf("bepusdt parse create response: %w", err)
	}
	if strings.TrimSpace(data.TradeID) == "" || strings.TrimSpace(data.PaymentURL) == "" {
		return nil, fmt.Errorf("bepusdt create response missing trade_id or payment_url")
	}
	return &payment.CreatePaymentResponse{TradeNo: data.TradeID, PayURL: data.PaymentURL}, nil
}

func firstNonEmptyBEpusdt(values ...string) string {
	for _, value := range values {
		if trimmed := strings.TrimSpace(value); trimmed != "" {
			return trimmed
		}
	}
	return ""
}

func (b *BEpusdt) QueryOrder(_ context.Context, tradeNo string) (*payment.QueryOrderResponse, error) {
	// BEpusdt's public API documents create/cancel and webhook notification, but
	// no order-status query endpoint. Never infer payment from an unverified API.
	return &payment.QueryOrderResponse{TradeNo: strings.TrimSpace(tradeNo), Status: payment.ProviderStatusPending}, nil
}

func (b *BEpusdt) VerifyNotification(_ context.Context, rawBody string, _ map[string]string) (*payment.PaymentNotification, error) {
	decoder := json.NewDecoder(strings.NewReader(rawBody))
	decoder.UseNumber()
	var payload map[string]any
	if err := decoder.Decode(&payload); err != nil {
		return nil, fmt.Errorf("bepusdt parse webhook: %w", err)
	}
	signature, ok := payload["signature"].(string)
	if !ok || strings.TrimSpace(signature) == "" {
		return nil, fmt.Errorf("bepusdt webhook missing signature")
	}
	if !hmac.Equal([]byte(bepusdtSign(payload, b.config["token"])), []byte(strings.ToLower(strings.TrimSpace(signature)))) {
		return nil, fmt.Errorf("bepusdt webhook invalid signature")
	}
	orderID, _ := payload["order_id"].(string)
	tradeID, _ := payload["trade_id"].(string)
	status, ok := bepusdtNumber(payload["status"])
	if strings.TrimSpace(orderID) == "" || strings.TrimSpace(tradeID) == "" || !ok {
		return nil, fmt.Errorf("bepusdt webhook missing order_id, trade_id or status")
	}
	amount, _ := bepusdtFloat(payload["amount"])
	result := payment.ProviderStatusFailed
	if status == 2 {
		result = payment.NotificationStatusSuccess
	}
	return &payment.PaymentNotification{TradeNo: strings.TrimSpace(tradeID), OrderID: strings.TrimSpace(orderID), Amount: amount, Status: result, RawData: rawBody}, nil
}

func (b *BEpusdt) Refund(context.Context, payment.RefundRequest) (*payment.RefundResponse, error) {
	return nil, fmt.Errorf("bepusdt does not support refunds")
}

func (b *BEpusdt) CancelPayment(ctx context.Context, tradeNo string) error {
	tradeNo = strings.TrimSpace(tradeNo)
	if tradeNo == "" {
		return nil
	}
	payload := map[string]any{"trade_id": tradeNo}
	payload["signature"] = bepusdtSign(payload, b.config["token"])
	var response bepusdtEnvelope
	if err := b.postJSON(ctx, "/order/cancel-transaction", payload, &response); err != nil {
		return fmt.Errorf("bepusdt cancel payment: %w", err)
	}
	if response.StatusCode != 200 {
		return fmt.Errorf("bepusdt cancel payment failed: %s", response.Message)
	}
	return nil
}

type bepusdtEnvelope struct {
	StatusCode int             `json:"status_code"`
	Message    string          `json:"message"`
	Data       json.RawMessage `json:"data"`
}

type bepusdtTransactionData struct {
	TradeID    string `json:"trade_id"`
	PaymentURL string `json:"payment_url"`
}

func (b *BEpusdt) postJSON(ctx context.Context, path string, payload map[string]any, out any) error {
	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, strings.TrimRight(b.config["apiBase"], "/")+path, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	client := b.httpClient
	if client == nil {
		client = &http.Client{Timeout: bepusdtHTTPTimeout}
	}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	data, err := io.ReadAll(io.LimitReader(resp.Body, bepusdtMaxResponseSize))
	if err != nil {
		return err
	}
	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		return fmt.Errorf("HTTP %d: %s", resp.StatusCode, summarizeBEpusdtResponse(data))
	}
	if err := json.Unmarshal(data, out); err != nil {
		return fmt.Errorf("parse response: %w", err)
	}
	return nil
}

func bepusdtSign(params map[string]any, token string) string {
	keys := make([]string, 0, len(params))
	values := make(map[string]string, len(params))
	for key, value := range params {
		if key == "signature" || value == nil {
			continue
		}
		text := bepusdtValueString(value)
		if text == "" {
			continue
		}
		keys = append(keys, key)
		values[key] = text
	}
	sort.Strings(keys)
	parts := make([]string, 0, len(keys))
	for _, key := range keys {
		parts = append(parts, key+"="+values[key])
	}
	hash := md5.Sum([]byte(strings.Join(parts, "&") + token))
	return hex.EncodeToString(hash[:])
}

func bepusdtValueString(value any) string {
	switch v := value.(type) {
	case string:
		return v
	case json.Number:
		// BEpusdt parses JSON into float64 before calculating its signature.
		// Normalize JSON numbers the same way fmt.Sprintf("%v", float64)
		// does on the BEpusdt side (e.g. 10.00 -> "10", 10.50 -> "10.5").
		parsed, err := strconv.ParseFloat(v.String(), 64)
		if err == nil {
			return strconv.FormatFloat(parsed, 'f', -1, 64)
		}
		return v.String()
	case float64:
		return strconv.FormatFloat(v, 'f', -1, 64)
	case float32:
		return strconv.FormatFloat(float64(v), 'f', -1, 32)
	case bool:
		return strconv.FormatBool(v)
	default:
		return fmt.Sprint(v)
	}
}

func bepusdtNumber(value any) (int, bool) {
	text := strings.TrimSpace(bepusdtValueString(value))
	n, err := strconv.Atoi(text)
	return n, err == nil
}

func bepusdtFloat(value any) (float64, bool) {
	n, err := strconv.ParseFloat(strings.TrimSpace(bepusdtValueString(value)), 64)
	return n, err == nil
}

func summarizeBEpusdtResponse(body []byte) string {
	text := strings.Join(strings.Fields(string(body)), " ")
	if len(text) > 512 {
		return text[:512] + "..."
	}
	if text == "" {
		return "<empty>"
	}
	return text
}

var (
	_ payment.Provider           = (*BEpusdt)(nil)
	_ payment.CancelableProvider = (*BEpusdt)(nil)
)
