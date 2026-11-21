package expo.modules.cybervpn

import ru.shapovalov.hysteria.api.DnsTransport
import ru.shapovalov.hysteria.api.DnsUpstream
import java.net.Inet6Address
import java.net.InetAddress
import java.net.IDN
import java.net.URI
import java.util.Locale

internal object VpnDnsSettings {
  private const val MAX_SERVERS = 8

  fun normalize(transportName: String, servers: List<String>): Pair<String, List<String>> {
    val transport = when (transportName.trim().lowercase(Locale.ROOT)) {
      "udp" -> DnsTransport.Udp
      "tcp" -> DnsTransport.Tcp
      "tls" -> DnsTransport.Tls
      "https" -> DnsTransport.Https
      else -> throw IllegalArgumentException("Неподдерживаемый DNS-транспорт: $transportName")
    }
    require(servers.isNotEmpty() && servers.size <= MAX_SERVERS) {
      "Укажите от 1 до $MAX_SERVERS DNS-серверов."
    }
    val normalized = servers.map { raw ->
      val server = raw.trim()
      require(server.isNotEmpty() && server.length <= 2048 && !server.any(Char::isWhitespace)) {
        "Некорректный адрес DNS-сервера: $raw"
      }
      when (transport) {
        DnsTransport.Udp, DnsTransport.Tcp -> {
          require(isNumericAddress(server)) { "Для UDP/TCP укажите IP-адрес без имени: $raw" }
          server
        }
        DnsTransport.Tls -> {
          val host = server.substringBeforeLast(':').takeIf { server.count { c -> c == ':' } == 1 } ?: server
          validateHost(host)
          server
        }
        DnsTransport.Https -> {
          val url = if (server.contains("://")) server else "https://$server"
          val parsed = try { URI(url) } catch (error: Exception) { throw IllegalArgumentException("Некорректный DoH URL: $raw", error) }
          require(parsed.scheme.equals("https", ignoreCase = true) && !parsed.host.isNullOrBlank() && parsed.rawUserInfo == null) {
            "DoH должен быть HTTPS-адресом без логина и пароля: $raw"
          }
          require(parsed.port == -1 || parsed.port in 1..65535) { "Некорректный порт DoH: $raw" }
          parsed.toASCIIString().replaceFirst(Regex("^https://", RegexOption.IGNORE_CASE), "https://")
        }
        else -> error("Unsupported DNS transport")
      }
    }.distinct()
    DnsUpstream(transport, normalized)
    return transport.wire to normalized
  }

  private fun validateHost(host: String) {
    require(host.isNotBlank() && host.length <= 253 && !host.any { it.isWhitespace() || it in "/@?#\\" }) {
      "Некорректное имя DNS-сервера: $host"
    }
    val unwrapped = host.removePrefix("[").removeSuffix("]")
    if (unwrapped.contains(':')) {
      require(unwrapped.matches(Regex("[0-9a-fA-F:]+")) && runCatching { InetAddress.getByName(unwrapped) is Inet6Address }.getOrDefault(false)) {
        "Некорректный IPv6 DNS-сервер: $host"
      }
      return
    }
    val ascii = try { IDN.toASCII(host.trim('[', ']'), IDN.USE_STD3_ASCII_RULES) }
    catch (error: IllegalArgumentException) { throw IllegalArgumentException("Некорректное имя DNS-сервера: $host", error) }
    require(ascii.split('.').all { it.isNotEmpty() && it.length <= 63 }) { "Некорректное имя DNS-сервера: $host" }
  }

  private fun isNumericAddress(value: String): Boolean {
    val host = value.removePrefix("[").removeSuffix("]")
    val ipv4 = host.matches(Regex("(?:[0-9]{1,3}\\.){3}[0-9]{1,3}")) && host.split('.').all { it.toIntOrNull() in 0..255 }
    if (ipv4) return true
    return host.contains(':') && host.matches(Regex("[0-9a-fA-F:]+")) &&
      runCatching { InetAddress.getByName(host) is Inet6Address }.getOrDefault(false)
  }
}
