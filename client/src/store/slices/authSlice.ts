// src/store/slices/authSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface AuthUser {
  id: string;
  email: string;
  role: 'super_admin' | 'manager' | 'coach' | 'student' | 'guardian' | 'employee' | 'operational_manager';
  firstName: string;
  lastName: string;
  phone?: string;
  avatar?: string;
  franchiseId?: string;
  academyId?: string;
  permissions: Record<string, boolean>;
}

export interface GeoRestrictionStatus {
  isRestricted: boolean;
  detectedCountry?: string;
  requiredCountry?: string;
  allowedCountryName?: string;
  detectedCountryName?: string;
  currency?: string;
  academyName?: string;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  geoRestriction: GeoRestrictionStatus | null;
}

const getStoredAuth = (): Pick<AuthState, 'accessToken' | 'refreshToken' | 'user' | 'geoRestriction'> => {
  try {
    const geo = sessionStorage.getItem('nox_geo_restriction_status');
    return {
      accessToken: localStorage.getItem('accessToken'),
      refreshToken: localStorage.getItem('refreshToken'),
      user: JSON.parse(localStorage.getItem('user') || 'null'),
      geoRestriction: geo ? JSON.parse(geo) : null,
    };
  } catch {
    return { accessToken: null, refreshToken: null, user: null, geoRestriction: null };
  }
};

const stored = getStoredAuth();

const initialState: AuthState = {
  user: stored.user,
  accessToken: stored.accessToken,
  refreshToken: stored.refreshToken,
  isAuthenticated: !!stored.accessToken,
  isLoading: false,
  geoRestriction: stored.geoRestriction,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials: (
      state,
      action: PayloadAction<{ user: AuthUser; tokens: { accessToken: string; refreshToken: string }; geoStatus?: GeoRestrictionStatus | null }>
    ) => {
      const { user, tokens, geoStatus } = action.payload;
      state.user = user;
      state.accessToken = tokens.accessToken;
      state.refreshToken = tokens.refreshToken;
      state.isAuthenticated = true;
      if (geoStatus !== undefined) {
        state.geoRestriction = geoStatus;
        if (geoStatus) {
          sessionStorage.setItem('nox_geo_restriction_status', JSON.stringify(geoStatus));
        } else {
          sessionStorage.removeItem('nox_geo_restriction_status');
        }
      }
      localStorage.setItem('accessToken', tokens.accessToken);
      localStorage.setItem('refreshToken', tokens.refreshToken);
      localStorage.setItem('user', JSON.stringify(user));
    },
    setGeoRestriction: (state, action: PayloadAction<GeoRestrictionStatus | null>) => {
      state.geoRestriction = action.payload;
      if (action.payload) {
        sessionStorage.setItem('nox_geo_restriction_status', JSON.stringify(action.payload));
      } else {
        sessionStorage.removeItem('nox_geo_restriction_status');
      }
    },
    clearCredentials: (state) => {
      state.user = null;
      state.accessToken = null;
      state.refreshToken = null;
      state.isAuthenticated = false;
      state.geoRestriction = null;
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      localStorage.removeItem('activeFranchiseId');
      try {
        sessionStorage.clear();
      } catch {}
    },
    updateAccessToken: (state, action: PayloadAction<string>) => {
      state.accessToken = action.payload;
      localStorage.setItem('accessToken', action.payload);
    },
    updateUser: (state, action: PayloadAction<Partial<AuthUser>>) => {
      if (state.user) {
        state.user = { ...state.user, ...action.payload };
        localStorage.setItem('user', JSON.stringify(state.user));
      }
    },
  },
});

export const { setCredentials, setGeoRestriction, clearCredentials, updateAccessToken, updateUser } = authSlice.actions;
export default authSlice.reducer;


