package admin

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

type replyTicketRequest struct {
	Content string `json:"content" binding:"required"`
}

func (h *TicketHandler) List(c *gin.Context) {
	page, pageSize := response.ParsePagination(c)
	params := pagination.PaginationParams{
		Page:      page,
		PageSize:  pageSize,
		SortBy:    c.DefaultQuery("sort_by", "last_reply_at"),
		SortOrder: c.DefaultQuery("sort_order", "desc"),
	}
	var userID int64
	if raw := strings.TrimSpace(c.Query("user_id")); raw != "" {
		parsed, err := strconv.ParseInt(raw, 10, 64)
		if err != nil || parsed <= 0 {
			response.BadRequest(c, "Invalid user ID")
			return
		}
		userID = parsed
	}
	search := strings.TrimSpace(c.Query("search"))
	if len(search) > 200 {
		search = search[:200]
	}
	items, pageResult, err := h.ticketService.ListAdmin(c.Request.Context(), params, service.TicketListFilters{
		UserID: userID,
		Status: c.Query("status"),
		Search: search,
	})
	if err != nil {
		response.ErrorFrom(c, err)
		return
	}
	response.Paginated(c, dto.TicketsFromService(items), pageResult.Total, page, pageSize)
}

func (h *TicketHandler) Get(c *gin.Context) {
	ticketID, ok := parseTicketID(c)
	if !ok {
		return
	}
	item, err := h.ticketService.GetAdmin(c.Request.Context(), ticketID)
	if err != nil {
		response.ErrorFrom(c, err)
		return
	}
	response.Success(c, dto.TicketWithMessagesFromService(item))
}

func (h *TicketHandler) Reply(c *gin.Context) {
	ticketID, ok := parseTicketID(c)
	if !ok {
		return
	}
	var req replyTicketRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}
	subject, ok := middleware2.GetAuthSubjectFromContext(c)
	if !ok {
		response.Unauthorized(c, "User not found in context")
		return
	}
	created, err := h.ticketService.ReplyAsAdmin(c.Request.Context(), subject.UserID, ticketID, req.Content)
	if err != nil {
		response.ErrorFrom(c, err)
		return
	}
	response.Success(c, dto.TicketMessageFromService(created))
}

func (h *TicketHandler) Close(c *gin.Context) {
	ticketID, ok := parseTicketID(c)
	if !ok {
		return
	}
	subject, ok := middleware2.GetAuthSubjectFromContext(c)
	if !ok {
		response.Unauthorized(c, "User not found in context")
		return
	}
	updated, err := h.ticketService.CloseByAdmin(c.Request.Context(), subject.UserID, ticketID)
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
