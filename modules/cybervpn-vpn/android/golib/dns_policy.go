package golib

import (
	"fmt"
	"strings"

	"golang.org/x/net/idna"
)

type directDomainRule struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type dnsPolicy struct {
	directDomains   map[string]string
	directSuffixes  map[string]string
	directWildcards map[string]string
	ipv6Mode        string
}

func newDNSPolicy(rules []directDomainRule, ipv6Mode string) (*dnsPolicy, error) {
	p := &dnsPolicy{
		directDomains:   make(map[string]string, len(rules)),
		directSuffixes:  make(map[string]string, len(rules)),
		directWildcards: make(map[string]string, len(rules)),
		ipv6Mode:        ipv6Mode,
	}
	for _, rule := range rules {
		rawName := strings.TrimSpace(rule.Name)
		suffix := false
		wildcard := false
		if strings.HasPrefix(rawName, "*.") {
			rawName, suffix, wildcard = strings.TrimPrefix(rawName, "*."), true, true
		} else if strings.HasPrefix(rawName, ".") {
			rawName, suffix = strings.TrimPrefix(rawName, "."), true
		}
		name, err := normalizeDNSName(rawName)
		if err != nil {
			return nil, fmt.Errorf("invalid direct DNS domain %q: %w", rule.Name, err)
		}
		if rule.ID == "" {
			return nil, fmt.Errorf("direct DNS domain %q has no rule ID", rule.Name)
		}
		destination := p.directDomains
		if suffix {
			destination = p.directSuffixes
		}
		if wildcard {
			destination = p.directWildcards
		}
		if existing, ok := destination[name]; ok && existing != rule.ID {
			return nil, fmt.Errorf("duplicate direct DNS domain %q", name)
		}
		destination[name] = rule.ID
	}
	return p, nil
}

func (p *dnsPolicy) directRuleFor(query []byte) (string, bool) {
	if p == nil {
		return "", false
	}
	if p.ipv6Mode == "bypass_only" {
		if qtype, ok := dnsQuestionType(query); ok && qtype == dnsTypeAAAA {
			return "ipv6-bypass", true
		}
	}
	name, ok := dnsQuestionName(query)
	if !ok {
		return "", false
	}
	if ruleID, found := p.directDomains[name]; found {
		return ruleID, true
	}
	bestLength := -1
	bestRule := ""
	for suffix, ruleID := range p.directSuffixes {
		if (name == suffix || strings.HasSuffix(name, "."+suffix)) && len(suffix) > bestLength {
			bestLength = len(suffix)
			bestRule = ruleID
		}
	}
	for suffix, ruleID := range p.directWildcards {
		if strings.HasSuffix(name, "."+suffix) && len(suffix) >= bestLength {
			bestLength = len(suffix)
			bestRule = ruleID
		}
	}
	return bestRule, bestLength >= 0
}

func dnsQuestionName(query []byte) (string, bool) {
	if len(query) < dnsHeaderLen || query[2]&0x80 != 0 || query[4] != 0 || query[5] != 1 {
		return "", false
	}
	pos := dnsHeaderLen
	labels := make([]string, 0, 8)
	for {
		if pos >= len(query) {
			return "", false
		}
		size := int(query[pos])
		pos++
		if size == 0 {
			break
		}
		if size&0xc0 != 0 || size > 63 || pos+size > len(query) {
			return "", false
		}
		labels = append(labels, string(query[pos:pos+size]))
		pos += size
	}
	if pos+4 > len(query) || len(labels) == 0 {
		return "", false
	}
	name, err := normalizeDNSName(strings.Join(labels, "."))
	return name, err == nil
}

func normalizeDNSName(name string) (string, error) {
	name = strings.TrimSuffix(strings.TrimSpace(name), ".")
	if name == "" || len(name) > 253 {
		return "", fmt.Errorf("name is empty or too long")
	}
	ascii, err := idna.Lookup.ToASCII(strings.ToLower(name))
	if err != nil {
		return "", err
	}
	for _, label := range strings.Split(ascii, ".") {
		if label == "" || len(label) > 63 {
			return "", fmt.Errorf("invalid DNS label")
		}
	}
	return strings.ToLower(ascii), nil
}
