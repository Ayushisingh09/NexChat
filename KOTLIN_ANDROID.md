# NexChat Android (Kotlin) — Complete Build Specification

> This document covers every detail needed to build a production-quality Android client
> for NexChat using Kotlin + Jetpack Compose. It is a faithful port of the existing
> web client, preserving all features, UI/UX patterns, and real-time behavior.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack & Dependencies](#2-tech-stack--dependencies)
3. [Architecture](#3-architecture)
4. [UI/UX Design System](#4-uiux-design-system)
5. [App Structure & Navigation](#5-app-structure--navigation)
6. [Authentication Flow](#6-authentication-flow)
7. [Chat Core](#7-chat-core)
8. [Real-Time Layer (Socket.io + MQTT)](#8-real-time-layer)
9. [Media & File Handling](#9-media--file-handling)
10. [Voice Messages & Audio](#10-voice-messages--audio)
11. [Stories (Status)](#11-stories-status)
12. [Calls (LiveKit VoIP)](#12-calls-livekit-voip)
13. [Friends System](#13-friends-system)
14. [Communities](#14-communities)
15. [Push Notifications (FCM)](#15-push-notifications-fcm)
16. [Local Caching & Offline Support](#16-local-caching--offline-support)
17. [Permissions](#17-permissions)
18. [Logo & Branding](#18-logo--branding)
19. [Smoothness & Performance](#19-smoothness--performance)
20. [Security](#20-security)
21. [Testing](#21-testing)
22. [Backend API Reference](#22-backend-api-reference)
23. [Database Schema Reference](#23-database-schema-reference)

---

## 1. Project Overview

NexChat is a full-featured messaging app with DMs, group chats, communities, stories, VoIP calls, polls, reactions, message scheduling, and more. The Android client must replicate the web app 1:1.

**Base URL:** `https://api.92lrcorps.xyz`  
**Socket URL:** `https://api.92lrcorps.xyz`  
**LiveKit URL:** `wss://livekit.92lrcorps.xyz`

---

## 2. Tech Stack & Dependencies

```kotlin
// build.gradle.kts (app)
plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("com.google.devtools.ksp")        // Room / Moshi code gen
    id("com.google.dagger.hilt.android")  // DI
    id("org.jetbrains.kotlin.plugin.serialization")
}

dependencies {
    // Core
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.4")
    implementation("androidx.activity:activity-compose:1.9.1")

    // Compose BOM
    implementation(platform("androidx.compose:compose-bom:2024.06.00"))
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-graphics")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")
    implementation("androidx.compose.animation:animation")

    // Navigation
    implementation("androidx.navigation:navigation-compose:2.7.7")

    // DI
    implementation("com.google.dagger:hilt-android:2.51.1")
    ksp("com.google.dagger:hilt-compiler:2.51.1")
    implementation("androidx.hilt:hilt-navigation-compose:1.2.0")

    // Networking
    implementation("com.squareup.retrofit2:retrofit:2.11.0")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("com.squareup.okhttp3:logging-interceptor:4.12.0")
    implementation("com.squareup.retrofit2:converter-moshi:2.11.0")
    implementation("com.squareup.moshi:moshi-kotlin:1.15.1")
    ksp("com.squareup.moshi:moshi-kotlin-codegen:1.15.1")

    // Socket.IO
    implementation("io.socket:socket.io-client:2.1.0")

    // Room (local cache)
    implementation("androidx.room:room-runtime:2.6.1")
    implementation("androidx.room:room-ktx:2.6.1")
    ksp("androidx.room:room-compiler:2.6.1")

    // DataStore (prefs)
    implementation("androidx.datastore:datastore-preferences:1.1.1")

    // WorkManager (background jobs)
    implementation("androidx.work:work-runtime-ktx:2.9.1")

    // Firebase
    implementation(platform("com.google.firebase:firebase-bom:33.1.2"))
    implementation("com.google.firebase:firebase-messaging-ktx")
    implementation("com.google.firebase:firebase-auth-ktx")

    // Image loading
    implementation("io.coil-kt:coil-compose:2.6.0")

    // LiveKit
    implementation("io.livekit:livekit-android:2.1.1")

    // Media playback
    implementation("androidx.media3:media3-exoplayer:1.4.0")
    implementation("androidx.media3:media3-ui:1.4.0")

    // Accompanist
    implementation("com.google.accompanist:accompanist-systemuicontroller:0.34.0")
    implementation("com.google.accompanist:accompanist-permissions:0.34.0")

    // Pagination
    implementation("androidx.paging:paging-runtime-ktx:3.3.2")
    implementation("androidx.paging:paging-compose:3.3.2")

    // Lottie animations
    implementation("com.airbnb.android:lottie-compose:6.5.0")

    // Markdown rendering
    implementation("io.noties.markwon:core:4.6.2")

    // CameraX
    implementation("androidx.camera:camera-camera2:1.3.4")
    implementation("androidx.camera:camera-lifecycle:1.3.4")
    implementation("androidx.camera:camera-view:1.3.4")
}
```

---

## 3. Architecture

### Pattern: Clean Architecture + MVI (Model-View-Intent)

```
app/
├── di/                          # Hilt modules
├── data/
│   ├── local/                   # Room DB, DataStore
│   │   ├── NexChatDatabase.kt
│   │   ├── dao/                 # ConversationDao, MessageDao, UserDao, etc.
│   │   └── entity/              # Room entities
│   ├── remote/                  # Retrofit API, DTOs
│   │   ├── api/                 # AuthApi, MessagesApi, ConversationsApi, etc.
│   │   └── dto/                 # Request/Response DTOs
│   ├── repository/              # Repository implementations
│   └── socket/                  # Socket.IO + MQTT service
├── domain/
│   ├── model/                   # Domain models (User, Message, Conversation, etc.)
│   ├── repository/              # Repository interfaces
│   └── usecase/                 # Business logic use cases
├── ui/
│   ├── theme/                   # Colors, Typography, Shapes
│   ├── navigation/              # NavHost, routes
│   ├── screens/
│   │   ├── auth/                # Login, Register, OTP, ForgotPassword
│   │   ├── chat/                # ChatList, ChatWindow, MessageInput
│   │   ├── calls/               # CallHistory, ActiveCall
│   │   ├── status/              # StoryViewer, CreateStory
│   │   ├── explore/             # CommunityExplore
│   │   ├── friends/             # FriendsList, FriendRequests
│   │   ├── community/           # CommunityPage
│   │   ├── settings/            # Settings, Profile
│   │   └── join/                # JoinGroup
│   ├── components/              # Reusable composables
│   │   ├── Avatar.kt
│   │   ├── MessageBubble.kt
│   │   ├── BottomSheet.kt
│   │   ├── GlassSurface.kt
│   │   └── PresenceDot.kt
│   └── viewmodel/               # ViewModels per screen
└── util/                        # Extensions, helpers
```

### Key Architecture Decisions

1. **Unidirectional data flow**: State flows down (via `StateFlow`), events flow up (via sealed interfaces).
2. **Offline-first**: Room is the single source of truth. Network fetches sync into Room. UI observes Room.
3. **Optimistic updates**: Messages show immediately with `PENDING` status, then get confirmed by server.
4. **Repository pattern**: Each feature has a repository that coordinates local Room + remote API.

---

## 4. UI/UX Design System

### 4.1 Color Palette

The app uses a dark-only glassmorphism theme. ALL colors from `client/src/index.css`:

```kotlin
// NexChatColors.kt
object NexChatColors {
    // Backgrounds
    val ChatBg        = Color(0xFF0B0B0E)      // wa-chat: main background
    val SidebarBg     = Color(0xFF131316)       // wa-sidebar
    val SidebarHover  = Color(0xFF1D1D22)       // wa-sidebar-hover
    val ActiveBg      = Color(0xFF26262D)       // wa-active
    val TopBarBg      = Color(0xFF131316)       // wa-top-bar
    val InputAreaBg   = Color(0xFF131316)       // wa-input-area
    val Surface       = Color(0xFF1A1A1E)       // wa-surface
    val Surface2      = Color(0xFF222228)       // wa-surface-2

    // Message Bubbles
    val SentBubble    = Color(0xFF2A2A31)       // wa-sent
    val ReceivedBubble= Color(0xFF1B1B1F)       // wa-received

    // Text
    val Primary       = Color(0xFFEDEDF0)       // wa-primary
    val Secondary     = Color(0xFF9A9AA3)       // wa-secondary
    val GreenAccent   = Color(0xFFA1A1AA)       // wa-green
    val GreenDeep     = Color(0xFFC4C4CD)       // wa-green-deep
    val Border        = Color(0xFF26262D)       // wa-border

    // Accent (Purple)
    val Accent        = Color(0xFF8B5CF6)       // Sent bubble accent, send button
    val AccentDark    = Color(0xFF7C3AED)       // Hover state

    // Status dots
    val Online        = Color(0xFF22C55E)       // online-dot
    val OnlineGlow    = Color(0xFF10B981)       // presence-dot-online
    val Away          = Color(0xFFF59E0B)       // away-dot
    val DND           = Color(0xFFEF4444)       // dnd-dot
    val Offline       = Color(0xFF52525B)       // presence-dot-offline

    // Functional
    val Error         = Color(0xFFEF4444)
    val Warning       = Color(0xFFF59E0B)
    val Success       = Color(0xFF22C55E)

    // Glassmorphism
    val GlassBg       = Color(0x73121216)       // rgba(18,18,22,0.45)
    val GlassBorder   = Color(0x0DFFFFFF)       // rgba(255,255,255,0.05)
    val BarGlassBg    = Color(0x99111115)       // rgba(17,17,21,0.60)

    // Sent bubble gradient (purple frosted glass)
    val SentGradientStart  = Color(0x2E8B5CF6)  // rgba(139,92,246,0.18)
    val SentGradientEnd    = Color(0x1E7C3AED)  // rgba(124,58,237,0.12)
    val SentBorder         = Color(0x1AFFFFFF)  // rgba(255,255,255,0.10)

    // Received bubble gradient
    val ReceivedGradientStart = Color(0x8C1E1E26) // rgba(30,30,38,0.55)
    val ReceivedGradientEnd   = Color(0x7314141A) // rgba(20,20,26,0.45)
}
```

### 4.2 Typography

```kotlin
// NexChatTypography.kt
// Font: system-ui (Roboto on Android)
object NexChatTypography {
    // Body
    val bodyLarge = TextStyle(fontSize = 16.sp, fontWeight = FontWeight.Normal, color = Primary)
    val bodyMedium = TextStyle(fontSize = 14.sp, fontWeight = FontWeight.Normal, color = Primary)
    val bodySmall = TextStyle(fontSize = 13.sp, fontWeight = FontWeight.Normal, color = Secondary)

    // Labels
    val labelLarge = TextStyle(fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = Primary)
    val labelMedium = TextStyle(fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Secondary)
    val labelSmall = TextStyle(fontSize = 10.sp, fontWeight = FontWeight.Bold, color = Secondary)

    // Headings
    val titleLarge = TextStyle(fontSize = 17.sp, fontWeight = FontWeight.Bold, color = Color.White)
    val titleMedium = TextStyle(fontSize = 15.sp, fontWeight = FontWeight.SemiBold, color = Color.White)

    // Timestamps
    val timestamp = TextStyle(fontSize = 10.sp, fontWeight = FontWeight.Medium, color = Secondary)

    // Story fonts
    val storySans = TextStyle(fontFamily = FontFamily.Default, fontWeight = FontWeight.Bold)   // Outfit
    val storySerif = TextStyle(fontFamily = FontFamily.Serif, fontWeight = FontWeight.SemiBold) // Playfair Display
    val storyMono = TextStyle(fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Medium) // Fira Code
    val storyCursive = TextStyle(fontFamily = FontFamily.Cursive, fontWeight = FontWeight.SemiBold, fontSize = 24.sp) // Caveat
}
```

### 4.3 Glassmorphism Components

The web app uses heavy glassmorphism (frosted glass). In Compose, replicate with:

```kotlin
// GlassSurface.kt
@Composable
fun GlassSurface(
    modifier: Modifier = Modifier,
    cornerRadius: Dp = 16.dp,
    content: @Composable () -> Unit
) {
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(cornerRadius))
            .background(
                Brush.linearGradient(
                    colors = listOf(
                        Color(0x73121216),  // Glass bg
                        Color(0x4D121216),
                    )
                )
            )
            .border(1.dp, Color(0x0DFFFFFF), RoundedCornerShape(cornerRadius))
            .shadow(8.dp, RoundedCornerShape(cornerRadius))
    ) {
        content()
    }
}

// BarGlass — frosted top/bottom bars
@Composable
fun BarGlass(modifier: Modifier = Modifier, content: @Composable () -> Unit) {
    Box(
        modifier = modifier
            .background(Color(0x99111115))
            .background(Brush.verticalGradient(listOf(Color(0x99111115), Color(0x99111115))))
    ) {
        content()
    }
}

// BubbleGlass — sent/received message bubbles
@Composable
fun BubbleGlassSent(modifier: Modifier = Modifier, content: @Composable () -> Unit) {
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(16.dp, 16.dp, 4.dp, 16.dp))
            .background(
                Brush.linearGradient(
                    colors = listOf(
                        Color(0x2E8B5CF6), // Sent gradient start
                        Color(0x1E7C3AED), // Sent gradient end
                    ),
                    start = Offset(0f, 0f),
                    end = Offset(Float.POSITIVE_INFINITY, Float.POSITIVE_INFINITY)
                )
            )
            .border(1.dp, Color(0x1AFFFFFF), RoundedCornerShape(16.dp, 16.dp, 4.dp, 16.dp))
    {
        content()
    }
}

@Composable
fun BubbleGlassReceived(modifier: Modifier = Modifier, content: @Composable () -> Unit) {
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(16.dp, 16.dp, 16.dp, 4.dp))
            .background(
                Brush.linearGradient(
                    colors = listOf(
                        Color(0x8C1E1E26),
                        Color(0x7314141A),
                    ),
                    start = Offset(0f, 0f),
                    end = Offset(Float.POSITIVE_INFINITY, Float.POSITIVE_INFINITY)
                )
            )
            .border(1.dp, Color(0x0DFFFFFF), RoundedCornerShape(16.dp, 16.dp, 16.dp, 4.dp))
    {
        content()
    }
}
```

### 4.4 Presence Dot

```kotlin
// PresenceDot.kt
@Composable
fun PresenceDot(
    isOnline: Boolean,
    modifier: Modifier = Modifier,
    size: Dp = 10.dp
) {
    val color = when {
        isOnline -> NexChatColors.OnlineGlow
        else -> NexChatColors.Offline
    }
    Box(modifier = modifier.size(size)) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .clip(CircleShape)
                .background(color)
                .then(
                    if (isOnline) Modifier.drawBehind {
                        drawCircle(
                            color = NexChatColors.OnlineGlow.copy(alpha = 0.3f),
                            radius = size.toPx() * 1.5f,
                        )
                    } else Modifier
                )
        )
    }
}
```

### 4.5 Animations

The web app has these animations. Implement in Compose:

| Animation | Duration | Easing | Usage |
|-----------|----------|--------|-------|
| slide-up | 320ms | spring(0.16, 1, 0.3, 1) | Messages appearing from bottom |
| slide-down | 240ms | spring(0.16, 1, 0.3, 1) | Dropdowns, menus |
| fade-in | 180ms | easeOut | General fade |
| pop-in | 260ms | spring(0.16, 1, 0.3, 1) | Modals, cards |
| scale-in | 220ms | spring(0.16, 1, 0.3, 1) | Emoji picker, sheets |
| msg-in-left | 280ms | spring(0.16, 1, 0.3, 1) | Received messages |
| msg-in-right | 280ms | spring(0.16, 1, 0.3, 1) | Sent messages |
| send-pulse | 300ms | ease-out-soft | Send button press |
| shake | 400ms | ease-in-out | Error states |
| shimmer | 1.6s infinite | linear | Loading skeletons |
| msg-expire | 450ms | custom | Disappearing messages |
| pulse-border | 1.5s infinite | ease-in-out | Active states |
| reaction-pop | 320ms | spring(0.34, 1.56, 0.64, 1) | Emoji reactions |
| highlight-flash | 2.2s | custom | Jump-to-message highlight |
| presence-in | 300ms | spring(0.16, 1, 0.3, 1) | Online indicator |
| page-enter | 350ms | ease-out-soft | Page transitions |

```kotlin
// AnimationSpecs.kt
object NexChatAnimations {
    val spring = spring<Float>(dampingRatio = 0.6f, stiffness = 300f)
    val slideUp = tween<Float>(320, easing = FastOutSlowInEasing)
    val slideDown = tween<Float>(240, easing = FastOutSlowInEasing)
    val fadeIn = fadeIn(animationSpec = tween(180))
    val fadeOut = fadeOut(animationSpec = tween(180))
    val popIn = scaleIn(
        initialScale = 0.9f,
        animationSpec = spring(dampingRatio = 0.7f, stiffness = 400f)
    )
    val scaleIn = scaleIn(
        initialScale = 0.96f,
        animationSpec = tween(220, easing = FastOutSlowInEasing)
    )
    val msgInLeft = slideInHorizontally(
        initialOffsetX = { -it / 6 },
        animationSpec = spring(dampingRatio = 0.7f, stiffness = 300f)
    ) + fadeIn(tween(280))
    val msgInRight = slideInHorizontally(
        initialOffsetX = { it / 6 },
        animationSpec = spring(dampingRatio = 0.7f, stiffness = 300f)
    ) + fadeIn(tween(280))
    val reactionPop = scaleIn(
        initialScale = 0.5f,
        animationSpec = spring(dampingRatio = 0.5f, stiffness = 500f)
    ) + fadeIn(tween(100))
}
```

### 4.6 Shimmer Loading Skeletons

```kotlin
// ShimmerEffect.kt
@Composable
fun ShimmerBox(
    modifier: Modifier = Modifier,
    shimmerColor: Color = Color(0xFF17171A)
) {
    val transition = rememberInfiniteTransition()
    val translateAnim by transition.animateFloat(
        initialValue = 0f,
        targetValue = 1000f,
        animationSpec = infiniteRepeatable(
            animation = tween(1600, easing = LinearEasing),
            repeatMode = RepeatMode.Restart
        )
    )
    Box(
        modifier = modifier
            .background(shimmerColor)
            .drawWithContent {
                drawRect(
                    brush = Brush.linearGradient(
                        colors = listOf(
                            Color.Transparent,
                            Color.White.copy(alpha = 0.04f),
                            Color(0xFFA1A1AA).copy(alpha = 0.07f),
                            Color.Transparent
                        ),
                        start = Offset(translateAnim - size.width, 0f),
                        end = Offset(translateAnim, 0f)
                    )
                )
            }
    )
}
```

### 4.7 Scrollbar

```kotlin
// Thin custom scrollbar matching web (5px width, rounded)
@Composable
fun ThinScrollbar(state: LazyListState) {
    Scrollbar(
        state = state,
        modifier = Modifier.width(5.dp),
        thumbColor = NexChatColors.GreenAccent.copy(alpha = 0.18f),
        thumbHoverColor = NexChatColors.GreenAccent.copy(alpha = 0.4f),
        thumbUnfocusedRadius = 2.dp
    )
}
```

---

## 5. App Structure & Navigation

### 5.1 Routes (matching web router)

```kotlin
sealed class Screen(val route: String) {
    data object Auth : Screen("auth")
    data object Chat : Screen("chat")
    data object ChatList : Screen("chat_list")   // sidebar list
    data object GroupChat : Screen("group/{id}") {
        fun createRoute(id: String) = "group/$id"
    }
    data object DirectMessage : Screen("dm/{username}") {
        fun createRoute(username: String) = "dm/$username"
    }
    data object Status : Screen("status")
    data object Settings : Screen("settings")
    data object Explore : Screen("explore")
    data object Friends : Screen("friends")
    data object Calls : Screen("calls")
    data object Community : Screen("community/{id}") {
        fun createRoute(id: String) = "community/$id"
    }
    data object ForgotPassword : Screen("forgot-password")
    data object ResetPassword : Screen("reset-password")
    data object JoinGroup : Screen("invite/{token}") {
        fun createRoute(token: String) = "invite/$token"
    }
    data object UserProfile : Screen("u/{username}") {
        fun createRoute(username: String) = "u/$username"
    }
}
```

### 5.2 Navigation Pattern

- **Desktop (tablet/landscape)**: Left dock (72dp) + resizable sidebar (280-520dp) + chat window
- **Mobile (portrait)**: Full-screen sidebar OR full-screen chat, with bottom tab bar
- **Bottom tab bar items**: Chats, Calls, Status, Explore, Friends
- The sidebar slides out on mobile when a conversation is selected (like WhatsApp)

```kotlin
// NexChatNavGraph.kt
@Composable
fun NexChatNavGraph(navController: NavHostController) {
    NavHost(navController, startDestination = Screen.Chat.route) {
        composable(Screen.Auth.route) { AuthScreen() }
        composable(Screen.Chat.route) { ChatPage() }
        composable(Screen.GroupChat.route) { GroupPage(it.arguments?.getString("id")) }
        composable(Screen.DirectMessage.route) { DirectMessagePage(it.arguments?.getString("username")) }
        composable(Screen.Status.route) { StatusPage() }
        composable(Screen.Settings.route) { SettingsPage() }
        composable(Screen.Explore.route) { ExplorePage() }
        composable(Screen.Friends.route) { FriendsPage() }
        composable(Screen.Calls.route) { CallsPage() }
        composable(Screen.Community.route) { CommunityPage(it.arguments?.getString("id")) }
        composable(Screen.ForgotPassword.route) { ForgotPasswordPage() }
        composable(Screen.ResetPassword.route) { ResetPasswordPage() }
        composable(Screen.JoinGroup.route) { JoinGroupPage(it.arguments?.getString("token")) }
        composable(Screen.UserProfile.route) { UserProfilePage(it.arguments?.getString("username")) }
    }
}
```

### 5.3 App Layout Structure

```
┌─────────────────────────────────────────────────────┐
│ [72dp Dock]  │  [Sidebar 280-520dp]  │  [Chat]     │
│ Profile icon │  Search bar            │  ChatHeader │
│ ────         │  Filter tabs           │  MessageList│
│ Chat icon    │  Conversation list     │  TypingInd  │
│ Calls icon   │  ...                   │  MessageInp │
│ Status icon  │                        │             │
│ Explore icon │  ────                  │             │
│ Friends icon │  Profile bar (bottom)  │             │
│ ────         │                        │             │
│ Settings     │                        │             │
│ Logout       │                        │             │
└─────────────────────────────────────────────────────┘

Mobile:
┌──────────────────────┐
│ [Full-width sidebar] │
│ Search bar           │
│ Filter tabs          │
│ Conversation list    │
│ ...                  │
│ ────                 │
│ [Bottom Tab Bar]     │
│ Chats|Calls|St|Ex|Fr │
└──────────────────────┘
→ Select chat → slides to full-screen chat
```

---

## 6. Authentication Flow

### 6.1 Auth Screens

1. **Login Screen**: Email/phone + password OR email/phone + OTP code
2. **Register Screen**: Display name, username, email/phone, password
3. **OTP Verification**: 6-digit code input with auto-read from SMS
4. **Forgot Password**: Enter email → receive reset link
5. **Reset Password**: New password input

### 6.2 Auth API Endpoints

```
POST /api/auth/send-otp       { email? | phone? }
POST /api/auth/verify-otp     { email? | phone?, code }
POST /api/auth/register       { email? | phone?, password?, displayName, username?, avatar? }
POST /api/auth/login          { email? | phone?, password? | code? }
POST /api/auth/refresh        { refreshToken } → { accessToken, refreshToken }
POST /api/auth/logout         { refreshToken }
POST /api/auth/forgot-password { email }
POST /api/auth/reset-password  { token, newPassword }
PUT  /api/auth/password        { currentPassword, newPassword }  [auth]
```

### 6.3 Token Management

```kotlin
// TokenStorage.kt — use EncryptedSharedPreferences or DataStore
class TokenStorage @Inject constructor(
    private val dataStore: DataStore<Preferences>
) {
    companion object {
        val ACCESS_TOKEN = stringPreferencesKey("chat_access_token")
        val REFRESH_TOKEN = stringPreferencesKey("chat_refresh_token")
        val USER_JSON = stringPreferencesKey("chat_user")
    }

    suspend fun saveTokens(accessToken: String, refreshToken: String) {
        dataStore.edit { prefs ->
            prefs[ACCESS_TOKEN] = accessToken
            prefs[REFRESH_TOKEN] = refreshToken
        }
    }

    suspend fun saveUser(user: User) {
        dataStore.edit { prefs ->
            prefs[USER_JSON] = Json.encodeToString(user)
        }
    }

    suspend fun clearAll() {
        dataStore.edit { it.clear() }
    }

    // Read on app start to check if logged in
    val accessToken: Flow<String?> = dataStore.data.map { it[ACCESS_TOKEN] }
    val refreshToken: Flow<String?> = dataStore.data.map { it[REFRESH_TOKEN] }
    val user: Flow<User?> = dataStore.data.map { prefs ->
        prefs[USER_JSON]?.let { Json.decodeFromString(it) }
    }
}
```

### 6.4 JWT Refresh Interceptor

```kotlin
// AuthInterceptor.kt — OkHttp interceptor
class AuthInterceptor @Inject constructor(
    private val tokenStorage: TokenStorage,
    private val authApi: AuthApi
) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val token = runBlocking { tokenStorage.accessToken.first() }
        val request = chain.request().newBuilder().apply {
            token?.let { addHeader("Authorization", "Bearer $it") }
        }.build()

        val response = chain.proceed(request)

        if (response.code == 401) {
            // Token expired — refresh
            synchronized(this) {
                val newToken = runBlocking {
                    val rt = tokenStorage.refreshToken.first() ?: return@runBlocking null
                    val result = authApi.refresh(RefreshRequest(rt))
                    result.data?.let { data ->
                        tokenStorage.saveTokens(data.accessToken, data.refreshToken)
                        data.accessToken
                    }
                }
                if (newToken != null) {
                    response.close()
                    val retryRequest = chain.request().newBuilder()
                        .addHeader("Authorization", "Bearer $newToken")
                        .build()
                    return chain.proceed(retryRequest)
                }
            }
        }
        return response
    }
}
```

---

## 7. Chat Core

### 7.1 Conversation List

**Left sidebar** (or full-screen on mobile):

- Search bar with global search
- Filter tabs: All | Direct | Groups
- Conversation items show: avatar, name, last message preview, timestamp, unread badge, pinned icon, muted icon
- Archived conversations in collapsible section
- Swipe actions: pin, mute, archive, delete

```kotlin
// ConversationItem.kt
@Composable
fun ConversationItem(
    conversation: Conversation,
    isActive: Boolean,
    currentUserId: String,
    onClick: () -> Unit
) {
    val otherParticipant = if (conversation.type == "DIRECT") {
        conversation.participants.find { it.id != currentUserId }
    } else null

    val displayName = when {
        conversation.type == "GROUP" -> conversation.name ?: "Group"
        otherParticipant != null -> otherParticipant.displayName ?: "Unknown"
        else -> "Unknown"
    }

    val lastMessageText = conversation.lastMessage?.let { msg ->
        when (msg.type) {
            "IMAGE" -> "Photo"
            "AUDIO" -> "Voice message"
            "VIDEO" -> "Video"
            "FILE" -> msg.content.ifEmpty { "File" }
            else -> msg.content
        }
    } ?: ""

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(
                if (isActive) NexChatColors.ActiveBg.copy(alpha = 0.5f)
                else Color.Transparent
            )
            .clickable(onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box {
            Avatar(
                url = conversation.avatar ?: otherParticipant?.avatar,
                name = displayName,
                size = 48.dp
            )
            if (conversation.type == "DIRECT" && otherParticipant?.isOnline == true) {
                PresenceDot(
                    isOnline = true,
                    modifier = Modifier.align(Alignment.BottomEnd)
                )
            }
        }

        Spacer(modifier = Modifier.width(12.dp))

        Column(modifier = Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = displayName,
                    style = NexChatTypography.labelLarge,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f, fill = false)
                )
                if (conversation.pinnedAt != null) {
                    Icon(Icons.Default.PushPin, "Pinned", tint = NexChatColors.Secondary, modifier = Modifier.size(12.dp))
                }
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = lastMessageText,
                    style = NexChatTypography.bodySmall,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f, fill = false)
                )
                if (conversation.unreadCount > 0) {
                    Badge(count = conversation.unreadCount)
                }
            }
        }
    }
}
```

### 7.2 Chat Window

The main chat area has:

1. **ChatHeader** — avatar, name, online status, back button (mobile), action menu
2. **MessageList** — virtualized lazy column of messages
3. **TypingIndicator** — "X is typing..."
4. **MessageInput** — text input, emoji picker, attachment menu, voice record button, send button

### 7.3 Message Bubble

```kotlin
// MessageBubble.kt — key elements
@Composable
fun MessageBubble(
    message: Message,
    isSent: Boolean,
    isGroup: Boolean,
    isFirstInGroup: Boolean,
    isLastInGroup: Boolean,
    currentUserId: String,
    onReply: () -> Unit,
    onReact: (String) -> Unit,
    onLongPress: (Offset) -> Unit,
) {
    val bubbleShape = when {
        isFirstInGroup && isLastInGroup -> RoundedCornerShape(16.dp)
        isFirstInGroup && isSent -> RoundedCornerShape(16.dp, 16.dp, 4.dp, 16.dp)
        isFirstInGroup && !isSent -> RoundedCornerShape(16.dp, 16.dp, 16.dp, 4.dp)
        isLastInGroup && isSent -> RoundedCornerShape(4.dp, 16.dp, 4.dp, 16.dp)
        isLastInGroup && !isSent -> RoundedCornerShape(16.dp, 4.dp, 16.dp, 4.dp)
        isSent -> RoundedCornerShape(4.dp, 16.dp, 4.dp, 16.dp)
        else -> RoundedCornerShape(16.dp, 4.dp, 16.dp, 4.dp)
    }

    val bubbleColors = if (isSent) {
        Brush.linearGradient(listOf(Color(0x2E8B5CF6), Color(0x1E7C3AED)))
    } else {
        Brush.linearGradient(listOf(Color(0x8C1E1E26), Color(0x7314141A)))
    }

    // Content: text, image, audio, video, file, poll
    // Status indicator: sent (single check), delivered (double check), read (double check blue)
    // Timestamp: bottom-right
    // Reactions: row below bubble
    // Reply preview: quoted message above content
    // Long press menu: reply, forward, star, pin, edit, delete, copy
}
```

**Message types to render:**
- `TEXT` — markdown rendering (bold, italic, code, links, mentions)
- `IMAGE` — full-width image with tap-to-zoom (Coil)
- `AUDIO` — voice message with waveform visualization
- `VIDEO` — video thumbnail with play button (ExoPlayer)
- `FILE` — file icon + name + size + download button
- `POLL` — question + options with vote counts

**Message status indicators:**
- `PENDING` — clock icon
- `SENT` — single gray check
- `DELIVERED` — double gray check
- `READ` — double blue check (green in this theme)
- `FAILED` — red retry icon

### 7.4 Message List (Virtualized)

```kotlin
// MessageList.kt
@Composable
fun MessageList(
    messages: List<Message>,
    currentUserId: String,
    isGroup: Boolean,
    onLoadMore: () -> Unit,
    hasMore: Boolean,
    isLoadingMore: Boolean,
    scrollToMessageId: String?,
) {
    val listState = rememberLazyListState()

    // Load more when scrolled to top
    LaunchedEffect(listState) {
        snapshotFlow { listState.firstVisibleItemIndex }
            .collect { index ->
                if (index == 0 && hasMore) onLoadMore()
            }
    }

    // Auto-scroll to bottom on new messages
    LaunchedEffect(messages.size) {
        if (listState.firstVisibleItemIndex < 3) {
            listState.animateScrollToItem(messages.size - 1)
        }
    }

    // Scroll to specific message (jump-to)
    LaunchedEffect(scrollToMessageId) {
        scrollToMessageId?.let { id ->
            val index = messages.indexOfFirst { it.id == id }
            if (index >= 0) listState.animateScrollToItem(index)
        }
    }

    LazyColumn(state = listState) {
        items(messages, key = { it.id }) { message ->
            MessageBubble(message = message, ...)
        }
    }
}
```

### 7.5 Message Input

Features:
- Auto-resizing multiline text input (max 6 lines, 4096 chars)
- Character counter shown near limit (3800+)
- Emoji picker (grid of common emojis)
- Attachment menu: Photos & Videos, Document, Schedule message
- Voice recording: hold mic → recording UI with timer → send
- @mention autocomplete in groups (with @everyone for admins)
- Typing indicator (emit typing:start/stop)
- Draft persistence per conversation
- Link preview card (auto-detected URLs)
- Reply/edit mode banner above input

---

## 8. Real-Time Layer

### 8.1 Socket.IO

```kotlin
// SocketService.kt
class SocketService @Inject constructor(
    private val tokenStorage: TokenStorage
) {
    private var socket: Socket? = null

    fun connect() {
        val token = runBlocking { tokenStorage.accessToken.first() } ?: return

        val opts = IO.Options.builder()
            .setAuth(mapOf("token" to token))
            .setReconnection(true)
            .setReconnectionDelay(1000)
            .setReconnectionDelayMax(5000)
            .build()

        socket = IO.socket("https://api.92lrcorps.xyz", opts)

        socket?.on(Socket.EVENT_CONNECT) {
            // Connected
            startHeartbeat()  // every 25s
        }

        socket?.on(Socket.EVENT_DISCONNECT) { /* handle */ }
        socket?.on("message:new") { args -> /* handle new message */ }
        socket?.on("message:updated") { args -> /* handle edit/delete */ }
        socket?.on("messages:delivered") { args -> /* handle delivery receipts */ }
        socket?.on("typing:start") { args -> /* typing indicator */ }
        socket?.on("typing:stop") { args -> /* stop typing */ }
        socket?.on("user:online") { args -> /* presence update */ }
        socket?.on("user:offline") { args -> /* presence update */ }
        socket?.on("call:ringing") { args -> /* incoming call */ }
        socket?.on("call:accepted") { args -> /* call accepted */ }
        socket?.on("call:rejected") { args -> /* call rejected */ }
        socket?.on("call:ended") { args -> /* call ended */ }
        socket?.on("call:cancelled") { args -> /* call cancelled */ }
        socket?.on("mqtt:message") { args -> /* MQTT-style events */ }

        socket?.connect()
    }

    private fun startHeartbeat() {
        // Send heartbeat every 25s (before 30s Redis TTL)
    }

    // Conversation rooms
    fun joinConversation(id: String) { socket?.emit("join_conversation", id) }
    fun leaveConversation(id: String) { socket?.emit("leave_conversation", id) }

    // Typing via MQTT
    fun startTyping(conversationId: String, userId: String, displayName: String) {
        mqttPublish("typing/$conversationId", mapOf("userId" to userId, "displayName" to displayName, "action" to "start"))
    }

    fun stopTyping(conversationId: String, userId: String) {
        mqttPublish("typing/$conversationId", mapOf("userId" to userId, "action" to "stop"))
    }

    private fun mqttPublish(topic: String, payload: Any) {
        socket?.emit("mqtt:publish", mapOf("topic" to topic, "payload" to payload))
    }

    fun mqttSubscribe(topic: String) {
        socket?.emit("mqtt:subscribe", topic)
    }

    fun mqttUnsubscribe(topic: String) {
        socket?.emit("mqtt:unsubscribe", topic)
    }

    // Community rooms
    fun joinCommunity(id: String) { socket?.emit("community:join", id) }
    fun leaveCommunity(id: String) { socket?.emit("community:leave", id) }

    // Calls
    fun acceptCall(callId: String) { socket?.emit("call:accept", mapOf("callId" to callId)) }
    fun rejectCall(callId: String) { socket?.emit("call:reject", mapOf("callId" to callId)) }
    fun endCall(callId: String) { socket?.emit("call:end", mapOf("callId" to callId)) }
    fun cancelCall(callId: String) { socket?.emit("call:cancel", mapOf("callId" to callId)) }

    fun disconnect() {
        socket?.disconnect()
        socket?.off()
    }
}
```

### 8.2 Socket Events (All)

**Emitted by client:**
- `heartbeat` — every 25s
- `join_conversation(conversationId)`
- `leave_conversation(conversationId)`
- `mqtt:subscribe(topic)` / `mqtt:unsubscribe(topic)`
- `mqtt:publish({topic, payload})` — typing indicators
- `community:join(communityId)` / `community:leave(communityId)`
- `call:accept({callId})` / `call:reject({callId})` / `call:end({callId})` / `call:cancel({callId})`

**Received by client:**
- `message:new` — new message in any conversation
- `message:updated` — message edited/deleted
- `messages:delivered` — delivery receipt
- `typing:start({conversationId, userId, displayName})`
- `typing:stop({conversationId, userId})`
- `user:online` / `user:offline` — presence
- `mqtt:message({topic, payload})` — MQTT-style events
- `call:ringing` / `call:accepted` / `call:rejected` / `call:ended` / `call:cancelled`

---

## 9. Media & File Handling

### 9.1 Upload Flow (Cloudflare R2 presigned URL)

```kotlin
// MediaRepository.kt
suspend fun uploadFile(file: File, onProgress: (Int) -> Unit): String {
    // 1. Get presigned URL
    val presigned = mediaApi.getPresignedUrl(
        fileName = file.name,
        fileType = file.mimeType ?: "application/octet-stream",
        fileSize = file.length()
    )

    // 2. Upload directly to R2
    val client = OkHttpClient.Builder()
        .progressInterceptor { bytesWritten, totalBytes ->
            onProgress((bytesWritten * 100 / totalBytes).toInt())
        }
        .build()

    val body = file.asRequestBody(file.mimeType?.toMediaTypeOrNull())
    val request = Request.Builder()
        .url(presigned.uploadUrl)
        .put(body)
        .build()

    client.newCall(request).execute()

    // 3. Return public URL
    return presigned.publicUrl
}
```

### 9.2 Media Types Supported

- **Images**: jpg, png, gif, webp → display inline with Coil, tap to zoom
- **Videos**: mp4, webm → thumbnail + play button, ExoPlayer for playback
- **Audio**: mp3, ogg, webm → voice message bubble with waveform
- **Files**: any → file icon + name + size + download

### 9.3 Image Cropping (Avatar)

Use `androidx.activity.result:activity-result-contract` + custom cropper or Coil transforms.

---

## 10. Voice Messages & Audio

### 10.1 Recording

```kotlin
// VoiceRecorder.kt
class VoiceRecorder {
    private var recorder: MediaRecorder? = null

    fun start(outputFile: File) {
        recorder = MediaRecorder().apply {
            setAudioSource(MediaRecorder.AudioSource.MIC)
            setOutputFormat(MediaRecorder.OutputFormat.WEBM)
            setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
            setOutputFile(outputFile.absolutePath)
            prepare()
            start()
        }
    }

    fun stop(): File? {
        recorder?.stop()
        recorder?.release()
        recorder = null
        return outputFile
    }

    fun cancel() {
        recorder?.release()
        recorder = null
    }
}
```

### 10.2 Playback

Use `MediaCodec` + `AudioTrack` or ExoPlayer for voice message playback with waveform visualization.

---

## 11. Stories (Status)

### 11.1 Story Feed

Stories bar at the top of the chat list (horizontal scrollable ring of avatars with colored rings for unseen).

```kotlin
// StoriesBar.kt
@Composable
fun StoriesBar(
    storyGroups: List<StoryFeedGroup>,
    currentUserId: String,
    onStoryClick: (index: Int) -> Unit,
    onCreateStory: () -> Unit
) {
    LazyRow(
        modifier = Modifier.padding(horizontal = 12.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        // "My Story" item (create if none)
        item { MyStoryRing(onCreate = onCreateStory) }
        // Other users' stories
        items(storyGroups) { group ->
            StoryRing(
                user = group.user,
                hasUnviewed = group.stories.any { !it.viewed },
                onClick = { onStoryClick(/* index */) }
            )
        }
    }
}
```

### 11.2 Story Viewer

Full-screen story viewer with:
- Progress bars at top (one per story in the group)
- Auto-advance after 5s (images) or video duration
- Tap left/right to go prev/next
- Swipe down to close
- Reaction emoji bar at bottom
- View count + viewer list

### 11.3 Create Story

- Pick image/video from gallery
- Or create text story with custom bg color and font style
- Caption input
- Share button

### 11.4 Story API

```
POST   /api/stories                   { type, mediaUrl?, caption?, bgColor?, fontStyle? }
GET    /api/stories/feed              → StoryFeedGroup[]
POST   /api/stories/:id/view          (mark viewed)
GET    /api/stories/:id/views         → { viewers[], reactionSummary }
POST   /api/stories/:id/react         { emoji }
DELETE /api/stories/:id
```

---

## 12. Calls (LiveKit VoIP)

### 12.1 Call Flow

1. **Initiate**: POST `/api/calls/initiate` → `{ callId, roomName }`
2. **Socket**: `call:ringing` sent to callee
3. **Accept**: Callee calls POST `/api/calls/:id/accept`, then socket `call:accept`
4. **Tokens**: Server generates LiveKit tokens for both parties on accept
5. **In-call**: LiveKit SDK handles WebRTC, audio/video, screen sharing
6. **End**: POST `/api/calls/:id/end` → duration computed server-side

### 12.2 Call UI States

```
┌──────────────────────────────┐
│  INCOMING CALL               │
│  [Avatar] John Doe           │
│  Voice Call / Video Call     │
│                              │
│  [Decline]    [Accept]       │
└──────────────────────────────┘

┌──────────────────────────────┐
│  OUTGOING CALL               │
│  [Avatar] John Doe           │
│  Calling...                  │
│                              │
│  [Cancel]                    │
└──────────────────────────────┘

┌──────────────────────────────┐
│  IN CALL                     │
│  [Remote Video / Avatar]     │
│                              │
│  [Mute] [Video] [Speaker]    │
│  [Screen] [End] [Minimize]   │
│  Duration: 01:23             │
└──────────────────────────────┘

┌──────────────────┐
│  CALL PiP        │
│  Mini floating   │
│  bubble while    │
│  browsing app    │
└──────────────────┘
```

### 12.3 LiveKit Integration

```kotlin
// LiveKitRoom.kt
class LiveKitManager @Inject constructor() {
    private var room: Room? = null

    suspend fun connect(token: String, url: String) {
        room = Room.connect(
            url = url,
            token = token,
            options = RoomOptions(
                adaptiveStream = true,
                dynacast = true,
                audioCaptureDefaults = AudioCaptureOptions(
                    echoCancellation = true,
                    noiseSuppression = true,
                    autoGainControl = true
                )
            )
        )

        room?.let { r ->
            r.remoteParticipants.forEach { (_, participant) ->
                participant.trackSubscribed.observeForever { track ->
                    when (track) {
                        is RemoteVideoTrack -> { /* render video */ }
                        is RemoteAudioTrack -> { /* enable audio */ }
                    }
                }
            }
        }
    }

    fun toggleMute(): Boolean { /* mute/unmute local audio */ }
    fun toggleVideo(): Boolean { /* enable/disable local video */ }
    fun toggleScreenShare(): Boolean { /* screen capture */ }
    fun disconnect() { room?.disconnect(); room = null }
}
```

### 12.4 Call History

```
GET /api/calls → CallRecord[]
```

Call history page shows: avatar, name, call type (voice/video), status icon, date, duration.

---

## 13. Friends System

### 13.1 API

```
GET    /api/friends                  → Friend[]
GET    /api/friends/presence          → Friend[] (with isOnline)
POST   /api/friends/request           { userId }
POST   /api/friends/accept/:id
POST   /api/friends/reject/:id
POST   /api/friends/cancel/:id
DELETE /api/friends/:friendId
GET    /api/friends/pending/received  → FriendRequest[]
GET    /api/friends/pending/sent      → FriendRequest[]
```

### 13.2 UI

- Friends list with online status
- Pending received/sent requests with accept/reject/cancel
- Search users by username
- "Add Friend" button on user profiles
- Friend request notification badge

---

## 14. Communities

### 14.1 Features

- Community profile (avatar, banner, description, rules, social links)
- Visibility: PUBLIC / PRIVATE
- Category: TECHNOLOGY, GAMING, AI, BUSINESS, EDUCATION, ENTERTAINMENT, MUSIC, ANIME, SPORTS, GENERAL
- Verification badges: NONE, OFFICIAL, VERIFIED, ORGANIZATION, GAMING
- Custom roles with colors and permission bits
- Events with RSVP
- Ratings (1-5 stars + review)
- Highlights (promoted messages)
- Achievements
- Leaderboard (weekly/monthly)
- Analytics (for admins)
- Moderation tools (profanity filter, spam detection, slow mode, bans)
- Audit logs
- Reports

### 14.2 API (extensive — 50+ endpoints)

All listed in `client/src/api/communities.api.ts`. The Android client must implement all of these.

---

## 15. Push Notifications (FCM)

### 15.1 Setup

```kotlin
// NexChatMessagingService.kt
class NexChatMessagingService : FirebaseMessagingService() {
    override fun onNewToken(token: String) {
        // Send to server
        CoroutineScope(Dispatchers.IO).launch {
            usersApi.saveFcmToken(token)
        }
    }

    override fun onMessageReceived(message: RemoteMessage) {
        // Show local notification
        val title = message.notification?.title ?: "New message"
        val body = message.notification?.body ?: ""
        val conversationId = message.data["conversationId"]

        showNotification(title, body, conversationId)
    }
}

// Notification channel setup for Android 8+
// Channel: "nexchat_messages" — high importance for message notifications
// Channel: "nexchat_calls" — critical for incoming calls
// Channel: "nexchat_general" — low importance for other
```

### 15.2 Permissions

```xml
<!-- AndroidManifest.xml -->
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
<uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />
```

---

## 16. Local Caching & Offline Support

### 16.1 Room Database

```kotlin
@Database(
    entities = [
        UserEntity::class,
        ConversationEntity::class,
        MessageEntity::class,
        ParticipantEntity::class,
        StoryEntity::class,
        FriendEntity::class,
        CallRecordEntity::class,
        CommunityEntity::class,
    ],
    version = 1,
    exportSchema = true
)
abstract class NexChatDatabase : RoomDatabase() {
    abstract fun userDao(): UserDao
    abstract fun conversationDao(): ConversationDao
    abstract fun messageDao(): MessageDao
    abstract fun participantDao(): ParticipantDao
    abstract fun storyDao(): StoryDao
    abstract fun friendDao(): FriendDao
    abstract fun callDao(): CallDao
    abstract fun communityDao(): CommunityDao
}
```

### 16.2 Caching Strategy

| Data | Cache | Sync Strategy |
|------|-------|---------------|
| Conversations | Room | Fetch on start, update via socket events |
| Messages | Room | Paginated fetch (cursor-based), optimistic insert |
| Users | Room | Fetch on demand, cache profile data |
| Stories | Room (TTL 24h) | Fetch feed on start, mark viewed via API |
| Friends | Room | Fetch on start, update via socket |
| Calls | Room | Fetch history, update via socket |
| Communities | Room | Fetch on demand |
| User preferences | DataStore | Read/write locally, sync to server |
| Token/drafts | DataStore | Local only |

### 16.3 Offline Message Queue

```kotlin
// When offline, messages go to Room with status PENDING.
// When connectivity returns, retry sending from queue.
// Optimistic UI: message appears immediately in list with clock icon.

@Dao
interface MessageDao {
    @Query("SELECT * FROM messages WHERE conversationId = :convId ORDER BY createdAt ASC")
    fun getMessages(convId: String): Flow<List<MessageEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertMessage(message: MessageEntity)

    @Query("UPDATE messages SET status = :status WHERE id = :id")
    suspend fun updateStatus(id: String, status: String)

    @Query("SELECT * FROM messages WHERE status = 'PENDING'")
    suspend fun getPendingMessages(): List<MessageEntity>
}
```

### 16.4 Message Drafts

Each conversation has a draft stored in DataStore:
```
draft:{conversationId} → String
```

Restored when conversation is opened. Cleared on send.

---

## 17. Permissions

### Required Permissions

```xml
<!-- AndroidManifest.xml -->
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />        <!-- Android 13+ -->
<uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />    <!-- Reconnect on boot -->
<uses-permission android:name="android.permission.RECORD_AUDIO" />              <!-- Voice messages, calls -->
<uses-permission android:name="android.permission.CAMERA" />                    <!-- Video calls, stories -->
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />      <!-- Pick media (pre-13) -->
<uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />         <!-- Android 13+ -->
<uses-permission android:name="android.permission.READ_MEDIA_VIDEO" />          <!-- Android 13+ -->
<uses-permission android:name="android.permission.READ_MEDIA_AUDIO" />          <!-- Android 13+ -->
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />        <!-- Call background -->
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_PHONE_CALL" /> <!-- VoIP -->
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_MICROPHONE" />
<uses-permission android:name="android.permission.WAKE_LOCK" />                 <!-- Keep alive during call -->
<uses-permission android:name="android.permission.VIBRATE" />                   <!-- Call vibration -->
<uses-permission android:name="android.permission.USE_FULL_SCREEN_INTENT" />    <!-- Incoming call screen -->
<uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM" />      <!-- Scheduled messages -->
```

### Runtime Permission Requests

Request permissions contextually:
- **Camera**: When user taps camera button in attachment menu or starts video call
- **Microphone**: When user starts recording voice message or joins a call
- **Notifications**: On first app launch, after login
- **Storage**: When user picks media (not needed on Android 13+ with media picker)

```kotlin
// Use Accompanist Permissions or Accompanist Permissions API
@Composable
fun RequestMicPermission(onGranted: @Composable () -> Unit) {
    val permissionState = rememberPermissionState(Manifest.permission.RECORD_AUDIO)
    if (permissionState.status.isGranted) {
        onGranted()
    } else {
        LaunchedEffect(Unit) { permissionState.launchPermissionRequest() }
    }
}
```

---

## 18. Logo & Branding

### 18.1 App Icon

The app uses a modern chat icon. Design specs:
- Adaptive icon (foreground + background layers)
- **Foreground**: NexChat "N" lettermark or chat bubble icon on dark background
- **Background**: Dark gradient matching the app theme (#0B0B0E → #131316)
- Style: Minimal, geometric, matches glassmorphism aesthetic

### 18.2 Splash Screen

```kotlin
// Theme the splash screen to match dark theme
// Use Android 12+ Splash Screen API
val splashScreen = installSplashScreen()
splashScreen.setKeepOnScreenCondition { viewModel.isLoading.value }
splashScreen.setSplashScreenTheme(R.style.NexChatSplash)
```

```xml
<!-- res/values/themes.xml -->
<style name="NexChatSplash" parent="Theme.SplashScreen">
    <item name="windowSplashScreenBackground">#0B0B0E</item>
    <item name="windowSplashScreenAnimatedIcon">@drawable/ic_splash_logo</item>
    <item name="postSplashScreenTheme">@style/NexChatTheme</item>
</style>
```

### 18.3 App Name & Metadata

```xml
<application
    android:label="NexChat"
    android:icon="@mipmap/ic_launcher"
    android:roundIcon="@mipmap/ic_launcher_round"
    android:supportsRtl="true"
    android:theme="@style/NexChatTheme">
```

### 18.4 In-App Assets

- Default avatar: circular, generates from initials with random pastel background
- Empty state illustrations
- Error state illustrations
- Loading indicators (use custom purple pulsing dots matching the web app)

---

## 19. Smoothness & Performance

### 19.1 Key Principles

1. **60fps scrolling**: LazyColumn with `key` parameter, stable composables, minimal recomposition
2. **Optimistic UI**: Messages appear instantly, confirmed by server
3. **Pagination**: Cursor-based message loading (25 per page), load more on scroll-to-top
4. **Image optimization**: Coil with memory/disk cache, resize to display size
5. **Socket reconnection**: Auto-reconnect with exponential backoff (1s → 5s max)
6. **Background presence**: Heartbeat every 25s keeps user online
7. **Message queue**: Offline messages queued and retried on reconnect

### 19.2 Performance Checklist

- [ ] Use `remember`, `derivedStateOf`, `LaunchedEffect` correctly
- [ ] Use `LazyColumn`/`LazyRow` for all lists (never Column in scrollable)
- [ ] Use `key` in `items {}` for stable recomposition
- [ ] Extract stable lambdas with `remember`
- [ ] Use `Modifier.drawWithContent` for shimmer (not recomposition)
- [ ] Coil for all images (memory cache, disk cache, crossfade)
- [ ] Room for local data (no repeated network calls)
- [ ] Paging 3 for infinite lists
- [ ] Avoid `scrollableColumn` — use LazyColumn
- [ ] Use `derivedStateOf` for derived state
- [ ] Profile with Compose Compiler metrics
- [ ] Enable R8/ProGuard for release builds
- [ ] Use `Dispatchers.IO` for network/disk, `Dispatchers.Main` for UI

### 19.3 Smooth Animations

- Use `animateContentSize()` for expanding bubbles
- Use `AnimatedVisibility` for show/hide with slide/fade
- Use `Crossfade` for page transitions
- Use `updateTransition` for complex multi-property animations
- Haptic feedback on send, reactions, long-press

### 19.4 Battery & Network Optimization

- **Doze mode**: Firebase handles push when app is backgrounded
- **Heartbeat**: 25s interval (server Redis TTL is 30s)
- **Socket.io reconnect**: Automatic with backoff
- **Batch presence updates**: Don't query individual user status
- **Image loading**: Coil handles disk cache + memory cache + placeholder

---

## 20. Security

### 20.1 Token Storage

```kotlin
// Use EncryptedSharedPreferences for tokens
val masterKey = MasterKey.Builder(context)
    .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
    .build()

val encryptedPrefs = EncryptedSharedPreferences.create(
    context,
    "nexchat_secure_prefs",
    masterKey,
    EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
    EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
)
```

### 20.2 SSL Pinning (optional)

```kotlin
// OkHttp certificate pinning
val client = OkHttpClient.Builder()
    .certificatePinner(
        CertificatePinner.Builder()
            .add("api.92lrcorps.xyz", "sha256/XXXXX...")
            .build()
    )
    .build()
```

### 20.3 App Lock (PIN/Biometric)

The web app has a PIN lock feature. Implement with:
- `BiometricPrompt` for fingerprint/face
- PIN stored as hash in EncryptedSharedPreferences
- Lock on app background (configurable timeout)
- Lock on app start if PIN is set

### 20.4 ProGuard/R8 Rules

```
# Keep Moshi models
-keep class com.nexchat.data.remote.dto.** { *; }
-keep class com.nexchat.domain.model.** { *; }

# Keep Room entities
-keep class com.nexchat.data.local.entity.** { *; }

# Keep Socket.IO
-keep class io.socket.** { *; }
```

---

## 21. Testing

### Unit Tests

- Repository logic
- Use cases
- ViewModel state management
- Token refresh logic
- Message queue retry logic

### Integration Tests

- API calls with MockWebServer
- Room database operations
- Socket.IO event handling

### UI Tests

- Compose UI tests for key screens
- Navigation tests
- Authentication flow tests

---

## 22. Backend API Reference

### Base URL: `https://api.92lrcorps.xyz/api`

All authenticated endpoints require `Authorization: Bearer <accessToken>` header.

#### Auth (`/auth`)
| Method | Path | Body | Response |
|--------|------|------|----------|
| POST | `/send-otp` | `{email? \| phone?}` | — |
| POST | `/verify-otp` | `{email? \| phone?, code}` | — |
| POST | `/register` | `{email? \| phone?, password?, displayName, username?, avatar?}` | `{user, accessToken, refreshToken}` |
| POST | `/login` | `{email? \| phone?, password? \| code?}` | `{user, accessToken, refreshToken}` |
| POST | `/refresh` | `{refreshToken}` | `{accessToken, refreshToken}` |
| POST | `/logout` | `{refreshToken}` | — |
| POST | `/forgot-password` | `{email}` | — |
| POST | `/reset-password` | `{token, newPassword}` | — |
| PUT | `/password` | `{currentPassword, newPassword}` | — |

#### Users (`/users`)
| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | `/me` | — | `User` |
| PUT | `/profile` | `{displayName?, avatar?, bio?, username?, ...}` | `User` |
| GET | `/search?q=` | — | `User[]` |
| GET | `/by-username/:username` | — | `User` |
| POST | `/fcm-token` | `{fcmToken}` | — |
| GET | `/blocked` | — | `User[]` |
| POST | `/block` | `{blockedId}` | — |
| POST | `/unblock` | `{blockedId}` | — |
| GET | `/sessions` | — | `Session[]` |
| DELETE | `/sessions/:id` | — | — |
| POST | `/sessions/revoke-others` | — | `{revoked}` |
| PUT | `/username` | `{username, password}` | — |
| POST | `/email/change-send-otp` | `{newEmail, password}` | — |
| POST | `/email/change-confirm` | `{code}` | — |
| DELETE | `/me` | `{password}` | — |

#### Conversations (`/conversations`)
| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | `/` | — | `Conversation[]` |
| POST | `/` | `{type, name?, avatar?, description?, participantIds}` | `Conversation` |
| DELETE | `/:id` | — | — |
| POST | `/:id/clear` | — | — |
| POST | `/:id/pin` | — | `{pinnedAt}` |
| POST | `/:id/mute` | `{duration}` | `{mutedUntil}` |
| POST | `/:id/archive` | `{archived}` | `{archivedAt}` |
| POST | `/:id/disappearing` | `{ttlSeconds}` | `{ttlSeconds}` |
| PUT | `/:id/group` | `{name?, avatar?, ...}` | `Conversation` |
| POST | `/:id/participants` | `{userIds}` | `Conversation` |
| DELETE | `/:id/participants/:userId` | — | — |
| PUT | `/:id/participants/:userId/role` | `{role}` | `Conversation` |
| GET | `/:id/participants` | `?offset=&limit=` | `{participants, total, hasMore}` |
| POST | `/:id/invites` | `{expiresInHours?, maxUses?}` | `GroupInvite` |
| GET | `/:id/invites` | — | `GroupInvite[]` |
| GET | `/:id/join-requests` | — | `JoinRequest[]` |
| POST | `/:id/join-requests/:requestId/resolve` | `{action}` | — |
| GET | `/:id/audit-log` | — | `AuditLog[]` |
| POST | `/:id/notification-preference` | `{preference}` | — |

#### Invites (`/invites`)
| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | `/:token` | — | `InvitePreview` |
| POST | `/:token/join` | — | `Conversation` |
| DELETE | `/:token` | — | — |

#### Messages (`/messages`)
| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | `/:conversationId` | `?cursor=&limit=25` | `{messages, nextCursor}` |
| GET | `/:conversationId/search` | `?q=&cursor=` | `{messages, nextCursor}` |
| GET | `/global-search` | `?q=&cursor=` | `{messages, nextCursor}` |
| GET | `/:conversationId/stats` | — | `{media, files, links, voice, mutualGroups, mutualFriends}` |
| GET | `/:conversationId/media` | `?category=MEDIA\|DOCS&cursor=` | `{messages, nextCursor}` |
| GET | `/:conversationId/pinned` | — | `Message[]` |
| GET | `/:conversationId/scheduled` | — | `{messages}` |
| POST | `/` | `{conversationId, content, type, mediaUrl?, replyToId?, mentionedUserIds?, ...}` | `Message` |
| PATCH | `/:id` | `{content}` | `Message` |
| DELETE | `/:id` | `{type: "ME" \| "EVERYONE"}` | — |
| POST | `/:id/star` | — | `{starred}` |
| POST | `/:id/reactions` | `{emoji}` | `{action, emoji}` |
| GET | `/:id/reactions` | — | `Record<string, ReactionGroup>` |
| POST | `/:id/pin` | — | `{pinned}` |
| POST | `/:id/poll-vote` | `{optionIndex}` | `{optionIndex}` |
| GET | `/:id/poll-votes` | — | `Record<number, User[]>` |
| GET | `/:id/read-by` | — | `{readBy, deliveredTo}` |
| POST | `/read/:conversationId` | — | — |
| POST | `/forward` | `{messageId, targetConversationId}` | `Message` |
| DELETE | `/scheduled/:id` | — | — |

#### Media (`/media`)
| Method | Path | Body | Response |
|--------|------|------|----------|
| POST | `/presigned-url` | `{fileName, fileType, fileSize}` | `{uploadUrl, publicUrl}` |
| POST | `/link-preview` | `{url}` | `LinkPreviewData \| null` |
| POST | `/translate` | `{text, target}` | `{translatedText, detectedSourceLang, target}` |

#### Stories (`/stories`)
| Method | Path | Body | Response |
|--------|------|------|----------|
| POST | `/` | `{type, mediaUrl?, caption?, bgColor?, fontStyle?}` | `Story` |
| GET | `/feed` | — | `StoryFeedGroup[]` |
| POST | `/:id/view` | — | — |
| GET | `/:id/views` | — | `{viewers, reactionSummary}` |
| POST | `/:id/react` | `{emoji}` | — |
| DELETE | `/:id` | — | — |

#### Friends (`/friends`)
| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | `/` | — | `Friend[]` |
| GET | `/presence` | — | `Friend[] (with isOnline)` |
| POST | `/request` | `{userId}` | — |
| POST | `/accept/:id` | — | — |
| POST | `/reject/:id` | — | — |
| POST | `/cancel/:id` | — | — |
| DELETE | `/:friendId` | — | — |
| GET | `/pending/received` | — | `FriendRequest[]` |
| GET | `/pending/sent` | — | `FriendRequest[]` |

#### Calls (`/calls`)
| Method | Path | Body | Response |
|--------|------|------|----------|
| POST | `/initiate` | `{userId, isVideo}` | `{callId, roomName}` |
| POST | `/:id/accept` | — | `CallRecord` |
| POST | `/:id/reject` | — | — |
| POST | `/:id/end` | — | `{duration}` |
| POST | `/:id/cancel` | — | — |
| GET | `/:id/token` | — | `{token, roomName}` |
| GET | `/` | — | `CallRecord[]` |

#### Communities (`/communities`) — 50+ endpoints
See `client/src/api/communities.api.ts` for the complete list.

---

## 23. Database Schema Reference

Complete Prisma schema at `prisma/schema.prisma`. Key models:

### Core Models

```
User           → id, email, phone, username, displayName, avatar, bio, fcmToken, lastSeen, ...
RefreshToken   → id, userId, token, expiresAt, userAgent, ip
Conversation   → id, type (DIRECT|GROUP), name, avatar, disappearingTtlSeconds, permissions, ...
Participant    → id, userId, conversationId, role, readWatermarkId, deliveredWatermarkId, clearedAt, pinnedAt, mutedUntil, archivedAt
Message        → id, conversationId, senderId, content, type, mediaUrl, status, replyToId, reactions, stars, ...
MessageRead    → id, messageId, userId, readAt
Reaction       → id, messageId, userId, emoji
Star           → id, messageId, userId
PollVote       → id, messageId, userId, optionIndex
Block          → id, blockerId, blockedId
MessageDelete  → id, messageId, userId
```

### Stories

```
Story          → id, userId, type, mediaUrl, caption, bgColor, fontStyle, expiresAt
StoryView      → id, storyId, viewerId, viewedAt
StoryReaction  → id, storyId, userId, emoji
```

### Social

```
Friendship     → id, userId, friendId
FriendRequest  → id, senderId, receiverId, status (PENDING|ACCEPTED|REJECTED)
Report         → id, reporterId, reportedId, reason, description
JoinRequest    → id, conversationId, userId, status
GroupInvite    → id, token, conversationId, createdById, expiresAt, maxUses, useCount, revoked
```

### Communities

```
Community                    → id, conversationId, visibility, category, tags, banner, verificationStatus, customUrl, ...
CustomRole                   → id, communityId, name, color, permissions (BigInt), priority
CustomRoleMember             → id, roleId, participantId
CommunityEvent               → id, communityId, title, type, startsAt, endsAt, status
CommunityEventAttendee       → id, eventId, userId, rsvp
CommunityRating              → id, communityId, userId, score, review
CommunityAchievement         → id, communityId, type, label, icon
CommunityHighlight           → id, communityId, messageId, reactionCount
CommunityLeaderboardEntry    → id, communityId, period, type, rank, userId, score
CommunityAuditLog            → id, communityId, actorId, action, details
ModSettings                  → id, communityId, profanityFilter, spamDetection, slowModeSeconds, ...
CommunityBan                 → id, communityId, userId, reason, expiresAt
CommunityReport              → id, communityId, reporterId, targetType, targetId, status
ModAction                    → id, communityId, action, moderatorId, targetId, durationMs
```

### Calls

```
Call           → id, callerId, calleeId, roomName, status (RINGING|ONGOING|ENDED|MISSED|REJECTED|CANCELLED), isVideo, startedAt, endedAt, duration
```

### Enums

```
ConversationType: DIRECT | GROUP
ParticipantRole: MEMBER | ADMIN
MessageType: TEXT | IMAGE | AUDIO | VIDEO | FILE | POLL
MessageStatus: SENT | DELIVERED | READ
StoryType: IMAGE | VIDEO | TEXT
CallStatus: RINGING | ONGOING | ENDED | MISSED | REJECTED | CANCELLED
CommunityVisibility: PUBLIC | PRIVATE
CommunityCategory: TECHNOLOGY | GAMING | AI | BUSINESS | EDUCATION | ENTERTAINMENT | MUSIC | ANIME | SPORTS | GENERAL
VerificationStatus: NONE | OFFICIAL | VERIFIED | ORGANIZATION | GAMING
EventStatus: SCHEDULED | ONGOING | COMPLETED | CANCELLED
```

---

## Appendix: LocalStorage Keys Used by Web Client

The Android app should replicate these with DataStore/Room:

| Key | Purpose |
|-----|---------|
| `chat_user` | Current user JSON |
| `chat_access_token` | JWT access token |
| `chat_refresh_token` | JWT refresh token |
| `draft:{conversationId}` | Message draft per conversation |
| `nexchat_message_queue` | Failed messages queue |
| `nexchat_pin` | App lock PIN hash |
| `nexchat:sidebarWidth` | Sidebar width preference |
| `fcm:saved:{userId}` | Last saved FCM token |
| `pendingInvite` | Pending group invite token |
| `call:micOn` | Mic preference for calls |

---

*This document is the complete specification for building the NexChat Android client. Every feature, every API endpoint, every UI component, and every animation from the web client is covered above.*
