package dto

import (
	"time"

	"github.com/Wei-Shaw/sub2api/internal/service"
)

type Announcement struct {
	ID              int64  `json:"id"`
	Title           string `json:"title"`
	Content         string `json:"content"`
	Status          string `json:"status"`
	NotifyMode      string `json:"notify_mode"`
	CommentsEnabled bool   `json:"comments_enabled"`

	Targeting service.AnnouncementTargeting `json:"targeting"`

	StartsAt *time.Time `json:"starts_at,omitempty"`
	EndsAt   *time.Time `json:"ends_at,omitempty"`

	CreatedBy *int64 `json:"created_by,omitempty"`
	UpdatedBy *int64 `json:"updated_by,omitempty"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type UserAnnouncement struct {
	ID              int64  `json:"id"`
	Title           string `json:"title"`
	Content         string `json:"content"`
	NotifyMode      string `json:"notify_mode"`
	CommentsEnabled bool   `json:"comments_enabled"`

	StartsAt *time.Time `json:"starts_at,omitempty"`
	EndsAt   *time.Time `json:"ends_at,omitempty"`

	ReadAt *time.Time `json:"read_at,omitempty"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type AnnouncementComment struct {
	ID             int64     `json:"id"`
	AnnouncementID int64     `json:"announcement_id"`
	UserID         int64     `json:"user_id"`
	ParentID       *int64    `json:"parent_id,omitempty"`
	Content        string    `json:"content"`
	AuthorEmail    string    `json:"author_email"`
	AuthorName     string    `json:"author_name"`
	AuthorRole     string    `json:"author_role"`
	CanDelete      bool      `json:"can_delete"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

func AnnouncementFromService(a *service.Announcement) *Announcement {
	if a == nil {
		return nil
	}
	return &Announcement{
		ID:              a.ID,
		Title:           a.Title,
		Content:         a.Content,
		Status:          a.Status,
		NotifyMode:      a.NotifyMode,
		CommentsEnabled: a.CommentsEnabled,
		Targeting:       a.Targeting,
		StartsAt:        a.StartsAt,
		EndsAt:          a.EndsAt,
		CreatedBy:       a.CreatedBy,
		UpdatedBy:       a.UpdatedBy,
		CreatedAt:       a.CreatedAt,
		UpdatedAt:       a.UpdatedAt,
	}
}

func UserAnnouncementFromService(a *service.UserAnnouncement) *UserAnnouncement {
	if a == nil {
		return nil
	}
	return &UserAnnouncement{
		ID:              a.Announcement.ID,
		Title:           a.Announcement.Title,
		Content:         a.Announcement.Content,
		NotifyMode:      a.Announcement.NotifyMode,
		CommentsEnabled: a.Announcement.CommentsEnabled,
		StartsAt:        a.Announcement.StartsAt,
		EndsAt:          a.Announcement.EndsAt,
		ReadAt:          a.ReadAt,
		CreatedAt:       a.Announcement.CreatedAt,
		UpdatedAt:       a.Announcement.UpdatedAt,
	}
}

func AnnouncementCommentFromService(c *service.AnnouncementComment, currentUserID int64, isAdmin bool) *AnnouncementComment {
	if c == nil {
		return nil
	}
	return &AnnouncementComment{
		ID:             c.ID,
		AnnouncementID: c.AnnouncementID,
		UserID:         c.UserID,
		ParentID:       c.ParentID,
		Content:        c.Content,
		AuthorEmail:    c.AuthorEmail,
		AuthorName:     c.AuthorName,
		AuthorRole:     c.AuthorRole,
		CanDelete:      isAdmin || (currentUserID > 0 && c.UserID == currentUserID),
		CreatedAt:      c.CreatedAt,
		UpdatedAt:      c.UpdatedAt,
	}
}

func AnnouncementCommentsFromService(items []service.AnnouncementComment, currentUserID int64, isAdmin bool) []AnnouncementComment {
	out := make([]AnnouncementComment, 0, len(items))
	for i := range items {
		if dto := AnnouncementCommentFromService(&items[i], currentUserID, isAdmin); dto != nil {
			out = append(out, *dto)
		}
	}
	return out
}
