//go:build unit

package service

import (
	"context"
	"errors"
	"testing"

	"github.com/Wei-Shaw/sub2api/internal/config"
	"github.com/stretchr/testify/require"
)

type homepageSettingRepoStub struct {
	values           map[string]string
	updates          map[string]string
	getMultipleErr   error
	getMultipleCalls int
	lastMultipleKeys []string
}

func (s *homepageSettingRepoStub) Get(context.Context, string) (*Setting, error) {
	panic("unexpected Get call")
}

func (s *homepageSettingRepoStub) GetValue(context.Context, string) (string, error) {
	panic("unexpected GetValue call")
}

func (s *homepageSettingRepoStub) Set(context.Context, string, string) error {
	panic("unexpected Set call")
}

func (s *homepageSettingRepoStub) GetMultiple(_ context.Context, keys []string) (map[string]string, error) {
	s.getMultipleCalls++
	s.lastMultipleKeys = append([]string(nil), keys...)
	if s.getMultipleErr != nil {
		return nil, s.getMultipleErr
	}
	out := make(map[string]string, len(keys))
	for _, key := range keys {
		if value, ok := s.values[key]; ok {
			out[key] = value
		}
	}
	return out, nil
}

func (s *homepageSettingRepoStub) SetMultiple(_ context.Context, settings map[string]string) error {
	s.updates = make(map[string]string, len(settings))
	for key, value := range settings {
		s.updates[key] = value
	}
	return nil
}

func (s *homepageSettingRepoStub) GetAll(context.Context) (map[string]string, error) {
	out := make(map[string]string, len(s.values))
	for key, value := range s.values {
		out[key] = value
	}
	return out, nil
}

func (s *homepageSettingRepoStub) Delete(context.Context, string) error {
	panic("unexpected Delete call")
}

func TestHomepageStatusGroupIDsNormalization(t *testing.T) {
	ids := []int64{0, -1, 3, 3, 2}
	for id := int64(4); id <= 150; id++ {
		ids = append(ids, id)
	}

	got := normalizeHomepageStatusGroupIDs(ids)
	require.Len(t, got, maxHomepageStatusGroupIDs)
	require.Equal(t, []int64{3, 2, 4, 5}, got[:4])
	require.Equal(t, int64(101), got[len(got)-1])
	require.Equal(t, []int64{}, parseHomepageStatusGroupIDs("not-json"))
	require.Equal(t, []int64{8, 5}, parseHomepageStatusGroupIDs(`[8,0,8,-2,5]`))
}

func TestSettingServiceHomepageStatusSettingsParseAndPersist(t *testing.T) {
	repo := &homepageSettingRepoStub{values: map[string]string{
		SettingKeyHomepageStatusEnabled:  "true",
		SettingKeyHomepageStatusGroupIDs: `[9,0,9,4]`,
	}}
	settingsService := NewSettingService(repo, &config.Config{})

	settings, err := settingsService.GetAllSettings(context.Background())
	require.NoError(t, err)
	require.True(t, settings.HomepageStatusEnabled)
	require.Equal(t, []int64{9, 4}, settings.HomepageStatusGroupIDs)

	err = settingsService.UpdateSettings(context.Background(), &SystemSettings{
		HomepageStatusEnabled:  true,
		HomepageStatusGroupIDs: []int64{7, -1, 7, 2},
	})
	require.NoError(t, err)
	require.Equal(t, "true", repo.updates[SettingKeyHomepageStatusEnabled])
	require.JSONEq(t, `[7,2]`, repo.updates[SettingKeyHomepageStatusGroupIDs])
}

func TestSettingServiceHomepageStatusSettingsDefaultDisabled(t *testing.T) {
	settingsService := NewSettingService(&homepageSettingRepoStub{values: map[string]string{}}, &config.Config{})

	settings, err := settingsService.GetAllSettings(context.Background())
	require.NoError(t, err)
	require.False(t, settings.HomepageStatusEnabled)
	require.Equal(t, []int64{}, settings.HomepageStatusGroupIDs)
}

func TestSettingServiceGetHomepageStatusRuntimeFailsClosed(t *testing.T) {
	repo := &homepageSettingRepoStub{
		getMultipleErr: errors.New("settings unavailable"),
	}
	settingsService := NewSettingService(repo, &config.Config{})

	runtime := settingsService.GetHomepageStatusRuntime(context.Background())
	require.False(t, runtime.Enabled)
	require.Equal(t, []int64{}, runtime.GroupIDs)
	require.False(t, runtime.ChannelMonitorEnabled)
	require.Equal(t, 1, repo.getMultipleCalls)
}

func TestSettingServiceGetHomepageStatusRuntimeMissingMonitorSwitchFailsClosed(t *testing.T) {
	repo := &homepageSettingRepoStub{values: map[string]string{
		SettingKeyHomepageStatusEnabled:  "true",
		SettingKeyHomepageStatusGroupIDs: `[4]`,
	}}
	settingsService := NewSettingService(repo, &config.Config{})

	runtime := settingsService.GetHomepageStatusRuntime(context.Background())
	require.True(t, runtime.Enabled)
	require.Equal(t, []int64{4}, runtime.GroupIDs)
	require.False(t, runtime.ChannelMonitorEnabled)
	require.Equal(t, 1, repo.getMultipleCalls)
}

func TestSettingServiceGetHomepageStatusRuntimeReadsPublicSwitchesTogether(t *testing.T) {
	repo := &homepageSettingRepoStub{values: map[string]string{
		SettingKeyHomepageStatusEnabled:  "true",
		SettingKeyHomepageStatusGroupIDs: `[4,2]`,
		SettingKeyChannelMonitorEnabled:  "true",
	}}
	settingsService := NewSettingService(repo, &config.Config{})

	runtime := settingsService.GetHomepageStatusRuntime(context.Background())
	require.True(t, runtime.Enabled)
	require.Equal(t, []int64{4, 2}, runtime.GroupIDs)
	require.True(t, runtime.ChannelMonitorEnabled)
	require.Equal(t, 1, repo.getMultipleCalls)
	require.ElementsMatch(t, []string{
		SettingKeyHomepageStatusEnabled,
		SettingKeyHomepageStatusGroupIDs,
		SettingKeyChannelMonitorEnabled,
	}, repo.lastMultipleKeys)
}
