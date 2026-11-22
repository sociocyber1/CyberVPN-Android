package golib

import M "github.com/sagernet/sing/common/metadata"

// FlowFilter attributes and filters an original TCP/UDP flow before forwarding.
// Protocol uses the IP protocol numbers 6 (TCP) and 17 (UDP).
type FlowFilter interface {
	Allow(protocol int32, sourceAddress string, sourcePort int32, destinationAddress string, destinationPort int32) bool
}

// TCPFlowFilter remains as a compatibility adapter for existing callers.
type TCPFlowFilter interface {
	Allow(sourceAddress string, sourcePort int32, destinationAddress string, destinationPort int32) bool
}

type flowFilterFunc func(protocol int32, sourceAddress string, sourcePort int32, destinationAddress string, destinationPort int32) bool

func (f flowFilterFunc) Allow(protocol int32, sourceAddress string, sourcePort int32, destinationAddress string, destinationPort int32) bool {
	return f(protocol, sourceAddress, sourcePort, destinationAddress, destinationPort)
}

type tcpFlowFilterAdapter struct{ inner TCPFlowFilter }

func (f tcpFlowFilterAdapter) Allow(_ int32, sourceAddress string, sourcePort int32, destinationAddress string, destinationPort int32) bool {
	return f.inner.Allow(sourceAddress, sourcePort, destinationAddress, destinationPort)
}

type flowFilterHolder struct{ filter FlowFilter }

func (s *Session) SetFlowFilter(filter FlowFilter) {
	if filter == nil {
		s.flowFilter.Store(nil)
	} else {
		s.flowFilter.Store(&flowFilterHolder{filter: filter})
	}
}

func (s *Session) SetTCPFlowFilter(filter TCPFlowFilter) {
	if filter == nil {
		s.SetFlowFilter(nil)
		return
	}
	s.SetFlowFilter(tcpFlowFilterAdapter{inner: filter})
}

func (s *Session) allowFlow(protocol int32, source, destination M.Socksaddr) bool {
	holder := s.flowFilter.Load()
	return holder == nil || holder.filter.Allow(protocol, source.Addr.String(), int32(source.Port), destination.Addr.String(), int32(destination.Port))
}

func (s *Session) allowTCPFlow(source, destination M.Socksaddr) bool {
	return s.allowFlow(6, source, destination)
}

func (s *Session) allowUDPFlow(source, destination M.Socksaddr) bool {
	return s.allowFlow(17, source, destination)
}
