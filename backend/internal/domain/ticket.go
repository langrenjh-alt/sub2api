package domain

import "time"

const (
	TicketStatusOpen   = "open"
	TicketStatusClosed = "closed"
)

const (
	TicketSenderRoleUser  = "user"
	TicketSenderRoleAdmin = "admin"
)

type Ticket struct {
	ID          int64
	UserID      int64
	User        *UserSummary
	Title       string
	Status      string
	CreatedBy   *int64
	ClosedBy    *int64
	ClosedAt    *time.Time
	LastReplyAt *time.Time
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

type TicketMessage struct {
	ID         int64
	TicketID   int64
	UserID     int64
	User       *UserSummary
	SenderRole string
	Content    string
	CreatedAt  time.Time
}

type UserSummary struct {
	ID       int64
	Email    string
	Username string
	Role     string
	Status   string
}
