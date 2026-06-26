package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/dialect"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

// AnnouncementComment holds the schema definition for comments on announcements.
type AnnouncementComment struct {
	ent.Schema
}

func (AnnouncementComment) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entsql.Annotation{Table: "announcement_comments"},
	}
}

func (AnnouncementComment) Fields() []ent.Field {
	return []ent.Field{
		field.Int64("announcement_id"),
		field.Int64("user_id"),
		field.Int64("parent_id").
			Optional().
			Nillable(),
		field.String("content").
			SchemaType(map[string]string{dialect.Postgres: "text"}).
			NotEmpty(),
		field.Time("created_at").
			Immutable().
			Default(time.Now).
			SchemaType(map[string]string{dialect.Postgres: "timestamptz"}),
		field.Time("updated_at").
			Default(time.Now).
			UpdateDefault(time.Now).
			SchemaType(map[string]string{dialect.Postgres: "timestamptz"}),
	}
}

func (AnnouncementComment) Edges() []ent.Edge {
	replies := edge.To("replies", AnnouncementComment.Type).
		Annotations(entsql.OnDelete(entsql.Cascade))

	return []ent.Edge{
		edge.From("announcement", Announcement.Type).
			Ref("comments").
			Field("announcement_id").
			Unique().
			Required(),
		edge.From("user", User.Type).
			Ref("announcement_comments").
			Field("user_id").
			Unique().
			Required(),
		replies.From("parent").
			Field("parent_id").
			Unique(),
	}
}

func (AnnouncementComment) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("announcement_id"),
		index.Fields("user_id"),
		index.Fields("parent_id"),
		index.Fields("created_at"),
	}
}
