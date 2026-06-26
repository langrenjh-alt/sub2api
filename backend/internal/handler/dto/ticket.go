package dto

import (
	"time"

	"github.com/Wei-Shaw/sub2api/internal/service"
)

type Ticket struct {
	ID          int64       `json:"id"`
	UserID      int64       `json:"user_id"`
	User        *TicketUser `json:"user,omitempty"`
	Title       string      `json:"title"`
	Status      string      `json:"status"`
	CreatedBy   *int64      `json:"created_by,omitempty"`
	ClosedBy    *int64      `json:"closed_by,omitempty"`
	ClosedAt    *time.Time  `json:"closed_at,omitempty"`
	LastReplyAt *time.Time  `json:"last_reply_at,omitempty"`
	CreatedAt   time.Time   `json:"created_at"`
	UpdatedAt   time.Time   `json:"updated_at"`
}

type TicketMessage struct {
	ID         int64       `json:"id"`
	TicketID   int64       `json:"ticket_id"`
	UserID     int64       `json:"user_id"`
	User       *TicketUser `json:"user,omitempty"`
	SenderRole string      `json:"sender_role"`
	Content    string      `json:"content"`
	CreatedAt  time.Time   `json:"created_at"`
}

type TicketUser struct {
	ID       int64  `json:"id"`
	Email    string `json:"email"`
	Username string `json:"username"`
	Role     string `json:"role"`
	Status   string `json:"status"`
}

type TicketWithMessages struct {
	Ticket   Ticket          `json:"ticket"`
	Messages []TicketMessage `json:"messages"`
}

func TicketFromService(t *service.Ticket) *Ticket {
	if t == nil {
		return nil
	}
	return &Ticket{
		ID:          t.ID,
		UserID:      t.UserID,
		Title:       t.Title,
		Status:      t.Status,
		CreatedBy:   t.CreatedBy,
		ClosedBy:    t.ClosedBy,
		ClosedAt:    t.ClosedAt,
		LastReplyAt: t.LastReplyAt,
		CreatedAt:   t.CreatedAt,
		UpdatedAt:   t.UpdatedAt,
	}
}

func TicketsFromService(items []service.Ticket) []Ticket {
	out := make([]Ticket, 0, len(items))
	for i := range items {
		if dto := TicketFromService(&items[i]); dto != nil {
			out = append(out, *dto)
		}
	}
	return out
}

func TicketFromServiceAdmin(t *service.Ticket) *Ticket {
	out := TicketFromService(t)
	if out == nil || t == nil {
		return out
	}
	out.User = TicketUserFromService(t.User)
	return out
}

func TicketsFromServiceAdmin(items []service.Ticket) []Ticket {
	out := make([]Ticket, 0, len(items))
	for i := range items {
		if dto := TicketFromServiceAdmin(&items[i]); dto != nil {
			out = append(out, *dto)
		}
	}
	return out
}

func TicketMessageFromService(m *service.TicketMessage) *TicketMessage {
	if m == nil {
		return nil
	}
	return &TicketMessage{
		ID:         m.ID,
		TicketID:   m.TicketID,
		UserID:     m.UserID,
		SenderRole: m.SenderRole,
		Content:    m.Content,
		CreatedAt:  m.CreatedAt,
	}
}

func TicketMessageFromServiceAdmin(m *service.TicketMessage) *TicketMessage {
	out := TicketMessageFromService(m)
	if out == nil || m == nil {
		return out
	}
	out.User = TicketUserFromService(m.User)
	return out
}

func TicketMessagesFromService(items []service.TicketMessage) []TicketMessage {
	out := make([]TicketMessage, 0, len(items))
	for i := range items {
		if dto := TicketMessageFromService(&items[i]); dto != nil {
			out = append(out, *dto)
		}
	}
	return out
}

func TicketMessagesFromServiceAdmin(items []service.TicketMessage) []TicketMessage {
	out := make([]TicketMessage, 0, len(items))
	for i := range items {
		if dto := TicketMessageFromServiceAdmin(&items[i]); dto != nil {
			out = append(out, *dto)
		}
	}
	return out
}

func TicketWithMessagesFromService(item *service.TicketWithMessages) *TicketWithMessages {
	if item == nil {
		return nil
	}
	return &TicketWithMessages{
		Ticket:   *TicketFromService(&item.Ticket),
		Messages: TicketMessagesFromService(item.Messages),
	}
}

func TicketWithMessagesFromServiceAdmin(item *service.TicketWithMessages) *TicketWithMessages {
	if item == nil {
		return nil
	}
	return &TicketWithMessages{
		Ticket:   *TicketFromServiceAdmin(&item.Ticket),
		Messages: TicketMessagesFromServiceAdmin(item.Messages),
	}
}

func TicketUserFromService(u *service.UserSummary) *TicketUser {
	if u == nil {
		return nil
	}
	return &TicketUser{
		ID:       u.ID,
		Email:    u.Email,
		Username: u.Username,
		Role:     u.Role,
		Status:   u.Status,
	}
}
