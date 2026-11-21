package expo.modules.cybervpn

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Intent
import android.net.VpnService
import android.os.Build
import android.os.ParcelFileDescriptor
import android.util.Log
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.launch
import ru.shapovalov.hysteria.ConnectionState
import ru.shapovalov.hysteria.HysteriaClientImpl
import ru.shapovalov.hysteria.api.DisconnectReason
import ru.shapovalov.hysteria.api.HysteriaClient
import ru.shapovalov.hysteria.api.Ipv6Mode
import ru.shapovalov.hysteria.api.TunConfig
import ru.shapovalov.hysteria.parseHysteriaUri

class CyberVpnService : VpnService() {
  private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
  private val hysteriaClient by lazy { HysteriaClientImpl() }
  private var connectionJob: Job? = null
  private var stateJob: Job? = null

  override fun onCreate() {
    super.onCreate()
    isRunning = true
    createNotificationChannel()
    stateJob = serviceScope.launch {
      hysteriaClient.state.collect { state ->
        when (state) {
          is ConnectionState.Connecting -> setState(STATE_CONNECTING)
          is ConnectionState.Connected -> setState(STATE_CONNECTED)
          is ConnectionState.Reconnecting -> setState(STATE_RECONNECTING)
          is ConnectionState.Error -> fail(state.message)
          is ConnectionState.Disconnected -> {
            if (state.reason == DisconnectReason.REVOKED) setState(STATE_DISCONNECTED)
          }
        }
      }
    }
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    when (intent?.action) {
      ACTION_DISCONNECT -> {
        stopTunnel()
        return START_NOT_STICKY
      }
      ACTION_CONNECT -> {
        val uri = intent.getStringExtra(EXTRA_CONFIG_URI)
        if (uri.isNullOrBlank()) {
          fail("Не получена конфигурация сервера")
          stopSelf(startId)
          return START_NOT_STICKY
        }
        startForeground(NOTIFICATION_ID, notification("Подключаемся к серверу…"))
        if (connectionJob?.isActive != true) startTunnel(uri)
        return START_NOT_STICKY
      }
      else -> {
        stopSelf(startId)
        return START_NOT_STICKY
      }
    }
  }

  private fun startTunnel(uri: String) {
    setState(STATE_CONNECTING)
    connectionJob = serviceScope.launch {
      try {
        val parsed = parseHysteriaUri(uri)
        hysteriaClient.validateConfig(parsed.config).getOrThrow()
        hysteriaClient.start(
          config = parsed.config,
          tunConfig = TunConfig.Default,
          protector = object : HysteriaClient.SocketProtector {
            override fun protect(fd: Int): Boolean = this@CyberVpnService.protect(fd)
            override fun bindAndProtect(fd: Int): Boolean = this@CyberVpnService.protect(fd)
          },
          tun = HysteriaClient.TunFactory(::establishTunnel),
        )
        if (hysteriaClient.state.value is ConnectionState.Connected) {
          setState(STATE_CONNECTED)
        }
      } catch (error: CancellationException) {
        throw error
      } catch (error: Throwable) {
        Log.e(TAG, "Hysteria2 tunnel start failed", error)
        fail(error.message ?: "Не удалось подключиться к серверу")
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
      }
    }
  }

  private fun establishTunnel(config: TunConfig): ParcelFileDescriptor {
    val builder = Builder()
      .setSession("CyberVPN — Hysteria2")
      .setMtu(config.mtu)
      .addAddress(TunConfig.IPV4_ADDRESS, TunConfig.IPV4_PREFIX_LENGTH)
      .addDnsServer(TunConfig.IPV4_DNS_ADDRESS)
      .addRoute("0.0.0.0", 0)

    if (config.ipv6Mode == Ipv6Mode.Enabled) {
      builder
        .addAddress(TunConfig.IPV6_ADDRESS, TunConfig.IPV6_PREFIX_LENGTH)
        .addDnsServer(TunConfig.IPV6_DNS_ADDRESS)
        .addRoute("::", 0)
    }

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) builder.setMetered(false)
    return builder.establish() ?: throw IllegalStateException("Android не создал VPN-интерфейс")
  }

  private fun stopTunnel() {
    setState(STATE_DISCONNECTING)
    hysteriaClient.shutdown(DisconnectReason.USER)
    connectionJob?.cancel()
    connectionJob = null
    serviceScope.launch {
      runCatching { hysteriaClient.stop(DisconnectReason.USER) }
        .onFailure { Log.w(TAG, "VPN shutdown cleanup failed", it) }
      setState(STATE_DISCONNECTED)
      stopForeground(STOP_FOREGROUND_REMOVE)
      stopSelf()
    }
  }

  override fun onRevoke() {
    setState(STATE_DISCONNECTED)
    hysteriaClient.shutdown(DisconnectReason.REVOKED)
    connectionJob?.cancel()
    stopForeground(STOP_FOREGROUND_REMOVE)
    stopSelf()
    super.onRevoke()
  }

  override fun onDestroy() {
    connectionJob?.cancel()
    stateJob?.cancel()
    hysteriaClient.shutdown(DisconnectReason.USER)
    isRunning = false
    val preferences = getSharedPreferences(PREFERENCES, MODE_PRIVATE)
    if (preferences.getString(KEY_STATE, STATE_DISCONNECTED) in listOf(STATE_CONNECTING, STATE_CONNECTED, STATE_RECONNECTING, STATE_DISCONNECTING)) {
      preferences.edit().putString(KEY_STATE, STATE_DISCONNECTED).remove(KEY_ERROR).apply()
    }
    serviceScope.cancel()
    super.onDestroy()
  }

  private fun fail(message: String) {
    val safeMessage = message.take(280)
    getSharedPreferences(PREFERENCES, MODE_PRIVATE).edit()
      .putString(KEY_STATE, STATE_ERROR)
      .putString(KEY_ERROR, safeMessage)
      .apply()
    updateNotification("Ошибка подключения")
  }

  private fun setState(state: String) {
    getSharedPreferences(PREFERENCES, MODE_PRIVATE).edit()
      .putString(KEY_STATE, state)
      .remove(KEY_ERROR)
      .apply()
    val text = when (state) {
      STATE_CONNECTED -> "Защищённое соединение активно"
      STATE_RECONNECTING -> "Восстанавливаем соединение…"
      STATE_CONNECTING -> "Подключаемся к серверу…"
      STATE_DISCONNECTING -> "Отключаемся…"
      else -> "VPN отключён"
    }
    if (state != STATE_DISCONNECTED) updateNotification(text)
  }

  private fun createNotificationChannel() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val channel = NotificationChannel(
        CHANNEL_ID,
        "Состояние VPN",
        NotificationManager.IMPORTANCE_LOW,
      ).apply { description = "Статус защищённого VPN-туннеля CyberVPN" }
      getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }
  }

  private fun notification(text: String): Notification {
    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      Notification.Builder(this, CHANNEL_ID)
    } else {
      @Suppress("DEPRECATION")
      Notification.Builder(this)
    }
    return builder
      .setSmallIcon(applicationInfo.icon)
      .setContentTitle("CyberVPN")
      .setContentText(text)
      .setOngoing(true)
      .setCategory(Notification.CATEGORY_SERVICE)
      .build()
  }

  private fun updateNotification(text: String) {
    val manager = getSystemService(NotificationManager::class.java) ?: return
    manager.notify(NOTIFICATION_ID, notification(text))
  }

  companion object {
    @Volatile
    var isRunning: Boolean = false
      private set

    const val ACTION_CONNECT = "expo.modules.cybervpn.CONNECT"
    const val ACTION_DISCONNECT = "expo.modules.cybervpn.DISCONNECT"
    const val EXTRA_CONFIG_URI = "config_uri"
    const val PREFERENCES = "cybervpn_vpn_status"
    const val KEY_STATE = "state"
    const val KEY_ERROR = "error"
    const val STATE_DISCONNECTED = "disconnected"
    const val STATE_CONNECTING = "connecting"
    const val STATE_CONNECTED = "connected"
    const val STATE_RECONNECTING = "reconnecting"
    const val STATE_DISCONNECTING = "disconnecting"
    const val STATE_ERROR = "error"
    private const val CHANNEL_ID = "cybervpn_vpn"
    private const val NOTIFICATION_ID = 7201
    private const val TAG = "CyberVpnService"
  }
}
