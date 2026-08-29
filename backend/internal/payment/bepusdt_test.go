package payment

import (
	"errors"
	"testing"
)

func TestNormalizeBEpusdtNetwork(t *testing.T) {
	t.Parallel()
	cases := map[string]string{
		"TRON":     BEpusdtNetworkTron,
		"trx":      BEpusdtNetworkTron,
		"BSC":      BEpusdtNetworkBSC,
		"bep20":    BEpusdtNetworkBSC,
		"ethereum": BEpusdtNetworkETH,
		"SOLANA":   BEpusdtNetworkSOL,
		"polygon":  "",
		"":         "",
	}
	for input, want := range cases {
		if got := NormalizeBEpusdtNetwork(input); got != want {
			t.Fatalf("NormalizeBEpusdtNetwork(%q) = %q, want %q", input, got, want)
		}
	}
}

func TestParseBEpusdtNetworks(t *testing.T) {
	t.Parallel()

	t.Run("explicit list is canonicalized and ordered", func(t *testing.T) {
		got := ParseBEpusdtNetworks(map[string]string{"networks": "sol, ETH, bsc,sol"})
		want := []string{BEpusdtNetworkBSC, BEpusdtNetworkETH, BEpusdtNetworkSOL}
		if len(got) != len(want) {
			t.Fatalf("got %v, want %v", got, want)
		}
		for i := range want {
			if got[i] != want[i] {
				t.Fatalf("got %v, want %v", got, want)
			}
		}
	})

	t.Run("known USDT trade type defaults to checkout chains", func(t *testing.T) {
		got := ParseBEpusdtNetworks(map[string]string{"tradeType": "usdt.trc20"})
		if len(got) != len(DefaultBEpusdtNetworks) {
			t.Fatalf("got %v, want defaults", got)
		}
	})

	t.Run("custom trade type disables the picker", func(t *testing.T) {
		got := ParseBEpusdtNetworks(map[string]string{"tradeType": "usdc.polygon"})
		if got != nil && len(got) != 0 {
			t.Fatalf("got %v, want none", got)
		}
	})
}

func TestResolveBEpusdtTradeType(t *testing.T) {
	t.Parallel()

	t.Run("maps checkout chain onto USDT trade type", func(t *testing.T) {
		got, err := ResolveBEpusdtTradeType("bsc", map[string]string{"networks": "tron,bsc"})
		if err != nil {
			t.Fatal(err)
		}
		if got != "usdt.bep20" {
			t.Fatalf("got %q, want usdt.bep20", got)
		}
	})

	t.Run("fills the only enabled chain", func(t *testing.T) {
		got, err := ResolveBEpusdtTradeType("", map[string]string{"networks": "sol"})
		if err != nil {
			t.Fatal(err)
		}
		if got != "usdt.solana" {
			t.Fatalf("got %q, want usdt.solana", got)
		}
	})

	t.Run("uses custom trade type when no picker is enabled", func(t *testing.T) {
		got, err := ResolveBEpusdtTradeType("", map[string]string{"tradeType": "usdc.polygon"})
		if err != nil {
			t.Fatal(err)
		}
		if got != "usdc.polygon" {
			t.Fatalf("got %q, want usdc.polygon", got)
		}
	})

	t.Run("rejects a chain that is not enabled", func(t *testing.T) {
		_, err := ResolveBEpusdtTradeType("eth", map[string]string{"networks": "tron,bsc"})
		if !errors.Is(err, ErrBEpusdtNetworkUnsupported) {
			t.Fatalf("err = %v, want unsupported", err)
		}
	})

	t.Run("requires a chain when several are enabled", func(t *testing.T) {
		_, err := ResolveBEpusdtTradeType("", map[string]string{"networks": "tron,bsc"})
		if !errors.Is(err, ErrBEpusdtNetworkRequired) {
			t.Fatalf("err = %v, want required", err)
		}
	})
}
