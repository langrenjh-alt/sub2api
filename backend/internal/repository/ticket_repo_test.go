package repository

import (
	"context"
	"database/sql"
	"fmt"
	"strconv"
	"strings"
	"testing"

	dbent "github.com/Wei-Shaw/sub2api/ent"
	"github.com/Wei-Shaw/sub2api/ent/enttest"
	_ "github.com/Wei-Shaw/sub2api/ent/runtime"
	"github.com/Wei-Shaw/sub2api/internal/pkg/pagination"
	"github.com/Wei-Shaw/sub2api/internal/service"
	"github.com/stretchr/testify/require"

	"entgo.io/ent/dialect"
	entsql "entgo.io/ent/dialect/sql"
	_ "modernc.org/sqlite"
)

func newTicketRepoSQLite(t *testing.T) (*ticketRepository, *dbent.Client) {
	t.Helper()

	name := strings.NewReplacer("/", "_", "\\", "_", " ", "_").Replace(t.Name())
	db, err := sql.Open("sqlite", fmt.Sprintf("file:%s?mode=memory&cache=shared&_fk=1", name))
	require.NoError(t, err)
	t.Cleanup(func() { _ = db.Close() })

	_, err = db.Exec("PRAGMA foreign_keys = ON")
	require.NoError(t, err)

	drv := entsql.OpenDB(dialect.SQLite, db)
	client := enttest.NewClient(t, enttest.WithOptions(dbent.Driver(drv)))
	t.Cleanup(func() { _ = client.Close() })

	return &ticketRepository{client: client}, client
}

func mustCreateTicketRepoUser(t *testing.T, ctx context.Context, client *dbent.Client, email, username string) *dbent.User {
	t.Helper()

	u, err := client.User.Create().
		SetEmail(email).
		SetUsername(username).
		SetPasswordHash("test-password-hash").
		SetRole(service.RoleUser).
		SetStatus(service.StatusActive).
		Save(ctx)
	require.NoError(t, err)
	return u
}

func TestTicketRepositoryListIncludesSenderAndSearchesSenderFields(t *testing.T) {
	repo, client := newTicketRepoSQLite(t)
	ctx := context.Background()

	sender := mustCreateTicketRepoUser(t, ctx, client, "ticket-sender@example.com", "ticket-sender")
	other := mustCreateTicketRepoUser(t, ctx, client, "other-sender@example.com", "other-sender")

	target := &service.Ticket{
		UserID: sender.ID,
		Title:  "Billing question",
		Status: service.TicketStatusOpen,
	}
	require.NoError(t, repo.Create(ctx, target))
	targetMessage := &service.TicketMessage{
		TicketID:   target.ID,
		UserID:     sender.ID,
		SenderRole: service.TicketSenderRoleUser,
		Content:    "Need help with my invoice.",
	}
	require.NoError(t, repo.AddMessage(ctx, targetMessage))
	require.NotNil(t, targetMessage.User)
	require.Equal(t, sender.Email, targetMessage.User.Email)

	otherTicket := &service.Ticket{
		UserID: other.ID,
		Title:  "Unrelated question",
		Status: service.TicketStatusOpen,
	}
	require.NoError(t, repo.Create(ctx, otherTicket))

	params := pagination.PaginationParams{Page: 1, PageSize: 10, SortBy: "id", SortOrder: "asc"}
	for _, search := range []string{sender.Email, sender.Username, strconv.FormatInt(sender.ID, 10)} {
		items, result, err := repo.List(ctx, params, service.TicketListFilters{Search: search})
		require.NoError(t, err)
		require.EqualValues(t, 1, result.Total)
		require.Len(t, items, 1)
		require.Equal(t, target.ID, items[0].ID)
		require.NotNil(t, items[0].User)
		require.Equal(t, sender.ID, items[0].User.ID)
		require.Equal(t, sender.Email, items[0].User.Email)
		require.Equal(t, sender.Username, items[0].User.Username)
	}

	messages, err := repo.ListMessages(ctx, target.ID)
	require.NoError(t, err)
	require.Len(t, messages, 1)
	require.NotNil(t, messages[0].User)
	require.Equal(t, sender.Email, messages[0].User.Email)
}

func TestTicketRepositoryIncludesSoftDeletedSenderSummary(t *testing.T) {
	repo, client := newTicketRepoSQLite(t)
	ctx := context.Background()

	sender := mustCreateTicketRepoUser(t, ctx, client, "deleted-ticket-sender@example.com", "deleted-ticket-sender")
	ticket := &service.Ticket{
		UserID: sender.ID,
		Title:  "Historical ticket",
		Status: service.TicketStatusOpen,
	}
	require.NoError(t, repo.Create(ctx, ticket))
	require.NoError(t, repo.AddMessage(ctx, &service.TicketMessage{
		TicketID:   ticket.ID,
		UserID:     sender.ID,
		SenderRole: service.TicketSenderRoleUser,
		Content:    "This sender will be soft-deleted.",
	}))
	require.NoError(t, client.User.DeleteOneID(sender.ID).Exec(ctx))

	items, result, err := repo.List(ctx,
		pagination.PaginationParams{Page: 1, PageSize: 10, SortBy: "id", SortOrder: "asc"},
		service.TicketListFilters{Search: sender.Email})
	require.NoError(t, err)
	require.EqualValues(t, 1, result.Total)
	require.Len(t, items, 1)
	require.NotNil(t, items[0].User)
	require.Equal(t, sender.Email, items[0].User.Email)

	messages, err := repo.ListMessages(ctx, ticket.ID)
	require.NoError(t, err)
	require.Len(t, messages, 1)
	require.NotNil(t, messages[0].User)
	require.Equal(t, sender.Email, messages[0].User.Email)
}
