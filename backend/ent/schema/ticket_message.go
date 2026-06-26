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

// TicketMessage holds the schema definition for ticket conversation messages.
type TicketMessage struct {
	ent.Schema
}

func (TicketMessage) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entsql.Annotation{Table: "ticket_messages"},
	}
}

func (TicketMessage) Fields() []ent.Field {
	return []ent.Field{
		field.Int64("ticket_id"),
		field.Int64("user_id"),
		field.String("sender_role").
			MaxLen(20),
		field.String("content").
			SchemaType(map[string]string{dialect.Postgres: "text"}).
			NotEmpty(),
		field.Time("created_at").
			Immutable().
			Default(time.Now).
			SchemaType(map[string]string{dialect.Postgres: "timestamptz"}),
	}
}

func (TicketMessage) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("ticket", Ticket.Type).
			Ref("messages").
			Field("ticket_id").
			Unique().
			Required(),
		edge.From("user", User.Type).
			Ref("ticket_messages").
			Field("user_id").
			Unique().
			Required(),
	}
}

func (TicketMessage) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("ticket_id"),
		index.Fields("user_id"),
		index.Fields("created_at"),
	}
}
