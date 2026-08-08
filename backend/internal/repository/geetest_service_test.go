package repository

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/url"
	"strings"
	"testing"

	"github.com/Wei-Shaw/sub2api/internal/service"
	"github.com/stretchr/testify/require"
)

func newGeetestVerifierForTest(t *testing.T, handler http.HandlerFunc) *geetestVerifier {
	t.Helper()
	verifier, ok := NewGeetestVerifier().(*geetestVerifier)
	require.True(t, ok)
	verifier.validateURL = "http://in-process/validate"
	verifier.httpClient = &http.Client{Transport: newInProcessTransport(handler, nil)}
	return verifier
}

func TestGeetestVerifierVerifySendsSignedForm(t *testing.T) {
	received := make(chan url.Values, 1)
	verifier := newGeetestVerifierForTest(t, func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, http.MethodPost, r.Method)
		require.Equal(t, "captcha-id", r.URL.Query().Get("captcha_id"))
		require.True(t, strings.HasPrefix(r.Header.Get("Content-Type"), "application/x-www-form-urlencoded"))
		require.Equal(t, "application/json", r.Header.Get("Accept"))
		body, err := io.ReadAll(r.Body)
		require.NoError(t, err)
		values, err := url.ParseQuery(string(body))
		require.NoError(t, err)
		received <- values
		_ = json.NewEncoder(w).Encode(service.GeetestVerifyResponse{Status: "success", Result: "success"})
	})

	result, err := verifier.Verify(context.Background(), "captcha-id", "captcha-key", service.GeetestChallenge{
		LotNumber:     "lot-123",
		CaptchaOutput: "output",
		PassToken:     "pass-token",
		GenTime:       "1700000000000",
	})
	require.NoError(t, err)
	require.Equal(t, "success", result.Result)

	values := <-received
	require.Equal(t, "lot-123", values.Get("lot_number"))
	require.Equal(t, "output", values.Get("captcha_output"))
	require.Equal(t, "pass-token", values.Get("pass_token"))
	require.Equal(t, "1700000000000", values.Get("gen_time"))
	require.Equal(t, "bfc3c209b63cbcb9d7e670935e0f53016299e8780d06aa401a9b73c5d0762d25", values.Get("sign_token"))
}

func TestGeetestVerifierVerifyReturnsTransportError(t *testing.T) {
	verifier, ok := NewGeetestVerifier().(*geetestVerifier)
	require.True(t, ok)
	verifier.validateURL = "http://in-process/validate"
	verifier.httpClient = &http.Client{Transport: roundTripFunc(func(*http.Request) (*http.Response, error) {
		return nil, errors.New("dial failed")
	})}

	result, err := verifier.Verify(context.Background(), "id", "key", service.GeetestChallenge{LotNumber: "lot"})
	require.Error(t, err)
	require.Nil(t, result)
}

func TestGeetestVerifierVerifyRejectsNonOKResponse(t *testing.T) {
	verifier := newGeetestVerifierForTest(t, func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusBadGateway)
	})

	result, err := verifier.Verify(context.Background(), "id", "key", service.GeetestChallenge{LotNumber: "lot"})
	require.ErrorContains(t, err, "HTTP 502")
	require.Nil(t, result)
}

func TestGeetestVerifierVerifyRejectsInvalidJSON(t *testing.T) {
	verifier := newGeetestVerifierForTest(t, func(w http.ResponseWriter, _ *http.Request) {
		_, _ = io.WriteString(w, "not-json")
	})

	result, err := verifier.Verify(context.Background(), "id", "key", service.GeetestChallenge{LotNumber: "lot"})
	require.Error(t, err)
	require.Nil(t, result)
}

func TestGeetestVerifierVerifyReturnsVendorFailure(t *testing.T) {
	verifier := newGeetestVerifierForTest(t, func(w http.ResponseWriter, _ *http.Request) {
		_ = json.NewEncoder(w).Encode(service.GeetestVerifyResponse{Result: "fail", Reason: "pass_token invalid"})
	})

	result, err := verifier.Verify(context.Background(), "id", "key", service.GeetestChallenge{LotNumber: "lot"})
	require.NoError(t, err)
	require.Equal(t, "fail", result.Result)
}
