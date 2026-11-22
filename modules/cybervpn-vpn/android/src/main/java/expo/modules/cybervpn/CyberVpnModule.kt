package expo.modules.cybervpn

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.net.VpnService
import android.provider.Settings
import androidx.core.content.ContextCompat
import org.json.JSONArray
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

    AsyncFunction("connect") Coroutine { configUri: String, bypassDomains: List<String>, dnsTransport: String, dnsServers: List<String> ->
      val context = requireNotNull(appContext.reactContext) { "Приложение уже закрыто" }
      require(configUri.startsWith("hy2://") || configUri.startsWith("hysteria2://")) {
        "Выбранная конфигурация не является ссылкой Hysteria2"
      }
      val normalizedDomains = NoToVpnDomains.normalize(bypassDomains)
      val normalizedDns = VpnDnsSettings.normalize(dnsTransport, dnsServers)
      context.getSharedPreferences(CyberVpnService.PREFERENCES, Context.MODE_PRIVATE).edit()
        .putString(CyberVpnService.KEY_BYPASS_DOMAINS, JSONArray(normalizedDomains).toString())
        .putString(CyberVpnService.KEY_DNS_TRANSPORT, normalizedDns.first)
        .putString(CyberVpnService.KEY_DNS_SERVERS, JSONArray(normalizedDns.second).toString())
        .apply()

      if (VpnService.prepare(context) != null) {
        val approved = permissionLauncher.launch(configUri)
        if (!approved) throw IllegalStateException("Разрешение на VPN-подключение не выдано")
      }

      val serviceIntent = Intent(context, CyberVpnService::class.java)
        .setAction(CyberVpnService.ACTION_CONNECT)
        .putExtra(CyberVpnService.EXTRA_CONFIG_URI, configUri)
        .putStringArrayListExtra(CyberVpnService.EXTRA_BYPASS_DOMAINS, ArrayList(normalizedDomains))
        .putExtra(CyberVpnService.EXTRA_DNS_TRANSPORT, normalizedDns.first)
        .putStringArrayListExtra(CyberVpnService.EXTRA_DNS_SERVERS, ArrayList(normalizedDns.second))
      ContextCompat.startForegroundService(context, serviceIntent)
      readStatus(context)
    }

    AsyncFunction("setBypassDomains") Coroutine { domains: List<String> ->
      val context = requireNotNull(appContext.reactContext) { "Приложение уже закрыто" }
      val normalizedDomains = NoToVpnDomains.normalize(domains)
      val preferences = context.getSharedPreferences(CyberVpnService.PREFERENCES, Context.MODE_PRIVATE)
      val currentState = preferences.getString(CyberVpnService.KEY_STATE, CyberVpnService.STATE_DISCONNECTED)
      if (currentState == CyberVpnService.STATE_CONNECTED) {
        val service = CyberVpnService.runningInstance
          ?: throw IllegalStateException("Служба VPN недоступна для обновления правил")
        service.updateBypassDomains(normalizedDomains)
      } else if (currentState in listOf(CyberVpnService.STATE_CONNECTING, CyberVpnService.STATE_RECONNECTING)) {
        throw IllegalStateException("Дождитесь завершения подключения перед изменением NoToVPN")
      }
      preferences.edit()
        .putString(CyberVpnService.KEY_BYPASS_DOMAINS, JSONArray(normalizedDomains).toString())
        .apply()
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

    AsyncFunction("getInstalledApps") {
      val context = requireNotNull(appContext.reactContext) { "Приложение уже закрыто" }
      val launcherIntent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
      @Suppress("DEPRECATION")
      context.packageManager.queryIntentActivities(launcherIntent, 0)
        .mapNotNull { info ->
          val packageName = info.activityInfo?.packageName ?: return@mapNotNull null
          if (packageName == context.packageName) return@mapNotNull null
          mapOf(
            "packageName" to packageName,
            "label" to info.loadLabel(context.packageManager).toString(),
          )
        }
        .distinctBy { it["packageName"] }
        .sortedBy { (it["label"] as? String)?.lowercase() ?: "" }
    }

    Function("getFirewallSettings") {
      val context = requireNotNull(appContext.reactContext) { "Приложение уже закрыто" }
      readFirewallSettings(context)
    }

    AsyncFunction("setFirewallSettings") Coroutine { enabled: Boolean, blockAll: Boolean, blockedPackages: List<String> ->
      val context = requireNotNull(appContext.reactContext) { "Приложение уже закрыто" }
      val policy = blockedPackages.distinct().filter { packageName ->
        packageName.isNotBlank() && packageName != context.packageName &&
          runCatching { context.packageManager.getApplicationInfo(packageName, 0) }.isSuccess
      }.take(500)
      val service = CyberVpnService.runningInstance
      val preferences = context.getSharedPreferences(CyberVpnService.PREFERENCES, Context.MODE_PRIVATE)
      val excluded = readPackageList(preferences.getString(CyberVpnService.KEY_EXCLUDED_PACKAGES, "[]"))
      if (enabled && excluded.isNotEmpty()) {
        throw IllegalStateException("Firewall нельзя включить вместе с исключениями из VPN. Сначала удалите исключения приложений.")
      }
      val state = preferences.getString(CyberVpnService.KEY_STATE, CyberVpnService.STATE_DISCONNECTED)
      if (enabled && (state != CyberVpnService.STATE_CONNECTED || service == null)) {
        throw IllegalStateException("Сначала подключите CyberVPN: правила Firewall можно активировать только при установленном туннеле")
      }
      if (enabled && service?.let { it.refreshAlwaysOnState() && it.refreshLockdownState() } != true) {
        throw IllegalStateException("Firewall недоступен: включите Always-on VPN и Block connections without VPN в настройках Android")
      }
      if (state in listOf(CyberVpnService.STATE_CONNECTING, CyberVpnService.STATE_RECONNECTING)) {
        throw IllegalStateException("Дождитесь завершения подключения перед изменением Firewall")
      }
      service?.applyFirewallSettings(enabled, blockAll, policy)
      preferences.edit()
        .putBoolean(CyberVpnService.KEY_FIREWALL_ENABLED, enabled)
        .putBoolean(CyberVpnService.KEY_BLOCK_ALL, blockAll)
        .putString(CyberVpnService.KEY_BLOCKED_PACKAGES, JSONArray(policy).toString())
        .apply()
      readFirewallSettings(context)
    }

    AsyncFunction("setExcludedApplications") Coroutine { excludedPackages: List<String> ->
      val context = requireNotNull(appContext.reactContext) { "Приложение уже закрыто" }
      val packages = excludedPackages.distinct().filter { packageName ->
        packageName.isNotBlank() && packageName != context.packageName &&
          runCatching { context.packageManager.getApplicationInfo(packageName, 0) }.isSuccess
      }.take(500)
      val preferences = context.getSharedPreferences(CyberVpnService.PREFERENCES, Context.MODE_PRIVATE)
      val state = preferences.getString(CyberVpnService.KEY_STATE, CyberVpnService.STATE_DISCONNECTED)
      if (state != CyberVpnService.STATE_DISCONNECTED) {
        throw IllegalStateException("Для изменения исключений полностью отключите VPN. Правила применятся при следующем подключении.")
      }
      if (preferences.getBoolean(CyberVpnService.KEY_FIREWALL_ENABLED, false)) {
        throw IllegalStateException("Сначала отключите правила Firewall: блокировка и обход VPN несовместимы.")
      }
      val service = CyberVpnService.runningInstance
      if (service?.refreshLockdownState() == true) {
        throw IllegalStateException("Отключите Android Lockdown (Block connections without VPN), чтобы исключённые приложения могли выйти напрямую.")
      }
      preferences.edit().putString(CyberVpnService.KEY_EXCLUDED_PACKAGES, JSONArray(packages).toString()).apply()
      service?.setExcludedApplications(packages)
      readFirewallSettings(context)
    }

    AsyncFunction("openVpnSettings") {
      val context = requireNotNull(appContext.reactContext) { "Приложение уже закрыто" }
      context.startActivity(Intent(Settings.ACTION_VPN_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }

    Function("getLiveConnections") {
      CyberVpnService.runningInstance?.getLiveConnections().orEmpty()
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

  private fun readFirewallSettings(context: Context): Map<String, Any> {
    val preferences = context.getSharedPreferences(CyberVpnService.PREFERENCES, Context.MODE_PRIVATE)
    val service = CyberVpnService.runningInstance
    val lockdown = service?.refreshLockdownState() == true
    val alwaysOn = service?.refreshAlwaysOnState() == true
    val storedPackages = try {
      val json = JSONArray(preferences.getString(CyberVpnService.KEY_BLOCKED_PACKAGES, "[]") ?: "[]")
      (0 until json.length()).mapNotNull { index -> json.optString(index).takeIf(String::isNotBlank) }
    } catch (_: Throwable) { emptyList() }
    val packages = storedPackages.filter { packageName ->
      packageName != context.packageName && runCatching { context.packageManager.getApplicationInfo(packageName, 0) }.isSuccess
    }
    val storedExcluded = readPackageList(preferences.getString(CyberVpnService.KEY_EXCLUDED_PACKAGES, "[]"))
    val excluded = storedExcluded.filter { packageName ->
      packageName != context.packageName && runCatching { context.packageManager.getApplicationInfo(packageName, 0) }.isSuccess
    }
    if (packages != storedPackages) preferences.edit()
      .putString(CyberVpnService.KEY_BLOCKED_PACKAGES, JSONArray(packages).toString())
      .apply()
    if (excluded != storedExcluded) preferences.edit()
      .putString(CyberVpnService.KEY_EXCLUDED_PACKAGES, JSONArray(excluded).toString())
      .apply()
    return mapOf(
      "enabled" to preferences.getBoolean(CyberVpnService.KEY_FIREWALL_ENABLED, false),
      "blockAll" to preferences.getBoolean(CyberVpnService.KEY_BLOCK_ALL, false),
      "blockedPackages" to packages,
      "excludedPackages" to excluded,
      "lockdownEnabled" to lockdown,
      "alwaysOn" to alwaysOn,
      "hasSavedConfig" to !preferences.getString(CyberVpnService.KEY_CONFIG_URI, null).isNullOrBlank(),
    )
  }

  private fun readPackageList(raw: String?): List<String> = try {
    val json = JSONArray(raw ?: "[]")
    (0 until json.length()).mapNotNull { index -> json.optString(index).takeIf(String::isNotBlank) }
  } catch (_: Throwable) { emptyList() }
}
