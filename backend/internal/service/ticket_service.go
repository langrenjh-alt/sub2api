package service

import (
	"context"
	"fmt"
	"strings"
	"time"

	dbent "github.com/Wei-Shaw/sub2api/ent"
	"github.com/Wei-Shaw/sub2api/internal/pkg/pagination"
)

type TicketService struct {
	entClient      *dbent.Client
	ticketRepo     TicketRepository
	userRepo       UserRepository
	settingService *SettingService
}

func NewTicketService(
	entClient *dbent.Client,
	ticketRepo TicketRepository,
	userRepo UserRepository,
	settingService *SettingService,
) *TicketService {
	return &TicketService{
		entClient:      entClient,
		ticketRepo:     ticketRepo,
		userRepo:       userRepo,
		settingService: settingService,
	}
}

type CreateTicketInput struct {
	UserID  int64
	Title   string
	Content string
}

func (s *TicketService) CreateTicket(ctx context.Context, input CreateTicketInput) (*TicketWithMessages, error) {
	if err := s.ensureEnabled(ctx); err != nil {
		return nil, err
	}
	title := strings.TrimSpace(input.Title)
	content := strings.TrimSpace(input.Content)
	if title == "" || len(title) > 200 {
		return nil, ErrTicketInvalidTitle
	}
	if content == "" {
		return nil, ErrTicketContentEmpty
	}
	if _, err := s.userRepo.GetByID(ctx, input.UserID); err != nil {
		return nil, fmt.Errorf("get ticket user: %w", err)
	}

	now := time.Now()
	ticket := &Ticket{
		UserID:      input.UserID,
		Title:       title,
		Status:      TicketStatusOpen,
		CreatedBy:   &input.UserID,
		LastReplyAt: &now,
	}
	message := &TicketMessage{
		UserID:     input.UserID,
		SenderRole: TicketSenderRoleUser,
		Content:    content,
	}

	if s.entClient == nil {
		if err := s.ticketRepo.Create(ctx, ticket); err != nil {
			return nil, fmt.Errorf("create ticket: %w", err)
		}
		message.TicketID = ticket.ID
		if err := s.ticketRepo.AddMessage(ctx, message); err != nil {
			return nil, fmt.Errorf("create ticket message: %w", err)
		}
		return &TicketWithMessages{Ticket: *ticket, Messages: []TicketMessage{*message}}, nil
	}

	tx, err := s.entClient.Tx(ctx)
	if err != nil {
		return nil, fmt.Errorf("start ticket tx: %w", err)
	}
	defer func() { _ = tx.Rollback() }()

	txCtx := dbent.NewTxContext(ctx, tx)
	if err := s.ticketRepo.Create(txCtx, ticket); err != nil {
		return nil, fmt.Errorf("create ticket: %w", err)
	}
	message.TicketID = ticket.ID
	if err := s.ticketRepo.AddMessage(txCtx, message); err != nil {
		return nil, fmt.Errorf("create ticket message: %w", err)
	}
	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("commit ticket tx: %w", err)
	}

	return &TicketWithMessages{Ticket: *ticket, Messages: []TicketMessage{*message}}, nil
}

func (s *TicketService) ListForUser(ctx context.Context, userID int64, params pagination.PaginationParams, status string) ([]Ticket, *pagination.PaginationResult, error) {
	if err := s.ensureEnabled(ctx); err != nil {
		return nil, nil, err
	}
	return s.ticketRepo.List(ctx, params, TicketListFilters{UserID: userID, Status: normalizeTicketStatus(status)})
}

func (s *TicketService) ListAdmin(ctx context.Context, params pagination.PaginationParams, filters TicketListFilters) ([]Ticket, *pagination.PaginationResult, error) {
	if err := s.ensureEnabled(ctx); err != nil {
		return nil, nil, err
	}
	filters.Status = normalizeTicketStatus(filters.Status)
	filters.Search = strings.TrimSpace(filters.Search)
	return s.ticketRepo.List(ctx, params, filters)
}

func (s *TicketService) GetForUser(ctx context.Context, userID, ticketID int64) (*TicketWithMessages, error) {
	if err := s.ensureEnabled(ctx); err != nil {
		return nil, err
	}
	ticket, err := s.ticketRepo.GetByID(ctx, ticketID)
	if err != nil {
		return nil, err
	}
	if ticket.UserID != userID {
		return nil, ErrTicketNotFound
	}
	messages, err := s.ticketRepo.ListMessages(ctx, ticketID)
	if err != nil {
		return nil, fmt.Errorf("list ticket messages: %w", err)
	}
	return &TicketWithMessages{Ticket: *ticket, Messages: messages}, nil
}

func (s *TicketService) GetAdmin(ctx context.Context, ticketID int64) (*TicketWithMessages, error) {
	if err := s.ensureEnabled(ctx); err != nil {
		return nil, err
	}
	ticket, err := s.ticketRepo.GetByID(ctx, ticketID)
	if err != nil {
		return nil, err
	}
	messages, err := s.ticketRepo.ListMessages(ctx, ticketID)
	if err != nil {
		return nil, fmt.Errorf("list ticket messages: %w", err)
	}
	return &TicketWithMessages{Ticket: *ticket, Messages: messages}, nil
}

func (s *TicketService) ReplyAsUser(ctx context.Context, userID, ticketID int64, content string) (*TicketMessage, error) {
	if err := s.ensureEnabled(ctx); err != nil {
		return nil, err
	}
	ticket, err := s.ticketRepo.GetByID(ctx, ticketID)
	if err != nil {
		return nil, err
	}
	if ticket.UserID != userID {
		return nil, ErrTicketNotFound
	}
	return s.addMessage(ctx, ticket, userID, TicketSenderRoleUser, content)
}

func (s *TicketService) ReplyAsAdmin(ctx context.Context, adminID, ticketID int64, content string) (*TicketMessage, error) {
	if err := s.ensureEnabled(ctx); err != nil {
		return nil, err
	}
	ticket, err := s.ticketRepo.GetByID(ctx, ticketID)
	if err != nil {
		return nil, err
	}
	return s.addMessage(ctx, ticket, adminID, TicketSenderRoleAdmin, content)
}

func (s *TicketService) CloseByUser(ctx context.Context, userID, ticketID int64) (*Ticket, error) {
	if err := s.ensureEnabled(ctx); err != nil {
		return nil, err
	}
	ticket, err := s.ticketRepo.GetByID(ctx, ticketID)
	if err != nil {
		return nil, err
	}
	if ticket.UserID != userID {
		return nil, ErrTicketNotFound
	}
	if ticket.Status == TicketStatusClosed {
		return ticket, nil
	}
	return s.ticketRepo.Close(ctx, ticketID, userID, time.Now())
}

func (s *TicketService) CloseByAdmin(ctx context.Context, adminID, ticketID int64) (*Ticket, error) {
	if err := s.ensureEnabled(ctx); err != nil {
		return nil, err
	}
	ticket, err := s.ticketRepo.GetByID(ctx, ticketID)
	if err != nil {
		return nil, err
	}
	if ticket.Status == TicketStatusClosed {
		return ticket, nil
	}
	return s.ticketRepo.Close(ctx, ticketID, adminID, time.Now())
}

func (s *TicketService) addMessage(ctx context.Context, ticket *Ticket, userID int64, role, content string) (*TicketMessage, error) {
	if ticket == nil {
		return nil, ErrTicketNotFound
	}
	if ticket.Status == TicketStatusClosed {
		return nil, ErrTicketClosed
	}
	trimmed := strings.TrimSpace(content)
	if trimmed == "" {
		return nil, ErrTicketContentEmpty
	}
	message := &TicketMessage{
		TicketID:   ticket.ID,
		UserID:     userID,
		SenderRole: role,
		Content:    trimmed,
	}
	if err := s.ticketRepo.AddMessage(ctx, message); err != nil {
		return nil, fmt.Errorf("add ticket message: %w", err)
	}
	return message, nil
}

func (s *TicketService) ensureEnabled(ctx context.Context) error {
	if s.settingService == nil {
		return nil
	}
	if !s.settingService.IsTicketSystemEnabled(ctx) {
		return ErrTicketSystemDisabled
	}
	return nil
}

func normalizeTicketStatus(status string) string {
	switch strings.ToLower(strings.TrimSpace(status)) {
	case TicketStatusOpen:
		return TicketStatusOpen
	case TicketStatusClosed:
		return TicketStatusClosed
	default:
		return ""
	}
}
