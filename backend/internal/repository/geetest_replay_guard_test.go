package repository

import (
	"context"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/require"
)

func TestGeetestReplayGuardClaimsLotNumberOnce(t *testing.T) {
	mr := miniredis.RunT(t)
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	t.Cleanup(func() { _ = rdb.Close() })

	guard := NewGeetestReplayGuard(rdb)
	claimed, err := guard.Claim(context.Background(), "captcha-id", "lot-number", time.Minute)
	require.NoError(t, err)
	require.True(t, claimed)

	claimed, err = guard.Claim(context.Background(), "captcha-id", "lot-number", time.Minute)
	require.NoError(t, err)
	require.False(t, claimed)

	claimed, err = guard.Claim(context.Background(), "other-captcha-id", "lot-number", time.Minute)
	require.NoError(t, err)
	require.True(t, claimed)
}

func TestGeetestReplayGuardFailsWhenRedisUnavailable(t *testing.T) {
	guard := NewGeetestReplayGuard(nil)
	claimed, err := guard.Claim(context.Background(), "captcha-id", "lot-number", time.Minute)
	require.Error(t, err)
	require.False(t, claimed)
}
