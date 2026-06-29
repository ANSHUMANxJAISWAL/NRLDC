import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

const initialState = {
  user: null,
  token: localStorage.getItem('token'),
  isLoading: true,
  isAuthenticated: false,
};

const authReducer = (state, action) => {
  switch (action.type) {
    case 'LOAD_USER':
      return {
        ...state,
        user: action.payload.user,
        isAuthenticated: true,
        isLoading: false,
      };
    case 'LOGIN':
      localStorage.setItem('token', action.payload.token);
      return {
        ...state,
        token: action.payload.token,
        user: action.payload.user,
        isAuthenticated: true,
        isLoading: false,
      };
    case 'LOGOUT':
      localStorage.removeItem('token');
      return {
        ...state,
        token: null,
        user: null,
        isAuthenticated: false,
        isLoading: false,
      };
    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload,
      };
    default:
      return state;
  }
};

export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  const loadUser = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      dispatch({ type: 'LOGOUT' });
      return;
    }

    try {
      const data = await authAPI.getMe();
      dispatch({
        type: 'LOAD_USER',
        payload: { user: data.user, token },
      });
    } catch (err) {
      console.error('Failed to load user profile:', err);
      dispatch({ type: 'LOGOUT' });
    }
  };

  // Auto load user on mount
  useEffect(() => {
    loadUser();
  }, []);

  // Listen to global unauthorized (401) events from api.js
  useEffect(() => {
    const handleUnauthorized = () => {
      dispatch({ type: 'LOGOUT' });
    };

    window.addEventListener('auth-unauthorized', handleUnauthorized);
    return () => {
      window.removeEventListener('auth-unauthorized', handleUnauthorized);
    };
  }, []);

  const login = async (email, password) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const data = await authAPI.login(email, password);
      if (data.status === '2fa_required') {
        dispatch({ type: 'SET_LOADING', payload: false });
        return data;
      }
      dispatch({
        type: 'LOGIN',
        payload: { token: data.token, user: data.user },
      });
      return data;
    } catch (err) {
      dispatch({ type: 'SET_LOADING', payload: false });
      throw err;
    }
  };

  const logout = async () => {
    try {
      await authAPI.logout();
    } catch (err) {
      console.warn('Logout request to server failed, clearing local session anyway.', err);
    } finally {
      dispatch({ type: 'LOGOUT' });
    }
  };

  return (
    <AuthContext.Provider value={{ ...state, login, logout, loadUser, dispatch }}>
      {children}
    </AuthContext.Provider>
  );
};
