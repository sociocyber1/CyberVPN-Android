package golib

import "testing"

func TestDNSPolicy_ExactMatch(t *testing.T) {
	p, err := newDNSPolicy([]directDomainRule{{ID: "r1", Name: "Example.COM."}}, "enabled")
	if err != nil {
		t.Fatal(err)
	}
	for _, name := range []string{"example.com", "Example.COM."} {
		if id, ok := p.directRuleFor(dnsQuery(name)); !ok || id != "r1" {
			t.Errorf("%q -> (%q, %v), want (r1, true)", name, id, ok)
		}
	}
	for _, name := range []string{"www.example.com", "notexample.com"} {
		if id, ok := p.directRuleFor(dnsQuery(name)); ok {
			t.Errorf("%q unexpectedly matched rule %q", name, id)
		}
	}
}

func TestDNSPolicy_NormalizesIDNA(t *testing.T) {
	unicode, err := newDNSPolicy([]directDomainRule{{ID: "r1", Name: "bücher.example"}}, "enabled")
	if err != nil {
		t.Fatal(err)
	}
	if id, ok := unicode.directRuleFor(dnsQuery("xn--bcher-kva.example")); !ok || id != "r1" {
		t.Fatalf("IDNA name -> (%q, %v), want (r1, true)", id, ok)
	}
}

func TestDNSPolicy_SuffixMatchUsesLabelBoundariesAndMostSpecificRule(t *testing.T) {
	p, err := newDNSPolicy([]directDomainRule{
		{ID: "tld", Name: ".ru"},
		{ID: "specific", Name: "*.example.ru"},
	}, "enabled")
	if err != nil {
		t.Fatal(err)
	}
	tests := []struct {
		name, want string
	}{
		{name: "ru", want: "tld"},
		{name: "example.ru", want: "tld"},
		{name: "www.example.ru", want: "specific"},
		{name: "notru", want: ""},
		{name: "example.rust", want: ""},
	}
	for _, tt := range tests {
		got, ok := p.directRuleFor(dnsQuery(tt.name))
		if tt.want == "" {
			if ok {
				t.Errorf("%q unexpectedly matched %q", tt.name, got)
			}
		} else if !ok || got != tt.want {
			t.Errorf("%q -> (%q, %v), want (%q, true)", tt.name, got, ok, tt.want)
		}
	}
}

func TestDNSPolicy_BypassOnlyRoutesAAAAToDirect(t *testing.T) {
	p, err := newDNSPolicy(nil, "bypass_only")
	if err != nil {
		t.Fatal(err)
	}
	if id, ok := p.directRuleFor(aaaaQuery("unmatched.example")); !ok || id != "ipv6-bypass" {
		t.Fatalf("AAAA -> (%q, %v), want IPv6 direct selection", id, ok)
	}
	if _, ok := p.directRuleFor(dnsQuery("unmatched.example")); ok {
		t.Fatal("A query without an exact rule must remain Remote")
	}
}
