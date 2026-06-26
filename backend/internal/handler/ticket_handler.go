package handler

import (
	"strconv"
	"strings"

	"github.com/Wei-Shaw/sub2api/internal/handler/dto"
	"github.com/Wei-Shaw/sub2api/internal/pkg/pagination"
	"github.com/Wei-Shaw/sub2api/internal/pkg/response"
	middleware2 "github.com/Wei-Shaw/sub2api/internal/server/middleware"
	"github.com/Wei-Shaw/sub2api/internal/service"

	"github.com/gin-gonic/gin"
)

type TicketHandler struct {
	ticketService *service.TicketService
}

func NewTicketHandler(ticketService *service.TicketService) *TicketHandler {
	return &TicketHandler{ticketService: ticketService}
}

type createTicketRequest struct {
	Title   string `json:"title" binding:"required"`
	Content string `json:"content" binding:"required"`
}

type replyTicketRequest struct {
	Content string `json:"content" binding:"required"`
}

func (h *TicketHandler) List(c *gin.Context) {
	subject, ok := middleware2.GetAuthSubjectFromContext(c)
	if !ok {
		response.Unauthorized(c, "User not found in context")
		return
	}
	page, pageSize := response.ParsePagination(c)
	params := pagination.PaginationParams{
		Page:      page,
		PageSize:  pageSize,
		SortBy:    c.DefaultQuery("sort_by", "last_reply_at"),
		SortOrder: c.DefaultQuery("sort_order", "desc"),
	}
	items, pageResult, err := h.ticketService.ListForUser(c.Request.Context(), subject.UserID, params, c.Query("status"))
	if err != nil {
		response.ErrorFrom(c, err)
		return
	}
	response.Paginated(c, dto.TicketsFromService(items), pageResult.Total, page, pageSize)
}

func (h *TicketHandler) Create(c *gin.Context) {
	subject, ok := middleware2.GetAuthSubjectFromContext(c)
	if !ok {
		response.Unauthorized(c, "User not found in context")
		return
	}
	var req createTicketRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}
	created, err := h.ticketService.CreateTicket(c.Request.Context(), service.CreateTicketInput{
		UserID:  subject.UserID,
		Title:   req.Title,
		Content: req.Content,
	})
	if err != nil {
		response.ErrorFrom(c, err)
		return
	}
	response.Success(c, dto.TicketWithMessagesFromService(created))
}

func (h *TicketHandler) Get(c *gin.Context) {
	subject, ok := middleware2.GetAuthSubjectFromContext(c)
	if !ok {
		response.Unauthorized(c, "User not found in context")
		return
	}
	ticketID, ok := parseTicketID(c)
	if !ok {
		return
	}
	item, err := h.ticketService.GetForUser(c.Request.Context(), subject.UserID, ticketID)
	if err != nil {
		response.ErrorFrom(c, err)
		return
	}
	response.Success(c, dto.TicketWithMessagesFromService(item))
}

func (h *TicketHandler) Reply(c *gin.Context) {
	subject, ok := middleware2.GetAuthSubjectFromContext(c)
	if !ok {
		response.Unauthorized(c, "User not found in context")
		return
	}
	ticketID, ok := parseTicketID(c)
	if !ok {
		return
	}
	var req replyTicketRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}
	created, err := h.ticketService.ReplyAsUser(c.Request.Context(), subject.UserID, ticketID, req.Content)
	if err != nil {
		response.ErrorFrom(c, err)
		return
	}
	response.Success(c, dto.TicketMessageFromService(created))
}

func (h *TicketHandler) Close(c *gin.Context) {
	subject, ok := middleware2.GetAuthSubjectFromContext(c)
	if !ok {
		response.Unauthorized(c, "User not found in context")
		return
	}
	ticketID, ok := parseTicketID(c)
	if !ok {
		return
	}
	updated, err := h.ticketService.CloseByUser(c.Request.Context(), subject.UserID, ticketID)
	if err != nil {
		response.ErrorFrom(c, err)
		return
	}
	response.Success(c, dto.TicketFromService(updated))
}

func parseTicketID(c *gin.Context) (int64, bool) {
	ticketID, err := strconv.ParseInt(strings.TrimSpace(c.Param("id")), 10, 64)
	if err != nil || ticketID <= 0 {
		response.BadRequest(c, "Invalid ticket ID")
		return 0, false
	}
	return ticketID, true
}
