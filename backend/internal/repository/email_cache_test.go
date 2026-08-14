//go:build unit

package repository

import (
	"context"
	"sync"
	"testing"
	"time"

	"github.com/Wei-Shaw/sub2api/internal/service"
	"github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/require"
)

func TestVerifyCodeKey(t *testing.T) {
	tests := []struct {
		name     string
		email    string
		expected string
	}{
		{
			name:     "normal_email",
			email:    "user@example.com",
			expected: "verify_code:user@example.com",
		},
		{
			name:     "empty_email",
			email:    "",
			expected: "verify_code:",
		},
		{
			name:     "email_with_plus",
			email:    "user+tag@example.com",
			expected: "verify_code:user+tag@example.com",
		},
		{
			name:     "email_with_special_chars",
			email:    "user.name+tag@sub.domain.com",
			expected: "verify_code:user.name+tag@sub.domain.com",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := verifyCodeKey(tc.email)
			require.Equal(t, tc.expected, got)
		})
	}
}

func TestConsumeVerificationCodeScopesAndAtomicallyConsumes(t *testing.T) {
	mr := miniredis.RunT(t)
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	t.Cleanup(func() { _ = rdb.Close() })
	cache := NewEmailCache(rdb).(*emailCache)
	ctx := context.Background()
	email := "registration@example.com"
	require.NoError(t, cache.SetVerificationCode(ctx, email, &service.VerificationCodeData{
		Code:              "123456",
		CreatedAt:         time.Now(),
		ExpiresAt:         time.Now().Add(time.Minute),
		Purpose:           service.VerificationCodePurposeRegistration,
		TurnstileVerified: true,
		GeetestVerified:   true,
	}, time.Minute))

	status, err := cache.ConsumeVerificationCode(ctx, email, service.VerificationCodeConsumeRequest{
		Code:           "123456",
		Purpose:        service.VerificationCodePurposePendingOAuth,
		RequireGeetest: true,
		MaxAttempts:    5,
	})
	require.NoError(t, err)
	require.Equal(t, service.VerificationCodeConsumeRequirementsMismatch, status)

	const workers = 8
	statuses := make(chan service.VerificationCodeConsumeStatus, workers)
	errorsCh := make(chan error, workers)
	var wg sync.WaitGroup
	for i := 0; i < workers; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			status, err := cache.ConsumeVerificationCode(ctx, email, service.VerificationCodeConsumeRequest{
				Code:             "123456",
				Purpose:          service.VerificationCodePurposeRegistration,
				RequireTurnstile: true,
				RequireGeetest:   true,
				MaxAttempts:      5,
			})
			statuses <- status
			errorsCh <- err
		}()
	}
	wg.Wait()
	close(statuses)
	close(errorsCh)

	for err := range errorsCh {
		require.NoError(t, err)
	}
	successes := 0
	for status := range statuses {
		if status == service.VerificationCodeConsumeSuccess {
			successes++
		}
	}
	require.Equal(t, 1, successes)
}
