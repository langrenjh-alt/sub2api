//go:build unit

package service

import (
	"context"
	"errors"
	"testing"

	"github.com/Wei-Shaw/sub2api/internal/config"
	"github.com/stretchr/testify/require"
)

type turnstileVerifierSpy struct {
	called    int
	lastToken string
	result    *TurnstileVerifyResponse
	err       error
}

func (s *turnstileVerifierSpy) VerifyToken(_ context.Context, _ string, token, _ string) (*TurnstileVerifyResponse, error) {
	s.called++
	s.lastToken = token
	if s.err != nil {
		return nil, s.err
	}
	if s.result != nil {
		return s.result, nil
	}
	return &TurnstileVerifyResponse{Success: true}, nil
}

func newAuthServiceForRegisterTurnstileTest(settings map[string]string, verifier TurnstileVerifier) *AuthService {
	cfg := &config.Config{
		Server: config.ServerConfig{
			Mode: "release",
		},
		Turnstile: config.TurnstileConfig{
			Required: true,
		},
	}

	settingService := NewSettingService(&settingRepoStub{values: settings}, cfg)
	turnstileService := NewTurnstileService(settingService, verifier)

	return NewAuthService(
		nil, // entClient
		&userRepoStub{},
		nil, // redeemRepo
		nil, // refreshTokenCache
		cfg,
		settingService,
		nil, // emailService
		turnstileService,
		nil, // emailQueueService
		nil, // promoService
		nil, // defaultSubAssigner
		nil, // affiliateService
		nil, // userPlatformQuotaRepo
	)
}

func TestAuthService_VerifyTurnstileForRegister_SkipWhenEmailVerifyCodeProvided(t *testing.T) {
	verifier := &turnstileVerifierSpy{}
	service := newAuthServiceForRegisterTurnstileTest(map[string]string{
		SettingKeyEmailVerifyEnabled:  "true",
		SettingKeyTurnstileEnabled:    "true",
		SettingKeyTurnstileSecretKey:  "secret",
		SettingKeyRegistrationEnabled: "true",
	}, verifier)

	err := service.VerifyTurnstileForRegister(context.Background(), "", "127.0.0.1", "123456")
	require.NoError(t, err)
	require.Equal(t, 0, verifier.called)
}

func TestAuthService_VerifyTurnstileForRegister_RequireWhenVerifyCodeMissing(t *testing.T) {
	verifier := &turnstileVerifierSpy{}
	service := newAuthServiceForRegisterTurnstileTest(map[string]string{
		SettingKeyEmailVerifyEnabled: "true",
		SettingKeyTurnstileEnabled:   "true",
		SettingKeyTurnstileSecretKey: "secret",
	}, verifier)

	err := service.VerifyTurnstileForRegister(context.Background(), "", "127.0.0.1", "")
	require.ErrorIs(t, err, ErrTurnstileVerificationFailed)
}

func TestAuthService_VerifyTurnstileForRegister_NoSkipWhenEmailVerifyDisabled(t *testing.T) {
	verifier := &turnstileVerifierSpy{}
	service := newAuthServiceForRegisterTurnstileTest(map[string]string{
		SettingKeyEmailVerifyEnabled: "false",
		SettingKeyTurnstileEnabled:   "true",
		SettingKeyTurnstileSecretKey: "secret",
	}, verifier)

	err := service.VerifyTurnstileForRegister(context.Background(), "turnstile-token", "127.0.0.1", "123456")
	require.NoError(t, err)
	require.Equal(t, 1, verifier.called)
	require.Equal(t, "turnstile-token", verifier.lastToken)
}

func TestTurnstileService_VerifyTokenWithState_ReportsExactVerificationState(t *testing.T) {
	verifier := &turnstileVerifierSpy{}
	disabledSettings := NewSettingService(&settingRepoStub{values: map[string]string{
		SettingKeyTurnstileEnabled: "false",
	}}, &config.Config{})

	verified, err := NewTurnstileService(disabledSettings, verifier).
		VerifyTokenWithState(context.Background(), "unused", "127.0.0.1")
	require.NoError(t, err)
	require.False(t, verified)
	require.Zero(t, verifier.called)

	enabledSettings := NewSettingService(&settingRepoStub{values: map[string]string{
		SettingKeyTurnstileEnabled:   "true",
		SettingKeyTurnstileSecretKey: "secret",
	}}, &config.Config{})
	verified, err = NewTurnstileService(enabledSettings, verifier).
		VerifyTokenWithState(context.Background(), "turnstile-token", "127.0.0.1")
	require.NoError(t, err)
	require.True(t, verified)
	require.Equal(t, 1, verifier.called)
}

func TestTurnstileService_VerifyTokenWithState_SettingsFailureIsFailClosed(t *testing.T) {
	verifier := &turnstileVerifierSpy{}
	settings := NewSettingService(&settingRepoStub{err: errors.New("database unavailable")}, &config.Config{})

	verified, err := NewTurnstileService(settings, verifier).
		VerifyTokenWithState(context.Background(), "turnstile-token", "127.0.0.1")

	require.ErrorIs(t, err, ErrTurnstileNotConfigured)
	require.False(t, verified)
	require.Zero(t, verifier.called)
}

func TestTurnstileService_VerifyTokenWithState_MissingVerifierIsFailClosed(t *testing.T) {
	settings := NewSettingService(&settingRepoStub{values: map[string]string{
		SettingKeyTurnstileEnabled:   "true",
		SettingKeyTurnstileSecretKey: "secret",
	}}, &config.Config{})

	verified, err := NewTurnstileService(settings, nil).
		VerifyTokenWithState(context.Background(), "turnstile-token", "127.0.0.1")

	require.ErrorIs(t, err, ErrTurnstileNotConfigured)
	require.False(t, verified)
}

func TestAuthService_VerifyTurnstileWithState_MissingServiceIsFailClosedWhenEnabled(t *testing.T) {
	settings := NewSettingService(&settingRepoStub{values: map[string]string{
		SettingKeyTurnstileEnabled:   "true",
		SettingKeyTurnstileSecretKey: "secret",
	}}, &config.Config{})
	authService := NewAuthService(
		nil,
		&userRepoStub{},
		nil,
		nil,
		&config.Config{},
		settings,
		nil,
		nil,
		nil,
		nil,
		nil,
		nil,
		nil,
	)

	verified, err := authService.VerifyTurnstileWithState(context.Background(), "turnstile-token", "127.0.0.1")

	require.ErrorIs(t, err, ErrTurnstileNotConfigured)
	require.False(t, verified)
}
