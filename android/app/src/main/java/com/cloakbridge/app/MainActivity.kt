package com.cloakbridge.app

import android.graphics.ImageDecoder
import android.os.Build
import android.os.Bundle
import android.provider.MediaStore
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material.icons.filled.Cloud
import androidx.compose.material.icons.filled.CloudUpload
import androidx.compose.material.icons.filled.Memory
import androidx.compose.material.icons.filled.Security
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.cloakbridge.app.data.LocalVaultEngine
import com.cloakbridge.app.ui.CloakBridgeViewModel

// Carbon Command Center Design Tokens (matching CloakBridge Web 1:1)
private val CarbonAppBg = Color(0xFF08090A)
private val CarbonNavBg = Color(0xFF0D0E10)
private val CarbonSurface = Color(0xFF17191C)
private val CarbonElevated = Color(0xFF202226)
private val CarbonBorder = Color(0xFF303237)
private val CarbonDivider = Color(0xFF25272B)
private val TextPrimary = Color(0xFFF1F2F3)
private val TextSecondary = Color(0xFFA3A7AD)
private val TextMuted = Color(0xFF777D85)
private val AccentOrange = Color(0xFFE37A37)
private val PrivacyGreen = Color(0xFF56B89A)
private val CloudSteelBlue = Color(0xFF7D9DBA)
private val WarnAmber = Color(0xFFE8B35D)
private val ErrorRed = Color(0xFFDB6666)

private val CarbonColorScheme = darkColorScheme(
    primary = AccentOrange,
    secondary = PrivacyGreen,
    tertiary = CloudSteelBlue,
    background = CarbonAppBg,
    surface = CarbonSurface,
    surfaceVariant = CarbonElevated,
    outline = CarbonBorder,
    onPrimary = CarbonNavBg,
    onSecondary = CarbonNavBg,
    onBackground = TextPrimary,
    onSurface = TextPrimary,
    onSurfaceVariant = TextSecondary
)

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme(colorScheme = CarbonColorScheme) {
                CloakBridgeScreen()
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun CloakBridgeScreen(vm: CloakBridgeViewModel = viewModel()) {
    val state by vm.uiState.collectAsState()
    var selectedTab by remember { mutableIntStateOf(0) }
    val context = LocalContext.current

    val photoPicker = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.PickVisualMedia()
    ) { uri ->
        if (uri != null) {
            val bitmap = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                ImageDecoder.decodeBitmap(ImageDecoder.createSource(context.contentResolver, uri))
            } else {
                @Suppress("DEPRECATION")
                MediaStore.Images.Media.getBitmap(context.contentResolver, uri)
            }
            vm.scanBitmapOnDevice(bitmap)
        }
    }

    Scaffold(
        containerColor = CarbonAppBg,
        bottomBar = {
            Column {
                HorizontalDivider(color = CarbonDivider, thickness = 1.dp)
                NavigationBar(containerColor = CarbonNavBg, tonalElevation = 0.dp) {
                    val navColors = NavigationBarItemDefaults.colors(
                        selectedIconColor = AccentOrange,
                        selectedTextColor = TextPrimary,
                        indicatorColor = CarbonElevated,
                        unselectedIconColor = TextMuted,
                        unselectedTextColor = TextMuted
                    )
                    NavigationBarItem(
                        selected = selectedTab == 0,
                        onClick = { selectedTab = 0 },
                        colors = navColors,
                        icon = { Icon(Icons.Default.Security, contentDescription = null) },
                        label = { Text("Shield", fontSize = 11.sp) }
                    )
                    NavigationBarItem(
                        selected = selectedTab == 1,
                        onClick = { selectedTab = 1 },
                        colors = navColors,
                        icon = { Icon(Icons.Default.Memory, contentDescription = null) },
                        label = { Text("Wire & Nano", fontSize = 11.sp) }
                    )
                    NavigationBarItem(
                        selected = selectedTab == 2,
                        onClick = { selectedTab = 2 },
                        colors = navColors,
                        icon = { Icon(Icons.Default.Cloud, contentDescription = null) },
                        label = { Text("Cloud Audit", fontSize = 11.sp) }
                    )
                    NavigationBarItem(
                        selected = selectedTab == 3,
                        onClick = { selectedTab = 3 },
                        colors = navColors,
                        icon = { Icon(Icons.Default.CloudUpload, contentDescription = null) },
                        label = { Text("Synced (${state.syncedCases.size})", fontSize = 11.sp) }
                    )
                }
            }
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = 16.dp, vertical = 14.dp)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            // Carbon Command Header
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .size(34.dp)
                            .background(CarbonSurface, RoundedCornerShape(7.dp))
                            .border(1.dp, CarbonBorder, RoundedCornerShape(7.dp)),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            Icons.Default.Security,
                            contentDescription = null,
                            tint = TextPrimary,
                            modifier = Modifier.size(18.dp)
                        )
                        Box(
                            modifier = Modifier
                                .align(Alignment.TopEnd)
                                .padding(4.dp)
                                .size(6.dp)
                                .background(AccentOrange, CircleShape)
                        )
                    }
                    Column {
                        Text(
                            text = "CloakBridge",
                            fontSize = 18.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = TextPrimary
                        )
                        Text(
                            text = "Carbon Command · Android Hybrid Firewall",
                            fontSize = 11.sp,
                            color = TextMuted
                        )
                    }
                }

                Box(
                    modifier = Modifier
                        .background(CarbonSurface, RoundedCornerShape(6.dp))
                        .border(
                            1.dp,
                            if (state.nanoStatus == "AVAILABLE") PrivacyGreen.copy(alpha = 0.45f) else CarbonBorder,
                            RoundedCornerShape(6.dp)
                        )
                        .clickable {
                            if (state.nanoStatus == "DOWNLOADABLE") vm.downloadNano() else vm.refreshNanoStatus()
                        }
                        .padding(horizontal = 10.dp, vertical = 6.dp)
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(6.dp)
                                .background(
                                    if (state.nanoStatus == "AVAILABLE") PrivacyGreen else WarnAmber,
                                    CircleShape
                                )
                        )
                        Text(
                            text = "NANO: ${state.nanoStatus}",
                            fontSize = 10.sp,
                            fontFamily = FontFamily.Monospace,
                            fontWeight = FontWeight.SemiBold,
                            color = if (state.nanoStatus == "AVAILABLE") PrivacyGreen else WarnAmber
                        )
                    }
                }
            }

            HorizontalDivider(color = CarbonDivider, thickness = 1.dp)

            state.nanoDownloadMessage?.let { msg ->
                Text(text = msg, fontSize = 11.sp, fontFamily = FontFamily.Monospace, color = WarnAmber)
            }
            state.busyMessage?.let { busy ->
                Card(
                    colors = CardDefaults.cardColors(containerColor = CarbonSurface),
                    border = BorderStroke(1.dp, AccentOrange.copy(alpha = 0.5f)),
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Column(Modifier.padding(12.dp)) {
                        Text(busy, fontSize = 12.sp, color = AccentOrange, fontWeight = FontWeight.Medium)
                        Spacer(Modifier.height(6.dp))
                        LinearProgressIndicator(
                            modifier = Modifier.fillMaxWidth(),
                            color = AccentOrange,
                            trackColor = CarbonDivider
                        )
                    }
                }
            }
            state.errorMessage?.let { err ->
                Card(
                    colors = CardDefaults.cardColors(containerColor = Color(0xFF241415)),
                    border = BorderStroke(1.dp, ErrorRed.copy(alpha = 0.45f)),
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Text(err, modifier = Modifier.padding(12.dp), fontSize = 12.sp, color = ErrorRed)
                }
            }
            state.statusBanner?.let { ok ->
                Card(
                    colors = CardDefaults.cardColors(containerColor = Color(0xFF121F1B)),
                    border = BorderStroke(1.dp, PrivacyGreen.copy(alpha = 0.45f)),
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Text(ok, modifier = Modifier.padding(12.dp), fontSize = 12.sp, color = PrivacyGreen)
                }
            }

            when (selectedTab) {
                0 -> {
                    Row(
                        modifier = Modifier.horizontalScroll(rememberScrollState()),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        LocalVaultEngine.demoPresets.forEach { preset ->
                            FilterChip(
                                selected = state.title == preset.title,
                                onClick = { vm.selectPreset(preset) },
                                colors = FilterChipDefaults.filterChipColors(
                                    containerColor = CarbonNavBg,
                                    selectedContainerColor = CarbonElevated,
                                    labelColor = TextMuted,
                                    selectedLabelColor = TextPrimary
                                ),
                                border = FilterChipDefaults.filterChipBorder(
                                    enabled = true,
                                    selected = state.title == preset.title,
                                    borderColor = CarbonBorder,
                                    selectedBorderColor = AccentOrange
                                ),
                                label = {
                                    Text(
                                        preset.policy.uppercase(),
                                        fontSize = 11.sp,
                                        fontFamily = FontFamily.Monospace
                                    )
                                }
                            )
                        }
                        OutlinedButton(
                            onClick = {
                                photoPicker.launch(
                                    PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)
                                )
                            },
                            shape = RoundedCornerShape(8.dp),
                            border = BorderStroke(1.dp, CarbonBorder),
                            colors = ButtonDefaults.outlinedButtonColors(
                                containerColor = CarbonElevated,
                                contentColor = TextPrimary
                            )
                        ) {
                            Icon(Icons.Default.CameraAlt, contentDescription = null, modifier = Modifier.size(15.dp))
                            Spacer(Modifier.width(6.dp))
                            Text("Scan Photo", fontSize = 11.sp)
                        }
                    }

                    OutlinedTextField(
                        value = state.rawText,
                        onValueChange = { vm.updateRawText(it) },
                        label = { Text("01 Raw Document (Local-Only · 0 Cloud Bytes)", fontSize = 12.sp) },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(215.dp),
                        shape = RoundedCornerShape(8.dp),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = AccentOrange,
                            unfocusedBorderColor = CarbonBorder,
                            focusedContainerColor = CarbonNavBg,
                            unfocusedContainerColor = CarbonNavBg,
                            focusedTextColor = TextPrimary,
                            unfocusedTextColor = TextPrimary
                        ),
                        textStyle = MaterialTheme.typography.bodySmall.copy(lineHeight = 18.sp)
                    )

                    Button(
                        onClick = {
                            vm.runShieldAndTriage()
                            selectedTab = 1
                        },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(44.dp),
                        shape = RoundedCornerShape(8.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = AccentOrange,
                            contentColor = CarbonNavBg
                        )
                    ) {
                        Icon(Icons.Default.Security, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(Modifier.width(8.dp))
                        Text("Run Privacy Shield & Offline Triage", fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                    }

                    if (state.vaultEntries.isNotEmpty()) {
                        Card(
                            colors = CardDefaults.cardColors(containerColor = CarbonSurface),
                            border = BorderStroke(1.dp, CarbonBorder),
                            shape = RoundedCornerShape(8.dp)
                        ) {
                            Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Text(
                                        "03 Local PII Vault",
                                        fontWeight = FontWeight.SemiBold,
                                        fontSize = 13.sp,
                                        color = TextPrimary
                                    )
                                    Text(
                                        "${state.vaultEntries.count { it.enabled }}/${state.vaultEntries.size} CLOAKED",
                                        fontFamily = FontFamily.Monospace,
                                        fontSize = 10.sp,
                                        color = PrivacyGreen
                                    )
                                }
                                FlowRow(
                                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                                    verticalArrangement = Arrangement.spacedBy(6.dp)
                                ) {
                                    state.vaultEntries.forEach { entry ->
                                        Box(
                                            modifier = Modifier
                                                .background(CarbonNavBg, RoundedCornerShape(6.dp))
                                                .border(
                                                    1.dp,
                                                    if (entry.enabled) WarnAmber.copy(alpha = 0.45f) else CarbonDivider,
                                                    RoundedCornerShape(6.dp)
                                                )
                                                .clickable { vm.toggleVaultEntry(entry.token) }
                                                .padding(horizontal = 8.dp, vertical = 5.dp)
                                        ) {
                                            Text(
                                                text = "${entry.token} → ${entry.original}",
                                                fontSize = 10.5.sp,
                                                fontFamily = FontFamily.Monospace,
                                                color = if (entry.enabled) WarnAmber else TextMuted,
                                                textDecoration = if (entry.enabled) TextDecoration.None else TextDecoration.LineThrough
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                1 -> {
                    Card(
                        colors = CardDefaults.cardColors(containerColor = CarbonSurface),
                        border = BorderStroke(1.dp, CarbonBorder),
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Text("05 Zero-Leak Wire Gate", fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                                Text(
                                    when {
                                        state.scrubbedText.isBlank() -> "NOT VERIFIED"
                                        state.zeroLeakVerified -> "0 LEAKS · VERIFIED"
                                        else -> "BLOCKED"
                                    },
                                    fontSize = 10.sp,
                                    fontFamily = FontFamily.Monospace,
                                    fontWeight = FontWeight.SemiBold,
                                    color = when {
                                        state.scrubbedText.isBlank() -> TextMuted
                                        state.zeroLeakVerified -> PrivacyGreen
                                        else -> ErrorRed
                                    }
                                )
                            }
                            Text(
                                text = state.scrubbedText.ifBlank { "Run Stage 1 Shield to verify and inspect the anonymized payload." },
                                fontFamily = FontFamily.Monospace,
                                fontSize = 11.sp,
                                color = TextSecondary
                            )
                        }
                    }

                    Card(
                        colors = CardDefaults.cardColors(containerColor = CarbonSurface),
                        border = BorderStroke(1.dp, CarbonBorder),
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Text("04 Instant Offline Triage", fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                                if (state.triageSource.isNotBlank()) {
                                    Text(
                                        state.triageSource,
                                        fontSize = 10.sp,
                                        fontFamily = FontFamily.Monospace,
                                        fontWeight = FontWeight.SemiBold,
                                        color = if (state.triageSource == "ON_DEVICE") PrivacyGreen else CloudSteelBlue
                                    )
                                }
                            }
                            Text(
                                text = state.triageText.ifBlank { "Run Shield & Triage to generate local risk scoring." },
                                fontSize = 12.sp,
                                color = TextSecondary
                            )
                        }
                    }

                    Card(
                        colors = CardDefaults.cardColors(containerColor = CarbonSurface),
                        border = BorderStroke(1.dp, CarbonBorder),
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Text("Execution Trace & Telemetry", fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                            state.telemetry.take(8).forEach { ev ->
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Column(Modifier.weight(1f)) {
                                        Text(
                                            "${ev.stage} · ${ev.requestedMode}",
                                            fontSize = 11.sp,
                                            fontFamily = FontFamily.Monospace,
                                            fontWeight = FontWeight.SemiBold,
                                            color = TextPrimary
                                        )
                                        Text(
                                            "${ev.modelName} · ${ev.outboundBytes} B out",
                                            fontSize = 10.sp,
                                            color = TextMuted
                                        )
                                    }
                                    Text(
                                        "${ev.actualSource} · ${ev.latencyMs}ms",
                                        fontSize = 10.sp,
                                        fontFamily = FontFamily.Monospace,
                                        color = if (ev.actualSource == "ON_DEVICE") PrivacyGreen else CloudSteelBlue
                                    )
                                }
                            }
                        }
                    }
                }

                2 -> {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Button(
                            onClick = { vm.runDeepCloudAudit() },
                            modifier = Modifier
                                .weight(1f)
                                .height(42.dp),
                            shape = RoundedCornerShape(8.dp),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = AccentOrange,
                                contentColor = CarbonNavBg
                            )
                        ) {
                            Text("Deep Cloud Audit", fontWeight = FontWeight.SemiBold, fontSize = 12.sp)
                        }
                        OutlinedButton(
                            onClick = { vm.runDisputeDraft() },
                            modifier = Modifier
                                .weight(1f)
                                .height(42.dp),
                            shape = RoundedCornerShape(8.dp),
                            border = BorderStroke(1.dp, CarbonBorder),
                            colors = ButtonDefaults.outlinedButtonColors(
                                containerColor = CarbonElevated,
                                contentColor = TextPrimary
                            )
                        ) {
                            Text("Draft Dispute", fontSize = 12.sp)
                        }
                    }

                    OutlinedButton(
                        onClick = { vm.toggleRehydratedView() },
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(8.dp),
                        border = BorderStroke(
                            1.dp,
                            if (state.showRehydrated) PrivacyGreen.copy(alpha = 0.45f) else WarnAmber.copy(alpha = 0.45f)
                        ),
                        colors = ButtonDefaults.outlinedButtonColors(
                            containerColor = CarbonSurface,
                            contentColor = if (state.showRehydrated) PrivacyGreen else WarnAmber
                        )
                    ) {
                        Icon(
                            if (state.showRehydrated) Icons.Default.Visibility else Icons.Default.VisibilityOff,
                            contentDescription = null,
                            modifier = Modifier.size(16.dp)
                        )
                        Spacer(Modifier.width(8.dp))
                        Text(
                            if (state.showRehydrated) "State: Locally Rehydrated Output" else "State: Raw Scrubbed Cloud Tokens",
                            fontSize = 12.sp
                        )
                    }

                    if (state.cloudAuditText.isNotBlank()) {
                        Card(
                            colors = CardDefaults.cardColors(containerColor = CarbonSurface),
                            border = BorderStroke(1.dp, CarbonBorder),
                            shape = RoundedCornerShape(8.dp)
                        ) {
                            Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                Text(
                                    "06 Deep Cloud Audit (${state.cloudAuditSource} · ${state.cloudAuditModel})",
                                    fontWeight = FontWeight.SemiBold,
                                    fontSize = 12.sp,
                                    fontFamily = FontFamily.Monospace,
                                    color = CloudSteelBlue
                                )
                                Text(
                                    text = vm.formatForDisplay(state.cloudAuditText),
                                    fontSize = 12.5.sp,
                                    color = TextPrimary
                                )
                            }
                        }
                    }

                    if (state.disputeDraftScrubbed.isNotBlank()) {
                        Card(
                            colors = CardDefaults.cardColors(containerColor = CarbonSurface),
                            border = BorderStroke(1.dp, CarbonBorder),
                            shape = RoundedCornerShape(8.dp)
                        ) {
                            Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                Text(
                                    "07 Rehydrated Dispute Letter (${state.disputeSource})",
                                    fontWeight = FontWeight.SemiBold,
                                    fontSize = 12.sp,
                                    fontFamily = FontFamily.Monospace,
                                    color = PrivacyGreen
                                )
                                Text(
                                    text = vm.formatForDisplay(state.disputeDraftScrubbed),
                                    fontSize = 12.5.sp,
                                    color = TextPrimary
                                )
                            }
                        }
                    }

                    OutlinedButton(
                        onClick = { vm.syncAnonymizedCaseToFirestore() },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(42.dp),
                        shape = RoundedCornerShape(8.dp),
                        border = BorderStroke(1.dp, PrivacyGreen.copy(alpha = 0.5f)),
                        colors = ButtonDefaults.outlinedButtonColors(
                            containerColor = CarbonElevated,
                            contentColor = TextPrimary
                        )
                    ) {
                        Icon(
                            Icons.Default.CloudUpload,
                            contentDescription = null,
                            tint = PrivacyGreen,
                            modifier = Modifier.size(16.dp)
                        )
                        Spacer(Modifier.width(8.dp))
                        Text("Sync Anonymized Case (Android ↔ Web)", fontWeight = FontWeight.Medium, fontSize = 12.sp)
                    }
                }

                3 -> {
                    Text(
                        "Cross-Platform Synced Cases (Anonymized Only)",
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 14.sp,
                        color = TextPrimary
                    )
                    if (state.syncedCases.isEmpty()) {
                        Text(
                            "No synced cases yet. Sync a case from Android or CloakBridge Web to see live cross-platform Firestore sync.",
                            fontSize = 12.sp,
                            color = TextMuted
                        )
                    } else {
                        state.syncedCases.forEach { item ->
                            Card(
                                colors = CardDefaults.cardColors(containerColor = CarbonSurface),
                                border = BorderStroke(1.dp, CarbonBorder),
                                shape = RoundedCornerShape(8.dp)
                            ) {
                                Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                    Text(
                                        "${item.title} [${item.platform.uppercase()}]",
                                        fontWeight = FontWeight.SemiBold,
                                        fontSize = 13.sp,
                                        color = TextPrimary
                                    )
                                    Text(
                                        "Policy: ${item.policyProfile} · ${item.tokenCount} tokens · Risk ${item.riskScore}/100",
                                        fontSize = 11.sp,
                                        fontFamily = FontFamily.Monospace,
                                        color = PrivacyGreen
                                    )
                                    Text(
                                        item.triageSummary.take(220),
                                        fontSize = 12.sp,
                                        color = TextSecondary
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
