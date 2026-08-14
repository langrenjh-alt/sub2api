//go:build unit

package service

import (
	"context"
	"errors"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

type homepageStatusSettingsStub struct {
	homepage      HomepageStatusRuntime
	homepageCalls int
}

func (s *homepageStatusSettingsStub) GetHomepageStatusRuntime(context.Context) HomepageStatusRuntime {
	s.homepageCalls++
	return s.homepage
}

type homepageStatusGroupReaderStub struct {
	groups []Group
	calls  int
}

func (s *homepageStatusGroupReaderStub) ListActive(context.Context) ([]Group, error) {
	s.calls++
	return s.groups, nil
}

type homepageStatusMonitorReaderStub struct {
	monitors          []*ChannelMonitor
	latest            map[int64][]*ChannelMonitorLatest
	availability      map[int64][]*ChannelMonitorAvailability
	listErr           error
	latestErr         error
	availabilityErr   error
	listCalls         int
	latestCalls       int
	availabilityCalls int
	latestIDs         []int64
	availabilityIDs   []int64
	windowDays        int
}

func (s *homepageStatusMonitorReaderStub) ListEnabled(context.Context) ([]*ChannelMonitor, error) {
	s.listCalls++
	return s.monitors, s.listErr
}

func (s *homepageStatusMonitorReaderStub) ListLatestForMonitorIDs(_ context.Context, ids []int64) (map[int64][]*ChannelMonitorLatest, error) {
	s.latestCalls++
	s.latestIDs = append([]int64(nil), ids...)
	return s.latest, s.latestErr
}

func (s *homepageStatusMonitorReaderStub) ComputeAvailabilityForMonitors(_ context.Context, ids []int64, windowDays int) (map[int64][]*ChannelMonitorAvailability, error) {
	s.availabilityCalls++
	s.availabilityIDs = append([]int64(nil), ids...)
	s.windowDays = windowDays
	return s.availability, s.availabilityErr
}

func TestHomepageStatusServiceDisabledSkipsDataRepositories(t *testing.T) {
	settings := &homepageStatusSettingsStub{homepage: HomepageStatusRuntime{GroupIDs: []int64{1}}}
	groups := &homepageStatusGroupReaderStub{}
	monitors := &homepageStatusMonitorReaderStub{}
	svc := NewHomepageStatusService(groups, monitors, settings)

	summary, err := svc.GetSummary(context.Background())
	require.NoError(t, err)
	require.False(t, summary.Enabled)
	require.Equal(t, []HomepageStatusGroup{}, summary.Groups)
	require.Equal(t, []HomepageStatusMonitor{}, summary.Monitors)
	require.Equal(t, 0, groups.calls)
	require.Equal(t, 0, monitors.listCalls)
	require.Equal(t, 1, settings.homepageCalls)
}

func TestHomepageStatusServiceBuildsAllowlistedSummary(t *testing.T) {
	checkedAt := time.Date(2026, time.July, 26, 1, 2, 3, 0, time.FixedZone("CST", 8*60*60))
	settings := &homepageStatusSettingsStub{
		homepage: HomepageStatusRuntime{Enabled: true, GroupIDs: []int64{3, 1}, ChannelMonitorEnabled: true},
	}
	groups := &homepageStatusGroupReaderStub{groups: []Group{
		{ID: 1, Name: "Alpha", Platform: PlatformAnthropic, RateMultiplier: 1.25, Status: StatusActive},
		{ID: 2, Name: "Inactive", Platform: PlatformOpenAI, RateMultiplier: 2, Status: StatusDisabled},
		{ID: 3, Name: "Beta", Platform: PlatformOpenAI, RateMultiplier: 0.8, Status: StatusActive},
		{ID: 4, Name: "Not selected", Platform: PlatformGemini, RateMultiplier: 1, Status: StatusActive},
	}}
	monitors := &homepageStatusMonitorReaderStub{
		monitors: []*ChannelMonitor{
			{ID: 2, Name: "Second", Provider: PlatformOpenAI, PrimaryModel: "gpt", Enabled: true, Endpoint: "https://secret.example", APIKey: "secret"},
			{ID: 1, Name: "First", Provider: PlatformAnthropic, PrimaryModel: "claude", Enabled: true},
			{ID: 3, Name: "Disabled", Provider: PlatformGemini, PrimaryModel: "gemini", Enabled: false},
		},
		latest: map[int64][]*ChannelMonitorLatest{
			1: {
				{Model: "extra", Status: MonitorStatusFailed, CheckedAt: checkedAt.Add(-time.Minute)},
				{Model: "claude", Status: MonitorStatusOperational, CheckedAt: checkedAt},
			},
		},
		availability: map[int64][]*ChannelMonitorAvailability{
			1: {{Model: "claude", TotalChecks: 20, AvailabilityPct: 95.5}},
			2: {{Model: "gpt", TotalChecks: 0, AvailabilityPct: 0}},
		},
	}

	summary, err := NewHomepageStatusService(groups, monitors, settings).GetSummary(context.Background())
	require.NoError(t, err)
	require.True(t, summary.Enabled)
	require.Equal(t, []HomepageStatusGroup{
		{ID: 1, Name: "Alpha", Platform: PlatformAnthropic, RateMultiplier: 1.25},
		{ID: 3, Name: "Beta", Platform: PlatformOpenAI, RateMultiplier: 0.8},
	}, summary.Groups)
	require.Len(t, summary.Monitors, 2)
	require.Equal(t, int64(1), summary.Monitors[0].ID)
	require.Equal(t, MonitorStatusOperational, summary.Monitors[0].Status)
	require.NotNil(t, summary.Monitors[0].Uptime7d)
	require.Equal(t, 95.5, *summary.Monitors[0].Uptime7d)
	require.Equal(t, checkedAt, *summary.Monitors[0].LastCheckedAt)
	require.Equal(t, int64(2), summary.Monitors[1].ID)
	require.Equal(t, "unknown", summary.Monitors[1].Status)
	require.Nil(t, summary.Monitors[1].Uptime7d)
	require.Nil(t, summary.Monitors[1].LastCheckedAt)
	require.Equal(t, []int64{1, 2}, monitors.latestIDs)
	require.Equal(t, []int64{1, 2}, monitors.availabilityIDs)
	require.Equal(t, monitorAvailability7Days, monitors.windowDays)
}

func TestHomepageStatusServiceGlobalMonitorSwitchSkipsMonitorRepository(t *testing.T) {
	settings := &homepageStatusSettingsStub{
		homepage: HomepageStatusRuntime{Enabled: true, ChannelMonitorEnabled: false},
	}
	groups := &homepageStatusGroupReaderStub{}
	monitors := &homepageStatusMonitorReaderStub{}

	summary, err := NewHomepageStatusService(groups, monitors, settings).GetSummary(context.Background())
	require.NoError(t, err)
	require.True(t, summary.Enabled)
	require.Empty(t, summary.Monitors)
	require.Equal(t, 0, groups.calls)
	require.Equal(t, 0, monitors.listCalls)
}

func TestHomepageStatusServiceMonitorAggregationFailureKeepsGroupsAndUnknownMonitors(t *testing.T) {
	settings := &homepageStatusSettingsStub{homepage: HomepageStatusRuntime{
		Enabled:               true,
		GroupIDs:              []int64{1},
		ChannelMonitorEnabled: true,
	}}
	groups := &homepageStatusGroupReaderStub{groups: []Group{
		{ID: 1, Name: "Alpha", Platform: PlatformOpenAI, RateMultiplier: 1.5, Status: StatusActive},
	}}
	monitors := &homepageStatusMonitorReaderStub{
		monitors: []*ChannelMonitor{
			{ID: 2, Name: "Primary", Provider: PlatformOpenAI, PrimaryModel: "gpt", Enabled: true},
		},
		latestErr:       errors.New("latest unavailable"),
		availabilityErr: errors.New("availability unavailable"),
	}

	summary, err := NewHomepageStatusService(groups, monitors, settings).GetSummary(context.Background())
	require.NoError(t, err)
	require.Equal(t, []HomepageStatusGroup{
		{ID: 1, Name: "Alpha", Platform: PlatformOpenAI, RateMultiplier: 1.5},
	}, summary.Groups)
	require.Equal(t, []HomepageStatusMonitor{
		{ID: 2, Name: "Primary", Provider: PlatformOpenAI, Status: "unknown"},
	}, summary.Monitors)
	require.Equal(t, 1, monitors.latestCalls)
	require.Equal(t, 1, monitors.availabilityCalls)
}

func TestHomepageStatusServiceMonitorListFailureKeepsGroups(t *testing.T) {
	settings := &homepageStatusSettingsStub{homepage: HomepageStatusRuntime{
		Enabled:               true,
		GroupIDs:              []int64{1},
		ChannelMonitorEnabled: true,
	}}
	groups := &homepageStatusGroupReaderStub{groups: []Group{
		{ID: 1, Name: "Alpha", Platform: PlatformOpenAI, RateMultiplier: 1.5, Status: StatusActive},
	}}
	monitors := &homepageStatusMonitorReaderStub{listErr: errors.New("monitors unavailable")}

	summary, err := NewHomepageStatusService(groups, monitors, settings).GetSummary(context.Background())
	require.NoError(t, err)
	require.Len(t, summary.Groups, 1)
	require.Equal(t, []HomepageStatusMonitor{}, summary.Monitors)
	require.Equal(t, 1, monitors.listCalls)
	require.Equal(t, 0, monitors.latestCalls)
	require.Equal(t, 0, monitors.availabilityCalls)
}

type homepageStatusConcurrentSettingsStub struct {
	runtime HomepageStatusRuntime
	calls   atomic.Int32
}

func (s *homepageStatusConcurrentSettingsStub) GetHomepageStatusRuntime(context.Context) HomepageStatusRuntime {
	s.calls.Add(1)
	return s.runtime
}

type homepageStatusBlockingMonitorReader struct {
	calls   atomic.Int32
	started chan struct{}
	release chan struct{}
	once    sync.Once
}

func (s *homepageStatusBlockingMonitorReader) ListEnabled(context.Context) ([]*ChannelMonitor, error) {
	s.calls.Add(1)
	s.once.Do(func() { close(s.started) })
	<-s.release
	return []*ChannelMonitor{}, nil
}

func (*homepageStatusBlockingMonitorReader) ListLatestForMonitorIDs(context.Context, []int64) (map[int64][]*ChannelMonitorLatest, error) {
	panic("unexpected latest call")
}

func (*homepageStatusBlockingMonitorReader) ComputeAvailabilityForMonitors(context.Context, []int64, int) (map[int64][]*ChannelMonitorAvailability, error) {
	panic("unexpected availability call")
}

func TestHomepageStatusServiceCachesAndSingleflightsConcurrentLoads(t *testing.T) {
	const callers = 12
	settings := &homepageStatusConcurrentSettingsStub{runtime: HomepageStatusRuntime{
		Enabled:               true,
		ChannelMonitorEnabled: true,
	}}
	monitors := &homepageStatusBlockingMonitorReader{
		started: make(chan struct{}),
		release: make(chan struct{}),
	}
	svc := NewHomepageStatusService(nil, monitors, settings)

	results := make(chan *HomepageStatusSummary, callers)
	errs := make(chan error, callers)
	var wg sync.WaitGroup
	start := make(chan struct{})
	for range callers {
		wg.Add(1)
		go func() {
			defer wg.Done()
			<-start
			summary, err := svc.GetSummary(context.Background())
			results <- summary
			errs <- err
		}()
	}
	close(start)
	<-monitors.started
	require.Eventually(t, func() bool { return settings.calls.Load() == callers }, time.Second, time.Millisecond)
	close(monitors.release)
	wg.Wait()
	close(results)
	close(errs)

	for err := range errs {
		require.NoError(t, err)
	}
	for summary := range results {
		require.True(t, summary.Enabled)
		require.Equal(t, []HomepageStatusMonitor{}, summary.Monitors)
	}
	require.Equal(t, int32(1), monitors.calls.Load())

	cached, err := svc.GetSummary(context.Background())
	require.NoError(t, err)
	require.True(t, cached.Enabled)
	require.Equal(t, int32(1), monitors.calls.Load())
}

func TestHomepageStatusServiceCanceledLeaderDoesNotCancelSharedLoad(t *testing.T) {
	settings := &homepageStatusConcurrentSettingsStub{runtime: HomepageStatusRuntime{
		Enabled:               true,
		ChannelMonitorEnabled: true,
	}}
	monitors := &homepageStatusBlockingMonitorReader{
		started: make(chan struct{}),
		release: make(chan struct{}),
	}
	svc := NewHomepageStatusService(nil, monitors, settings)
	leaderCtx, cancelLeader := context.WithCancel(context.Background())
	leaderErr := make(chan error, 1)
	go func() {
		_, err := svc.GetSummary(leaderCtx)
		leaderErr <- err
	}()
	<-monitors.started

	followerResult := make(chan *HomepageStatusSummary, 1)
	followerErr := make(chan error, 1)
	go func() {
		summary, err := svc.GetSummary(context.Background())
		followerResult <- summary
		followerErr <- err
	}()
	require.Eventually(t, func() bool { return settings.calls.Load() == 2 }, time.Second, time.Millisecond)

	cancelLeader()
	require.ErrorIs(t, <-leaderErr, context.Canceled)
	close(monitors.release)
	require.NoError(t, <-followerErr)
	require.True(t, (<-followerResult).Enabled)
	require.Equal(t, int32(1), monitors.calls.Load())
}

func TestHomepageStatusServiceCacheExpiresAndReturnsClones(t *testing.T) {
	svc := NewHomepageStatusService(nil, nil, nil)
	now := time.Date(2026, time.July, 26, 1, 2, 3, 0, time.UTC)
	original := &HomepageStatusSummary{
		Enabled: true,
		Groups:  []HomepageStatusGroup{{ID: 1, Name: "Alpha"}},
		Monitors: []HomepageStatusMonitor{
			{ID: 2, Name: "Primary", Status: MonitorStatusOperational},
		},
	}
	svc.cacheSummary("key", original, now)

	cached := svc.cachedSummary("key", now.Add(svc.cacheTTL-time.Nanosecond))
	require.NotNil(t, cached)
	cached.Groups[0].Name = "mutated"
	require.Equal(t, "Alpha", svc.cachedSummary("key", now).Groups[0].Name)
	require.Nil(t, svc.cachedSummary("key", now.Add(svc.cacheTTL)))
}

func TestHomepageStatusServiceDisabledRuntimeNeverUsesEnabledCache(t *testing.T) {
	settings := &homepageStatusSettingsStub{homepage: HomepageStatusRuntime{
		Enabled:               true,
		ChannelMonitorEnabled: true,
	}}
	monitors := &homepageStatusMonitorReaderStub{monitors: []*ChannelMonitor{}}
	svc := NewHomepageStatusService(nil, monitors, settings)

	enabled, err := svc.GetSummary(context.Background())
	require.NoError(t, err)
	require.True(t, enabled.Enabled)
	require.Equal(t, 1, monitors.listCalls)

	settings.homepage.Enabled = false
	disabled, err := svc.GetSummary(context.Background())
	require.NoError(t, err)
	require.False(t, disabled.Enabled)
	require.Equal(t, []HomepageStatusGroup{}, disabled.Groups)
	require.Equal(t, []HomepageStatusMonitor{}, disabled.Monitors)
	require.Equal(t, 1, monitors.listCalls)
}

func TestHomepageStatusServiceMonitorSwitchChangeDoesNotUseEnabledCache(t *testing.T) {
	settings := &homepageStatusSettingsStub{homepage: HomepageStatusRuntime{
		Enabled:               true,
		ChannelMonitorEnabled: true,
	}}
	monitors := &homepageStatusMonitorReaderStub{monitors: []*ChannelMonitor{
		{ID: 1, Name: "Primary", Provider: PlatformOpenAI, PrimaryModel: "gpt", Enabled: true},
	}}
	svc := NewHomepageStatusService(nil, monitors, settings)

	enabled, err := svc.GetSummary(context.Background())
	require.NoError(t, err)
	require.Len(t, enabled.Monitors, 1)
	require.Equal(t, 1, monitors.listCalls)

	settings.homepage.ChannelMonitorEnabled = false
	disabled, err := svc.GetSummary(context.Background())
	require.NoError(t, err)
	require.True(t, disabled.Enabled)
	require.Equal(t, []HomepageStatusMonitor{}, disabled.Monitors)
	require.Equal(t, 1, monitors.listCalls)
}
