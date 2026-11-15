# Requirements Document

**Feature**: In-App Navigation & Daily Movement Tracking

**Status**: Draft

**Owner**: Daffa (AURA Mobile Team)

**Created**: 2025-01-15

**Updated**: 2025-01-15

---

## Introduction

### Overview

AURA currently provides navigation to hospitals only via external WebView maps, forcing users to leave the app and lose health context. Users cannot visualize their daily movements within the app, and there's no proactive system to warn them about health hazards (pollution, traffic, disease risks) during navigation.

This feature adds comprehensive in-app navigation and journey tracking capabilities:

1. **Universal Navigation** - Turn-by-turn directions to any destination with real-time health warnings
2. **Active Tracking Mode** - Manual start/stop tracking for recording specific journeys
3. **Daily Journey History** - Animated replay visualization showing movement patterns and pollution exposure analysis

### Background

AURA's core mission is to protect urban commuters from environmental health hazards through proactive, personalized guidance. The existing passive background tracking collects waypoints but provides no visual feedback or actionable insights. Users need to see where they've been, understand their exposure patterns, and receive warnings before entering hazardous zones.

### Goals

**Primary Goals:**
1. Enable universal in-app navigation with health-aware routing for any destination
2. Provide daily journey insights through animated replay and exposure analytics
3. Reduce pollution exposure by warning users about hazardous zones during navigation

**Success Metrics:**
- 40% of DAU use navigation at least once per week
- Users replay daily journey at least 2x per week
- 25% reduction in high-AQI exposure time for active users
- Active tracking battery drain < 2% per hour
- Route calculation < 2s, replay animation maintains 60fps

### Scope

**In Scope:**
- Universal navigation to any address/POI
- Turn-by-turn visual instructions
- 5 categories of health warning alerts (traffic, pollution, disease)
- Manual start/stop journey tracking
- Animated daily journey replay with speed controls
- Exposure statistics and AI-generated health analysis
- Integration with existing background tracking system

**Out of Scope (Future Enhancements):**
- Voice turn-by-turn navigation (TTS)
- Multi-modal routing (walking + public transport)
- Offline map downloads (tiles cached on-demand only)
- Route alternatives (fastest vs safest)
- Social sharing features
- Wearable device integration

---

## Requirements

### Functional Requirements

#### FR-1: Universal Navigation System

**FR-1.1: Route Calculation**
- System shall calculate routes using backend API endpoint `/api/v1/navigation/calculate-route`
- System shall accept origin/destination coordinates and optional waypoints
- System shall fallback to OSRM/TomTom APIs if backend unavailable
- System shall return: polyline, distance, duration, turn-by-turn steps, traffic segments, health warnings
- Response time shall be < 2 seconds (P95)

**FR-1.2: Map Rendering**
- System shall use native MapView from `react-native-maps` library
- System shall render route polyline with 6px width, color `#1E6CEF`
- System shall display user's current GPS position with blue dot
- System shall display destination marker with custom pin icon
- System shall support map gestures (pan, zoom, rotate)

**FR-1.3: Turn-by-Turn Instructions**
- System shall display current instruction card at top of screen
- Instruction card shall show: maneuver icon, instruction text, distance to maneuver
- System shall update user position every 1.5 seconds during active navigation
- System shall advance to next instruction when user within 30 meters of maneuver point
- System shall support maneuver types: turn-left, turn-right, straight, uturn, roundabout, arrive

**FR-1.4: Rerouting**
- System shall detect when user deviates > 50 meters from planned route
- System shall automatically recalculate route from current position to destination
- System shall show rerouting notification to user
- System shall limit rerouting attempts to max 1 per minute to avoid API spam

**FR-1.5: Route Caching**
- System shall cache last calculated route in AsyncStorage
- Cache shall include: route_id, polyline, steps, timestamp
- Cache shall be valid for 30 minutes
- System shall use cached route if user navigates to same destination within validity period

#### FR-2: Health Warning System

**FR-2.1: Warning Categories**
- System shall support 5 hazard categories:
  1. Heavy Traffic (icon: `warning`, color: `#EF4444`)
  2. Moderate Traffic (icon: `car`, color: `#F59E0B`)
  3. High Pollution (icon: `cloud`, color: `#9333EA`)
  4. Disease Hotspot (icon: `medical`, color: `#B91C1C`)
  5. Safe Zone (icon: `shield-checkmark`, color: `#10B981`)

**FR-2.2: Warning Delivery**
- System shall fetch health warnings as part of route calculation response
- System shall display alert card when user within 200 meters of hazard location
- Alert card shall show: category icon, title, message, AQI value, PM2.5 value
- Alert card shall include health risks array and recommendations array
- Alert card shall auto-dismiss when user > 500 meters past hazard
- User shall be able to manually dismiss alert card
- User shall be able to tap alert card for detailed view modal

**FR-2.3: Map Markers**
- System shall render map markers for all hazards along route
- Markers shall use Ionicons matching category
- Markers shall be color-coded by severity
- Markers shall be tappable to show info callout
- Callout shall display: title, AQI, distance from user

**FR-2.4: Warning Proximity Detection**
- System shall calculate distance from user position to each warning location
- System shall use Haversine formula for distance calculation
- System shall sort warnings by distance (nearest first)
- System shall limit active warnings to max 3 simultaneous cards (prevent screen clutter)

#### FR-3: Active Journey Tracking

**FR-3.1: Session Management**
- System shall provide "Mulai Tracking" button in dashboard and journey history screen
- On start, system shall request location permissions if not granted
- System shall call backend API `POST /api/v1/tracking/start-session` to create session
- System shall receive session_id from backend
- System shall store session metadata in expo-secure-store
- On stop, system shall call backend API `POST /api/v1/tracking/stop-session`
- System shall save final statistics and AI analysis from backend

**FR-3.2: Waypoint Recording**
- System shall record GPS waypoints every 5 seconds during active tracking
- Each waypoint shall include: latitude, longitude, timestamp, accuracy_meters, speed_mps, heading
- System shall store waypoints in local memory array first
- System shall persist waypoints to AsyncStorage every 30 seconds (crash protection)

**FR-3.3: Hybrid Smart Sync**
- System shall sync waypoints to backend via `POST /api/v1/tracking/sync-waypoints`
- Auto-sync shall trigger every 10-15 waypoints
- Auto-sync shall trigger when network connection changes from offline to online
- Final sync with `is_final: true` shall trigger on stop
- Failed syncs shall queue for retry (max 3 attempts with exponential backoff)
- System shall show sync status indicator: syncing (spinner), synced (checkmark), failed (alert icon)

**FR-3.4: Live Tracking UI**
- Screen shall display MapView centered on user position
- Map shall render polyline trail of all recorded waypoints (color: `#10B981`)
- Screen shall show stats overlay: elapsed time (HH:MM:SS), distance (km), current speed (km/h), current AQI
- Screen shall update stats every second
- Screen shall show prominent "Stop Tracking" button (red, bottom center)

**FR-3.5: Tracking Summary**
- On stop, system shall display summary modal immediately
- Summary shall show: total time, total distance, total outdoor minutes, average AQI, max AQI, worst area name
- Summary shall include AI-generated health analysis from backend
- User shall be able to name the journey (optional text input)
- User shall be able to tap "Lihat Detail" to navigate to journey history screen

#### FR-4: Daily Journey History & Replay

**FR-4.1: History View**
- Screen shall be accessible from dashboard "Tracking Harian" navigation card
- Screen shall display calendar date picker (default: today)
- System shall fetch history via `GET /api/v1/tracking/daily-history?user_id={uid}&date={YYYY-MM-DD}`
- System shall display "No data" empty state if no waypoints exist for selected date

**FR-4.2: Waypoint Visualization**
- Map shall display all waypoints as colored circular markers:
  - Indoor stays: orange circles (radius 30px)
  - Outdoor transit: green circles (radius 30px)
- Map shall render polyline connecting waypoints chronologically (color: `#2563EB`, width: 4px, dash pattern)
- Map bounds shall auto-fit to include all waypoints with 60px padding

**FR-4.3: Statistics Display**
- Screen shall show 4 stats cards below map:
  1. Total Outdoor Time (minutes or hours)
  2. Total Indoor Time (minutes or hours)
  3. Average AQI Exposure
  4. Worst Area + AQI value
- Stats shall be fetched from backend daily_stats object
- Stats shall update when date changes

**FR-4.4: Animated Replay**
- "Putar Ulang Perjalanan" button shall trigger replay animation
- Animated marker shall appear on map as blue navigation arrow icon
- Marker shall move through waypoints sequentially based on timestamp order
- Animation shall use react-native-reanimated `withTiming()` for smooth interpolation between points
- Default animation speed: 1x (1 second real time = 1 waypoint transition)

**FR-4.5: Playback Controls**
- Timeline slider shall allow manual scrubbing through waypoints
- Slider value range: 0 to (waypoints.length - 1)
- Scrubbing shall pause autoplay
- Play/Pause button shall toggle animation state
- Speed buttons shall offer: 0.5x, 1x, 2x, 5x
- Active speed button shall be visually highlighted
- Changing speed during playback shall immediately adjust animation rate

**FR-4.6: Current Waypoint Info**
- Info card shall display details of current waypoint during replay:
  - Timestamp (HH:MM format)
  - Location name (zone_name from backend or reverse geocoded)
  - AQI value
  - PM2.5 value
  - Classification badge (Indoor/Outdoor)
  - Duration at this point (minutes)
- Info card shall update in real-time as animation progresses

**FR-4.7: Performance Optimization**
- If waypoints count > 500, system shall interpolate to reduce density to 250 points
- Animation shall maintain 60fps on devices with 2GB RAM
- Map zoom/pan gestures shall be disabled during autoplay (prevent user confusion)
- Replay shall auto-stop and reset to beginning when reaching last waypoint

### Non-Functional Requirements

#### NFR-1: Performance

**NFR-1.1: API Response Times**
- Route calculation: < 2 seconds (P95)
- Waypoint sync: < 1 second (P95)
- Daily history fetch: < 3 seconds (P95)

**NFR-1.2: Rendering Performance**
- Map initial load: < 1 second
- Polyline rendering with 200 points: < 500ms
- Replay animation: maintain 60fps throughout

**NFR-1.3: App Responsiveness**
- Navigation UI interactions: < 100ms response time
- Button taps: immediate visual feedback (< 50ms)
- No ANR (Application Not Responding) errors during tracking

#### NFR-2: Battery Efficiency

**NFR-2.1: Active Tracking**
- GPS polling during tracking: < 2% battery drain per hour
- Background services: no wake locks held when app backgrounded
- CPU usage: < 5% average during tracking

**NFR-2.2: Navigation Mode**
- GPS polling during navigation: < 3% battery drain per hour
- Screen always-on during navigation (user configurable)

**NFR-2.3: Passive Background Tracking**
- Existing background tracking battery impact maintained: < 1.5% per day

#### NFR-3: Reliability

**NFR-3.1: GPS Failure Handling**
- System shall fallback to last known position if GPS signal lost
- System shall show "GPS signal weak" indicator to user
- System shall attempt GPS re-acquisition every 10 seconds
- System shall not crash if GPS unavailable

**NFR-3.2: Network Failure Handling**
- System shall queue API requests for retry when network unavailable
- System shall show offline mode indicator
- System shall use cached routes for navigation when offline
- System shall sync queued data when network restored

**NFR-3.3: State Persistence**
- Active tracking state shall persist across app restarts
- User shall be able to resume tracking session after app force-close
- Waypoints shall not be lost if app crashes (saved to AsyncStorage every 30s)

**NFR-3.4: Error Recovery**
- System shall handle API errors gracefully (show user-friendly error messages)
- System shall implement retry logic with exponential backoff (max 3 attempts)
- System shall log errors to crash reporting service (Sentry or Firebase Crashlytics)

#### NFR-4: Usability

**NFR-4.1: Visual Design**
- All screens shall follow AURA Design System (AuraColors, Plus Jakarta Sans font)
- Navigation shall use consistent spacing (8px, 12px, 16px, 20px, 24px)
- Cards shall use elevation shadows (2dp, 4dp, 8dp)
- Gradients shall match existing dashboard aesthetic

**NFR-4.2: Interaction Design**
- Health warning alerts shall be non-intrusive (bottom sheet, swipeable)
- Buttons shall have min touch target 44x44 dp (accessibility)
- Map gestures shall be intuitive (pinch-zoom, two-finger rotate)

**NFR-4.3: Onboarding**
- First-time users shall see tooltip: "Tap Play to replay your day" (journey history)
- First-time users shall see tooltip: "Enter destination to see health warnings" (navigation)
- Tooltips shall auto-dismiss after 5 seconds or manual dismiss
- Tooltips shall only show once per user (stored in AsyncStorage)

**NFR-4.4: Feedback**
- All button presses shall have haptic feedback (light impact)
- Successful sync shall show toast notification: "Data synced"
- Failed sync shall show alert: "Sync failed, will retry"

#### NFR-5: Accessibility

**NFR-5.1: Screen Readers**
- All interactive elements shall have accessibility labels
- Map markers shall be accessible via VoiceOver/TalkBack
- Stats cards shall announce values when focused

**NFR-5.2: Visual Accessibility**
- Hazard categories shall be distinguishable by icon shape, not just color (color-blind friendly)
- Text contrast ratio shall meet WCAG AA standards (4.5:1 for normal text)
- Font sizes shall respect system accessibility settings (Dynamic Type on iOS, Font Scale on Android)

**NFR-5.3: Motor Accessibility**
- All touch targets shall be min 44x44 dp
- Swipe gestures shall have alternative tap actions
- No time-based interactions that cannot be extended

#### NFR-6: Data & Privacy

**NFR-6.1: Data Collection**
- System shall only collect location data when user explicitly enables tracking
- System shall show clear explanation of data usage in permission prompt
- System shall allow user to delete historical waypoints (GDPR compliance)

**NFR-6.2: Data Storage**
- Waypoints shall be encrypted at rest (using expo-secure-store for session metadata)
- API requests shall use HTTPS only
- Local waypoint cache shall be cleared after 30 days automatically

**NFR-6.3: Data Transmission**
- Waypoints shall be sent to backend with user_id for association
- System shall not transmit data to third parties (TomTom/OSRM APIs called from backend, not directly from app)

### User Interface Requirements

#### UI-1: Universal Navigation Screen

**UI-1.1: Layout**
- Full-screen MapView
- Top overlay: destination search bar (white, rounded, shadow)
- Top overlay: current instruction card (when navigating)
- Bottom overlay: health warning alert cards (max 3 visible, scrollable)
- Bottom overlay: route info card (distance, duration, ETA)
- Top-right corner: close/back button

**UI-1.2: Destination Search**
- TextInput placeholder: "Cari tujuan..."
- Autocomplete dropdown with max 5 suggestions
- Recent destinations (last 5) shown by default
- Search icon (Ionicons: `search`) on left
- Clear button (Ionicons: `close-circle`) on right when text entered

**UI-1.3: Instruction Card**
- Background: white with shadow
- Left: maneuver icon (32px, color: `#1E6CEF`)
- Center: instruction text (16px, bold)
- Below: distance text (14px, regular, color: `#64748B`)
- Card height: 80px, full width with 16px margin

**UI-1.4: Health Warning Card**
- Background: white with colored left border (4px, category color)
- Left: category icon (24px, category color)
- Center: title text (14px, bold), message text (12px, regular)
- Right: dismiss button (Ionicons: `close`, 20px)
- Card height: auto (min 70px), full width with 16px margin
- Cards stack vertically with 8px gap

**UI-1.5: Route Info Card**
- Background: LinearGradient `['#1E6CEF', '#1D4ED8']`
- Left: distance text (18px, bold, white)
- Center: duration text (14px, regular, white)
- Right: ETA text (14px, regular, white)
- Card height: 60px, full width

#### UI-2: Active Tracking Screen

**UI-2.1: Layout**
- Full-screen MapView following user position
- Top overlay: stats panel (semi-transparent white card)
- Bottom overlay: Stop button (prominent, red)

**UI-2.2: Stats Panel**
- Background: white with blur effect (iOS) or shadow (Android)
- Grid layout: 2x2
  - Top-left: Elapsed time with clock icon
  - Top-right: Distance with ruler icon
  - Bottom-left: Speed with speedometer icon
  - Bottom-right: Current AQI with cloud icon
- Panel height: 120px, full width with 16px margin

**UI-2.3: Stop Button**
- Background: `#EF4444`
- Text: "Stop Tracking" (16px, bold, white)
- Icon: Ionicons `stop-circle` (24px, white)
- Size: 200px width x 56px height, centered bottom with 24px margin
- Shadow: elevation 8dp

#### UI-3: Daily Journey History Screen

**UI-3.1: Layout**
- Top: Date picker button
- Middle: MapView (fixed height 400px)
- Below: Stats cards (horizontal scrollable)
- Bottom: "Putar Ulang Perjalanan" button
- Bottom: Playback controls (when replay active)

**UI-3.2: Date Picker**
- Button style: white background, rounded, shadow
- Left: Calendar icon (Ionicons: `calendar`)
- Center: Selected date text (e.g., "15 Januari 2025")
- Right: Chevron down icon
- Opens modal calendar on tap

**UI-3.3: Stats Cards**
- Card background: LinearGradient (category-specific colors)
- Icon on left (32px, white)
- Value text (24px, bold, white)
- Label text (12px, regular, white, opacity 0.9)
- Card size: 160px width x 100px height
- Cards scroll horizontally with 12px gap

**UI-3.4: Replay Button**
- Background: LinearGradient `['#10B981', '#059669']`
- Icon: Ionicons `play-circle` (24px)
- Text: "Putar Ulang Perjalanan" (14px, bold, white)
- Size: full width with 16px margin, height 50px

**UI-3.5: Playback Controls**
- Background: white card with shadow
- Top: Timeline slider (full width)
- Middle row: Play/Pause button (center, 48px icon)
- Bottom row: Speed buttons (0.5x, 1x, 2x, 5x) as chips
- Active speed chip: filled with `#1E6CEF`, inactive: outline only
- Controls height: 140px

**UI-3.6: Current Waypoint Info Card**
- Position: overlay on map (bottom-left corner)
- Background: white with shadow
- Top: Time text (12px, bold, `#1E293B`)
- Middle: Location name (14px, bold, `#1E293B`)
- Below: AQI badge (pill shape, color-coded)
- Below: Classification badge (Indoor/Outdoor, pill shape)
- Card size: 200px width x auto height, 16px margin from edges

### Integration Requirements

#### INT-1: Backend API Integration

**INT-1.1: Navigation API**
- Endpoint: `POST /api/v1/navigation/calculate-route`
- Request body: `{ origin: { latitude, longitude }, destination: { latitude, longitude }, waypoints?: [], mode: 'driving' }`
- Response: `{ route_id, distance_meters, duration_seconds, polyline, coordinates, steps, traffic_segments, health_warnings, map_markers }`
- Error handling: fallback to OSRM if 404/500/timeout

**INT-1.2: Tracking Session API**
- Start: `POST /api/v1/tracking/start-session`
- Sync: `POST /api/v1/tracking/sync-waypoints`
- Stop: `POST /api/v1/tracking/stop-session`
- All endpoints require `user_id` in request (from auth context)

**INT-1.3: History API**
- Endpoint: `GET /api/v1/tracking/daily-history?user_id={uid}&date={YYYY-MM-DD}`
- Response: `{ sessions[], combined_waypoints[], daily_stats }`
- Caching: cache response for 5 minutes to avoid redundant fetches

#### INT-2: Existing Systems Integration

**INT-2.1: Background Tracking Coexistence**
- Active tracking shall not interfere with existing passive background tracking
- Both systems shall use separate TaskManager task names
- Waypoint data formats shall be compatible (same type definitions)

**INT-2.2: Dashboard Integration**
- Add 2 new navigation cards to dashboard below existing 4 feature buttons
- Update `SemarangMapCard` with "Mulai Tracking" FAB button
- Maintain existing dashboard refresh/pull-to-reload functionality

**INT-2.3: Authentication Integration**
- Use existing `useAuth()` context for user_id retrieval
- Respect auth state (redirect to login if not authenticated)
- Include auth token in all API request headers

#### INT-3: Third-Party Services

**INT-3.1: Google Maps (react-native-maps)**
- Provider: `PROVIDER_GOOGLE` on Android, `PROVIDER_DEFAULT` on iOS
- API key configured in app.json
- Tile caching enabled by default

**INT-3.2: Geocoding (Optional)**
- Use expo-location's `reverseGeocodeAsync` for location names
- Fallback to zone_name from backend if geocoding fails
- Cache geocoded results to minimize API calls

---

## Constraints

### Technical Constraints

**TC-1: Platform Versions**
- Minimum Android SDK: 34 (Android 14)
- Minimum iOS version: 15.0
- React Native version: 0.86.3
- Expo SDK version: 57

**TC-2: Device Requirements**
- GPS capability required (cannot function on emulators without GPS simulation)
- Minimum 2GB RAM for smooth replay animation
- Minimum 100MB free storage for map tile caching

**TC-3: Library Compatibility**
- Must use react-native-maps v1.27.2 (already installed)
- Must maintain compatibility with expo-location v57
- Must not conflict with existing expo-task-manager usage

### Business Constraints

**BC-1: API Dependencies**
- Backend API development happens in parallel
- Frontend must handle API unavailability gracefully (mock data, fallbacks)
- Backend API rate limits TBD (frontend must implement request throttling)

**BC-2: Budget Constraints**
- No budget for paid mapping APIs (Google Maps Directions, TomTom Traffic) from frontend
- Backend handles all paid API calls and aggregates data
- Frontend uses free OSRM APIs only as fallback

**BC-3: Timeline Constraints**
- Feature delivery target: 3 weeks
- Backend API must be ready by end of Week 2 for integration testing
- Testing and polish in Week 3

### Design Constraints

**DC-1: Design System Adherence**
- Must follow AURA Design System colors, typography, spacing
- Must maintain visual consistency with existing screens
- Must not introduce new color palette or font families

**DC-2: Dashboard Layout**
- Cannot clutter dashboard with too many buttons
- Max 2 new navigation cards for this feature
- Must maintain existing dashboard scroll behavior

**DC-3: Accessibility Requirements**
- Must meet WCAG 2.1 Level AA standards
- Must support system font scaling
- Must support screen readers (VoiceOver, TalkBack)

---

## Risks & Mitigations

### Risk 1: Backend API Development Delays
**Impact**: High - Frontend cannot function fully without backend endpoints  
**Probability**: Medium  
**Mitigation**:
- Implement comprehensive mock API responses for all endpoints
- Use existing OSRM/TomTom APIs as fallback for routing
- Design graceful degradation (show route without health warnings if backend unavailable)
- Prioritize UI/UX development that doesn't depend on backend

### Risk 2: Battery Drain Exceeds Target
**Impact**: High - Users will disable feature or uninstall app  
**Probability**: Medium  
**Mitigation**:
- Extensive battery testing on real devices (Android & iOS, multiple models)
- Use `Location.Accuracy.Balanced` instead of `High` where GPS precision not critical
- Implement adaptive polling (reduce frequency when user stationary)
- Add "Battery Saver Mode" toggle in settings
- Monitor battery usage via Android Battery Historian and iOS Instruments

### Risk 3: GPS Inaccuracy Indoors/Urban Canyons
**Impact**: Medium - Waypoints may be incorrect in buildings or dense urban areas  
**Probability**: High  
**Mitigation**:
- Classify waypoints as indoor/outdoor based on movement patterns and GPS accuracy
- Use WiFi/cell tower triangulation when GPS accuracy > 50 meters
- Show accuracy indicator to user (icon with color: green < 20m, yellow < 50m, red > 50m)
- Filter out waypoints with accuracy > 100 meters from statistics calculation

### Risk 4: Animation Performance on Low-End Devices
**Impact**: Medium - Laggy animation hurts UX and user satisfaction  
**Probability**: Medium  
**Mitigation**:
- Test on low-end Android devices (Samsung Galaxy A12: 3GB RAM, Snapdragon 450)
- Reduce waypoint density for replay (interpolate if > 500 points to 250 points)
- Offer "Performance Mode" toggle that simplifies animation (linear interpolation, no easing)
- Use native driver for animations (set `useNativeDriver: true` in reanimated)

### Risk 5: User Privacy Concerns
**Impact**: High - Users may refuse location permissions or abandon feature  
**Probability**: Low (AURA users already opted into background tracking)  
**Mitigation**:
- Clear onboarding explaining data usage (health protection, not advertising/tracking)
- Emphasize data stays on user's device and AURA backend (not sold to third parties)
- Provide easy toggle to disable tracking anytime
- GDPR compliance: allow data export and deletion on request
- Show privacy policy link prominently

### Risk 6: Map Tile Loading Failures
**Impact**: Medium - Users see blank map or loading spinner indefinitely  
**Probability**: Low  
**Mitigation**:
- Implement tile loading timeout (10 seconds)
- Show error state with retry button if tiles fail to load
- Cache tiles aggressively (react-native-maps handles this automatically)
- Fallback to lower resolution tiles if high-res tiles unavailable

---

## Open Questions

### Q1: Destination Search Implementation
**Question**: Should we integrate Google Places Autocomplete API (paid) or build static POI list of Semarang landmarks?

**Options**:
1. Google Places Autocomplete API - Most accurate, but costs ~$2.83 per 1000 requests
2. Mapbox Search API - Cheaper alternative, $0.50 per 1000 requests
3. Static POI list - Free, but limited to predefined locations (~100 landmarks)
4. Hybrid: Static POI + manual address input (no autocomplete)

**Recommendation**: Start with static POI list (hospitals, malls, government buildings, universities) + manual address input. Add paid API in v2 if user feedback demands it.

**Decision Needed By**: Week 1 (affects UI design)

---

### Q2: Route Alternatives
**Question**: Should we show multiple route options (fastest, shortest, safest)?

**Options**:
1. Single route only (backend decides best route based on traffic + pollution)
2. Show 2-3 alternatives (user can tap to switch)

**Recommendation**: Single route for v1 (simplifies UI and backend logic). Add alternatives in v2 based on user requests.

**Decision Needed By**: Week 1 (affects API design)

---

### Q3: Voice Navigation
**Question**: Do we need turn-by-turn voice guidance?

**Options**:
1. Voice navigation with TTS (requires expo-speech or react-native-tts)
2. Visual-only navigation (user reads instruction cards)

**Recommendation**: Visual-only for v1 (voice is complex: multiple languages, background audio mixing). Add voice in v2 if highly requested.

**Decision Needed By**: Week 2 (affects scope)

---

### Q4: Journey Naming & Organization
**Question**: Should users be able to name journeys and organize them into categories (e.g., "Daily Commute", "Weekend Trip")?

**Options**:
1. No naming, journeys identified by date/time only
2. Optional naming (text input on stop tracking summary)
3. Full organization: naming + categories + favorites

**Recommendation**: Optional naming for v1 (simple text input, stored in backend). No categories yet (add in v2 if users request it).

**Decision Needed By**: Week 1 (affects stop tracking UI)

---

### Q5: Historical Data Retention
**Question**: How long should we keep waypoint history on device and backend?

**Options**:
1. Device: 7 days, Backend: 30 days
2. Device: 30 days, Backend: 90 days
3. Device: 30 days, Backend: unlimited (user can delete manually)

**Recommendation**: Device 30 days (auto-cleanup old data), Backend 90 days (cost-effective), user can request data export or deletion anytime (GDPR).

**Decision Needed By**: Week 1 (affects AsyncStorage cleanup logic)

---

### Q6: Notification for High-Risk Zones
**Question**: Should we send push notifications when user enters high-risk zones (even if not actively navigating)?

**Options**:
1. No notifications (user sees warnings only during active navigation)
2. Notifications enabled by default
3. Notifications opt-in (user enables in settings)

**Recommendation**: Opt-in notifications for v1 (avoid annoying users). Use existing background tracking to detect zone entry, send local notification if opted in.

**Decision Needed By**: Week 2 (affects background tracking logic)

---

## Dependencies

### Internal Dependencies

**ID-1: Existing Code**
- `src/services/backgroundMobilityTracker.ts` - Passive tracking continues to work, must not conflict
- `src/services/mobilityService.ts` - Extend for active tracking endpoints
- `src/services/locationService.ts` - GPS utilities (getCurrentGpsLocation, Haversine distance)
- `src/components/dashboard/SemarangMapCard.tsx` - Map styling reference
- `src/constants/aura-theme.ts` - AuraColors, typography constants
- `src/context/auth-context.tsx` - User authentication state

**ID-2: Backend API Endpoints**
Must be ready by end of Week 2:
- `POST /api/v1/navigation/calculate-route`
- `POST /api/v1/tracking/start-session`
- `POST /api/v1/tracking/sync-waypoints`
- `POST /api/v1/tracking/stop-session`
- `GET /api/v1/tracking/daily-history`

**ID-3: Design Assets**
- Icon set for 5 hazard categories (can use Ionicons initially)
- Mockups for navigation screen, tracking screen, history screen (optional, can design in code)

### External Dependencies

**ED-1: React Native Libraries**
- `react-native-maps` v1.27.2 (already installed)
- `react-native-reanimated` v4.5.1 (already installed)
- `expo-location` v57 (already installed)
- `expo-task-manager` v57 (already installed)
- `@react-native-async-storage/async-storage` v2.2.0 (already installed)

**ED-2: Third-Party Services**
- OpenStreetMap tiles (free, no API key needed)
- OSRM routing API (free, fallback for route calculation)
- TomTom Traffic API (called from backend, not directly from app)

**ED-3: Platform Services**
- Google Maps SDK (Android) - requires API key in app.json
- Apple Maps SDK (iOS) - no API key needed
- Geocoding services (expo-location) - free

---

## Glossary

**Active Tracking**: Manual journey recording mode where user explicitly starts and stops tracking (vs passive background tracking)

**AQI (Air Quality Index)**: Numerical scale 0-500 indicating pollution level (0-50 Good, 51-100 Moderate, 101-150 Unhealthy for Sensitive Groups, 151-200 Unhealthy, 201-300 Very Unhealthy, 301+ Hazardous)

**Health Warning**: Alert shown to user about environmental hazards (traffic, pollution, disease) along their route

**Hazard Category**: Classification of environmental risk (Heavy Traffic, Moderate Traffic, High Pollution, Disease Hotspot, Safe Zone)

**Journey**: Single trip from start to stop, recorded via active tracking

**PM2.5**: Fine particulate matter ≤ 2.5 micrometers, key air pollutant measured in µg/m³

**Polyline**: Encoded sequence of lat/lon coordinates representing a route path on map

**Replay**: Animated visualization of past journey showing movement through waypoints over time

**Turn-by-Turn**: Navigation instructions that update dynamically as user approaches each maneuver

**Waypoint**: GPS coordinate recorded at specific timestamp during tracking, includes lat, lon, accuracy, speed, heading

**Hybrid Smart Sync**: Strategy that saves data locally first, then syncs to backend periodically (balances data safety vs network efficiency)

**Maneuver**: Turn or direction change in navigation (e.g., turn-left, turn-right, straight, uturn)

**Rerouting**: Recalculating navigation route when user deviates from planned path

**Session**: Active tracking session with unique session_id, has start time, optional end time, and list of waypoints

**Exposure Stats**: Metrics quantifying user's pollution exposure (total outdoor time, average AQI, max AQI, worst area)

---

## Approval

**Requirements Review**: Pending

**Approved By**: (Pending)

**Approval Date**: (Pending)

**Next Steps**: 
1. Review requirements with stakeholders
2. Address open questions (Q1-Q6)
3. Proceed to Design phase → Create `design.md`
