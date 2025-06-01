import axios from 'axios';

const API_URL = 'http://localhost:8000/api';

const api = axios.create({
    baseURL: API_URL,
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json'
    }
});

export default api;

export const register = async (userData) => {
    try {
        const response = await api.post('/accounts/register/', userData);
        return response.data;
    } catch (error) {
        throw new Error(error.response?.data?.detail || 'Registration failed');
    }
};

export const login = async (credentials) => {
    try {
        const response = await api.post('/accounts/login/', credentials);
        return response.data;
    } catch (error) {
        throw new Error(error.response?.data?.detail || 'Login failed');
    }
};