package repository

import (
	"context"
	"strings"
	"time"

	dbent "github.com/Wei-Shaw/sub2api/ent"
	"github.com/Wei-Shaw/sub2api/ent/ticket"
	"github.com/Wei-Shaw/sub2api/ent/ticketmessage"
	"github.com/Wei-Shaw/sub2api/internal/pkg/pagination"
	"github.com/Wei-Shaw/sub2api/internal/service"

	entsql "entgo.io/ent/dialect/sql"
)

type ticketRepository struct {
	client *dbent.Client
}

func NewTicketRepository(client *dbent.Client) service.TicketRepository {
	return &ticketRepository{client: client}
}

func (r *ticketRepository) Create(ctx context.Context, t *service.Ticket) error {
	client := clientFromContext(ctx, r.client)
	builder := client.Ticket.Create().
		SetUserID(t.UserID).
		SetTitle(t.Title).
		SetStatus(t.Status).
		SetNillableCreatedBy(t.CreatedBy).
		SetNillableClosedBy(t.ClosedBy).
		SetNillableClosedAt(t.ClosedAt).
		SetNillableLastReplyAt(t.LastReplyAt)

	created, err := builder.Save(ctx)
	if err != nil {
		return translatePersistenceError(err, service.ErrTicketNotFound, nil)
	}
	applyTicketEntityToService(t, created)
	return nil
}

func (r *ticketRepository) GetByID(ctx context.Context, id int64) (*service.Ticket, error) {
	client := clientFromContext(ctx, r.client)
	m, err := client.Ticket.Query().
		Where(ticket.IDEQ(id)).
		Only(ctx)
	if err != nil {
		return nil, translatePersistenceError(err, service.ErrTicketNotFound, nil)
	}
	return ticketEntityToService(m), nil
}

func (r *ticketRepository) List(
	ctx context.Context,
	params pagination.PaginationParams,
	filters service.TicketListFilters,
) ([]service.Ticket, *pagination.PaginationResult, error) {
	client := clientFromContext(ctx, r.client)
	q := client.Ticket.Query()

	if filters.UserID > 0 {
		q = q.Where(ticket.UserIDEQ(filters.UserID))
	}
	if filters.Status != "" {
		q = q.Where(ticket.StatusEQ(filters.Status))
	}
	if filters.Search != "" {
		search := strings.TrimSpace(filters.Search)
		q = q.Where(ticket.TitleContainsFold(search))
	}

	total, err := q.Clone().Count(ctx)
	if err != nil {
		return nil, nil, err
	}

	itemsQuery := q.
		Offset(params.Offset()).
		Limit(params.Limit())
	for _, order := range ticketListOrders(params) {
		itemsQuery = itemsQuery.Order(order)
	}

	items, err := itemsQuery.All(ctx)
	if err != nil {
		return nil, nil, err
	}
	return ticketEntitiesToService(items), paginationResultFromTotal(int64(total), params), nil
}

func (r *ticketRepository) Close(ctx context.Context, ticketID int64, closedBy int64, closedAt time.Time) (*service.Ticket, error) {
	client := clientFromContext(ctx, r.client)
	updated, err := client.Ticket.UpdateOneID(ticketID).
		SetStatus(service.TicketStatusClosed).
		SetClosedBy(closedBy).
		SetClosedAt(closedAt).
		Save(ctx)
	if err != nil {
		return nil, translatePersistenceError(err, service.ErrTicketNotFound, nil)
	}
	return ticketEntityToService(updated), nil
}

func (r *ticketRepository) AddMessage(ctx context.Context, m *service.TicketMessage) error {
	client := clientFromContext(ctx, r.client)
	created, err := client.TicketMessage.Create().
		SetTicketID(m.TicketID).
		SetUserID(m.UserID).
		SetSenderRole(m.SenderRole).
		SetContent(m.Content).
		Save(ctx)
	if err != nil {
		return translatePersistenceError(err, service.ErrTicketNotFound, nil)
	}
	m.ID = created.ID
	m.CreatedAt = created.CreatedAt

	_, err = client.Ticket.UpdateOneID(m.TicketID).
		SetLastReplyAt(created.CreatedAt).
		Save(ctx)
	if err != nil {
		return translatePersistenceError(err, service.ErrTicketNotFound, nil)
	}
	return nil
}

func (r *ticketRepository) ListMessages(ctx context.Context, ticketID int64) ([]service.TicketMessage, error) {
	client := clientFromContext(ctx, r.client)
	items, err := client.TicketMessage.Query().
		Where(ticketmessage.TicketIDEQ(ticketID)).
		Order(dbent.Asc(ticketmessage.FieldCreatedAt), dbent.Asc(ticketmessage.FieldID)).
		All(ctx)
	if err != nil {
		return nil, err
	}
	return ticketMessageEntitiesToService(items), nil
}

func ticketListOrders(params pagination.PaginationParams) []func(*entsql.Selector) {
	sortBy := strings.ToLower(strings.TrimSpace(params.SortBy))
	sortOrder := params.NormalizedSortOrder(pagination.SortOrderDesc)

	field := ticket.FieldLastReplyAt
	switch sortBy {
	case "title":
		field = ticket.FieldTitle
	case "status":
		field = ticket.FieldStatus
	case "created_at":
		field = ticket.FieldCreatedAt
	case "updated_at":
		field = ticket.FieldUpdatedAt
	case "last_reply_at", "":
		field = ticket.FieldLastReplyAt
	case "id":
		field = ticket.FieldID
	default:
		field = ticket.FieldLastReplyAt
	}

	if sortOrder == pagination.SortOrderAsc {
		if field == ticket.FieldID {
			return []func(*entsql.Selector){dbent.Asc(field)}
		}
		return []func(*entsql.Selector){dbent.Asc(field), dbent.Asc(ticket.FieldID)}
	}
	if field == ticket.FieldID {
		return []func(*entsql.Selector){dbent.Desc(field)}
	}
	return []func(*entsql.Selector){dbent.Desc(field), dbent.Desc(ticket.FieldID)}
}

func applyTicketEntityToService(dst *service.Ticket, src *dbent.Ticket) {
	if dst == nil || src == nil {
		return
	}
	*dst = *ticketEntityToService(src)
}

func ticketEntityToService(m *dbent.Ticket) *service.Ticket {
	if m == nil {
		return nil
	}
	return &service.Ticket{
		ID:          m.ID,
		UserID:      m.UserID,
		Title:       m.Title,
		Status:      m.Status,
		CreatedBy:   m.CreatedBy,
		ClosedBy:    m.ClosedBy,
		ClosedAt:    m.ClosedAt,
		LastReplyAt: m.LastReplyAt,
		CreatedAt:   m.CreatedAt,
		UpdatedAt:   m.UpdatedAt,
	}
}

func ticketEntitiesToService(models []*dbent.Ticket) []service.Ticket {
	out := make([]service.Ticket, 0, len(models))
	for i := range models {
		if s := ticketEntityToService(models[i]); s != nil {
			out = append(out, *s)
		}
	}
	return out
}

func ticketMessageEntityToService(m *dbent.TicketMessage) *service.TicketMessage {
	if m == nil {
		return nil
	}
	return &service.TicketMessage{
		ID:         m.ID,
		TicketID:   m.TicketID,
		UserID:     m.UserID,
		SenderRole: m.SenderRole,
		Content:    m.Content,
		CreatedAt:  m.CreatedAt,
	}
}

func ticketMessageEntitiesToService(models []*dbent.TicketMessage) []service.TicketMessage {
	out := make([]service.TicketMessage, 0, len(models))
	for i := range models {
		if s := ticketMessageEntityToService(models[i]); s != nil {
			out = append(out, *s)
		}
	}
	return out
}
