/**
 * Navigation Store - Zustand
 * Manages state for universal navigation feature
 */

import { create } from 'zustand';
import { NavigationRoute, HealthWarning, MapMarker, UserLocationDuringNavigation } from '@/types/navigation';

interface NavigationState {
  // State
  activeRoute: NavigationRoute | null;
  isNavigating: boolean;
  currentStepIndex: number;
  healthWarnings: HealthWarning[];
  mapMarkers: MapMarker[];
  userLocation: UserLocationDuringNavigation | null;
  totalDistance: number; // meters traveled so far
  totalDuration: number; // seconds elapsed so far

  // Actions
  setRoute: (route: NavigationRoute) => void;
  startNavigation: () => void;
  stopNavigation: () => void;
  updatePosition: (location: UserLocationDuringNavigation) => void;
  updateCurrentStep: (stepIndex: number) => void;
  updateWarnings: (warnings: HealthWarning[]) => void;
  clearRoute: () => void;
  reset: () => void;
}

const initialState = {
  activeRoute: null,
  isNavigating: false,
  currentStepIndex: 0,
  healthWarnings: [] as HealthWarning[],
  mapMarkers: [] as MapMarker[],
  userLocation: null,
  totalDistance: 0,
  totalDuration: 0,
};

export const useNavigationStore = create<NavigationState>((set) => ({
  ...initialState,

  setRoute: (route: NavigationRoute) =>
    set({
      activeRoute: route,
      mapMarkers: Array.isArray(route.map_markers) ? route.map_markers : [],
      healthWarnings: Array.isArray(route.health_warnings) ? route.health_warnings : [],
      currentStepIndex: 0,
      totalDistance: 0,
      totalDuration: 0,
    }),

  startNavigation: () =>
    set({
      isNavigating: true,
      totalDistance: 0,
      totalDuration: 0,
    }),

  stopNavigation: () =>
    set({
      isNavigating: false,
    }),

  updatePosition: (location: UserLocationDuringNavigation) =>
    set((state) => ({
      userLocation: location,
      totalDistance: state.activeRoute
        ? Math.min(state.totalDistance + 10, state.activeRoute.distance_meters)
        : state.totalDistance,
    })),

  updateCurrentStep: (stepIndex: number) =>
    set({
      currentStepIndex: stepIndex,
    }),

  updateWarnings: (warnings: HealthWarning[]) =>
    set({
      healthWarnings: warnings,
    }),

  clearRoute: () =>
    set({
      activeRoute: null,
      healthWarnings: [],
      mapMarkers: [],
      currentStepIndex: 0,
      isNavigating: false,
    }),

  reset: () => set(initialState),
}));
