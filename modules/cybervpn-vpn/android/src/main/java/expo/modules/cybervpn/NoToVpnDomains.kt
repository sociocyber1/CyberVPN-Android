package expo.modules.cybervpn

import java.net.IDN
import java.util.Locale

internal object NoToVpnDomains {
  private const val MAX_SUFFIXES = 400

  fun normalize(values: List<String>): List<String> {
    require(values.size <= MAX_SUFFIXES) {
      "Можно указать не более $MAX_SUFFIXES доменных суффиксов."
    }
    return values.map { raw ->
      var host = raw.trim().lowercase(Locale.ROOT)
      val isSuffix = host.startsWith("*.") || host.startsWith(".")
      if (host.startsWith("*.")) host = host.substring(2)
      else if (host.startsWith(".")) host = host.substring(1)
      host = host.trimEnd('.')
      require(host.isNotEmpty() && host.none { it.isWhitespace() || it in "/:?#@\\" }) {
        "Некорректный доменный суффикс: $raw"
      }
      val ascii = try {
        IDN.toASCII(host, IDN.USE_STD3_ASCII_RULES).lowercase(Locale.ROOT)
      } catch (error: IllegalArgumentException) {
        throw IllegalArgumentException("Некорректный доменный суффикс: $raw", error)
      }
      val labels = ascii.split('.')
      require(ascii.length <= 253 && labels.all { label ->
        label.isNotEmpty() && label.length <= 63 &&
          label.first().isLetterOrDigit() && label.last().isLetterOrDigit() &&
          label.all { it.isLetterOrDigit() || it == '-' }
      } && !labels.all { it.all(Char::isDigit) }) {
        "Некорректный доменный суффикс: $raw"
      }
      if (isSuffix) ".$ascii" else ascii
    }.distinct()
  }
}
