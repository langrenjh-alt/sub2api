package repository

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"strings"
	"time"

	"github.com/Wei-Shaw/sub2api/internal/service"
	"github.com/redis/go-redis/v9"
)

const geetestReplayKeyPrefix = "geetest_used:"

type geetestReplayGuard struct {
	rdb *redis.Client
}

func NewGeetestReplayGuard(rdb *redis.Client) service.GeetestReplayGuard {
	return &geetestReplayGuard{rdb: rdb}
}

func (g *geetestReplayGuard) Claim(ctx context.Context, captchaID, lotNumber string, ttl time.Duration) (bool, error) {
	if g == nil || g.rdb == nil {
		return false, errors.New("GEETEST replay cache is not configured")
	}
	if strings.TrimSpace(captchaID) == "" || strings.TrimSpace(lotNumber) == "" || ttl <= 0 {
		return false, errors.New("invalid GEETEST replay claim")
	}
	sum := sha256.Sum256([]byte(captchaID + "\x00" + lotNumber))
	key := geetestReplayKeyPrefix + hex.EncodeToString(sum[:])
	return g.rdb.SetNX(ctx, key, "1", ttl).Result()
}
