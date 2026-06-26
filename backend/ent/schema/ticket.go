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

// Ticket holds the schema definition for user support tickets.
type Ticket struct {
	ent.Schema
}

func (Ticket) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entsql.Annotation{Table: "tickets"},
	}
}

func (Ticket) Fields() []ent.Field {
	return []ent.Field{
		field.Int64("user_id"),
		field.String("title").
			MaxLen(200).
			NotEmpty(),
		field.String("status").
			MaxLen(20).
			Default("open"),
		field.Int64("created_by").
			Optional().
			Nillable(),
		field.Int64("closed_by").
			Optional().
			Nillable(),
		field.Time("closed_at").
			Optional().
			Nillable().
			SchemaType(map[string]string{dialect.Postgres: "timestamptz"}),
		field.Time("last_reply_at").
			Optional().
			Nillable().
			SchemaType(map[string]string{dialect.Postgres: "timestamptz"}),
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

func (Ticket) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("user", User.Type).
			Ref("tickets").
			Field("user_id").
			Unique().
			Required(),
		edge.To("messages", TicketMessage.Type).
			Annotations(entsql.OnDelete(entsql.Cascade)),
	}
}

func (Ticket) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("user_id"),
		index.Fields("status"),
		index.Fields("created_at"),
		index.Fields("last_reply_at"),
	}
}
