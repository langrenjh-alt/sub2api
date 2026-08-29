package service

import (
	"errors"
	"testing"

	"github.com/Wei-Shaw/sub2api/internal/payment"
	infraerrors "github.com/Wei-Shaw/sub2api/internal/pkg/errors"
)

func TestValidateBEpusdtCreateOrderNetwork(t *testing.T) {
	t.Parallel()

	err := validateBEpusdtCreateOrderNetwork(CreateOrderRequest{Network: "bsc"}, &payment.InstanceSelection{
		ProviderKey: payment.TypeBEpusdt,
		Config:      map[string]string{"networks": "tron,bsc,eth,sol"},
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	err = validateBEpusdtCreateOrderNetwork(CreateOrderRequest{}, &payment.InstanceSelection{
		ProviderKey: payment.TypeBEpusdt,
		Config:      map[string]string{"networks": "tron,bsc"},
	})
	appErr := infraerrors.FromError(err)
	if appErr == nil || appErr.Reason != "PAYMENT_NETWORK_REQUIRED" {
		t.Fatalf("got %v, want PAYMENT_NETWORK_REQUIRED", err)
	}

	err = validateBEpusdtCreateOrderNetwork(CreateOrderRequest{Network: "sol"}, &payment.InstanceSelection{
		ProviderKey: payment.TypeBEpusdt,
		Config:      map[string]string{"networks": "tron"},
	})
	appErr = infraerrors.FromError(err)
	if appErr == nil || appErr.Reason != "PAYMENT_NETWORK_UNSUPPORTED" {
		t.Fatalf("got %v, want PAYMENT_NETWORK_UNSUPPORTED", err)
	}
}

func TestBuildProviderCreatePaymentRequestSetsBEpusdtTradeType(t *testing.T) {
	t.Parallel()

	req := buildProviderCreatePaymentRequest(CreateOrderRequest{
		PaymentType: payment.TypeBEpusdt,
		Network:     "eth",
	}, &payment.InstanceSelection{
		ProviderKey:    payment.TypeBEpusdt,
		SupportedTypes: payment.TypeBEpusdt,
		Config:         map[string]string{"networks": "tron,eth"},
	}, "order-1", "10.00", "test")
	if req.TradeType != "usdt.erc20" {
		t.Fatalf("TradeType = %q, want usdt.erc20", req.TradeType)
	}
}

func TestWrapBEpusdtNetworkErrorPassthrough(t *testing.T) {
	t.Parallel()
	err := errors.New("other")
	if got := wrapBEpusdtNetworkError(err); !errors.Is(got, err) {
		t.Fatalf("got %v, want original", got)
	}
}
func TestBuildProviderCreatePaymentRequestRequiresNetworkInsteadOfDefaultTradeType(t *testing.T) {
	t.Parallel()

	req := buildProviderCreatePaymentRequest(CreateOrderRequest{
		PaymentType: payment.TypeBEpusdt,
	}, &payment.InstanceSelection{
		ProviderKey: payment.TypeBEpusdt,
		Config:      map[string]string{"networks": "tron,bsc,eth,sol", "tradeType": "usdt.bep20"},
	}, "order-1", "10.00", "test")
	if req.TradeType != "" {
		t.Fatalf("TradeType = %q, want empty so we do not silently fall back to usdt.bep20", req.TradeType)
	}

	req = buildProviderCreatePaymentRequest(CreateOrderRequest{
		PaymentType: payment.TypeBEpusdt,
		Network:     "sol",
	}, &payment.InstanceSelection{
		ProviderKey: payment.TypeBEpusdt,
		Config:      map[string]string{"networks": "tron,bsc,eth,sol", "tradeType": "usdt.bep20"},
	}, "order-1", "10.00", "test")
	if req.TradeType != "usdt.solana" {
		t.Fatalf("TradeType = %q, want usdt.solana", req.TradeType)
	}
}
