package repository

import (
	"context"

	dbent "github.com/Wei-Shaw/sub2api/ent"
	"github.com/Wei-Shaw/sub2api/ent/announcementcomment"
	"github.com/Wei-Shaw/sub2api/internal/service"
)

type announcementCommentRepository struct {
	client *dbent.Client
}

func NewAnnouncementCommentRepository(client *dbent.Client) service.AnnouncementCommentRepository {
	return &announcementCommentRepository{client: client}
}

func (r *announcementCommentRepository) Create(ctx context.Context, c *service.AnnouncementComment) error {
	client := clientFromContext(ctx, r.client)
	builder := client.AnnouncementComment.Create().
		SetAnnouncementID(c.AnnouncementID).
		SetUserID(c.UserID).
		SetContent(c.Content).
		SetNillableParentID(c.ParentID)

	created, err := builder.Save(ctx)
	if err != nil {
		return translatePersistenceError(err, service.ErrAnnouncementCommentNotFound, nil)
	}
	applyAnnouncementCommentEntityToService(c, created)
	if enriched, err := r.GetByID(ctx, created.ID); err == nil {
		*c = *enriched
	}
	return nil
}

func (r *announcementCommentRepository) GetByID(ctx context.Context, id int64) (*service.AnnouncementComment, error) {
	client := clientFromContext(ctx, r.client)
	m, err := client.AnnouncementComment.Query().
		Where(announcementcomment.IDEQ(id)).
		WithUser().
		Only(ctx)
	if err != nil {
		return nil, translatePersistenceError(err, service.ErrAnnouncementCommentNotFound, nil)
	}
	return announcementCommentEntityToService(m), nil
}

func (r *announcementCommentRepository) ListByAnnouncement(ctx context.Context, announcementID int64) ([]service.AnnouncementComment, error) {
	client := clientFromContext(ctx, r.client)
	items, err := client.AnnouncementComment.Query().
		Where(announcementcomment.AnnouncementIDEQ(announcementID)).
		WithUser().
		Order(dbent.Asc(announcementcomment.FieldCreatedAt), dbent.Asc(announcementcomment.FieldID)).
		All(ctx)
	if err != nil {
		return nil, err
	}
	return announcementCommentEntitiesToService(items), nil
}

func (r *announcementCommentRepository) Delete(ctx context.Context, id int64) error {
	client := clientFromContext(ctx, r.client)
	if err := client.AnnouncementComment.DeleteOneID(id).Exec(ctx); err != nil {
		return translatePersistenceError(err, service.ErrAnnouncementCommentNotFound, nil)
	}
	return nil
}

func applyAnnouncementCommentEntityToService(dst *service.AnnouncementComment, src *dbent.AnnouncementComment) {
	if dst == nil || src == nil {
		return
	}
	dst.ID = src.ID
	dst.AnnouncementID = src.AnnouncementID
	dst.UserID = src.UserID
	dst.ParentID = src.ParentID
	dst.Content = src.Content
	dst.CreatedAt = src.CreatedAt
	dst.UpdatedAt = src.UpdatedAt
}

func announcementCommentEntityToService(m *dbent.AnnouncementComment) *service.AnnouncementComment {
	if m == nil {
		return nil
	}
	out := &service.AnnouncementComment{
		ID:             m.ID,
		AnnouncementID: m.AnnouncementID,
		UserID:         m.UserID,
		ParentID:       m.ParentID,
		Content:        m.Content,
		CreatedAt:      m.CreatedAt,
		UpdatedAt:      m.UpdatedAt,
	}
	if user := m.Edges.User; user != nil {
		out.AuthorEmail = user.Email
		out.AuthorName = user.Username
		out.AuthorRole = user.Role
	}
	return out
}

func announcementCommentEntitiesToService(models []*dbent.AnnouncementComment) []service.AnnouncementComment {
	out := make([]service.AnnouncementComment, 0, len(models))
	for i := range models {
		if s := announcementCommentEntityToService(models[i]); s != nil {
			out = append(out, *s)
		}
	}
	return out
}
