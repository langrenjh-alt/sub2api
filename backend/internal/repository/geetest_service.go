package repository

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/Wei-Shaw/sub2api/internal/pkg/httpclient"
	"github.com/Wei-Shaw/sub2api/internal/service"
)

const geetestValidateURL = "https://gcaptcha4.geetest.com/validate"

type geetestVerifier struct {
	httpClient  *http.Client
	validateURL string
}

func NewGeetestVerifier() service.GeetestVerifier {
	sharedClient, err := httpclient.GetClient(httpclient.Options{
		Timeout:            3 * time.Second,
		ValidateResolvedIP: true,
	})
	if err != nil {
		sharedClient = &http.Client{Timeout: 3 * time.Second}
	}
	return &geetestVerifier{httpClient: sharedClient, validateURL: geetestValidateURL}
}

func (v *geetestVerifier) Verify(ctx context.Context, captchaID, captchaKey string, challenge service.GeetestChallenge) (*service.GeetestVerifyResponse, error) {
	endpoint, err := url.Parse(v.validateURL)
	if err != nil {
		return nil, fmt.Errorf("parse validate URL: %w", err)
	}
	query := endpoint.Query()
	query.Set("captcha_id", captchaID)
	endpoint.RawQuery = query.Encode()

	form := url.Values{}
	form.Set("lot_number", challenge.LotNumber)
	form.Set("captcha_output", challenge.CaptchaOutput)
	form.Set("pass_token", challenge.PassToken)
	form.Set("gen_time", challenge.GenTime)
	form.Set("sign_token", geetestSignToken(captchaKey, challenge.LotNumber))

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint.String(), strings.NewReader(form.Encode()))
	if err != nil {
		return nil, fmt.Errorf("create validate request: %w", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")

	resp, err := v.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("send validate request: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("validate API returned HTTP %d", resp.StatusCode)
	}

	var result service.GeetestVerifyResponse
	if err := json.NewDecoder(io.LimitReader(resp.Body, 1<<20)).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode validate response: %w", err)
	}
	return &result, nil
}

func geetestSignToken(captchaKey, lotNumber string) string {
	mac := hmac.New(sha256.New, []byte(captchaKey))
	_, _ = mac.Write([]byte(lotNumber))
	return hex.EncodeToString(mac.Sum(nil))
}
