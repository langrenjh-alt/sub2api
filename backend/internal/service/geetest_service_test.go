//go:build unit

package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/Wei-Shaw/sub2api/internal/config"
	"github.com/stretchr/testify/require"
)

type geetestVerifierStub struct {
	called     int
	captchaID  string
	captchaKey string
	challenge  GeetestChallenge
	result     *GeetestVerifyResponse
	err        error
}

type geetestReplayGuardStub struct {
	called  int
	claimed bool
	err     error
}

func (s *geetestReplayGuardStub) Claim(_ context.Context, _, _ string, _ time.Duration) (bool, error) {
	s.called++
	if s.err != nil {
		return false, s.err
	}
	return s.claimed, nil
}

func (s *geetestVerifierStub) Verify(_ context.Context, captchaID, captchaKey string, challenge GeetestChallenge) (*GeetestVerifyResponse, error) {
	s.called++
	s.captchaID = captchaID
	s.captchaKey = captchaKey
	s.challenge = challenge
	if s.err != nil {
		return nil, s.err
	}
	if s.result != nil {
		return s.result, nil
	}
	return &GeetestVerifyResponse{Result: "success"}, nil
}

func newGeetestServiceForTest(settings map[string]string, verifier GeetestVerifier) (*SettingService, *GeetestService) {
	settingService := NewSettingService(&settingRepoStub{values: settings}, &config.Config{})
	return settingService, NewGeetestService(settingService, verifier, &geetestReplayGuardStub{claimed: true})
}

func validGeetestChallenge() GeetestChallenge {
	return GeetestChallenge{
		LotNumber:     "lot",
		CaptchaOutput: "output",
		PassToken:     "pass",
		GenTime:       "1700000000000",
	}
}

func TestGeetestServiceVerifySkipsWhenDisabled(t *testing.T) {
	verifier := &geetestVerifierStub{}
	_, svc := newGeetestServiceForTest(map[string]string{}, verifier)
	require.NoError(t, svc.Verify(context.Background(), GeetestChallenge{}))
	require.Zero(t, verifier.called)
}

func TestGeetestServiceVerifyRequiresCredentials(t *testing.T) {
	_, svc := newGeetestServiceForTest(map[string]string{SettingKeyGeetestEnabled: "true"}, &geetestVerifierStub{})
	require.ErrorIs(t, svc.Verify(context.Background(), validGeetestChallenge()), ErrGeetestNotConfigured)
}

func TestGeetestServiceVerifyRequiresCompleteChallenge(t *testing.T) {
	_, svc := newGeetestServiceForTest(map[string]string{
		SettingKeyGeetestEnabled:    "true",
		SettingKeyGeetestCaptchaID:  "id",
		SettingKeyGeetestCaptchaKey: "key",
	}, &geetestVerifierStub{})
	require.ErrorIs(t, svc.Verify(context.Background(), GeetestChallenge{LotNumber: "lot"}), ErrGeetestVerificationFailed)
}

func TestGeetestServiceVerifyAcceptsSuccess(t *testing.T) {
	verifier := &geetestVerifierStub{}
	_, svc := newGeetestServiceForTest(map[string]string{
		SettingKeyGeetestEnabled:    "true",
		SettingKeyGeetestCaptchaID:  "id",
		SettingKeyGeetestCaptchaKey: "key",
	}, verifier)
	require.NoError(t, svc.Verify(context.Background(), validGeetestChallenge()))
	require.Equal(t, "id", verifier.captchaID)
	require.Equal(t, "key", verifier.captchaKey)
	require.Equal(t, validGeetestChallenge(), verifier.challenge)
}

func TestGeetestServiceVerifyRejectsVendorFailure(t *testing.T) {
	verifier := &geetestVerifierStub{result: &GeetestVerifyResponse{Result: "fail", Reason: "invalid"}}
	_, svc := newGeetestServiceForTest(map[string]string{
		SettingKeyGeetestEnabled:    "true",
		SettingKeyGeetestCaptchaID:  "id",
		SettingKeyGeetestCaptchaKey: "key",
	}, verifier)
	require.ErrorIs(t, svc.Verify(context.Background(), validGeetestChallenge()), ErrGeetestVerificationFailed)
}

func TestGeetestServiceVerifyFailsClosedWhenVendorUnavailable(t *testing.T) {
	verifier := &geetestVerifierStub{err: errors.New("timeout")}
	_, svc := newGeetestServiceForTest(map[string]string{
		SettingKeyGeetestEnabled:    "true",
		SettingKeyGeetestCaptchaID:  "id",
		SettingKeyGeetestCaptchaKey: "key",
	}, verifier)
	require.ErrorIs(t, svc.Verify(context.Background(), validGeetestChallenge()), ErrGeetestServiceUnavailable)
}

func TestGeetestServiceVerifyFailsClosedOnErrorStatus(t *testing.T) {
	verifier := &geetestVerifierStub{result: &GeetestVerifyResponse{Status: "error", Code: "50000"}}
	_, svc := newGeetestServiceForTest(map[string]string{
		SettingKeyGeetestEnabled:    "true",
		SettingKeyGeetestCaptchaID:  "id",
		SettingKeyGeetestCaptchaKey: "key",
	}, verifier)
	require.ErrorIs(t, svc.Verify(context.Background(), validGeetestChallenge()), ErrGeetestVerificationFailed)
}

func TestGeetestServiceVerifyRejectsReplayBeforeVendorCall(t *testing.T) {
	verifier := &geetestVerifierStub{}
	settingService := NewSettingService(&settingRepoStub{values: map[string]string{
		SettingKeyGeetestEnabled:    "true",
		SettingKeyGeetestCaptchaID:  "id",
		SettingKeyGeetestCaptchaKey: "key",
	}}, &config.Config{})
	svc := NewGeetestService(settingService, verifier, &geetestReplayGuardStub{claimed: false})
	require.ErrorIs(t, svc.Verify(context.Background(), validGeetestChallenge()), ErrGeetestVerificationFailed)
	require.Zero(t, verifier.called)
}

func TestGeetestServiceVerifyFailsClosedOnSettingsError(t *testing.T) {
	verifier := &geetestVerifierStub{}
	settingService := NewSettingService(&settingRepoStub{err: errors.New("database unavailable")}, &config.Config{})
	guard := &geetestReplayGuardStub{claimed: true}
	svc := NewGeetestService(settingService, verifier, guard)
	require.ErrorIs(t, svc.Verify(context.Background(), validGeetestChallenge()), ErrGeetestServiceUnavailable)
	require.Zero(t, verifier.called)
	require.Zero(t, guard.called)
}

func TestGeetestServiceVerifyFailsClosedOnReplayCacheError(t *testing.T) {
	verifier := &geetestVerifierStub{}
	settingService := NewSettingService(&settingRepoStub{values: map[string]string{
		SettingKeyGeetestEnabled:    "true",
		SettingKeyGeetestCaptchaID:  "id",
		SettingKeyGeetestCaptchaKey: "key",
	}}, &config.Config{})
	svc := NewGeetestService(settingService, verifier, &geetestReplayGuardStub{err: errors.New("redis unavailable")})
	require.ErrorIs(t, svc.Verify(context.Background(), validGeetestChallenge()), ErrGeetestServiceUnavailable)
	require.Zero(t, verifier.called)
}

func TestAuthServiceVerifyGeetestRejectsMissingInjectedServiceWhenEnabled(t *testing.T) {
	settingService, _ := newGeetestServiceForTest(map[string]string{SettingKeyGeetestEnabled: "true"}, &geetestVerifierStub{})
	authService := NewAuthService(nil, nil, nil, nil, &config.Config{}, settingService, nil, nil, nil, nil, nil, nil, nil)
	require.ErrorIs(t, authService.VerifyGeetest(context.Background(), GeetestChallenge{}), ErrGeetestNotConfigured)
}

func TestAuthServiceVerifyGeetestForRegisterSkipsDuplicateChallenge(t *testing.T) {
	verifier := &geetestVerifierStub{}
	settingService, geetestService := newGeetestServiceForTest(map[string]string{
		SettingKeyEmailVerifyEnabled: "true",
		SettingKeyGeetestEnabled:     "true",
		SettingKeyGeetestCaptchaID:   "id",
		SettingKeyGeetestCaptchaKey:  "key",
	}, verifier)
	authService := NewAuthService(nil, nil, nil, nil, &config.Config{}, settingService, nil, nil, nil, nil, nil, nil, nil)
	authService.geetestService = geetestService

	require.NoError(t, authService.VerifyGeetestForRegister(context.Background(), GeetestChallenge{}, "123456"))
	require.Zero(t, verifier.called)
}
