package expo.modules.cybervpn

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.net.VpnService
import androidx.core.content.ContextCompat
import expo.modules.kotlin.activityresult.AppContextActivityResultContract
import expo.modules.kotlin.activityresult.AppContextActivityResultLauncher
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class CyberVpnModule : Module() {
  private lateinit var permissionLauncher: AppContextActivityResultLauncher<String, Boolean>

  override fun definition() = ModuleDefinition {
    Name("CyberVpn")

    RegisterActivityContracts {
      permissionLauncher = registerForActivityResult(
        object : AppContextActivityResultContract<String, Boolean> {
          override fun createIntent(context: Context, input: String): Intent =
            VpnService.prepare(context) ?: Intent()

          override fun parseResult(input: String, resultCode: Int, intent: Intent?): Boolean =
            resultCode == Activity.RESULT_OK
        }
      )
    }

    AsyncFunction("connect") Coroutine { configUri: String ->
      val context = requireNotNull(appContext.reactContext) { "Приложение уже закрыто" }
      require(configUri.startsWith("hy2://") || configUri.startsWith("hysteria2://")) {
        "Выбранная конфигурация не является ссылкой Hysteria2"
      }

      if (VpnService.prepare(context) != null) {
        val approved = permissionLauncher.launch(configUri)
        if (!approved) throw IllegalStateException("Разрешение на VPN-подключение не выдано")
      }

      val serviceIntent = Intent(context, CyberVpnService::class.java)
        .setAction(CyberVpnService.ACTION_CONNECT)
        .putExtra(CyberVpnService.EXTRA_CONFIG_URI, configUri)
      ContextCompat.startForegroundService(context, serviceIntent)
      readStatus(context)
    }

    AsyncFunction("disconnect") {
      val context = requireNotNull(appContext.reactContext) { "Приложение уже закрыто" }
      val preferences = context.getSharedPreferences(CyberVpnService.PREFERENCES, Context.MODE_PRIVATE)
      preferences.edit()
        .putString(CyberVpnService.KEY_STATE, CyberVpnService.STATE_DISCONNECTING)
        .remove(CyberVpnService.KEY_ERROR)
        .apply()
      val serviceIntent = Intent(context, CyberVpnService::class.java)
        .setAction(CyberVpnService.ACTION_DISCONNECT)
      context.startService(serviceIntent)
      readStatus(context)
    }

    Function("getStatus") {
      val context = requireNotNull(appContext.reactContext) { "Приложение уже закрыто" }
      readStatus(context)
    }
  }

  private fun readStatus(context: Context): Map<String, String> {
    val preferences = context.getSharedPreferences(CyberVpnService.PREFERENCES, Context.MODE_PRIVATE)
    var state = preferences.getString(CyberVpnService.KEY_STATE, CyberVpnService.STATE_DISCONNECTED)
      ?: CyberVpnService.STATE_DISCONNECTED
    if (!CyberVpnService.isRunning && state in listOf(
        CyberVpnService.STATE_CONNECTING,
        CyberVpnService.STATE_CONNECTED,
        CyberVpnService.STATE_RECONNECTING,
        CyberVpnService.STATE_DISCONNECTING,
      )
    ) {
      state = CyberVpnService.STATE_DISCONNECTED
      preferences.edit().putString(CyberVpnService.KEY_STATE, state).remove(CyberVpnService.KEY_ERROR).apply()
    }
    val error = preferences.getString(CyberVpnService.KEY_ERROR, null)
    return buildMap {
      put("state", state)
      if (!error.isNullOrBlank()) put("error", error)
    }
  }
}
