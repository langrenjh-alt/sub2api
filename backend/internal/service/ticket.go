package service

import (
	"context"
	"time"

	"github.com/Wei-Shaw/sub2api/internal/domain"
	infraerrors "github.com/Wei-Shaw/sub2api/internal/pkg/errors"
	"github.com/Wei-Shaw/sub2api/internal/pkg/pagination"
)

const (
	TicketStatusOpen   = domain.TicketStatusOpen
	TicketStatusClosed = domain.TicketStatusClosed
)

const (
	TicketSenderRoleUser  = domain.TicketSenderRoleUser
	TicketSenderRoleAdmin = domain.TicketSenderRoleAdmin
)

var (
	ErrTicketSystemDisabled = infraerrors.Forbidden("TICKET_SYSTEM_DISABLED", "ticket system is disabled")
	ErrTicketNotFound       = infraerrors.NotFound("TICKET_NOT_FOUND", "ticket not found")
	ErrTicketInvalidTitle   = infraerrors.BadRequest("TICKET_TITLE_INVALID", "ticket title is invalid")
	ErrTicketContentEmpty   = infraerrors.BadRequest("TICKET_CONTENT_REQUIRED", "ticket content is required")
	ErrTicketClosed         = infraerrors.Conflict("TICKET_CLOSED", "ticket is closed")
)

type Ticket = domain.Ticket
type TicketMessage = domain.TicketMessage
type UserSummary = domain.UserSummary

type TicketWithMessages struct {
	Ticket   Ticket
	Messages []TicketMessage
}

type TicketListFilters struct {
	UserID int64
	Status string
	Search string
}

type TicketRepository interface {
	Create(ctx context.Context, ticket *Ticket) error
	GetByID(ctx context.Context, id int64) (*Ticket, error)
	List(ctx context.Context, params pagination.PaginationParams, filters TicketListFilters) ([]Ticket, *pagination.PaginationResult, error)
	Close(ctx context.Context, ticketID int64, closedBy int64, closedAt time.Time) (*Ticket, error)
	AddMessage(ctx context.Context, message *TicketMessage) error
	ListMessages(ctx context.Context, ticketID int64) ([]TicketMessage, error)
}
