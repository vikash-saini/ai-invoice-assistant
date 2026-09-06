const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export const apiService = {
    async getHealth() {
        const response = await fetch(`${API_BASE_URL}/health`);
        if (!response.ok) {
            throw new Error('Unable to connect Backend API');
        }
        return response.json();
    }
}