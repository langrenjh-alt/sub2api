package service

import (
	"context"
	"strings"
	"time"

	infraerrors "github.com/Wei-Shaw/sub2api/internal/pkg/errors"
	"github.com/Wei-Shaw/sub2api/internal/pkg/logger"
)

var (
	ErrGeetestVerificationFailed = infraerrors.BadRequest("GEETEST_VERIFICATION_FAILED", "geetest verification failed")
	ErrGeetestNotConfigured      = infraerrors.ServiceUnavailable("GEETEST_NOT_CONFIGURED", "geetest not configured")
	ErrGeetestServiceUnavailable = infraerrors.ServiceUnavailable("GEETEST_SERVICE_UNAVAILABLE", "geetest service unavailable")
)

// GeetestChallenge contains the four values returned by a successful GEETEST v4 client challenge.
type GeetestChallenge struct {
	LotNumber     string
	CaptchaOutput string
	PassToken     string
	GenTime       string
}

func (c GeetestChallenge) normalized() GeetestChallenge {
	return GeetestChallenge{
		LotNumber:     strings.TrimSpace(c.LotNumber),
		CaptchaOutput: strings.TrimSpace(c.CaptchaOutput),
		PassToken:     strings.TrimSpace(c.PassToken),
		GenTime:       strings.TrimSpace(c.GenTime),
	}
}

func (c GeetestChallenge) valid() bool {
	return c.LotNumber != "" && c.CaptchaOutput != "" && c.PassToken != "" && c.GenTime != ""
}

// GeetestVerifyResponse is the response returned by GEETEST v4's validate API.
type GeetestVerifyResponse struct {
	Result      string                 `json:"result"`
	Reason      string                 `json:"reason"`
	Status      string                 `json:"status,omitempty"`
	Code        string                 `json:"code,omitempty"`
	Message     string                 `json:"msg,omitempty"`
	CaptchaArgs map[string]interface{} `json:"captcha_args,omitempty"`
}

// GeetestVerifier verifies a completed GEETEST v4 challenge with the vendor API.
type GeetestVerifier interface {
	Verify(ctx context.Context, captchaID, captchaKey string, challenge GeetestChallenge) (*GeetestVerifyResponse, error)
}

// GeetestReplayGuard atomically claims a completed challenge before it is sent
// to the vendor. Claims are retained on every outcome so a lot number cannot be
// replayed concurrently or retried against another authentication action.
type GeetestReplayGuard interface {
	Claim(ctx context.Context, captchaID, lotNumber string, ttl time.Duration) (bool, error)
}

const geetestReplayTTL = 15 * time.Minute

type GeetestService struct {
	settingService *SettingService
	verifier       GeetestVerifier
	replayGuard    GeetestReplayGuard
}

func NewGeetestService(settingService *SettingService, verifier GeetestVerifier, replayGuard GeetestReplayGuard) *GeetestService {
	return &GeetestService{settingService: settingService, verifier: verifier, replayGuard: replayGuard}
}

func (s *GeetestService) IsEnabled(ctx context.Context) bool {
	return s != nil && s.settingService != nil && s.settingService.IsGeetestEnabled(ctx)
}

// Verify validates a challenge. Authentication is a high-risk action, so
// upstream transport and protocol failures are handled fail-closed.
func (s *GeetestService) Verify(ctx context.Context, challenge GeetestChallenge) error {
	_, err := s.VerifyWithState(ctx, challenge)
	return err
}

// VerifyWithState returns whether GEETEST was enabled for the exact settings
// snapshot used by this verification. Callers use the boolean when binding a
// successful challenge to a later email-code registration step.
func (s *GeetestService) VerifyWithState(ctx context.Context, challenge GeetestChallenge) (bool, error) {
	if s == nil || s.settingService == nil {
		return false, ErrGeetestNotConfigured
	}

	enabled, captchaID, captchaKey, err := s.settingService.GetGeetestConfig(ctx)
	if err != nil {
		logger.LegacyPrintf("service.geetest", "[GEETEST] Failed to load settings: %v", err)
		return false, ErrGeetestServiceUnavailable
	}
	if !enabled {
		return false, nil
	}

	if captchaID == "" || captchaKey == "" || s.verifier == nil || s.replayGuard == nil {
		logger.LegacyPrintf("service.geetest", "%s", "[GEETEST] Enabled but credentials, verifier, or replay guard are not configured")
		return true, ErrGeetestNotConfigured
	}

	challenge = challenge.normalized()
	if !challenge.valid() {
		return true, ErrGeetestVerificationFailed
	}
	claimed, err := s.replayGuard.Claim(ctx, captchaID, challenge.LotNumber, geetestReplayTTL)
	if err != nil {
		logger.LegacyPrintf("service.geetest", "[GEETEST] Replay guard unavailable: %v", err)
		return true, ErrGeetestServiceUnavailable
	}
	if !claimed {
		return true, ErrGeetestVerificationFailed
	}

	result, err := s.verifier.Verify(ctx, captchaID, captchaKey, challenge)
	if err != nil {
		logger.LegacyPrintf("service.geetest", "[GEETEST] Validate API unavailable: %v", err)
		return true, ErrGeetestServiceUnavailable
	}
	if result == nil {
		return true, ErrGeetestServiceUnavailable
	}
	if result.Status == "error" {
		logger.LegacyPrintf("service.geetest", "[GEETEST] Validate API error response: code=%s", result.Code)
		return true, ErrGeetestVerificationFailed
	}
	if result.Result != "success" {
		logger.LegacyPrintf("service.geetest", "[GEETEST] Verification failed: %s", result.Reason)
		return true, ErrGeetestVerificationFailed
	}

	return true, nil
}

func (s *AuthService) VerifyGeetest(ctx context.Context, challenge GeetestChallenge) error {
	_, err := s.VerifyGeetestWithState(ctx, challenge)
	return err
}

func (s *AuthService) VerifyGeetestWithState(ctx context.Context, challenge GeetestChallenge) (bool, error) {
	if s == nil {
		return false, nil
	}
	if s.geetestService == nil {
		if s.settingService == nil {
			return false, nil
		}
		enabled, _, _, err := s.settingService.GetGeetestConfig(ctx)
		if err != nil {
			return false, ErrGeetestServiceUnavailable
		}
		if enabled {
			return true, ErrGeetestNotConfigured
		}
		return false, nil
	}
	return s.geetestService.VerifyWithState(ctx, challenge)
}

// VerifyGeetestForRegister avoids consuming a one-time challenge twice when
// email verification already gated the verification-code request.
func (s *AuthService) VerifyGeetestForRegister(ctx context.Context, challenge GeetestChallenge, verifyCode string) error {
	if s == nil {
		return nil
	}
	if s.IsEmailVerifyEnabled(ctx) && strings.TrimSpace(verifyCode) != "" {
		return nil
	}
	return s.VerifyGeetest(ctx, challenge)
}

func (s *AuthService) isGeetestRequired(ctx context.Context) (bool, error) {
	if s == nil || s.settingService == nil {
		return false, nil
	}
	enabled, _, _, err := s.settingService.GetGeetestConfig(ctx)
	return enabled, err
}
