# Implementation Tasks: In-App Navigation & Daily Movement Tracking

## Task 1: Setup Navigation & Tracking State Management
**Status**: Ready
**Estimated Time**: 2 hours
**Priority**: Critical

### Subtasks:
- [ ] Create `/src/stores/navigationStore.ts` with Zustand state
- [ ] Create `/src/stores/trackingStore.ts` with Zustand state  
- [ ] Create `/src/types/navigation.ts` with TypeScript interfaces
- [ ] Create `/src/types/tracking.ts` with TypeScript interfaces
- [ ] Export from `/src/stores/index.ts` for easy imports

### Definition of Done:
- All store hooks can be imported and used
- Types compile without errors
- Store state updates trigger component re-renders

---

## Task 2: Create Navigation API Service
**Status**: Blocked by Task 1
**Estimated Time**: 1.5 hours
**Priority**: Critical
**Dependencies**: Task 1

### Subtasks:
- [ ] Create `/src/services/navigationService.ts`
- [ ] Implement `calculateRoute()` with backend fallback to OSRM
- [ ] Implement `startTrackingSession()`
- [ ] Implement `syncWaypoints()` with retry logic
- [ ] Implement `stopTrackingSession()`
- [ ] Implement `getDailyHistory()`
- [ ] Add request caching for routes

### Definition of Done:
- All API methods callable from any component
- Error handling with fallbacks working
- Mock responses available for offline testing

---

## Task 3: Build Universal Navigation Screen - Map & Route Display
**Status**: Blocked by Task 1,2
**Estimated Time**: 2.5 hours
**Priority**: High
**Dependencies**: Task 1, 2

### Subtasks:
- [ ] Create `/src/app/universal-navigation.tsx` screen
- [ ] Implement destination search input with autocomplete
- [ ] Render MapView with user location
- [ ] Fetch and display route polyline
- [ ] Add route info card (distance, duration, ETA)
- [ ] Implement "Calculate Route" button logic
- [ ] Add loading/error states

### Definition of Done:
- User can search destination and see route on map
- Route polyline renders correctly
- Info card shows accurate distance/duration
- No crashes on missing GPS data

---

## Task 4: Build Universal Navigation Screen - Turn-by-Turn & Health Warnings
**Status**: Blocked by Task 3
**Estimated Time**: 2 hours
**Priority**: High
**Dependencies**: Task 3

### Subtasks:
- [ ] Implement live GPS tracking during navigation
- [ ] Add turn-by-turn instruction card (top of screen)
- [ ] Implement maneuver detection (advance to next step)
- [ ] Add health warning alert cards (bottom of screen)
- [ ] Implement warning proximity detection
- [ ] Add warning detail modal (tap to see full info)
- [ ] Implement rerouting on user deviation

### Definition of Done:
- Turn instructions update as user moves
- Health warnings appear at correct locations
- Warnings auto-dismiss when user passes
- User can tap warning for details

---

## Task 5: Add Map Markers for Hazard Categories
**Status**: Blocked by Task 3
**Estimated Time**: 1.5 hours
**Priority**: Medium
**Dependencies**: Task 3

### Subtasks:
- [ ] Create custom marker component for each hazard category
- [ ] Render all markers from route response
- [ ] Implement marker tap handler (show callout)
- [ ] Add marker detail modal with health info
- [ ] Add "Hindari Area" button (recalculate route)
- [ ] Style markers matching Ionicons + colors

### Definition of Done:
- All 5 hazard categories visible on map
- Markers tappable and show info
- Icons clearly distinguish categories

---

## Task 6: Build Active Tracking Screen
**Status**: Blocked by Task 1,2
**Estimated Time**: 2 hours
**Priority**: High
**Dependencies**: Task 1, 2

### Subtasks:
- [ ] Create `/src/app/active-tracking.tsx` screen
- [ ] Implement "Start Tracking" button flow
- [ ] Request location permissions
- [ ] Create tracking session via API
- [ ] Start GPS location watching
- [ ] Draw polyline trail on map
- [ ] Display live stats (time, distance, speed, AQI)
- [ ] Implement "Stop Tracking" button
- [ ] Show tracking summary modal

### Definition of Done:
- User can start/stop tracking
- Live stats update every second
- Polyline trail follows movement
- Summary shows on stop with option to save

---

## Task 7: Implement Hybrid Smart Sync During Tracking
**Status**: Blocked by Task 6
**Estimated Time**: 1.5 hours
**Priority**: High
**Dependencies**: Task 6

### Subtasks:
- [ ] Store waypoints locally (AsyncStorage)
- [ ] Implement auto-sync every 10-15 waypoints
- [ ] Auto-sync on network reconnection
- [ ] Final sync with `is_final: true` on stop
- [ ] Add retry logic (max 3 attempts, exponential backoff)
- [ ] Show sync status indicator (syncing, synced, failed)
- [ ] Persist tracking state across app restarts

### Definition of Done:
- Waypoints sync reliably to backend
- Data survives app crash (stored locally)
- User sees sync status in UI
- Failed syncs retry automatically

---

## Task 8: Build Daily Journey History Screen - Basic View
**Status**: Blocked by Task 1,2
**Estimated Time**: 2 hours
**Priority**: High
**Dependencies**: Task 1, 2

### Subtasks:
- [ ] Create `/src/app/daily-journey.tsx` screen
- [ ] Implement date picker (calendar modal)
- [ ] Fetch daily history from API
- [ ] Display all waypoints on map (color-coded)
- [ ] Render connecting polyline
- [ ] Auto-fit map bounds to waypoints
- [ ] Show stats cards (outdoor time, AQI, etc.)
- [ ] Handle "No data" empty state

### Definition of Done:
- User can select date and view journeys
- Waypoints display correctly (indoor vs outdoor)
- Stats cards show accurate data
- Map bounds fit to waypoints

---

## Task 9: Build Daily Journey History Screen - Animated Replay
**Status**: Blocked by Task 8
**Estimated Time**: 2.5 hours
**Priority**: High
**Dependencies**: Task 8

### Subtasks:
- [ ] Implement animated marker movement through waypoints
- [ ] Add play/pause button and timeline slider
- [ ] Implement speed controls (0.5x, 1x, 2x, 5x)
- [ ] Use react-native-reanimated for smooth animation
- [ ] Add current waypoint info card (time, location, AQI)
- [ ] Implement scrubbing (pause animation when slider dragged)
- [ ] Handle animation completion (loop or reset)

### Definition of Done:
- Autoplay animation works smoothly at 60fps
- Timeline slider scrubs through waypoints
- Speed controls adjust animation rate
- Info card updates in real-time

---

## Task 10: Optimize Replay Performance
**Status**: Blocked by Task 9
**Estimated Time**: 1.5 hours
**Priority**: Medium
**Dependencies**: Task 9

### Subtasks:
- [ ] Add waypoint interpolation (reduce density if > 500 points)
- [ ] Test on low-end devices (2GB RAM)
- [ ] Profile animation performance (FPS counter)
- [ ] Implement "Performance Mode" toggle if needed
- [ ] Cache interpolated waypoints
- [ ] Optimize map rendering during animation

### Definition of Done:
- Animation maintains 60fps on low-end devices
- No noticeable lag or stutter
- Memory usage stays under 100MB

---

## Task 11: Integrate Navigation & Tracking into Dashboard
**Status**: Blocked by Task 3,6
**Estimated Time**: 1 hour
**Priority**: Medium
**Dependencies**: Task 3, 6

### Subtasks:
- [ ] Add "Tracking Harian" navigation card to dashboard
- [ ] Add "Navigasi" navigation card to dashboard
- [ ] Add "Mulai Tracking" FAB button to SemarangMapCard
- [ ] Update dashboard layout to accommodate new cards
- [ ] Maintain existing dashboard functionality

### Definition of Done:
- Dashboard shows 2 new navigation cards
- Cards navigate to correct screens
- FAB button triggers active tracking flow
- Dashboard still scrolls smoothly

---

## Task 12: Add Onboarding Tooltips
**Status**: Blocked by Task 8,9
**Estimated Time**: 1 hour
**Priority**: Low
**Dependencies**: Task 8, 9

### Subtasks:
- [ ] Implement tooltip component
- [ ] Add "Tap Play to replay your day" tooltip (journey history)
- [ ] Add "Enter destination for health warnings" tooltip (navigation)
- [ ] Store tooltip shown status (AsyncStorage)
- [ ] Show only once per user
- [ ] Auto-dismiss after 5 seconds

### Definition of Done:
- Tooltips appear on first-time use
- Only shown once
- Don't annoy returning users

---

## Task 13: Error Handling & Edge Cases
**Status**: Blocked by Task 4,6,9
**Estimated Time**: 1.5 hours
**Priority**: Medium
**Dependencies**: Task 4, 6, 9

### Subtasks:
- [ ] Handle GPS signal loss (fallback to last known position)
- [ ] Handle network unavailability (offline mode)
- [ ] Handle API timeouts (retry or show error)
- [ ] Handle invalid destinations (show error message)
- [ ] Handle app crash during tracking (resume state)
- [ ] Handle missing location permissions (show permission prompt)

### Definition of Done:
- No crashes in any error scenario
- User sees helpful error messages
- App recovers gracefully from errors

---

## Task 14: Testing & Bug Fixes
**Status**: Blocked by Task 13
**Estimated Time**: 2 hours
**Priority**: High
**Dependencies**: Task 13

### Subtasks:
- [ ] Test on Android device (real device, not emulator)
- [ ] Test on iOS device
- [ ] Test navigation with various routes
- [ ] Test tracking for 30 minutes (battery check)
- [ ] Test replay animation performance
- [ ] Test offline scenarios
- [ ] Fix any bugs found

### Definition of Done:
- All features work on real Android & iOS devices
- No crashes during extended testing
- Battery usage acceptable (< 2% per hour active tracking)

---

## Task 15: Polish & Final Integration
**Status**: Blocked by Task 14
**Estimated Time**: 1 hour
**Priority**: Medium
**Dependencies**: Task 14

### Subtasks:
- [ ] Add haptic feedback to buttons
- [ ] Add toast notifications for sync events
- [ ] Polish UI animations and transitions
- [ ] Add accessibility labels to all components
- [ ] Verify AURA Design System compliance
- [ ] Test on slow networks (3G simulation)

### Definition of Done:
- UI feels polished and responsive
- All interactions have feedback
- Accessibility compliant
- Smooth experience on slow networks

