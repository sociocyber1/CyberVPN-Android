package golib

import (
	"context"
	"net"
	"testing"

	M "github.com/sagernet/sing/common/metadata"
)

type denyTCPFlow struct{ calls int }

func (f *denyTCPFlow) Allow(string, int32, string, int32) bool {
	f.calls++
	return false
}

func TestTCPFlowFilterRejectsBeforeForwardingOrDirectDNS(t *testing.T) {
	for _, destination := range []string{"203.0.113.7:443", "172.19.0.2:53"} {
		t.Run(destination, func(t *testing.T) {
			filter := &denyTCPFlow{}
			session := &Session{}
			session.SetTCPFlowFilter(filter)
			connection, peer := net.Pipe()
			defer connection.Close()
			defer peer.Close()
			handler := &tunHandler{session: session}
			err := handler.newConnection(context.Background(), connection,
				M.ParseSocksaddr("172.19.0.1:45000"), M.ParseSocksaddr(destination))
			if err == nil || filter.calls != 1 {
				t.Fatalf("rejected flow: error=%v, filter calls=%d", err, filter.calls)
			}
		})
	}
}

type recordingFlowFilter struct {
	protocols []int32
	allowed   bool
}

func (f *recordingFlowFilter) Allow(protocol int32, _ string, _ int32, _ string, _ int32) bool {
	f.protocols = append(f.protocols, protocol)
	return f.allowed
}

func TestFlowFilterReceivesTCPAndUDPProtocolNumbers(t *testing.T) {
	session := &Session{}
	filter := &recordingFlowFilter{allowed: false}
	session.SetFlowFilter(filter)
	source := M.ParseSocksaddr("10.0.0.2:40000")
	destination := M.ParseSocksaddr("198.51.100.8:443")

	if session.allowTCPFlow(source, destination) {
		t.Fatal("TCP flow should be denied")
	}
	if session.allowUDPFlow(source, destination) {
		t.Fatal("UDP flow should be denied")
	}
	if len(filter.protocols) != 2 || filter.protocols[0] != 6 || filter.protocols[1] != 17 {
		t.Fatalf("protocol callbacks = %v, want [6 17]", filter.protocols)
	}
}

func TestFlowFilterDefaultsToAllow(t *testing.T) {
	session := &Session{}
	if !session.allowTCPFlow(M.ParseSocksaddr("10.0.0.2:40000"), M.ParseSocksaddr("198.51.100.8:443")) {
		t.Fatal("TCP should be allowed when no filter is configured")
	}
	if !session.allowUDPFlow(M.ParseSocksaddr("10.0.0.2:40000"), M.ParseSocksaddr("198.51.100.8:443")) {
		t.Fatal("UDP should be allowed when no filter is configured")
	}
}
