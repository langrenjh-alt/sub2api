package payment

import (
	"errors"
	"strings"
)

const (
	BEpusdtNetworkTron = "tron"
	BEpusdtNetworkBSC  = "bsc"
	BEpusdtNetworkETH  = "eth"
	BEpusdtNetworkSOL  = "sol"
)

// DefaultBEpusdtNetworks is the checkout chain list when the merchant has not
// restricted BEpusdt networks. These map to USDT on each chain.
var DefaultBEpusdtNetworks = []string{
	BEpusdtNetworkTron,
	BEpusdtNetworkBSC,
	BEpusdtNetworkETH,
	BEpusdtNetworkSOL,
}

var (
	ErrBEpusdtNetworkRequired    = errors.New("crypto network is required")
	ErrBEpusdtNetworkUnsupported = errors.New("crypto network is not enabled")
)

var bepusdtNetworkTradeTypes = map[string]string{
	BEpusdtNetworkTron: "usdt.trc20",
	BEpusdtNetworkBSC:  "usdt.bep20",
	BEpusdtNetworkETH:  "usdt.erc20",
	BEpusdtNetworkSOL:  "usdt.solana",
}

var bepusdtTradeTypeNetworks = map[string]string{
	"usdt.trc20":  BEpusdtNetworkTron,
	"usdt.bep20":  BEpusdtNetworkBSC,
	"usdt.erc20":  BEpusdtNetworkETH,
	"usdt.solana": BEpusdtNetworkSOL,
}

// NormalizeBEpusdtNetwork canonicalizes a user- or admin-supplied chain name.
func NormalizeBEpusdtNetwork(raw string) string {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "tron", "trx", "trc20":
		return BEpusdtNetworkTron
	case "bsc", "bnb", "bep20":
		return BEpusdtNetworkBSC
	case "eth", "ethereum", "erc20":
		return BEpusdtNetworkETH
	case "sol", "solana":
		return BEpusdtNetworkSOL
	default:
		return ""
	}
}

// BEpusdtTradeTypeForNetwork returns the BEpusdt create-transaction trade_type
// for a checkout chain, such as usdt.bep20 for BSC.
func BEpusdtTradeTypeForNetwork(network string) string {
	return bepusdtNetworkTradeTypes[NormalizeBEpusdtNetwork(network)]
}

// BEpusdtNetworkFromTradeType maps a configured BEpusdt trade_type back to a
// checkout chain when the mapping is known.
func BEpusdtNetworkFromTradeType(tradeType string) string {
	return bepusdtTradeTypeNetworks[strings.ToLower(strings.TrimSpace(tradeType))]
}

// ParseBEpusdtNetworks returns the chains a BEpusdt instance should expose at
// checkout. An explicit `networks` config wins; otherwise USDT checkout chains
// default to tron/bsc/eth/sol. A custom tradeType that is not one of those
// USDT mappings disables the picker so the configured type is used as-is.
func ParseBEpusdtNetworks(cfg map[string]string) []string {
	if cfg == nil {
		cfg = map[string]string{}
	}
	if parsed := parseBEpusdtNetworkList(cfg["networks"]); len(parsed) > 0 {
		return parsed
	}
	if strings.TrimSpace(cfg["tradeType"]) != "" && BEpusdtNetworkFromTradeType(cfg["tradeType"]) == "" {
		return nil
	}
	return append([]string(nil), DefaultBEpusdtNetworks...)
}

// ResolveBEpusdtTradeType maps a checkout chain onto a BEpusdt trade_type using
// the instance config. A missing network is filled in when only one chain is
// enabled, or when the instance is locked to a custom tradeType.
func ResolveBEpusdtTradeType(network string, cfg map[string]string) (string, error) {
	if cfg == nil {
		cfg = map[string]string{}
	}
	enabled := ParseBEpusdtNetworks(cfg)
	network = NormalizeBEpusdtNetwork(network)
	if network == "" {
		switch len(enabled) {
		case 0:
			if tradeType := strings.TrimSpace(cfg["tradeType"]); tradeType != "" {
				return tradeType, nil
			}
			return "", ErrBEpusdtNetworkRequired
		case 1:
			network = enabled[0]
		default:
			return "", ErrBEpusdtNetworkRequired
		}
	}
	if !containsBEpusdtNetwork(enabled, network) {
		return "", ErrBEpusdtNetworkUnsupported
	}
	tradeType := BEpusdtTradeTypeForNetwork(network)
	if tradeType == "" {
		return "", ErrBEpusdtNetworkUnsupported
	}
	return tradeType, nil
}

func parseBEpusdtNetworkList(raw string) []string {
	seen := make(map[string]struct{}, 4)
	parsed := make([]string, 0, 4)
	for _, part := range strings.Split(raw, ",") {
		network := NormalizeBEpusdtNetwork(part)
		if network == "" {
			continue
		}
		if _, exists := seen[network]; exists {
			continue
		}
		seen[network] = struct{}{}
		parsed = append(parsed, network)
	}
	return SortBEpusdtNetworks(parsed)
}

// SortBEpusdtNetworks keeps checkout chains in the default display order.
func SortBEpusdtNetworks(networks []string) []string {
	if len(networks) == 0 {
		return networks
	}
	seen := make(map[string]struct{}, len(networks))
	sorted := make([]string, 0, len(networks))
	for _, network := range DefaultBEpusdtNetworks {
		if containsBEpusdtNetwork(networks, network) {
			sorted = append(sorted, network)
			seen[network] = struct{}{}
		}
	}
	for _, network := range networks {
		if _, exists := seen[network]; exists {
			continue
		}
		sorted = append(sorted, network)
	}
	return sorted
}

func containsBEpusdtNetwork(networks []string, network string) bool {
	for _, candidate := range networks {
		if candidate == network {
			return true
		}
	}
	return false
}
